'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import styles from './coach.module.css'
import { CoachContext } from '@/lib/coach-context'
import type { CoachContextValue, CoachInfo } from '@/lib/coach-context'
import type { Club, Nageur } from '@/lib/types'
import { resolveClubColors } from '@/lib/constants'
import { t } from '@/lib/i18n'
import Coachs from './tabs/Coachs'

const SB_URL  = 'https://girspxdolhsuvmkkgngb.supabase.co'
const SB_ANON = 'sb_publishable_0g2OLZxdskIL3tSUllA5vQ_2WNKpFLv'
const sb = createClient(SB_URL, SB_ANON)

type Tab = 'seance' | 'dash' | 'hist' | 'planning' | 'video' | 'hrv' | 'poids' | 'perf' | 'swimmers' | 'coachs' | 'settings'

const TABS: { id: Tab; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: 'seance', labelKey: 'nav.seance',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  },
  {
    id: 'dash', labelKey: 'nav.dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  },
  {
    id: 'hist', labelKey: 'nav.history',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    id: 'planning', labelKey: 'nav.planning',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    id: 'video', labelKey: 'nav.video',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  },
  {
    id: 'hrv', labelKey: 'nav.hrv',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
  {
    id: 'poids', labelKey: 'nav.weight',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  },
  {
    id: 'perf', labelKey: 'nav.perf',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    id: 'swimmers', labelKey: 'nav.swimmers',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    id: 'coachs', labelKey: 'nav.coachs',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    id: 'settings', labelKey: 'nav.settings',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
]

export default function CoachClient() {
  const router = useRouter()

  const [status,    setStatus]    = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('seance')

  const [club,      setClub]      = useState<Club | null>(null)
  const [coach,     setCoach]     = useState<CoachInfo | null>(null)
  const [nageurs,   setNageurs]   = useState<Nageur[]>([])
  const [colors,    setColors]    = useState({ c1: '#1560bd', c2: '#f5c400' })
  const [theme,     setTheme]     = useState('light')
  const [lang,      setLangState] = useState('fr')
  const [coachMode, setCoachMode] = useState<'club' | 'indiv'>('club')
  const [toast,     setToast]     = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { init() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { router.push('/login'); return }

      const user = session.user
      const m    = (user.user_metadata ?? {}) as Record<string, string>

      if (m.role === 'swimmer') { router.push('/swimmer'); return }
      if (m.role !== 'coach' && m.role !== 'manager') { router.push('/login'); return }

      const name = ((m.firstName ?? '') + ' ' + (m.lastName ?? '')).trim()
        || (user.email ?? '').split('@')[0]

      setCoach({ id: user.id, name, email: user.email ?? '', role: m.role ?? 'coach' })

      // Language
      const savedLang = m.lang
        || (typeof localStorage !== 'undefined' ? localStorage.getItem('c66_lang_' + user.id) : null)
        || 'fr'
      setLangState(savedLang)

      // CoachMode
      const savedMode = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('coachMode') as 'club' | 'indiv' | null)
        : null
      if (savedMode === 'indiv') setCoachMode('indiv')

      // Resolve club_id via /api/coaches (service key bypasses RLS)
      const coachRes = await fetch('/api/coaches?userId=' + encodeURIComponent(user.id))
      if (!coachRes.ok) throw new Error('Coach introuvable (statut ' + coachRes.status + ')')
      const coachData = await coachRes.json() as { club_id: string }
      const clubId = coachData.club_id
      if (!clubId) throw new Error('Aucun club associé à ce compte coach.')

      // Parallel: club data + nageurs
      const [clubRes, nageursRes] = await Promise.all([
        fetch('/api/clubs?id=' + encodeURIComponent(clubId)),
        fetch('/api/nageurs?coachId=' + encodeURIComponent(user.id) + '&clubId=' + encodeURIComponent(clubId)),
      ])

      if (!clubRes.ok) throw new Error('Club introuvable (statut ' + clubRes.status + ')')
      const clubData = await clubRes.json() as Club
      setClub(clubData)
      setColors(resolveClubColors(clubData))

      if (nageursRes.ok) {
        const nagData = await nageursRes.json() as Nageur[]
        setNageurs(Array.isArray(nagData) ? nagData : [])
      }

      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setErrorMsg((e as Error).message)
    }
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  function setLang(l: string) {
    setLangState(l)
    if (typeof localStorage !== 'undefined' && coach)
      localStorage.setItem('c66_lang_' + coach.id, l)
  }

  async function handleLogout() {
    await sb.auth.signOut()
    router.push('/login')
  }

  const ctxValue = useMemo<CoachContextValue>(() => ({
    club, coach, nageurs, colors, theme, lang, coachMode,
    setCoachMode, setLang, showToast,
  }), [club, coach, nageurs, colors, theme, lang, coachMode, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return <div className={styles.loadingScreen}>SWIMDATA…</div>
  }

  if (status === 'error') {
    return <div className={styles.loadingScreen}>ERREUR — {errorMsg}</div>
  }

  const activeTabDef = TABS.find(tb => tb.id === activeTab)

  return (
    <CoachContext.Provider value={ctxValue}>
      <div
        data-theme={theme}
        className={styles.root}
        style={{ '--c1': colors.c1, '--c2': colors.c2 } as React.CSSProperties}
      >
        {/* ── Header ── */}
        <header className={styles.hdr}>
          <span className={styles.hdrLogo}>SWIMDATA</span>
          <span className={styles.hdrClub}>{club?.short_name || club?.name || ''}</span>
          <span className={styles.hdrName}>{coach?.name || ''}</span>
          <button className={styles.hdrOut} onClick={handleLogout} title={t('logout', lang)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </header>

        {/* ── Nav ── */}
        <nav className={styles.nav}>
          {TABS.map(tb => (
            <button
              key={tb.id}
              className={`${styles.navItem} ${activeTab === tb.id ? styles.navActive : ''}`}
              onClick={() => setActiveTab(tb.id)}
            >
              {tb.icon}
              <span>{t(tb.labelKey, lang)}</span>
            </button>
          ))}
        </nav>

        {/* ── Main ── */}
        <main className={styles.main}>
          <div className={styles.inner}>
            <div className={styles.pageTitle}>
              {activeTabDef ? t(activeTabDef.labelKey, lang) : ''}
            </div>

            {activeTab === 'coachs' ? (
              <Coachs />
            ) : (
              <div className={styles.placeholder}>
                {t('not.migrated', lang)}
                <br />
                <a className={styles.placeholderLink} href="/index.html">
                  {t('old.version', lang)}
                </a>
              </div>
            )}
          </div>
        </main>

        {/* ── Toast ── */}
        <div className={`${styles.toast} ${toast ? styles.toastVisible : ''}`}>
          {toast}
        </div>
      </div>
    </CoachContext.Provider>
  )
}
