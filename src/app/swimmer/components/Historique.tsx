'use client'

import { useState } from 'react'
import styles from './historique.module.css'
import type { SessionEntry } from '../lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function sessionDate(s: SessionEntry): string {
  return String(s.date || s.session_date || s.day || '').slice(0, 10)
}

function fkm(m: number)  { return m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : m + ' m' }
function fkms(m: number) { return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m' }

// ── Intensités (identiques à index.html) ─────────────────────────────────

const INTS = ['AEC1', 'AEC2', 'AEC3', 'ANC', 'ANP', 'AEP'] as const
type IntKey = typeof INTS[number]

const ILABELS: Record<IntKey, string> = {
  AEC1: 'AEC1', AEC2: 'AEC2', AEC3: 'AEC3',
  ANC:  'ANC',  ANP:  'ANP',  AEP:  'AEP',
}
const ICOLORS: Record<IntKey, string> = {
  AEC1: '#2176e8', AEC2: '#22c55e', AEC3: '#e6aa00',
  ANC:  '#ef4444', ANP:  '#a855f7', AEP:  '#f97316',
}

type SRow = Partial<Record<IntKey, string | number>> & {
  desc?: string
  dist?: string | number
}

// ── SessionDetail ─────────────────────────────────────────────────────────

function SessionDetail({ s }: { s: SessionEntry }) {
  const rows = (s.rows ?? []) as SRow[]

  const totDist = rows.reduce((a, r) => a + (parseInt(String(r.dist ?? 0)) || 0), 0)

  const intTots = Object.fromEntries(
    INTS.map(k => [k, rows.reduce((a, r) => a + (parseInt(String(r[k] ?? 0)) || 0), 0)])
  ) as Record<IntKey, number>

  const activeInts  = INTS.filter(k => intTots[k] > 0)
  const visibleRows = rows.filter(r => r.desc || (parseInt(String(r.dist ?? 0)) || 0) > 0)

  return (
    <div>
      {/* Nom + bassin */}
      <div className={styles.sessTitle}>
        {String(s.name || s.titre || s.title || 'Séance')}
      </div>
      {s.pool && <span className={styles.sessPool}>{String(s.pool)} m</span>}

      {/* Stats bar */}
      {totDist > 0 && (
        <div className={styles.stb}>
          <div>
            <div className={styles.stbLbl}>Distance totale</div>
            <div className={styles.stbVal}>{fkm(totDist)}</div>
          </div>
          {activeInts.length > 0 && <div className={styles.stbSep} />}
          <div className={styles.stbInts}>
            {activeInts.map(k => (
              <div key={k} className={styles.stbI}>
                <span className={styles.stbILbl}>{ILABELS[k]}</span>
                <span className={styles.stbIVal} style={{ color: ICOLORS[k] }}>{fkms(intTots[k])}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau des séries */}
      {visibleRows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.xg}>
            <thead>
              <tr>
                <th style={{ width: 26 }}>#</th>
                <th className={styles.thDesc}>Description</th>
                <th style={{ width: 68 }}>Dist.</th>
                {activeInts.map(k => (
                  <th key={k} className={styles.thInt} style={{ width: 62 }}>{ILABELS[k]}</th>
                ))}
                <th className={styles.thTot} style={{ width: 74 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const d = parseInt(String(r.dist ?? 0)) || 0
                return (
                  <tr key={i}>
                    <td className={styles.xrn}>{i + 1}</td>
                    <td className={styles.tdDesc}>{r.desc || '—'}</td>
                    <td className={styles.tdNum}>{d > 0 ? d + ' m' : '—'}</td>
                    {activeInts.map(k => {
                      const v = parseInt(String(r[k] ?? 0)) || 0
                      return (
                        <td key={k} className={styles.tdNum}
                          style={{ color: v ? ICOLORS[k] : 'inherit', fontWeight: v ? 600 : 400 }}>
                          {v ? fkms(v) : ''}
                        </td>
                      )
                    })}
                    <td className={styles.tdTot}>{d > 0 ? fkms(d) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {s.notes && <div className={styles.sessNotes}>{String(s.notes)}</div>}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  sessions: SessionEntry[]
}

const DOWS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function Historique({ sessions }: Props) {
  const today = todayStr()

  const past = sessions.filter(s => {
    const d = sessionDate(s)
    return d !== '' && d <= today
  })

  // ── Calendrier ────────────────────────────────────────────────────────
  const [calDate,   setCalDate]   = useState(() => new Date())
  const [detailDay, setDetailDay] = useState<string | null>(null)

  function calShift(n: number) {
    setCalDate(prev => new Date(prev.getFullYear(), prev.getMonth() + n, 1))
  }

  const byDate: Record<string, SessionEntry[]> = {}
  past.forEach(s => {
    const d = sessionDate(s)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(s)
  })

  const y          = calDate.getFullYear()
  const mo         = calDate.getMonth()
  const monthLabel = new Date(y, mo, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const firstDow   = (new Date(y, mo, 1).getDay() + 6) % 7
  const nbDays     = new Date(y, mo + 1, 0).getDate()

  const detailSessions = detailDay ? (byDate[detailDay] ?? []) : []

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <div className={styles.card}>
        <div className={styles.calHead}>
          <button className={styles.calNavBtn} onClick={() => calShift(-1)}>‹</button>
          <div className={styles.calMonth} style={{ textTransform: 'capitalize' }}>{monthLabel}</div>
          <button className={styles.calNavBtn} onClick={() => calShift(1)}>›</button>
        </div>

        <div className={styles.calGrid}>
          {DOWS.map(dow => (
            <div key={dow} className={styles.calDow}>{dow}</div>
          ))}

          {Array.from({ length: firstDow }, (_, i) => (
            <div key={'e' + i} className={styles.calDayEmpty} />
          ))}

          {Array.from({ length: nbDays }, (_, i) => {
            const d       = i + 1
            const ds      = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const sess    = byDate[ds] ?? []
            const isToday = ds === today
            const hasSess = sess.length > 0

            return (
              <div
                key={ds}
                className={[
                  styles.calDay,
                  isToday ? styles.calDayToday   : '',
                  hasSess ? styles.calDayHasSess : '',
                ].join(' ')}
                onClick={hasSess ? () => setDetailDay(ds) : undefined}
              >
                <span>{d}</span>
                {hasSess && (
                  <span className={styles.dots}>
                    {sess.slice(0, 3).map((_, i) => (
                      <span key={i} className={styles.dot} />
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.calLegend}>
          <span className={styles.calLegendItem}>
            <span className={styles.legendDot} /> Séance réalisée
          </span>
        </div>
      </div>

      {past.length === 0 && (
        <div className={styles.empty}>Aucune séance enregistrée pour le moment.</div>
      )}

      {/* ── Modal détail ── */}
      {detailDay && (
        <div className={styles.modalBk} onClick={() => setDetailDay(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              {new Date(detailDay + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
              <button className={styles.modalX} onClick={() => setDetailDay(null)}>×</button>
            </div>

            {detailSessions.map((s, idx) => (
              <div key={String(s.id ?? idx)}>
                {idx > 0 && <hr className={styles.separator} />}
                <SessionDetail s={s} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
