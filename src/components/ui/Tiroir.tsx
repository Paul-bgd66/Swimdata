'use client'
import { useEffect } from 'react'
import styles from './tiroir.module.css'

interface TiroirProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function Tiroir({ open, onClose, children }: TiroirProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        {children}
      </div>
    </>
  )
}
