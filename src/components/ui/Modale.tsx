'use client'
import { useEffect } from 'react'
import styles from './modale.module.css'

interface ModaleProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function Modale({ open, onClose, title, children }: ModaleProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        {title && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>
  )
}
