'use client'

import { useState } from 'react'
import styles from './historique.module.css'
import type { SessionEntry } from '../lib/types'

// ── Helpers (fidèles à swimmer.html) ─────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function sessionDate(s: SessionEntry): string {
  return String(s.date || s.session_date || s.day || '').slice(0, 10)
}

function sessionDist(s: SessionEntry): number {
  let v = Number(s.distance || s.total_distance || s.total || s.volume || s.km || 0)
  if (v > 0 && v < 100) v = v * 1000
  return v
}

function fmtDist(m: number): string {
  if (!m) return '0 m'
  return m >= 1000
    ? (Math.round(m / 100) / 10).toLocaleString('fr-FR') + ' km'
    : Math.round(m) + ' m'
}

function renderFieldValue(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) {
    return v.map(it => {
      if (typeof it === 'string') return it
      if (it && typeof it === 'object')
        return Object.values(it as Record<string, unknown>)
          .filter(x => typeof x === 'string' || typeof x === 'number')
          .join(' — ')
      return ''
    }).filter(Boolean).join('\n')
  }
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .filter(x => typeof x === 'string' || typeof x === 'number')
      .join(' — ')
  }
  return ''
}

const SKIP = new Set([
  'id', 'club_id', 'coach_id', 'created_at', 'updated_at',
  'date', 'session_date', 'name', 'titre', 'title',
  'distance', 'total_distance', 'total', 'volume', 'km',
])

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

            {detailSessions.map((s, idx) => {
              const dist    = sessionDist(s)
              const title   = String(s.name || s.titre || s.title || 'Séance')
              const entries = Object.entries(s).filter(
                ([k, v]) => !SKIP.has(k) && v != null && v !== ''
              )
              return (
                <div key={String(s.id ?? idx)}>
                  {idx > 0 && <hr className={styles.separator} />}
                  <div className={styles.sessTitle}>{title}</div>
                  {dist > 0 && <div className={styles.sessDist}>{fmtDist(dist)}</div>}
                  {entries.map(([k, v]) => {
                    const txt = renderFieldValue(v)
                    if (!txt) return null
                    return (
                      <div key={k} className={styles.sessField}>
                        <div className={styles.fLabel}>{k.replace(/_/g, ' ')}</div>
                        <div className={styles.sessFieldVal}>{txt}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
