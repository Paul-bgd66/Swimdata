'use client'
import styles from './bouton.module.css'

type Variante = 'primary' | 'outline' | 'danger' | 'ghost'

interface BoutonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  couleur?: string
}

export default function Bouton({ variante = 'primary', couleur, children, className, style, ...rest }: BoutonProps) {
  const bg = variante === 'primary' && couleur ? { background: couleur } : {}
  return (
    <button
      className={`${styles.btn} ${styles[variante]} ${className || ''}`}
      style={{ ...bg, ...style }}
      {...rest}
    >
      {children}
    </button>
  )
}
