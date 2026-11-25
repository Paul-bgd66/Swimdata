'use client'

import { useState } from 'react'
import { useCoach } from '@/lib/coach-context'
import { getToken } from '@/lib/supabase'
import type { Nageur, HrvEntry, PoidsEntry, Perf, Groupe } from '@/lib/types'
import Anneau from '@/components/ui/Anneau'
import Tiroir from '@/components/ui/Tiroir'
import { serieRecup } from '@/lib/tendance'
import styles from './nageurs.module.css'

interface HrvRow  { nageur_nom: string; historique: HrvEntry[] }
interface PoidsRow { prenom: string; nom: string; entries: PoidsEntry[] }
interface PerfsRow { nageur_nom: string; performances: Perf[] }

const COULEUR_HEX: Record<string, string> = {
  rouge:  '#EF4444',
  orange: '#F59E0B',
  vert:   '#22C55E',
}

function initials(n: Nageur): string {
  return ((n.prenom[0] || '') + (n.nom[0] || '')).toUpperCase()
}

function avatarColor(n: Nageur, groupes: Groupe[], c1: string): string {
  const g = groupes.find(x => x.id === n.groupe_id)
  return g?.couleur || c1
}

export default function Nageurs() {
  const {
    club, coach, nageursFiltres, groupes, groupeActif, sousGroupeActif,
    colors, showToast, updateNageurGroupeId, updateNageur, removeNageur,
  } = useCoach()

  const racine    = groupes.filter(g => !g.parentId)
  const sousGrMap = groupes.reduce<Record<string, Groupe[]>>((acc, g) => {
    if (g.parentId) { acc[g.parentId] = acc[g.parentId] || []; acc[g.parentId].push(g) }
    return acc
  }, {})

  // ── Drawer ──
  const [selected,    setSelected]    = useState<Nageur | null>(null)
  const [tiroirOpen,  setTiroirOpen]  = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [hrv,         setHrv]         = useState<HrvEntry[] | null>(null)
  const [poids,       setPoids]       = useState<PoidsEntry[] | null>(null)
  const [perfs,       setPerfs]       = useState<Perf[] | null>(null)

  // ── Collapsible sections ──
  const [openHrv,   setOpenHrv]   = useState(false)
  const [openPoids, setOpenPoids] = useState(false)
  const [openPerfs, setOpenPerfs] = useState(false)

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
    setHrv(null); setPoids(null); setPerfs(null)
    setOpenHrv(false); setOpenPoids(false); setOpenPerfs(false)
    setEditOpen(false); setEditErr(''); setConfirmDel(false)
    setEditPrenom(n.prenom); setEditNom(n.nom)
    fetchData(n)
  }

  function closeDrawer() {
    setTiroirOpen(false)
    setTimeout(() => setSelected(null), 350)
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
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Erreur ' + res.status)
      setSwimFb({ ok: true, msg: `Invitation envoyée à ${swimEmail.trim()}` })
      setSwimFirst(''); setSwimLast(''); setSwimEmail('')
    } catch (err) {
      setSwimFb({ ok: false, msg: (err as Error).message })
    } finally {
      setSwimSend(false)
    }
  }

  // ── Récup ring for drawer ──
  const recupResult  = hrv ? serieRecup(hrv.map(h => ({ date: h.date, rmssd: h.rmssd, note: h.note }))) : null
  const recupCouleur = recupResult?.couleur ? COULEUR_HEX[recupResult.couleur] : undefined
  const recupValeur  = recupResult?.derniere ?? null

  // 7-day average récup
  const hrv7j   = hrv ? [...hrv].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7) : []
  const avg7j   = hrv7j.length
    ? Math.round(hrv7j.reduce((s, h) => {
        const v = h.note != null
          ? h.note
          : h.rmssd != null
          ? Math.round(Math.min(100, Math.max(0, (h.rmssd - 20) / 50 * 100)))
          : 0
        return s + v
      }, 0) / hrv7j.length)
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
            <div key={n.id} className={styles.card} onClick={() => openDrawer(n)}>
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
            </div>
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
          <button className={styles.inviteBtn} type="submit"
            disabled={swimSend || !swimEmail.trim()} style={{ background: colors.c1 }}>
            {swimSend ? '…' : 'Inviter'}
          </button>
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

            {/* Rings */}
            <div className={styles.drawerRings}>
              {loadingData ? (
                <span className={styles.loadingText}>Chargement…</span>
              ) : (
                <>
                  <div className={styles.ringCol}>
                    <Anneau valeur={null} label="Sommeil" taille="lg" />
                  </div>
                  <div className={styles.ringCol}>
                    <Anneau
                      valeur={recupValeur}
                      couleur={recupCouleur}
                      label="Récup"
                      taille="lg"
                    />
                    {avg7j != null && (
                      <span className={styles.ringAvg}>moy. 7j : {avg7j}</span>
                    )}
                  </div>
                  <div className={styles.ringCol}>
                    <Anneau valeur={null} label="Effort" taille="lg" />
                  </div>
                </>
              )}
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
                {hrv && hrv.length > 0 && <span className={styles.badge}>{hrv.length}</span>}
                <span className={styles.chevron}>{openHrv ? '▲' : '▼'}</span>
              </button>
              {openHrv && (
                <div className={styles.collBody}>
                  {!hrv || hrv.length === 0 ? (
                    <p className={styles.muted}>Aucune donnée</p>
                  ) : (
                    <table className={styles.table}>
                      <thead><tr><th>Date</th><th>RMSSD</th><th>Note</th></tr></thead>
                      <tbody>
                        {[...hrv].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((h, i) => (
                          <tr key={i}>
                            <td>{h.date.slice(0, 10)}</td>
                            <td>{h.rmssd ?? '—'}</td>
                            <td>{h.note  ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Poids */}
            <div className={styles.collapsible}>
              <button className={styles.collHdr} onClick={() => setOpenPoids(v => !v)}>
                <span>Poids</span>
                {poids && poids.length > 0 && <span className={styles.badge}>{poids.length}</span>}
                <span className={styles.chevron}>{openPoids ? '▲' : '▼'}</span>
              </button>
              {openPoids && (
                <div className={styles.collBody}>
                  {!poids || poids.length === 0 ? (
                    <p className={styles.muted}>Aucune donnée</p>
                  ) : (
                    <ul className={styles.poidsLst}>
                      {[...poids].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((p, i) => (
                        <li key={i} className={styles.poidsRow}>
                          <span>{p.date.slice(0, 10)}</span>
                          <span className={styles.poidsVal}>{p.weight} kg</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Perfs */}
            <div className={styles.collapsible}>
              <button className={styles.collHdr} onClick={() => setOpenPerfs(v => !v)}>
                <span>Performances</span>
                {perfs && perfs.length > 0 && <span className={styles.badge}>{perfs.length}</span>}
                <span className={styles.chevron}>{openPerfs ? '▲' : '▼'}</span>
              </button>
              {openPerfs && (
                <div className={styles.collBody}>
                  {!perfs || perfs.length === 0 ? (
                    <p className={styles.muted}>Aucune donnée</p>
                  ) : (
                    <ul className={styles.perfsList}>
                      {perfs.slice(0, 10).map((p, i) => (
                        <li key={i} className={styles.perfRow}>
                          <span className={styles.perfEvent}>{p.distance}m {p.nage} ({p.bassin}m)</span>
                          <span className={styles.perfTime}>{p.temps}</span>
                          <span className={styles.perfDate}>{p.date?.slice(0, 10)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Delete zone */}
            <div className={styles.deleteZone}>
              {confirmDel ? (
                <div className={styles.confirmBar}>
                  <p className={styles.confirmMsg}>
                    Supprimer {selected.prenom} {selected.nom} définitivement ?
                  </p>
                  <div className={styles.confirmBtns}>
                    <button className={styles.confirmCancel} onClick={() => setConfirmDel(false)}>
                      Annuler
                    </button>
                    <button className={styles.confirmDelete} onClick={handleDelete} disabled={deleting}>
                      {deleting ? '…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              ) : (
                <button className={styles.deleteBtn} onClick={() => setConfirmDel(true)}>
                  Supprimer ce nageur
                </button>
              )}
            </div>
          </div>
        )}
      </Tiroir>
    </div>
  )
}
