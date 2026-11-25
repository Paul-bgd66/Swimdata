'use client'

import { useState, useRef } from 'react'
import { useCoach } from '@/lib/coach-context'
import { getToken } from '@/lib/supabase'
import type { Nageur, HrvEntry, PoidsEntry, Perf, Groupe } from '@/lib/types'
import Anneau from '@/components/ui/Anneau'
import Tiroir from '@/components/ui/Tiroir'
import Carte from '@/components/ui/Carte'
import Bouton from '@/components/ui/Bouton'
import Modale from '@/components/ui/Modale'
import MiniGraphe from '@/components/ui/MiniGraphe'
import { todayLocal, addDays, formatFr } from '@/lib/dates'
import styles from './nageurs.module.css'

interface HrvRow  { nageur_nom: string; historique: HrvEntry[] }
interface PoidsRow { prenom: string; nom: string; entries: PoidsEntry[] }
interface PerfsRow { nageur_nom: string; performances: Perf[] }

function initials(n: Nageur): string {
  return ((n.prenom[0] || '') + (n.nom[0] || '')).toUpperCase()
}

function avatarColor(n: Nageur, groupes: Groupe[], c1: string): string {
  const g = groupes.find(x => x.id === n.groupe_id)
  return g?.couleur || c1
}

function eventKey(p: Perf): string   { return `${p.distance}-${p.nage}-${p.bassin}` }
function eventLabel(p: Perf): string { return `${p.distance}m ${p.nage} (${p.bassin}m)` }

function timeToSec(t: string): number {
  if (!t) return 9999
  const parts = t.split(':')
  return parts.length === 2 ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) : parseFloat(t)
}

function secsToLabel(s: number): string {
  const mins = Math.floor(s / 60)
  const rem  = (s % 60).toFixed(2).padStart(5, '0')
  return mins > 0 ? `${mins}:${rem}` : rem
}

function bestPerf(ps: Perf[]): Perf | null {
  return ps.reduce<Perf | null>((best, p) => {
    if (!p.temps) return best
    return !best || timeToSec(p.temps) < timeToSec(best.temps) ? p : best
  }, null)
}

function lastPerf(ps: Perf[]): Perf | null {
  return ps.reduce<Perf | null>((last, p) => {
    return !p.date ? last : (!last || p.date > last.date ? p : last)
  }, null)
}

function lastAtOrBefore<T extends { date: string }>(entries: T[], date: string): T | null {
  const filtered = entries.filter(e => e.date.slice(0, 10) <= date)
  if (!filtered.length) return null
  return [...filtered].sort((a, b) => b.date.localeCompare(a.date))[0]
}

