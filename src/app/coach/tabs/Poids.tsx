'use client'

import { useState, useEffect, useRef } from 'react'
import { useCoach } from '@/lib/coach-context'
import type { PoidsEntry, Nageur } from '@/lib/types'
import { fmtDate, todayStr } from '@/lib/helpers'
import styles from './poids.module.css'

// ── Chart component (dynamic import, safe SSR) ────────────────────────────────

interface ChartProps { entries: PoidsEntry[]; c1: string }

function PoidsChart({ entries, c1 }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current || !entries.length) return
    const el = canvasRef.current
    let destroyed = false

    ;(async () => {
      const { Chart } = await import('chart.js/auto')
      if (destroyed || !el) return
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

      const cs     = getComputedStyle(el)
      const muted  = cs.getPropertyValue('--muted').trim()  || '#6b7a93'
      const border = cs.getPropertyValue('--border').trim() || '#e3e8f0'

      const weights = entries.map(e => e.weight)
      const minW    = Math.min(...weights)
      const maxW    = Math.max(...weights)

      chartRef.current = new Chart(el, {
        type: 'line',
        data: {
          labels:   entries.map(e => e.date.slice(5)),
          datasets: [{
            data:            weights,
            borderColor:     c1,
            backgroundColor: c1 + '18',
            borderWidth:     2.5,
            pointRadius:     4,
            pointBackgroundColor: c1,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 7 } },
            y: {
              grid: { color: border },
              ticks: { color: muted, font: { size: 10 }, callback: (v: string | number) => v + ' kg' },
              min: Math.floor((minW - 0.5) * 2) / 2,
              max: Math.ceil((maxW + 0.5) * 2) / 2,
            },
          },
        },
      })
    })()

    return () => {
      destroyed = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [entries, c1])

  if (!entries.length) return <div className={styles.chartEmpty}>Aucune donnée</div>
  return <div className={styles.chartWrap}><canvas ref={canvasRef} /></div>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nagNom(n: Nageur) { return (n.prenom + ' ' + n.nom).trim() }
function apiKey(n: Nageur) { return (n.prenom + '|' + (n.nom || '')).toLowerCase() }

interface Confirm { title: string; msg: string; onConfirm: () => void }

// ── Component ─────────────────────────────────────────────────────────────────

