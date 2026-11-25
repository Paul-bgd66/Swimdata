'use client'
import styles from './anneau.module.css'

type Taille = 'sm' | 'md' | 'lg'

const DIM: Record<Taille, { px: number; sw: number; fs: number }> = {
  sm: { px: 36, sw: 4,  fs: 9  },
  md: { px: 52, sw: 5,  fs: 12 },
  lg: { px: 76, sw: 7,  fs: 16 },
}

interface AnneauProps {
  valeur: number | null
  couleur?: string
  label?: string
  taille?: Taille
}

export default function Anneau({ valeur, couleur = '#06B6D4', label, taille = 'md' }: AnneauProps) {
  const { px, sw, fs } = DIM[taille]
  const r    = (px - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = valeur == null ? 0 : Math.max(0, Math.min(100, valeur))
  const dash = (pct / 100) * circ

  return (
    <div className={styles.wrap}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
        {valeur != null && (
          <circle
            cx={px / 2} cy={px / 2} r={r}
            fill="none"
            stroke={couleur}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            transform={`rotate(-90 ${px / 2} ${px / 2})`}
          />
        )}
        <text
          x={px / 2} y={px / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fs}
          fill={valeur == null ? 'var(--muted)' : couleur}
          fontFamily="'DM Sans', sans-serif"
          fontWeight="700"
        >
          {valeur == null ? '—' : pct}
        </text>
      </svg>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  )
}
