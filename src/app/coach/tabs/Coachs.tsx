'use client'

import { useState, useEffect } from 'react'
import { useCoach } from '@/lib/coach-context'
import type { Coach } from '@/lib/types'
import styles from './coachs.module.css'

export default function Coachs() {
  const { club, coach, colors } = useCoach()

  const [coaches, setCoaches]     = useState<Coach[]>([])
  const [loading, setLoading]     = useState(true)
  const [inviteEmail, setInvite]  = useState('')
  const [sending, setSending]     = useState(false)
  const [feedback, setFeedback]   = useState<{ ok: boolean; msg: string } | null>(null)

  const isManager = coach?.role === 'manager'

  useEffect(() => {
    if (!club) return
    fetch('/api/coaches?clubId=' + encodeURIComponent(club.id))
      .then(r => r.ok ? r.json() : [])
      .then((data: Coach[]) => {
        setCoaches(Array.isArray(data) ? data.filter(c => c.id !== coach?.id) : [])
      })
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false))
  }, [club, coach?.id])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !club || !coach) return
    setSending(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'coach', coachId: coach.id, clubId: club.id }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Erreur ' + res.status)
      setFeedback({ ok: true, msg: 'Invitation envoyée à ' + inviteEmail.trim() })
      setInvite('')
    } catch (err) {
      setFeedback({ ok: false, msg: (err as Error).message })
    } finally {
      setSending(false)
    }
  }

  function initials(c: Coach): string {
    if (c.initials) return c.initials.toUpperCase().slice(0, 2)
    const first = c.firstname || ''
    const last  = c.lastname  || c.name || ''
    return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?'
  }

  function displayName(c: Coach): string {
    if (c.firstname || c.lastname) return [c.firstname, c.lastname].filter(Boolean).join(' ')
    return c.name || c.email || '—'
  }

  return (
    <div className={styles.root}>
      {/* ── Coach list ── */}
      {loading ? (
        <p className={styles.muted}>Chargement…</p>
      ) : coaches.length === 0 ? (
        <p className={styles.muted}>Aucun autre coach dans ce club.</p>
      ) : (
        <ul className={styles.list}>
          {coaches.map(c => (
            <li key={c.id} className={styles.card}>
              <span
                className={styles.avatar}
                style={{ background: c.color || colors.c1 }}
              >
                {initials(c)}
              </span>
              <span className={styles.info}>
                <span className={styles.name}>
                  {displayName(c)}
                  {c.role === 'manager' && <span className={styles.star}>⭐</span>}
                </span>
                {c.email && <span className={styles.email}>{c.email}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Invite form (manager only) ── */}
      {isManager && (
        <form className={styles.form} onSubmit={handleInvite}>
          <p className={styles.formTitle}>Inviter un coach</p>
          <div className={styles.row}>
            <input
              className={styles.input}
              type="email"
              placeholder="Adresse e-mail"
              value={inviteEmail}
              onChange={e => setInvite(e.target.value)}
              required
              disabled={sending}
            />
            <button
              className={styles.btn}
              type="submit"
              disabled={sending || !inviteEmail.trim()}
              style={{ background: colors.c1 }}
            >
              {sending ? '…' : 'Inviter'}
            </button>
          </div>
          {feedback && (
            <p className={feedback.ok ? styles.ok : styles.err}>{feedback.msg}</p>
          )}
        </form>
      )}
    </div>
  )
}
