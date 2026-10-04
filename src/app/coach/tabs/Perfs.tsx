'use client'

import { useState, useEffect } from 'react'
import { useCoach } from '@/lib/coach-context'
import type { Perf, Nageur } from '@/lib/types'
import { parseTemps, seasonStart, fmtDate, todayStr } from '@/lib/helpers'
import styles from './perfs.module.css'

const EPREUVES_25 = [
  { nage: 'crawl',    distances: [50, 100, 200, 400, 800, 1500] },
  { nage: 'dos',      distances: [50, 100, 200] },
  { nage: 'brasse',   distances: [50, 100, 200] },
  { nage: 'papillon', distances: [50, 100, 200] },
  { nage: '4nages',   distances: [100, 200, 400] },
]
const EPREUVES_50 = [
  { nage: 'crawl',    distances: [50, 100, 200, 400, 800, 1500] },
  { nage: 'dos',      distances: [50, 100, 200] },
  { nage: 'brasse',   distances: [50, 100, 200] },
  { nage: 'papillon', distances: [50, 100, 200] },
  { nage: '4nages',   distances: [200, 400] },
]
const NAGE_LABELS: Record<string, string> = {
  crawl: 'Crawl', dos: 'Dos', brasse: 'Brasse', papillon: 'Papillon', '4nages': '4 Nages',
}

function nagNom(n: Nageur) { return (n.prenom + ' ' + n.nom).trim() }

function getBest(perfs: Perf[], bassin: 25 | 50, nage: string, distance: number) {
  const ss = seasonStart()
  const mine = perfs.filter(
    p => Number(p.bassin) === bassin && p.nage === nage && Number(p.distance) === distance
  )
  let pb: Perf | null = null
  let sb: Perf | null = null
  for (const p of mine) {
    const t = parseTemps(p.temps)
    if (t === Infinity) continue
    if (!pb || t < parseTemps(pb.temps)) pb = p
    if (p.date >= ss && (!sb || t < parseTemps(sb.temps))) sb = p
  }
  return { pb, sb }
}

interface HistModal { nom: string; nage: string; distance: number }
interface AddModal  { nageur: Nageur }
interface Confirm   { title: string; msg: string; onConfirm: () => void }

