'use client'

import styles from './dashboard.module.css'
import type { SessionEntry, HrvEntry, PoidsEntry, SwimmerMeta } from '../lib/types'

interface Props {
  meta:      SwimmerMeta
  sessions:  SessionEntry[]
  hrv:       HrvEntry[]
  poids:     PoidsEntry[]
  showToast: (msg: string) => void
}

function sessionDist(s: SessionEntry): number {
  const rows = (s.rows ?? []) as Array<{ dist?: string | number }>
  return rows.reduce((a, r) => a + (parseInt(String(r.dist ?? 0)) || 0), 0)
}

function fmtDist(m: number): string {
  if (!m) return '0 m'
  return m >= 1000 ? (Math.round(m / 100) / 10).toLocaleString('fr-FR') + ' km' : Math.round(m) + ' m'
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Dashboard({ meta, sessions, hrv, poids, showToast }: Props) {
  const now   = new Date()
  const today = localDateStr(now)

  const mondayDate = new Date(now)
  mondayDate.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const mondayStr = localDateStr(mondayDate)

  const firstMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  let wk = 0, mo = 0
  sessions.forEach(s => {
    const ds = String(s.date || s.session_date || s.day || '').slice(0, 10)
    if (!ds || ds > today) return
    const dist = sessionDist(s)
    if (ds >= mondayStr)     wk += dist
    if (ds >= firstMonthStr) mo += dist
  })

  // HRV
  const withRmssd = hrv.filter(h => h.rmssd != null)
  let hrvVal = '—'
  let hrvSub = 'aucune mesure HRV'
  if (withRmssd.length) {
    const last = withRmssd[withRmssd.length - 1]
    let arrow = '→'
    if (withRmssd.length > 1) {
      const prev = withRmssd[withRmssd.length - 2]
      if (last.rmssd! > prev.rmssd! * 1.05) arrow = '↑'
      else if (last.rmssd! < prev.rmssd! * 0.95) arrow = '↓'
    }
    hrvVal = `${last.rmssd} ms ${arrow}`
    hrvSub = `RMSSD — ${fmtDate(last.date)}` + (last.note != null ? ` · note ${last.note}/10` : '')
  }

  // Poids
  let poidsVal = '—'
  let poidsSub = 'aucune mesure'
  if (poids.length) {
    const lp = poids[poids.length - 1]
    poidsVal = `${lp.weight} kg`
    poidsSub = fmtDate(lp.date)
  }

  const greeting = 'Bonjour ' + (meta.firstName || '') + ' 👋'
  const dateStr  = now.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroHello}>{greeting}</div>
        <div className={styles.heroDate}>{dateStr}</div>
      </div>

      {/* Volume */}
      <div className={styles.grid2}>
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.cardLabel}>Cette semaine</div>
          <div className={styles.cardBig}>{fmtDist(wk)}</div>
          <div className={styles.cardSub}>volume nagé</div>
        </div>
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.cardLabel}>Ce mois</div>
          <div className={styles.cardBig}>{fmtDist(mo)}</div>
          <div className={styles.cardSub}>volume nagé</div>
        </div>
      </div>

      {/* Santé */}
      <div className={styles.grid2} style={{ marginTop: 12 }}>
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.cardLabel}>État de forme</div>
          <div className={styles.cardBig}>{hrvVal}</div>
          <div className={styles.cardSub}>{hrvSub}</div>
        </div>
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.cardLabel}>Poids</div>
          <div className={styles.cardBig}>{poidsVal}</div>
          <div className={styles.cardSub}>{poidsSub}</div>
        </div>
      </div>

      {/* Wearables */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardLabel}>Wearables</div>
        <div className={styles.cardSub}>
          Connecte Whoop ou Oura pour voir ton score de récupération ici.
        </div>
        <div className={styles.phBtns}>
          <button className={styles.btn} onClick={() => showToast('Intégration Whoop — bientôt disponible')}>WHOOP</button>
          <button className={styles.btn} onClick={() => showToast('Intégration Oura — bientôt disponible')}>OURA</button>
        </div>
      </div>
    </div>
  )
}
