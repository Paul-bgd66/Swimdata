'use client'

import { useCoach } from '@/lib/coach-context'
import styles from './subgroupe-filter.module.css'

export default function SubGroupeFilter() {
  const { sousGroupes, sousGroupeActif, setSousGroupeActif, colors } = useCoach()

  if (sousGroupes.length === 0) return null

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.chip} ${sousGroupeActif === null ? styles.chipActive : ''}`}
        style={sousGroupeActif === null ? { background: colors.c1 } : {}}
        onClick={() => setSousGroupeActif(null)}
      >
        Tous
      </button>
      {sousGroupes.map(sg => (
        <button
          key={sg.id}
          className={`${styles.chip} ${sousGroupeActif?.id === sg.id ? styles.chipActive : ''}`}
          style={sousGroupeActif?.id === sg.id ? { background: colors.c1 } : {}}
          onClick={() => setSousGroupeActif(sg)}
        >
          {sg.nom}
        </button>
      ))}
    </div>
  )
}