export default function Perfs() {
  const { club, coach, nageurs, colors, showToast } = useCoach()

  const [perfsMap,  setPerfsMap]  = useState<Record<string, Perf[]>>({})
  const [loading,   setLoading]   = useState(true)
  const [bassin,    setBassin]    = useState<25 | 50>(25)
  const [openId,    setOpenId]    = useState<string | null>(null)
  const [hist,      setHist]      = useState<HistModal | null>(null)
  const [addM,      setAddM]      = useState<AddModal | null>(null)
  const [confirm,   setConfirm]   = useState<Confirm | null>(null)

  // Add perf form state
  const [apEpreuve, setApEpreuve] = useState('crawl_50')
  const [apDate,    setApDate]    = useState('')
  const [apTemps,   setApTemps]   = useState('')
  const [apNote,    setApNote]    = useState('')
  const [apErr,     setApErr]     = useState('')
  const [apLoading, setApLoading] = useState(false)

  useEffect(() => {
    if (!club || !coach) return
    fetch(`/api/performances?clubId=${encodeURIComponent(club.id)}&coachId=${encodeURIComponent(coach.id)}`)
      .then(r => r.ok ? r.json() : [])
      .then((groups: { nageur_nom: string; performances: Perf[] }[]) => {
        if (!Array.isArray(groups)) return
        const map: Record<string, Perf[]> = {}
        groups.forEach(g => {
          map[g.nageur_nom.trim().toLowerCase()] = g.performances || []
        })
        setPerfsMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [club, coach])

  function getNageurPerfs(n: Nageur): Perf[] {
    return perfsMap[nagNom(n).toLowerCase()] ?? []
  }

  // ── History modal helpers ─────────────────────────────────────────────────

  const histNageur = hist
    ? nageurs.find(n => nagNom(n).toLowerCase() === hist.nom.toLowerCase()) ?? null
    : null
  const histPerfs = hist && histNageur
    ? getNageurPerfs(histNageur)
        .filter(p => Number(p.bassin) === bassin && p.nage === hist.nage && Number(p.distance) === hist.distance)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : []

  // ── Delete perf ───────────────────────────────────────────────────────────

  function handleDeletePerf(n: Nageur, p: Perf) {
    setConfirm({
      title: 'Supprimer cette performance ?',
      msg: `${p.temps} — ${fmtDate(p.date)}`,
      onConfirm: () => {
        const key = nagNom(n).toLowerCase()
        setPerfsMap(prev => ({
          ...prev,
          [key]: (prev[key] ?? []).filter(x =>
            !(Number(x.bassin) === Number(p.bassin) &&
              x.nage === p.nage &&
              Number(x.distance) === Number(p.distance) &&
              x.temps === p.temps &&
              x.date === p.date)
          ),
        }))
        setConfirm(null)
        if (!club || !coach) return
        const q = new URLSearchParams({
          clubId:    club.id,
          coachId:   coach.id,
          nageurNom: nagNom(n),
          bassin:    String(p.bassin),
          nage:      p.nage,
          distance:  String(p.distance),
          temps:     p.temps,
          date:      p.date,
        })
        fetch('/api/performances?' + q.toString(), { method: 'DELETE' })
          .catch(e => console.warn('[deletePerf]', (e as Error).message))
        showToast('Performance supprimée.')
      },
    })
  }

  // ── Add perf ──────────────────────────────────────────────────────────────

  function openAdd(nageur: Nageur) {
    const eps = bassin === 25 ? EPREUVES_25 : EPREUVES_50
    setApEpreuve(`${eps[0].nage}_${eps[0].distances[0]}`)
    setApDate(todayStr())
    setApTemps('')
    setApNote('')
    setApErr('')
    setApLoading(false)
    setAddM({ nageur })
  }

  async function submitAdd() {
    if (!addM || !club || !coach) return
    setApErr('')
    if (!apDate || !apTemps.trim()) { setApErr('Date et temps requis.'); return }
    if (parseTemps(apTemps) === Infinity) { setApErr('Format invalide (ex: 1:02.45 ou 31.20).'); return }
    const [nage, distStr] = apEpreuve.split('_')
    const distance = parseInt(distStr, 10)
    const nom = nagNom(addM.nageur)
    const key = nom.toLowerCase()
    setApLoading(true)
    try {
      const r = await fetch('/api/performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId:  club.id,
          coachId: coach.id,
          entries: [{ nageur_nom: nom, bassin, nage, distance, temps: apTemps.trim(), date: apDate, note: apNote }],
        }),
      })
      const data = await r.json() as { error?: string }
      if (!r.ok) throw new Error(data.error || 'Erreur serveur')
      const newPerf: Perf = { bassin, nage, distance, temps: apTemps.trim(), date: apDate, note: apNote }
      setPerfsMap(prev => ({ ...prev, [key]: (prev[key] ?? []).concat(newPerf) }))
      setAddM(null)
      showToast('Performance enregistrée ✓')
    } catch (e) {
      setApErr((e as Error).message)
    } finally {
      setApLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const eps = bassin === 25 ? EPREUVES_25 : EPREUVES_50

  return (
    <div className={styles.root}>
      {/* ── Bassin toggle ── */}
      <div className={styles.bassinToggle}>
        <button
          className={`${styles.bassinBtn} ${bassin === 25 ? styles.active : ''}`}
          onClick={() => setBassin(25)}
        >
          Bassin 25m
        </button>
        <button
          className={`${styles.bassinBtn} ${bassin === 50 ? styles.active : ''}`}
          onClick={() => setBassin(50)}
        >
          Bassin 50m
        </button>
      </div>

      {loading && <p className={styles.muted}>Chargement…</p>}
      {!loading && nageurs.length === 0 && <p className={styles.muted}>Aucun nageur enregistré.</p>}

      {/* ── Swimmer accordions ── */}
      {!loading && nageurs.map(n => {
        const nPerfs = getNageurPerfs(n)
        const isOpen = openId === n.id

        // Events that have at least one perf for current bassin, in canonical order
        const eventsWithPerf = eps.flatMap(e =>
          e.distances
            .filter(d => nPerfs.some(p => Number(p.bassin) === bassin && p.nage === e.nage && Number(p.distance) === d))
            .map(d => {
              const { pb, sb } = getBest(nPerfs, bassin, e.nage, d)
              return pb ? { nage: e.nage, distance: d, pb, sb } : null
            })
        ).filter(Boolean) as { nage: string; distance: number; pb: Perf; sb: Perf | null }[]

        return (
          <div key={n.id} className={styles.card}>
            <div className={styles.cardHdr} onClick={() => setOpenId(prev => prev === n.id ? null : n.id)}>
              <span className={styles.avatar} style={{ background: colors.c1 }}>
                {(n.prenom[0] || '').toUpperCase()}{(n.nom[0] || '').toUpperCase()}
              </span>
              <span className={styles.cardName}>{nagNom(n)}</span>
              <span className={styles.cardCount}>
                {eventsWithPerf.length} épreuve{eventsWithPerf.length !== 1 ? 's' : ''}
              </span>
              <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div className={styles.cardBody}>
                {eventsWithPerf.length === 0 ? (
                  <p className={styles.emptyPerf}>Aucune performance — ajoutez une épreuve</p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Épreuve</th>
                        <th className={`${styles.th} ${styles.thSb}`}>Season Best</th>
                        <th className={`${styles.th} ${styles.thPb}`}>Personal Best</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventsWithPerf.map(e => (
                        <tr
                          key={`${e.nage}_${e.distance}`}
                          className={styles.tr}
                          onClick={() => setHist({ nom: nagNom(n), nage: e.nage, distance: e.distance })}
                        >
                          <td className={styles.td}>{NAGE_LABELS[e.nage]} {e.distance}m</td>
                          <td className={`${styles.td} ${styles.tdSb}`}>{e.sb ? e.sb.temps : '—'}</td>
                          <td className={`${styles.td} ${styles.tdPb}`}>{e.pb.temps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <button className={styles.addPerfBtn} onClick={() => openAdd(n)}>
                  + Ajouter une performance
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* ── History modal ── */}
      {hist && (
        <div className={styles.modalBk} onClick={() => setHist(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHdr}>
              <span className={styles.modalTitle}>
                {NAGE_LABELS[hist.nage] || hist.nage} {hist.distance}m — {hist.nom}
              </span>
              <button className={styles.modalClose} onClick={() => setHist(null)}>✕</button>
            </div>
            {histPerfs.length === 0 ? (
              <p className={styles.muted}>Aucune performance enregistrée.</p>
            ) : (
              histPerfs.map((p, i) => (
                <div key={i} className={styles.histRow}>
                  <span className={styles.histDate}>{fmtDate(p.date)}</span>
                  <span className={styles.histTemps}>{p.temps}</span>
                  {histNageur && (
                    <button className={styles.histDel} onClick={() => handleDeletePerf(histNageur, p)}>✕</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Add perf modal ── */}
      {addM && (
        <div className={styles.modalBk} onClick={() => setAddM(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHdr}>
              <span className={styles.modalTitle}>Ajouter — {nagNom(addM.nageur)}</span>
              <button className={styles.modalClose} onClick={() => setAddM(null)}>✕</button>
            </div>

            <div className={styles.fLabel}>Épreuve</div>
            <select className={styles.fSelect} value={apEpreuve} onChange={e => setApEpreuve(e.target.value)}>
              {(bassin === 25 ? EPREUVES_25 : EPREUVES_50).flatMap(e =>
                e.distances.map(d => (
                  <option key={`${e.nage}_${d}`} value={`${e.nage}_${d}`}>
                    {NAGE_LABELS[e.nage]} {d}m
                  </option>
                ))
              )}
            </select>

            <div className={styles.fLabel}>Date</div>
            <input
              type="date"
              className={styles.fInput}
              value={apDate}
              onChange={e => setApDate(e.target.value)}
            />

            <div className={styles.fLabel}>Temps</div>
            <input
              type="text"
              className={styles.fInput}
              placeholder="ex: 1:02.45 ou 31.20"
              inputMode="decimal"
              value={apTemps}
              onChange={e => setApTemps(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAdd()}
            />

            <div className={styles.fLabel}>Note (optionnel)</div>
            <input
              type="text"
              className={styles.fInput}
              placeholder="Ex: Championnat régional"
              value={apNote}
              onChange={e => setApNote(e.target.value)}
            />

            {apErr && <p className={styles.fErr}>{apErr}</p>}

            <button
              className={styles.submitBtn}
              style={{ background: colors.c1 }}
              onClick={submitAdd}
              disabled={apLoading}
            >
              {apLoading ? 'ENREGISTREMENT…' : 'ENREGISTRER'}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirm && (
        <div className={styles.confirmOverlay} onClick={() => setConfirm(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>{confirm.title}</div>
            <div className={styles.confirmMsg}>{confirm.msg}</div>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>Annuler</button>
              <button className={styles.confirmDelete} onClick={confirm.onConfirm}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