export default function Poids() {
  const { club, coach, nageurs, colors, showToast } = useCoach()

  const [entriesMap, setEntriesMap] = useState<Record<string, PoidsEntry[]>>({})
  const [loading,    setLoading]    = useState(true)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [confirm,    setConfirm]    = useState<Confirm | null>(null)

  // Add form
  const [addWeight,   setAddWeight]   = useState('')
  const [addDate,     setAddDate]     = useState('')
  const [addErr,      setAddErr]      = useState('')
  const [addLoading,  setAddLoading]  = useState(false)

  // ── Load from API ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!club || !coach) return
    fetch(`/api/poids?clubId=${encodeURIComponent(club.id)}&coachId=${encodeURIComponent(coach.id)}`)
      .then(r => r.ok ? r.json() : [])
      .then((groups: { prenom: string; nom: string; entries: PoidsEntry[] }[]) => {
        if (!Array.isArray(groups)) return
        const map: Record<string, PoidsEntry[]> = {}
        groups.forEach(g => {
          const k = (g.prenom + '|' + (g.nom || '')).toLowerCase()
          map[k] = (g.entries || []).slice().sort((a, b) => a.date < b.date ? -1 : 1)
        })
        setEntriesMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [club, coach])

  // Auto-select first nageur
  useEffect(() => {
    if (!activeId && nageurs.length > 0) setActiveId(nageurs[0].id)
  }, [nageurs, activeId])

  // Reset add form when switching nageur
  useEffect(() => {
    setAddWeight('')
    setAddDate(todayStr())
    setAddErr('')
  }, [activeId])

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeNageur = nageurs.find(n => n.id === activeId) ?? null

  function getEntries(n: Nageur): PoidsEntry[] {
    return entriesMap[apiKey(n)] ?? []
  }

  // ── Add entry ─────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!activeNageur || !club || !coach) return
    const val = parseFloat(addWeight)
    if (!addDate) { setAddErr('Date requise.'); return }
    if (!val || val < 20 || val > 250) { setAddErr('Poids invalide (20–250 kg).'); return }
    setAddErr('')
    setAddLoading(true)
    try {
      const r = await fetch('/api/poids', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId:  club.id,
          coachId: coach.id,
          entries: [{ prenom: activeNageur.prenom, nom: activeNageur.nom || '', date: addDate, weight: val }],
        }),
      })
      const data = await r.json() as { error?: string }
      if (!r.ok) throw new Error(data.error || 'Erreur serveur')
      const key = apiKey(activeNageur)
      setEntriesMap(prev => {
        const cur = prev[key] ?? []
        const without = cur.filter(e => e.date !== addDate)
        const next = [...without, { date: addDate, weight: val }].sort((a, b) => a.date < b.date ? -1 : 1)
        return { ...prev, [key]: next }
      })
      setAddWeight('')
      showToast('Mesure enregistrée ✓')
    } catch (e) {
      setAddErr((e as Error).message)
    } finally {
      setAddLoading(false)
    }
  }

  // ── Delete entry ──────────────────────────────────────────────────────────

  function handleDelete(n: Nageur, entry: PoidsEntry) {
    setConfirm({
      title: 'Supprimer cette mesure ?',
      msg:   `${entry.weight} kg — ${fmtDate(entry.date)}`,
      onConfirm: () => {
        const key = apiKey(n)
        setEntriesMap(prev => ({
          ...prev,
          [key]: (prev[key] ?? []).filter(e => e.date !== entry.date),
        }))
        setConfirm(null)
        if (!club || !coach) return
        const q = new URLSearchParams({
          clubId:  club.id,
          coachId: coach.id,
          prenom:  n.prenom,
          nom:     n.nom || '',
          date:    entry.date,
        })
        fetch('/api/poids?' + q.toString(), { method: 'DELETE' })
          .catch(e => console.warn('[deletePoids]', (e as Error).message))
        showToast('Mesure supprimée.')
      },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <p className={styles.muted}>Chargement…</p>

  if (nageurs.length === 0) return <p className={styles.muted}>Aucun nageur enregistré.</p>

  const entries   = activeNageur ? getEntries(activeNageur) : []
  const lastEntry = entries[entries.length - 1] ?? null
  const prevEntry = entries[entries.length - 2] ?? null
  const diff      = lastEntry && prevEntry
    ? Math.round((lastEntry.weight - prevEntry.weight) * 10) / 10
    : null

  return (
    <div className={styles.root}>
      {/* ── Swimmer chips nav ── */}
      <div className={styles.nav}>
        {nageurs.map(n => {
          const last = getEntries(n).at(-1)
          return (
            <button
              key={n.id}
              className={`${styles.chip} ${activeId === n.id ? styles.chipActive : ''}`}
              style={activeId === n.id ? { borderColor: colors.c1, background: colors.c1 } : {}}
              onClick={() => setActiveId(n.id)}
            >
              {nagNom(n)}{last ? ` · ${last.weight} kg` : ''}
            </button>
          )
        })}
      </div>

      {activeNageur && (
        <>
          {/* ── Current weight summary ── */}
          {lastEntry && (
            <div className={styles.summaryCard}>
              <div className={styles.summaryName}>{nagNom(activeNageur)}</div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryWeight}>{lastEntry.weight} kg</span>
                {diff !== null && (
                  <span
                    className={styles.summaryDiff}
                    style={{ color: diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : 'var(--muted)' }}
                  >
                    {diff > 0 ? '+' : ''}{diff} kg
                  </span>
                )}
                <span className={styles.summaryDate}>{fmtDate(lastEntry.date)}</span>
              </div>
            </div>
          )}

          {/* ── Chart ── */}
          <div className={styles.chartCard}>
            <div className={styles.sectionLabel}>Évolution du poids</div>
            <PoidsChart entries={entries} c1={colors.c1} />
          </div>

          {/* ── Add form ── */}
          <div className={styles.addCard}>
            <div className={styles.sectionLabel}>Ajouter une mesure</div>
            <div className={styles.addRow}>
              <input
                type="number"
                className={styles.fInput}
                step="0.1"
                placeholder="Poids (ex: 72.5)"
                inputMode="decimal"
                value={addWeight}
                onChange={e => setAddWeight(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <input
                type="date"
                className={styles.fInput}
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
              />
              <button
                className={styles.addBtn}
                style={{ background: colors.c1 }}
                onClick={handleAdd}
                disabled={addLoading}
              >
                {addLoading ? '…' : 'Ajouter'}
              </button>
            </div>
            {addErr && <p className={styles.err}>{addErr}</p>}
          </div>

          {/* ── History ── */}
          <div className={styles.histCard}>
            <div className={styles.sectionLabel}>
              Historique ({entries.length} mesure{entries.length !== 1 ? 's' : ''})
            </div>
            {entries.length === 0 ? (
              <p className={styles.muted}>Aucune mesure enregistrée.</p>
            ) : (
              [...entries].reverse().map((e, i, arr) => {
                const prev = arr[i + 1]
                const d    = prev ? Math.round((e.weight - prev.weight) * 10) / 10 : null
                return (
                  <div key={e.date} className={styles.histRow}>
                    <span className={styles.histDate}>{fmtDate(e.date)}</span>
                    <span className={styles.histWeight}>{e.weight} kg</span>
                    {d !== null && (
                      <span
                        className={styles.histDiff}
                        style={{ color: d > 0 ? '#ef4444' : d < 0 ? '#22c55e' : 'var(--muted)' }}
                      >
                        {d > 0 ? '+' : ''}{d} kg
                      </span>
                    )}
                    <button
                      className={styles.histDel}
                      onClick={() => handleDelete(activeNageur, e)}
                    >
                      ✕
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </>
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
