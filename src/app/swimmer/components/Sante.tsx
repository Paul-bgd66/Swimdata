'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './sante.module.css'
import { fmtDate, todayStr } from '../lib/helpers'
import type { HrvEntry, PoidsEntry, SwimmerMeta } from '../lib/types'

// ── Mini chart — Chart.js chargé dynamiquement (safe SSR) ────────────────────

interface MiniChartProps {
  data:  { date: string; value: number }[]
  color: string
}

function MiniChart({ data, color }: MiniChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const el = canvasRef.current
    let destroyed = false

    ;(async () => {
      const { Chart } = await import('chart.js/auto')
      if (destroyed || !el) return
      if (chartRef.current) chartRef.current.destroy()

      const cs     = getComputedStyle(el)
      const muted  = cs.getPropertyValue('--muted').trim()  || '#6b7a93'
      const border = cs.getPropertyValue('--border').trim() || '#e3e8f0'

      chartRef.current = new Chart(el, {
        type: 'line',
        data: {
          labels:   data.map(e => e.date.slice(5)),
          datasets: [{
            data:            data.map(e => e.value),
            borderColor:     color,
            backgroundColor: color + '22',
            tension:         0.3,
            pointRadius:     3,
            fill:            false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: muted,  font: { size: 10 } }, grid: { display: false } },
            y: { ticks: { color: muted,  font: { size: 10 } }, grid: { color: border } },
          },
        },
      })
    })()

    return () => {
      destroyed = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [data, color])

  return <div className={styles.chartWrap}><canvas ref={canvasRef} /></div>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function last30<T extends { date: string }>(arr: T[], key: keyof T): T[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cs = cutoff.toISOString().slice(0, 10)
  return arr.filter(e => e.date >= cs && e[key] != null)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ConfirmState {
  title:     string
  message:   string
  onConfirm: () => void
}

interface Props {
  hrv:           HrvEntry[]
  poids:         PoidsEntry[]
  swimmerNom:    string
  meta:          SwimmerMeta
  onHrvChange:   (h: HrvEntry[])   => void
  onPoidsChange: (p: PoidsEntry[]) => void
  showToast:     (msg: string)     => void
  colors:        { c1: string; c2: string }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sante({
  hrv, poids, swimmerNom, meta,
  onHrvChange, onPoidsChange, showToast, colors,
}: Props) {

  const [hrvDate,    setHrvDate]    = useState(todayStr)
  const [manualVal,  setManualVal]  = useState('')
  const [hrvMsg,     setHrvMsg]     = useState<{ text: string; type: 'ok' | 'err' | 'mute' } | null>(null)
  const [hrvLoading, setHrvLoading] = useState(false)
  const [drag,       setDrag]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [poidsDate,    setPoidsDate]    = useState(todayStr)
  const [poidsVal,     setPoidsVal]     = useState('')
  const [poidsMsg,     setPoidsMsg]     = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const [poidsLoading, setPoidsLoading] = useState(false)

  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  // ── RR file → RMSSD ───────────────────────────────────────────────────────

  async function processRRFile(file: File) {
    if (!hrvDate) { setHrvMsg({ text: 'Sélectionne une date.', type: 'err' }); return }
    setHrvMsg({ text: 'Analyse en cours…', type: 'mute' })
    try {
      const text  = await file.text()
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      const rr: number[] = []
      lines.forEach(line => {
        const clean = line.trim().replace(',', '.')
        if (!clean) return
        const v = parseFloat(clean)
        if (!isNaN(v) && v >= 300 && v <= 2000) rr.push(v)
      })
      if (rr.length < 50) {
        setHrvMsg({ text: `⚠️ Fichier insuffisant — ${rr.length} intervalles (minimum 50).`, type: 'err' })
        return
      }
      const diffs = rr.slice(1).map((v, i) => v - rr[i])
      const rmssd = Math.round(
        Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / diffs.length) * 10
      ) / 10
      await persistHrv(rmssd, 'rr')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setHrvMsg({ text: `RMSSD ${rmssd} ms enregistré ✓`, type: 'ok' })
    } catch (e) {
      setHrvMsg({ text: (e as Error).message, type: 'err' })
    }
  }

  // ── Shared HRV save — upsert par date ────────────────────────────────────

  async function persistHrv(rmssd: number, source: string) {
    setHrvLoading(true)
    try {
      const r = await fetch('/api/hrv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: meta.clubId, coachId: meta.coachId,
          entries: [{ nageur_nom: swimmerNom, date: hrvDate, rmssd, source, commentaire: '' }],
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erreur serveur')
      // Upsert local — même logique que swimmer.html
      const next = hrv.filter(h => h.date !== hrvDate)
      next.push({ date: hrvDate, rmssd, note: null, source })
      next.sort((a, b) => a.date < b.date ? -1 : 1)
      onHrvChange(next)
    } finally {
      setHrvLoading(false)
    }
  }

  async function submitManual() {
    const val = parseFloat(manualVal)
    if (!hrvDate || !val || val <= 0) {
      setHrvMsg({ text: 'Date et valeur RMSSD requises.', type: 'err' }); return
    }
    setHrvMsg(null)
    try {
      await persistHrv(val, 'manual')
      setManualVal('')
      setHrvMsg({ text: 'Mesure enregistrée ✓', type: 'ok' })
    } catch (e) {
      setHrvMsg({ text: (e as Error).message, type: 'err' })
    }
  }

  // ── Delete — mesure individuelle uniquement, jamais le nageur entier ──────

  function handleDeleteHrv(entry: HrvEntry) {
    setConfirm({
      title:   'Supprimer cette mesure ?',
      message: `${entry.rmssd} ms — ${fmtDate(entry.date)}`,
      onConfirm: () => {
        onHrvChange(hrv.filter(h => h.date !== entry.date))
        setConfirm(null)
        const q = new URLSearchParams({
          clubId:    meta.clubId    ?? '',
          coachId:   meta.coachId   ?? '',
          nageurNom: swimmerNom,
          date:      entry.date,
        })
        fetch('/api/hrv?' + q.toString(), { method: 'DELETE' })
          .then(r => { if (!r.ok) console.warn('[deleteHrv] server', r.status) })
          .catch(e => console.warn('[deleteHrv]', (e as Error).message))
      },
    })
  }

  // ── Poids ─────────────────────────────────────────────────────────────────

  async function submitPoids() {
    const val = parseFloat(poidsVal)
    if (!poidsDate || !val || val <= 0) {
      setPoidsMsg({ text: 'Date et poids requis.', type: 'err' }); return
    }
    setPoidsLoading(true); setPoidsMsg(null)
    try {
      const r = await fetch('/api/poids', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: meta.clubId, coachId: meta.coachId,
          entries: [{
            prenom: meta.firstName ?? '', nom: meta.lastName ?? '',
            date: poidsDate, weight: val,
          }],
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erreur serveur')
      const next = poids.filter(p => p.date !== poidsDate)
      next.push({ date: poidsDate, weight: val })
      next.sort((a, b) => a.date < b.date ? -1 : 1)
      onPoidsChange(next)
      setPoidsVal('')
      setPoidsMsg({ text: 'Mesure enregistrée ✓', type: 'ok' })
    } catch (e) {
      setPoidsMsg({ text: (e as Error).message, type: 'err' })
    } finally {
      setPoidsLoading(false)
    }
  }

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const hrvChartData   = last30(hrv, 'rmssd').map(e => ({ date: e.date, value: e.rmssd! }))
  const poidsChartData = last30(poids, 'weight').map(e => ({ date: e.date, value: e.weight }))
  const sortedHrv      = [...hrv].sort((a, b) => a.date > b.date ? -1 : 1)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── HRV card ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>HRV — importer depuis EliteHRV</div>

        <div className={styles.fLabel}>Date</div>
        <input
          type="date" className={styles.fInput}
          value={hrvDate} onChange={e => setHrvDate(e.target.value)}
        />

        {/* Drop / click zone */}
        <div
          className={`${styles.uploadZone} ${drag ? styles.drag : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault(); setDrag(false)
            const f = e.dataTransfer.files[0]
            if (f) processRRFile(f)
          }}
        >
          <div className={styles.uploadIcon}>📂</div>
          <div className={styles.uploadTitle}>Importer un fichier RR</div>
          <div className={styles.uploadSub}>Glisse ou clique — format .txt EliteHRV</div>
        </div>
        <input
          ref={fileInputRef} type="file" accept=".txt,.csv" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processRRFile(f) }}
        />

        {hrvMsg && (
          <div className={`${styles.msg} ${styles[hrvMsg.type]}`}>{hrvMsg.text}</div>
        )}

        {/* Saisie manuelle — option secondaire */}
        <details className={styles.details}>
          <summary className={styles.summary}>Saisie manuelle (sans export)</summary>
          <div className={styles.detailsBody}>
            <div className={styles.fLabel}>RMSSD (ms)</div>
            <input
              type="number" className={styles.fInput}
              placeholder="ex: 65" inputMode="decimal"
              value={manualVal} onChange={e => setManualVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitManual()}
            />
            <button
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnBlock}`}
              onClick={submitManual} disabled={hrvLoading}
              style={{ marginTop: 4 }}
            >
              ENREGISTRER
            </button>
          </div>
        </details>

        <MiniChart data={hrvChartData} color={colors.c1} />

        {/* Historique avec × par mesure */}
        {sortedHrv.length > 0 && (
          <details className={styles.details} style={{ marginTop: 16 }}>
            <summary className={styles.summary}>
              Historique ({hrv.length} mesure{hrv.length > 1 ? 's' : ''})
            </summary>
            <div>
              {sortedHrv.map(h => (
                <div key={h.date} className={styles.histRow}>
                  <span className={styles.histDate}>{fmtDate(h.date)}</span>
                  <span className={styles.histVal}>{h.rmssd} ms</span>
                  {h.source && <span className={styles.histSource}>{h.source}</span>}
                  <button
                    className={styles.histDelBtn} title="Supprimer"
                    onClick={() => handleDeleteHrv(h)}
                  >×</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Poids card ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Poids — ajouter une mesure</div>
        <div className={styles.setRow}>
          <div>
            <div className={styles.fLabel}>Date</div>
            <input
              type="date" className={styles.fInput}
              value={poidsDate} onChange={e => setPoidsDate(e.target.value)}
            />
          </div>
          <div>
            <div className={styles.fLabel}>Poids (kg)</div>
            <input
              type="number" className={styles.fInput}
              placeholder="ex: 72.4" inputMode="decimal" step="0.1"
              value={poidsVal} onChange={e => setPoidsVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitPoids()}
            />
          </div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
          onClick={submitPoids} disabled={poidsLoading}
          style={{ marginTop: 8 }}
        >
          {poidsLoading ? 'ENREGISTREMENT…' : 'ENREGISTRER'}
        </button>
        {poidsMsg && (
          <div className={`${styles.msg} ${styles[poidsMsg.type]}`}>{poidsMsg.text}</div>
        )}
        <MiniChart data={poidsChartData} color={colors.c2} />
      </div>

      {/* ── Wearables card ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Connecter mes appareils</div>
        <div className={styles.cardSub}>
          Synchronise automatiquement HRV, sommeil et récupération.
        </div>
        <div className={styles.phBtns}>
          <button className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => showToast('Whoop — Bientôt disponible')}>WHOOP</button>
          <button className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => showToast('Oura — Bientôt disponible')}>OURA</button>
        </div>
      </div>

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
