'use client'

import { useState } from 'react'
import styles from './performances.module.css'
import { parseTemps, seasonStart, fmtDate, todayStr } from '../lib/helpers'
import type { Perf, SwimmerMeta } from '../lib/types'

// ── Constants ────────────────────────────────────────────────────────────────

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
  crawl: 'Crawl',
  dos: 'Dos',
  brasse: 'Brasse',
  papillon: 'Papillon',
  '4nages': '4 Nages',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface HistModalState {
  nage: string
  distance: number
}

interface AddModalOpen {
  bassin: 25 | 50
}

interface ConfirmState {
  title: string
  message: string
  onConfirm: () => void
}

interface Props {
  perfs: Perf[]
  swimmerNom: string
  meta: SwimmerMeta
  onPerfsChange: (perfs: Perf[]) => void
  showToast: (msg: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Performances({ perfs, swimmerNom, meta, onPerfsChange, showToast }: Props) {
  const [bassin, setBassinState] = useState<25 | 50>(25)
  const [histModal, setHistModal] = useState<HistModalState | null>(null)
  const [addModal, setAddModal] = useState<AddModalOpen | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  // Add perf form state
  const [apBassin, setApBassin] = useState<25 | 50>(25)
  const [apEpreuve, setApEpreuve] = useState('crawl_50')
  const [apDate, setApDate] = useState(todayStr)
  const [apTemps, setApTemps] = useState('')
  const [apErr, setApErr] = useState('')
  const [apLoading, setApLoading] = useState(false)

  // ── Bassin toggle ──────────────────────────────────────────────────────────

  function handleSetBassin(b: 25 | 50) {
    setBassinState(b)
  }

  // ── Perf list computation ──────────────────────────────────────────────────

  const eps = bassin === 25 ? EPREUVES_25 : EPREUVES_50
  const ss = seasonStart()

  function getBestPerfs(nage: string, distance: number) {
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

  // ── History modal ──────────────────────────────────────────────────────────

  function openHistModal(nage: string, distance: number) {
    setHistModal({ nage, distance })
  }

  function closeHistModal() {
    setHistModal(null)
  }

  function handleDeletePerf(p: Perf) {
    setConfirm({
      title: 'Supprimer cette performance ?',
      message: `${p.temps} — ${fmtDate(p.date)}`,
      onConfirm: () => {
        const next = perfs.filter(
          x =>
            !(
              Number(x.bassin) === Number(p.bassin) &&
              x.nage === p.nage &&
              Number(x.distance) === Number(p.distance) &&
              x.temps === p.temps &&
              x.date === p.date
            )
        )
        onPerfsChange(next)
        setConfirm(null)
        const q = new URLSearchParams({
          clubId:    meta.clubId    ?? '',
          coachId:   meta.coachId   ?? '',
          nageurNom: swimmerNom,
          bassin:    String(p.bassin),
          nage:      p.nage,
          distance:  String(p.distance),
          temps:     p.temps,
          date:      p.date,
        })
        fetch('/api/performances?' + q.toString(), { method: 'DELETE' })
          .then(r => { if (!r.ok) console.warn('[deletePerf] server', r.status) })
          .catch(e => console.warn('[deletePerf]', (e as Error).message))
      },
    })
  }

  // ── Add perf modal ─────────────────────────────────────────────────────────

  function openAddModal() {
    setApBassin(bassin)
    setApEpreuve(bassin === 25 ? 'crawl_50' : 'crawl_50')
    setApDate(todayStr())
    setApTemps('')
    setApErr('')
    setApLoading(false)
    setAddModal({ bassin })
  }

  function closeAddModal() {
    setAddModal(null)
  }

  function getEpOptions(b: 25 | 50) {
    const list = b === 25 ? EPREUVES_25 : EPREUVES_50
    return list.flatMap(e => e.distances.map(d => ({ value: `${e.nage}_${d}`, label: `${NAGE_LABELS[e.nage]} ${d}m` })))
  }

  async function submitAddPerf() {
    setApErr('')
    if (!apDate || !apTemps) { setApErr('Date et temps requis.'); return }
    if (parseTemps(apTemps) === Infinity) { setApErr('Format de temps invalide (ex: 1:02.45).'); return }
    const [nage, distStr] = apEpreuve.split('_')
    const distance = parseInt(distStr, 10)
    setApLoading(true)
    try {
      const r = await fetch('/api/performances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId:  meta.clubId,
          coachId: meta.coachId,
          entries: [{ nageur_nom: swimmerNom, bassin: apBassin, nage, distance, temps: apTemps, date: apDate, note: '' }],
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erreur serveur')
      const newPerf: Perf = { bassin: apBassin, nage, distance, temps: apTemps, date: apDate, note: '' }
      onPerfsChange([...perfs, newPerf])
      closeAddModal()
      showToast('Performance enregistrée ✓')
    } catch (e) {
      setApErr((e as Error).message)
    } finally {
      setApLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const histPerfs = histModal
    ? perfs
        .filter(
          p =>
            Number(p.bassin) === bassin &&
            p.nage === histModal.nage &&
            Number(p.distance) === histModal.distance
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : []

  return (
    <>
      {/* ── Bassin toggle ── */}
      <div className={styles.bassinToggle}>
        <button
          className={`${styles.bassinBtn} ${bassin === 25 ? styles.active : ''}`}
          onClick={() => handleSetBassin(25)}
        >
          BASSIN 25M
        </button>
        <button
          className={`${styles.bassinBtn} ${bassin === 50 ? styles.active : ''}`}
          onClick={() => handleSetBassin(50)}
        >
          BASSIN 50M
        </button>
      </div>

      {/* ── Perf list ── */}
      <div className={styles.card}>
        {eps.map(e =>
          e.distances.map(d => {
            const { pb, sb } = getBestPerfs(e.nage, d)
            return (
              <div
                key={`${e.nage}_${d}`}
                className={styles.perfRow}
                onClick={() => openHistModal(e.nage, d)}
              >
                <div className={styles.perfEp}>{NAGE_LABELS[e.nage]} {d}m</div>
                <div className={styles.perfTime}>
                  <span className={styles.tag}>SB</span>
                  {sb ? sb.temps : '—'}
                </div>
                <div className={`${styles.perfTime} ${styles.perfTimePb}`}>
                  <span className={styles.tag}>PB</span>
                  {pb ? pb.temps : '—'}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Add button ── */}
      <button className={styles.addBtn} onClick={openAddModal}>
        + AJOUTER UNE PERF
      </button>

      {/* ── History modal ── */}
      {histModal && (
        <div className={styles.modalBk} onClick={closeHistModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              {NAGE_LABELS[histModal.nage] || histModal.nage} {histModal.distance}m
            </div>
            {histPerfs.length === 0 ? (
              <div className={styles.empty}>Aucune performance enregistrée.</div>
            ) : (
              histPerfs.map((p, i) => (
                <div key={i} className={styles.histRow}>
                  <div className={styles.histDate}>{fmtDate(p.date)}</div>
                  <div className={styles.histTemps}>{p.temps}</div>
                  <button
                    className={styles.histDelBtn}
                    title="Supprimer"
                    onClick={() => handleDeletePerf(p)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Add perf modal ── */}
      {addModal && (
        <div className={styles.modalBk} onClick={closeAddModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Ajouter une performance</div>

            <div className={styles.fLabel}>Bassin</div>
            <select
              className={styles.fSelect}
              value={apBassin}
              onChange={e => {
                const b = parseInt(e.target.value, 10) as 25 | 50
                setApBassin(b)
                setApEpreuve(getEpOptions(b)[0]?.value ?? 'crawl_50')
              }}
            >
              <option value="25">25 m</option>
              <option value="50">50 m</option>
            </select>

            <div className={styles.fLabel}>Épreuve</div>
            <select
              className={styles.fSelect}
              value={apEpreuve}
              onChange={e => setApEpreuve(e.target.value)}
            >
              {getEpOptions(apBassin).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
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
              onKeyDown={e => e.key === 'Enter' && submitAddPerf()}
            />

            {apErr && <div className={styles.fErr}>{apErr}</div>}

            <button
              className={styles.submitBtn}
              onClick={submitAddPerf}
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
            <div className={styles.confirmMsg}>{confirm.message}</div>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>
                Annuler
              </button>
              <button className={styles.confirmDelete} onClick={confirm.onConfirm}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
