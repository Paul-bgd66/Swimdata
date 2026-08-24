'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Performances from './components/Performances'
import Sante from './components/Sante'
import Video from './components/Video'
import Profil from './components/Profil'
import Historique from './components/Historique'
import Dashboard from './components/Dashboard'
import styles from './swimmer.module.css'
import type { HrvEntry, PoidsEntry, Perf, SwimmerMeta, VideoEntry, SessionEntry } from './lib/types'

const SB_URL  = 'https://girspxdolhsuvmkkgngb.supabase.co'
const SB_ANON = 'sb_publishable_0g2OLZxdskIL3tSUllA5vQ_2WNKpFLv'
const sb = createClient(SB_URL, SB_ANON)

type Tab = 'dashboard' | 'training' | 'perf' | 'video' | 'sante' | 'settings'

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Accueil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'training',
    label: 'Entraîn.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'perf',
    label: 'Perfs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: 'video',
    label: 'Vidéo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
  },
  {
    id: 'sante',
    label: 'Santé',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Réglages',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

export default function SwimmerClient() {
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('perf')
  const [swimmerNom, setSwimmerNom] = useState('')
  const [meta, setMeta] = useState<SwimmerMeta>({})
  const [userId,     setUserId]     = useState('')
  const [email,      setEmail]      = useState('')
  const [perfs,      setPerfs]      = useState<Perf[]>([])
  const [hrv,        setHrv]        = useState<HrvEntry[]>([])
  const [poids,      setPoids]      = useState<PoidsEntry[]>([])
  const [videos,     setVideos]     = useState<VideoEntry[]>([])
  const [sessions,   setSessions]   = useState<SessionEntry[]>([])
  const [theme,      setTheme]      = useState('light')
  const [colors,     setColors]     = useState({ c1: '#2176e8', c2: '#f5c400' })
  const [clubColors, setClubColors] = useState({ c1: '#2176e8', c2: '#f5c400' })
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { router.push('/login'); return }

      const user = session.user
      setUserId(user.id)
      setEmail(user.email ?? '')
      const m = (user.user_metadata ?? {}) as SwimmerMeta
      if (m.role !== 'swimmer') { router.push('/index.html'); return }

      const nom =
        ((m.firstName ?? '') + ' ' + (m.lastName ?? '')).trim() ||
        (user.email ?? '').split('@')[0]

      setSwimmerNom(nom)
      setMeta(m)

      const savedTheme =
        m.swimmerTheme ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('swimmerTheme') : null) ||
        'light'
      setTheme(savedTheme)

      // Club colors — fall through to defaults if fetch fails
      let c1 = m.swimmerColor1 || '#2176e8'
      let c2 = m.swimmerColor2 || '#f5c400'
      if (m.clubId) {
        try {
          const r = await fetch('/api/clubs?id=' + encodeURIComponent(m.clubId))
          if (r.ok) {
            const club = await r.json()
            const rawC1 = club.color1 || '#2176e8'
            const rawC2 = club.color2 || '#f5c400'
            setClubColors({ c1: rawC1, c2: rawC2 })
            c1 = m.swimmerColor1 || rawC1
            c2 = m.swimmerColor2 || rawC2
          }
        } catch { /* non-fatal */ }
      }
      setColors({ c1, c2 })

      setStatus('ready')
      await loadAllData(nom, m)
    } catch (e) {
      setStatus('error')
      setErrorMsg((e as Error).message)
    }
  }

  async function loadAllData(nom: string, m: SwimmerMeta) {
    if (!m.clubId || !m.coachId) {
      console.warn('[data] clubId/coachId manquants dans user_metadata')
      return
    }
    const q =
      'clubId='  + encodeURIComponent(m.clubId) +
      '&coachId=' + encodeURIComponent(m.coachId)

    const uid = await sb.auth.getSession().then(r => r.data.session?.user.id ?? '')

    const [perfsRes, hrvRes, poidsRes, videosRes, sessionsRes] = await Promise.allSettled([
      fetch('/api/performances?' + q).then(r => r.ok ? r.json() : []),
      fetch('/api/hrv?'          + q).then(r => r.ok ? r.json() : []),
      fetch('/api/poids?'        + q).then(r => r.ok ? r.json() : []),
      fetch('/api/videos?'       + q).then(r => r.ok ? r.json() : []),
      fetch('/api/sessions?'     + q).then(r => r.ok ? r.json() : []),
    ])

    // ── performances — .concat() guard ──────────────────────────────────────
    let next: Perf[] = []
    if (perfsRes.status === 'fulfilled' && Array.isArray(perfsRes.value)) {
      perfsRes.value.forEach((g: { nageur_nom: string; performances: Perf[] }) => {
        if (sameName(g.nageur_nom, nom)) next = next.concat(g.performances ?? [])
      })
    }
    setPerfs(next)

    // ── HRV — même garde .concat() ──────────────────────────────────────────
    let nextHrv: HrvEntry[] = []
    if (hrvRes.status === 'fulfilled' && Array.isArray(hrvRes.value)) {
      hrvRes.value.forEach((g: { nageur_nom: string; historique: HrvEntry[] }) => {
        if (sameName(g.nageur_nom, nom)) nextHrv = nextHrv.concat(g.historique ?? [])
      })
    }
    nextHrv.sort((a, b) => a.date < b.date ? -1 : 1)
    setHrv(nextHrv)

    // ── Poids — match prénom + nom ───────────────────────────────────────────
    let nextPoids: PoidsEntry[] = []
    if (poidsRes.status === 'fulfilled' && Array.isArray(poidsRes.value)) {
      poidsRes.value.forEach((g: { prenom: string; nom: string; entries: PoidsEntry[] }) => {
        if (sameName(g.prenom, m.firstName ?? '') && sameName(g.nom, m.lastName ?? ''))
          nextPoids = g.entries ?? []
      })
    }
    nextPoids.sort((a, b) => a.date < b.date ? -1 : 1)
    setPoids(nextPoids)

    // ── Vidéos — aplatir quel que soit le groupement ────────────────────────
    const nextVideos: VideoEntry[] = []
    if (videosRes.status === 'fulfilled' && Array.isArray(videosRes.value)) {
      videosRes.value.forEach((item: VideoEntry & { videos?: VideoEntry[]; swimmer_id?: string; prenom?: string; nom?: string; swimmer_prenom?: string; swimmer_nom?: string }) => {
        const vids: VideoEntry[] = Array.isArray(item.videos) ? item.videos : [item]
        vids.forEach(v => {
          const sid  = v.swimmer_id  || item.swimmer_id  || ''
          const pre  = v.swimmer_prenom || item.swimmer_prenom || item.prenom || ''
          const vnom = v.swimmer_nom    || item.swimmer_nom    || item.nom    || ''
          if (sid === uid || sameName((pre + ' ' + vnom).trim(), nom)) {
            nextVideos.push(v)
          }
        })
      })
    }
    setVideos(nextVideos)

    // ── Sessions — tableau plat, toutes séances du club ──────────────────
    if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)) {
      setSessions(sessionsRes.value as SessionEntry[])
    }
  }

  function handleMetaChange(patch: Partial<SwimmerMeta>) {
    setMeta(prev => ({ ...prev, ...patch }))
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      const fn = patch.firstName ?? meta.firstName ?? ''
      const ln = patch.lastName  ?? meta.lastName  ?? ''
      setSwimmerNom((fn + ' ' + ln).trim())
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  async function handleLogout() {
    await sb.auth.signOut()
    router.push('/login')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return <div className={styles.loadingScreen}>SWIMDATA…</div>
  }

  if (status === 'error') {
    return <div className={styles.loadingScreen}>ERREUR — {errorMsg}</div>
  }

  return (
    <div
      data-theme={theme}
      className={styles.root}
      style={{ '--c1': colors.c1, '--c2': colors.c2 } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <header className={styles.hdr}>
        <span className={styles.hdrLogo}>SWIMDATA</span>
        <span className={styles.hdrName}>{meta.firstName || swimmerNom}</span>
        <button className={styles.hdrOut} onClick={handleLogout} title="Se déconnecter">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.navItem} ${activeTab === t.id ? styles.navActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Main ── */}
      <main className={styles.main}>
        <div className={styles.inner}>

          {activeTab === 'perf' && (
            <>
              <div className={styles.pageTitle}>Performances</div>
              <Performances
                perfs={perfs}
                swimmerNom={swimmerNom}
                meta={meta}
                onPerfsChange={setPerfs}
                showToast={showToast}
              />
            </>
          )}

          {activeTab === 'sante' && (
            <>
              <div className={styles.pageTitle}>Santé</div>
              <Sante
                hrv={hrv}
                poids={poids}
                swimmerNom={swimmerNom}
                meta={meta}
                onHrvChange={setHrv}
                onPoidsChange={setPoids}
                showToast={showToast}
                colors={colors}
              />
            </>
          )}

          {activeTab === 'video' && (
            <>
              <div className={styles.pageTitle}>Vidéo</div>
              <Video
                videos={videos}
                userId={userId}
                meta={meta}
                onVideosChange={setVideos}
                showToast={showToast}
              />
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <div className={styles.pageTitle}>Réglages</div>
              <Profil
                meta={meta}
                email={email}
                theme={theme}
                colors={colors}
                clubColors={clubColors}
                onMetaChange={handleMetaChange}
                onThemeChange={setTheme}
                onColorsChange={setColors}
                showToast={showToast}
                onLogout={handleLogout}
              />
            </>
          )}

          {activeTab === 'dashboard' && (
            <>
              <div className={styles.pageTitle}>Accueil</div>
              <Dashboard
                meta={meta}
                sessions={sessions}
                hrv={hrv}
                poids={poids}
                showToast={showToast}
              />
            </>
          )}

          {activeTab === 'training' && (
            <>
              <div className={styles.pageTitle}>Entraînements</div>
              <Historique sessions={sessions} />
            </>
          )}

          {activeTab !== 'perf' && activeTab !== 'sante' && activeTab !== 'video'
            && activeTab !== 'settings' && activeTab !== 'training'
            && activeTab !== 'dashboard' && (
            <div className={styles.placeholder}>Bientôt disponible</div>
          )}

        </div>
      </main>

      {/* ── Toast ── */}
      <div className={`${styles.toast} ${toast ? styles.toastVisible : ''}`}>
        {toast}
      </div>
    </div>
  )
}