function last30entries<T extends { date: string }>(entries: T[]): T[] {
  const cutoff = addDays(todayLocal(), -30)
  return entries
    .filter(e => e.date.slice(0, 10) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export default function Nageurs() {
  const {
    club, coach, nageursFiltres, groupes, groupeActif, sousGroupeActif,
    colors, showToast, updateNageurGroupeId, updateNageur, removeNageur, addNageur,
  } = useCoach()

  const racine    = groupes.filter(g => !g.parentId)
  const sousGrMap = groupes.reduce<Record<string, Groupe[]>>((acc, g) => {
    if (g.parentId) { acc[g.parentId] = acc[g.parentId] || []; acc[g.parentId].push(g) }
    return acc
  }, {})

  const dateInputRef = useRef<HTMLInputElement>(null)

  // ── Drawer ──
  const [selected,     setSelected]     = useState<Nageur | null>(null)
  const [tiroirOpen,   setTiroirOpen]   = useState(false)
  const [loadingData,  setLoadingData]  = useState(false)
  const [hrv,          setHrv]          = useState<HrvEntry[] | null>(null)
  const [poids,        setPoids]        = useState<PoidsEntry[] | null>(null)
  const [perfs,        setPerfs]        = useState<Perf[] | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // ── Collapsible sections ──
  const [openHrv,       setOpenHrv]       = useState(false)
  const [openPoids,     setOpenPoids]     = useState(false)
  const [openPerfs,     setOpenPerfs]     = useState(false)
  const [openPerfEvent, setOpenPerfEvent] = useState<string | null>(null)

  // ── Edit name ──
  const [editOpen,   setEditOpen]   = useState(false)
  const [editPrenom, setEditPrenom] = useState('')
  const [editNom,    setEditNom]    = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editErr,    setEditErr]    = useState('')

  // ── Delete confirm ──
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  // ── Invite form ──
  const [swimFirst, setSwimFirst] = useState('')
  const [swimLast,  setSwimLast]  = useState('')
  const [swimEmail, setSwimEmail] = useState('')
  const [swimSend,  setSwimSend]  = useState(false)
  const [swimFb,    setSwimFb]    = useState<{ ok: boolean; msg: string } | null>(null)

  function openDrawer(n: Nageur) {
    setSelected(n)
    setTiroirOpen(true)
    setSelectedDate(null)
    setHrv(null); setPoids(null); setPerfs(null)
    setOpenHrv(true); setOpenPoids(true); setOpenPerfs(true)
    setOpenPerfEvent(null)
    setEditOpen(false); setEditErr(''); setConfirmDel(false)
    setEditPrenom(n.prenom); setEditNom(n.nom)
    fetchData(n)
  }

  function closeDrawer() {
    setTiroirOpen(false)
    setTimeout(() => setSelected(null), 350)
  }

  function prevDay() {
    setSelectedDate(prev => prev === null ? todayLocal() : addDays(prev, -1))
  }

  function nextDay() {
    setSelectedDate(prev => {
      if (prev === null || prev >= todayLocal()) return prev
      return addDays(prev, 1)
    })
  }

  async function fetchData(n: Nageur) {
    if (!club || !coach) return
    setLoadingData(true)
    const name = `${n.prenom} ${n.nom}`
    const qs   = `clubId=${encodeURIComponent(club.id)}&coachId=${encodeURIComponent(coach.id)}`
    try {
      const [hRes, pRes, perfRes] = await Promise.all([
        fetch(`/api/hrv?${qs}`),
        fetch(`/api/poids?${qs}`),
        fetch(`/api/performances?${qs}`),
      ])
      if (hRes.ok) {
        const all = await hRes.json() as HrvRow[]
        setHrv(all.find(x => x.nageur_nom === name)?.historique ?? [])
      } else { setHrv([]) }
      if (pRes.ok) {
        const all = await pRes.json() as PoidsRow[]
        setPoids(all.find(x => `${x.prenom} ${x.nom}` === name)?.entries ?? [])
      } else { setPoids([]) }
      if (perfRes.ok) {
        const all = await perfRes.json() as PerfsRow[]
        setPerfs(all.find(x => x.nageur_nom === name)?.performances ?? [])
      } else { setPerfs([]) }
    } catch {
      setHrv([]); setPoids([]); setPerfs([])
    } finally {
      setLoadingData(false)
    }
  }

  async function handleGroupChange(nageurId: string, groupeId: string | null) {
    const n = nageursFiltres.find(x => x.id === nageurId) ?? selected
    if (!n) return
    const prev = n.groupe_id ?? null
    updateNageurGroupeId(nageurId, groupeId)
    if (selected?.id === nageurId) setSelected(s => s ? { ...s, groupe_id: groupeId } : s)
    try {
      const token = await getToken()
      const res = await fetch('/api/nageurs', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ id: nageurId, groupeId }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status)
      showToast(`✓ ${n.prenom} ${n.nom} → ${groupes.find(g => g.id === groupeId)?.nom ?? 'Sans groupe'}`)
    } catch (e) {
      updateNageurGroupeId(nageurId, prev)
      if (selected?.id === nageurId) setSelected(s => s ? { ...s, groupe_id: prev } : s)
      showToast('Erreur : ' + (e as Error).message)
    }
  }

  async function handleEditSave() {
    if (!selected || !editPrenom.trim() || !editNom.trim()) return
    setEditSaving(true); setEditErr('')
    try {
      const token = await getToken()
      const res = await fetch('/api/nageurs', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ id: selected.id, prenom: editPrenom.trim(), nom: editNom.trim() }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status)
      updateNageur(selected.id, { prenom: editPrenom.trim(), nom: editNom.trim() })
      setSelected(s => s ? { ...s, prenom: editPrenom.trim(), nom: editNom.trim() } : s)
      setEditOpen(false)
      showToast('✓ Modifié')
    } catch (e) {
      setEditErr((e as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/nageurs?id=${encodeURIComponent(selected.id)}`, {
        method:  'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Erreur ' + res.status)
      }
      removeNageur(selected.id)
      closeDrawer()
      showToast(`${selected.prenom} ${selected.nom} supprimé`)
    } catch (e) {
      showToast('Erreur : ' + (e as Error).message)
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  async function handleInviteSwimmer(e: React.FormEvent) {
    e.preventDefault()
    if (!swimEmail.trim() || !club || !coach) return
    setSwimSend(true); setSwimFb(null)
    try {
      const groupeId = sousGroupeActif?.id ?? groupeActif?.id ?? undefined
      const res = await fetch('/api/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:     swimEmail.trim(),
          role:      'swimmer',
          coachId:   coach.id,
          clubId:    club.id,
          firstName: swimFirst.trim(),
          lastName:  swimLast.trim(),
          groupeId,
        }),
      })
      const json = await res.json() as { error?: string; userId?: string }
      if (!res.ok) throw new Error(json.error || 'Erreur ' + res.status)
      if (json.userId) {
        addNageur({
          id:         json.userId,
          prenom:     swimFirst.trim(),
          nom:        swimLast.trim(),
          email:      swimEmail.trim(),
          groupe_id:  groupeId || null,
          created_at: new Date().toISOString(),
        })
      }
      setSwimFb({ ok: true, msg: `Invitation envoyée à ${swimEmail.trim()}` })
      setSwimFirst(''); setSwimLast(''); setSwimEmail('')
    } catch (err) {
      setSwimFb({ ok: false, msg: (err as Error).message })
    } finally {
      setSwimSend(false)
    }
  }

  // ── Computed data ──────────────────────────────────────────────────────────
  const isOverview = selectedDate === null

  // Last-known HRV/Poids at or before selectedDate (or most recent in overview)
  const lastHrvEntry = hrv
    ? isOverview
      ? ([...hrv].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null)
      : lastAtOrBefore(hrv, selectedDate!)
    : null

  const lastPoidsEntry = poids
    ? isOverview
      ? ([...poids].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null)
      : lastAtOrBefore(poids, selectedDate!)
    : null

  // Last 30 days for overview charts
  const hrv30   = hrv   ? last30entries(hrv.filter(h => h.rmssd != null)) : []
  const poids30 = poids ? last30entries(poids) : []

  // Overview: group perfs by event
  const perfEventMap: Map<string, Perf[]> | null = perfs ? (() => {
    const map = new Map<string, Perf[]>()
    perfs.filter(p => p.date && p.temps).forEach(p => {
      const k = eventKey(p)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(p)
    })
    return map
  })() : null

  // Day view: perfs on selected date
  const perfsOnDay = !isOverview && perfs
    ? perfs.filter(p => p.date?.slice(0, 10) === selectedDate)
    : []

  // Day view: best-at-or-before by event
  const perfsBefore: Map<string, Perf[]> | null = !isOverview && perfs && selectedDate
    ? (() => {
        const map = new Map<string, Perf[]>()
        perfs.filter(p => p.date && p.date.slice(0, 10) <= selectedDate!).forEach(p => {
          const k = eventKey(p)
          if (!map.has(k)) map.set(k, [])
          map.get(k)!.push(p)
        })
        return map
      })()
    : null

  return (
    <div className={styles.root}>
      {/* ── Swimmer grid ── */}
      {nageursFiltres.length === 0 ? (
        <p className={styles.muted}>
          {groupeActif ? 'Aucun nageur dans ce groupe.' : 'Aucun nageur.'}
        </p>
      ) : (
        <div className={styles.grid}>
          {nageursFiltres.map(n => (
            <Carte key={n.id} onClick={() => openDrawer(n)} className={styles.swimCard}>
              <div
                className={styles.cardAvatar}
                style={{ background: avatarColor(n, groupes, colors.c1) }}
              >
                {initials(n)}
              </div>
              <div className={styles.cardName}>{n.prenom} {n.nom}</div>
              <div className={styles.cardRings}>
                <Anneau valeur={null} label="Sommeil" taille="sm" />
                <Anneau valeur={null} label="Récup"   taille="sm" />
                <Anneau valeur={null} label="Effort"  taille="sm" />
              </div>
            </Carte>
          ))}
        </div>
      )}

      {/* ── Invite swimmer form ── */}
      <form className={styles.inviteForm} onSubmit={handleInviteSwimmer}>
        <p className={styles.inviteTitle}>
          Inviter un nageur
          {(sousGroupeActif ?? groupeActif) && (
            <span className={styles.inviteGroupe}>
              → {sousGroupeActif?.nom ?? groupeActif?.nom}
            </span>
          )}
        </p>
        <div className={styles.inviteRow}>
          <input className={styles.input} type="text" placeholder="Prénom" value={swimFirst}
            onChange={e => setSwimFirst(e.target.value)} disabled={swimSend} />
          <input className={styles.input} type="text" placeholder="Nom" value={swimLast}
            onChange={e => setSwimLast(e.target.value)} disabled={swimSend} />
        </div>
        <div className={styles.inviteRow}>
          <input className={styles.input} type="email" placeholder="Adresse e-mail" value={swimEmail}
            onChange={e => setSwimEmail(e.target.value)} required disabled={swimSend} />
          <Bouton variante="primary" couleur={colors.c1} type="submit"
            disabled={swimSend || !swimEmail.trim()}>
            {swimSend ? '…' : 'Inviter'}
          </Bouton>
        </div>
        {swimFb && <p className={swimFb.ok ? styles.ok : styles.err}>{swimFb.msg}</p>}
      </form>

      {/* ── Drawer ── */}
      <Tiroir open={tiroirOpen} onClose={closeDrawer}>
        {selected && (
          <div className={styles.drawerContent}>

            {/* Header */}
            <div className={styles.drawerHdr}>
              <div
                className={styles.drawerAvatar}
                style={{ background: avatarColor(selected, groupes, colors.c1) }}
              >
                {initials(selected)}
              </div>

              <div className={styles.drawerNameWrap}>
                {editOpen ? (
                  <>
                    <div className={styles.editRow}>
                      <input
                        className={styles.editInput}
                        value={editPrenom}
                        onChange={e => setEditPrenom(e.target.value)}
                        placeholder="Prénom"
                      />
                      <input
                        className={styles.editInput}
                        value={editNom}
                        onChange={e => setEditNom(e.target.value)}
                        placeholder="Nom"
                      />
                      <button className={styles.editSave} onClick={handleEditSave} disabled={editSaving}>✓</button>
                      <button className={styles.editCancel} onClick={() => { setEditOpen(false); setEditErr('') }}>✕</button>
                    </div>
                    {editErr && <p className={styles.err}>{editErr}</p>}
                  </>
                ) : (
                  <div className={styles.nameRow}>
                    <span className={styles.drawerName}>{selected.prenom} {selected.nom}</span>
                    <button className={styles.iconBtn} onClick={() => setEditOpen(true)} title="Modifier">✏️</button>
                  </div>
                )}
              </div>

              <button className={styles.closeBtn} onClick={closeDrawer}>✕</button>
            </div>

            {/* Date selector */}
            <div className={styles.dateSel}>
              <button className={styles.dateArrow} onClick={prevDay} title="Jour précédent">←</button>
              <button
                className={styles.dateLabel}
                onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                title="Choisir une date"
              >
                {isOverview ? "Vue d'ensemble" : formatFr(selectedDate)}
              </button>
              <button
                className={styles.dateArrow}
                onClick={nextDay}
                disabled={isOverview || selectedDate! >= todayLocal()}
                title="Jour suivant"
              >→</button>
              <input
                ref={dateInputRef}
                type="date"
                className={styles.dateHiddenInput}
                value={selectedDate ?? ''}
                max={todayLocal()}
                onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }}
              />
              {!isOverview && (
                <button className={styles.dateTodayBtn} onClick={() => setSelectedDate(null)}>
                  ← Vue d&apos;ensemble
                </button>
              )}
            </div>

            {/* Rings */}
            <div className={styles.drawerRings}>
              <div className={styles.ringCol}>
                <Anneau valeur={null} label="Sommeil" taille="lg" />
              </div>
              <div className={styles.ringCol}>
                <Anneau valeur={null} label="Récup" taille="lg" />
              </div>
              <div className={styles.ringCol}>
                <Anneau valeur={null} label="Effort" taille="lg" />
              </div>
            </div>

            {/* 7-day averages */}
            <div className={styles.avg7Row}>
              <div className={styles.avg7Item}>
                <span className={styles.avg7Label}>Sommeil 7j</span>
                <span className={styles.avg7Num}>—</span>
              </div>
              <div className={styles.avg7Item}>
                <span className={styles.avg7Label}>Récup 7j</span>
                <span className={styles.avg7Num}>—</span>
              </div>
              <div className={styles.avg7Item}>
                <span className={styles.avg7Label}>Effort 7j</span>
                <span className={styles.avg7Num}>—</span>
              </div>
            </div>

            {/* Group selector */}
            <div className={styles.drawerSection}>
              <label className={styles.sectionLabel}>Groupe</label>
              <select
                className={styles.groupSelect}
                value={selected.groupe_id ?? ''}
                onChange={e => handleGroupChange(selected.id, e.target.value || null)}
              >
                <option value="">— Sans groupe —</option>
                {racine.flatMap(r => [
                  <option key={r.id} value={r.id}>{r.nom}</option>,
                  ...(sousGrMap[r.id] || []).map(sg => (
                    <option key={sg.id} value={sg.id}>{`  ↳ ${sg.nom}`}</option>
                  )),
                ])}
              </select>
            </div>

            {/* HRV */}
            <div className={styles.collapsible}>
              <button className={styles.collHdr} onClick={() => setOpenHrv(v => !v)}>
                <span>HRV</span>
                {lastHrvEntry?.rmssd != null && (
                  <span className={styles.badge}>{lastHrvEntry.rmssd} ms</span>
                )}
                <span className={styles.chevron}>{openHrv ? '▲' : '▼'}</span>
              </button>
              {openHrv && (
                <div className={styles.collBody}>
                  {hrv === null ? (
                    <p className={styles.loadingText}>Chargement…</p>
                  ) : !lastHrvEntry ? (
                    <p className={styles.muted}>Aucune donnée</p>
                  ) : (
                    <>
                      <div className={styles.lastVal}>
                        <span className={styles.lastValNum}>
                          {lastHrvEntry.rmssd ?? '—'}
                          <span className={styles.lastValUnit}> ms RMSSD</span>
                        </span>
                        {!isOverview && lastHrvEntry.date.slice(0, 10) < selectedDate! && (
                          <button
                            className={styles.lastValDate}
                            onClick={() => setSelectedDate(lastHrvEntry!.date.slice(0, 10))}
                          >
                            mesuré le {formatFr(lastHrvEntry.date)}
                          </button>
                        )}
                      </div>
                      {isOverview && hrv30.length > 0 && (
                        <MiniGraphe
                          data={hrv30.map(h => ({ date: h.date, value: h.rmssd ?? 0 }))}
                          color={colors.c1}
                          onPointClick={d => setSelectedDate(d)}
                          height={110}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Poids */}
            <div className={styles.collapsible}>
              <button className={styles.collHdr} onClick={() => setOpenPoids(v => !v)}>
                <span>Poids</span>
                {lastPoidsEntry && (
                  <span className={styles.badge}>{lastPoidsEntry.weight} kg</span>
                )}
                <span className={styles.chevron}>{openPoids ? '▲' : '▼'}</span>
              </button>
              {openPoids && (
                <div className={styles.collBody}>
                  {poids === null ? (
                    <p className={styles.loadingText}>Chargement…</p>
                  ) : !lastPoidsEntry ? (
                    <p className={styles.muted}>Aucune donnée</p>
                  ) : (
                    <>
                      <div className={styles.lastVal}>
                        <span className={styles.lastValNum}>
                          {lastPoidsEntry.weight}
                          <span className={styles.lastValUnit}> kg</span>
                        </span>
                        {!isOverview && lastPoidsEntry.date.slice(0, 10) < selectedDate! && (
                          <button
                            className={styles.lastValDate}
                            onClick={() => setSelectedDate(lastPoidsEntry!.date.slice(0, 10))}
                          >
                            mesuré le {formatFr(lastPoidsEntry.date)}
                          </button>
                        )}
                      </div>
                      {isOverview && poids30.length > 0 && (
                        <MiniGraphe
                          data={poids30.map(p => ({ date: p.date, value: p.weight }))}
                          color={colors.c1}
                          formatY={v => v + ' kg'}
                          onPointClick={d => setSelectedDate(d)}
                          height={110}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Perfs */}
            <div className={styles.collapsible}>
              <button className={styles.collHdr} onClick={() => setOpenPerfs(v => !v)}>
                <span>Performances</span>
                {!isOverview && perfsOnDay.length > 0 && (
                  <span className={styles.badge}>{perfsOnDay.length}</span>
                )}
                <span className={styles.chevron}>{openPerfs ? '▲' : '▼'}</span>
              </button>
              {openPerfs && (
                <div className={styles.collBody}>
                  {perfs === null ? (
                    <p className={styles.loadingText}>Chargement…</p>
                  ) : isOverview ? (
                    // ── Overview: event list with best + last + expandable chart ──
                    !perfEventMap || perfEventMap.size === 0 ? (
                      <p className={styles.muted}>Aucune donnée</p>
                    ) : (
                      <ul className={styles.eventList}>
                        {Array.from(perfEventMap.entries()).map(([key, ps]) => {
                          const best  = bestPerf(ps)
                          const last  = lastPerf(ps)
                          const chart = ps
                            .filter(p => p.date && p.temps)
                            .map(p => ({ date: p.date.slice(0, 10), value: timeToSec(p.temps) }))
                            .sort((a, b) => a.date.localeCompare(b.date))
                          return (
                            <li key={key} className={styles.eventItem}>
                              <button
                                className={styles.eventHdr}
                                onClick={() => setOpenPerfEvent(v => v === key ? null : key)}
                              >
                                <span className={styles.eventName}>{eventLabel(ps[0])}</span>
                                <span className={styles.eventBest}>{best?.temps ?? '—'}</span>
                                {chart.length >= 2 && (
                                  <span className={styles.chevron}>{openPerfEvent === key ? '▲' : '▼'}</span>
                                )}
                              </button>
                              {last && last !== best && (
                                <div className={styles.eventLastRow}>
                                  <span className={styles.eventLastLabel}>Dernier</span>
                                  <span className={styles.eventLastTime}>{last.temps}</span>
                                  <span className={styles.eventLastDate}>{formatFr(last.date)}</span>
                                </div>
                              )}
                              {openPerfEvent === key && chart.length >= 2 && (
                                <MiniGraphe
                                  data={chart}
                                  color={colors.c1}
                                  invertY
                                  formatY={secsToLabel}
                                  onPointClick={d => setSelectedDate(d)}
                                  height={100}
                                />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )
                  ) : (
                    // ── Day view: today's perfs first, then best-at-or-before ──
                    !perfsBefore || perfsBefore.size === 0 ? (
                      <p className={styles.muted}>Aucune donnée</p>
                    ) : (
                      <ul className={styles.eventList}>
                        {/* Perfs done on this day */}
                        {perfsOnDay.map((p, i) => (
                          <li key={'d' + i} className={styles.eventItem}>
                            <div className={styles.eventHdr}>
                              <span className={styles.eventName}>{eventLabel(p)}</span>
                              <span className={styles.eventBest}>{p.temps}</span>
                            </div>
                          </li>
                        ))}
                        {/* Best-at-or-before for events NOT done today */}
                        {Array.from(perfsBefore.entries())
                          .filter(([key]) => !perfsOnDay.some(p => eventKey(p) === key))
                          .map(([key, ps]) => {
                            const best = bestPerf(ps)
                            if (!best) return null
                            return (
                              <li key={'b' + key} className={styles.eventItem}>
                                <div className={styles.eventHdr}>
                                  <span className={styles.eventName}>{eventLabel(best)}</span>
                                  <span className={styles.eventBest}>{best.temps}</span>
                                </div>
                                {best.date.slice(0, 10) < selectedDate! && (
                                  <button
                                    className={styles.lastValDate}
                                    onClick={() => setSelectedDate(best!.date.slice(0, 10))}
                                  >
                                    mesuré le {formatFr(best.date)}
                                  </button>
                                )}
                              </li>
                            )
                          })}
                      </ul>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Delete zone */}
            <div className={styles.deleteZone}>
              <Bouton variante="danger" onClick={() => setConfirmDel(true)} style={{ width: '100%' }}>
                Supprimer ce nageur
              </Bouton>
            </div>
          </div>
        )}
      </Tiroir>

      {/* ── Delete modal ── */}
      <Modale
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title={`Supprimer ${selected?.prenom ?? ''} ${selected?.nom ?? ''} ?`}
      >
        <p className={styles.modalMsg}>Cette action est irréversible.</p>
        <div className={styles.modalBtns}>
          <Bouton variante="outline" onClick={() => setConfirmDel(false)}>Annuler</Bouton>
          <Bouton variante="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '…' : 'Supprimer'}
          </Bouton>
        </div>
      </Modale>
    </div>
  )
}
