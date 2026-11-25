'use client'
import styles from './carte.module.css'

interface CarteProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  borderColor?: string
}

export default function Carte({ children, onClick, className, borderColor }: CarteProps) {
  return (
    <div
      className={`${styles.root} ${onClick ? styles.clickable : ''} ${className || ''}`}
      style={borderColor ? { borderColor } : undefined}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
