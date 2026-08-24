'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, User } from '@supabase/supabase-js'
import styles from './login.module.css'

const SB_URL  = 'https://girspxdolhsuvmkkgngb.supabase.co'
const SB_ANON = 'sb_publishable_0g2OLZxdskIL3tSUllA5vQ_2WNKpFLv'
const sb = createClient(SB_URL, SB_ANON)

type State    = 'home' | 'login' | 'signup' | 'set-password' | 'success'
type FlowType = 'invite' | 'recovery'

export default function LoginClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [state, setState]         = useState<State>('home')
  const [pkceUser, setPkceUser]   = useState<User | null>(null)
  const [flowType, setFlowType]   = useState<FlowType>('invite')
  const [forgotOpen, setForgotOpen] = useState(false)

  // form fields
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginMsg, setLoginMsg]           = useState('')
  const [loginLoading, setLoginLoading]   = useState(false)

  const [signupFirstName, setSignupFirstName] = useState('')
  const [signupLastName, setSignupLastName]   = useState('')
  const [signupClub, setSignupClub]           = useState('')
  const [signupEmail, setSignupEmail]         = useState('')
  const [signupPassword, setSignupPassword]   = useState('')
  const [signupMsg, setSignupMsg]             = useState<{ text: string; ok: boolean } | null>(null)
  const [signupLoading, setSignupLoading]     = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  const [invitePassword, setInvitePassword]   = useState('')
  const [invitePassword2, setInvitePassword2] = useState('')
  const [inviteMsg, setInviteMsg]             = useState<{ text: string; ok: boolean } | null>(null)
  const [inviteLoading, setInviteLoading]     = useState(false)

  const [successMsg, setSuccessMsg] = useState('')

  const loginPasswordRef = useRef<HTMLInputElement>(null)

  // ── PKCE / implicit flow detection ──────────────────────────────
  useEffect(() => {
    // PKCE flow (?code=...) — used for both invite and recovery
    const code = searchParams.get('code')
    if (code) {
      const ft: FlowType = searchParams.get('type') === 'recovery' ? 'recovery' : 'invite'
      history.replaceState(null, '', window.location.pathname)
      sb.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          setState('login')
          setLoginMsg('Lien invalide ou expiré.')
          return
        }
        setPkceUser(data?.user ?? null)
        setFlowType(ft)
        setState('set-password')
      })
      return
    }

    // Implicit flow (#access_token=...) — handles both invite and recovery
    if (typeof window === 'undefined') return
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const params = Object.fromEntries(hash.split('&').map(p => {
      const [k, v] = p.split('=')
      return [decodeURIComponent(k), decodeURIComponent(v ?? '')]
    }))
    const t = params.type
    if ((t !== 'invite' && t !== 'recovery') || !params.access_token) return
    history.replaceState(null, '', window.location.pathname)
    sb.auth.setSession({
      access_token:  params.access_token,
      refresh_token: params.refresh_token ?? '',
    }).then(({ data, error }) => {
      if (error) {
        setState('login')
        setLoginMsg('Lien invalide ou expiré.')
        return
      }
      setPkceUser(data?.user ?? null)
      setFlowType(t === 'recovery' ? 'recovery' : 'invite')
      setState('set-password')
    })
  }, [searchParams])

  // ── helpers ─────────────────────────────────────────────────────
  function showState(s: State) {
    setState(s)
    setLoginMsg('')
    setSignupMsg(null)
    setForgotMsg(null)
    setForgotOpen(false)
  }

  function showWelcomeAndRedirect() {
    const firstName = pkceUser?.user_metadata?.firstName ?? ''
    setSuccessMsg('Bienvenue' + (firstName ? ' ' + firstName : '') + ' ! Ton compte est prêt.')
    setState('success')
    setTimeout(() => router.push('/swimmer.html'), 2000)
  }

  // ── actions ─────────────────────────────────────────────────────
  async function submitLogin() {
    if (!loginEmail || !loginPassword) { setLoginMsg('Email et mot de passe requis.'); return }
    setLoginLoading(true); setLoginMsg('')
    const { data, error } = await sb.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    setLoginLoading(false)
    if (error) { setLoginMsg(error.message); return }
    const role = data?.user?.user_metadata?.role
    router.push(role === 'swimmer' ? '/swimmer.html' : '/index.html')
  }

  async function submitSignup() {
    if (!signupEmail || !signupPassword) { setSignupMsg({ text: 'Email et mot de passe requis.', ok: false }); return }
    if (signupPassword.length < 6) { setSignupMsg({ text: 'Mot de passe : 6 caractères minimum.', ok: false }); return }
    setSignupLoading(true); setSignupMsg(null)
    const { error } = await sb.auth.signUp({
      email: signupEmail, password: signupPassword,
      options: { data: { role: 'coach', firstName: signupFirstName, lastName: signupLastName, clubName: signupClub } },
    })
    setSignupLoading(false)
    if (error) { setSignupMsg({ text: error.message, ok: false }); return }
    setSignupMsg({ text: '✅ Email de confirmation envoyé à ' + signupEmail, ok: true })
  }

  async function submitForgot() {
    if (!forgotEmail) { setForgotMsg({ text: 'Entrez votre email.', ok: false }); return }
    setForgotMsg({ text: 'Envoi en cours…', ok: false })
    const { error } = await sb.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin + '/login' : '/login',
    })
    if (error) { setForgotMsg({ text: error.message, ok: false }); return }
    setForgotMsg({ text: '✅ Lien envoyé — vérifiez votre boite mail.', ok: true })
  }

  async function submitSetPassword() {
    if (!invitePassword) { setInviteMsg({ text: 'Mot de passe requis.', ok: false }); return }
    if (invitePassword.length < 6) { setInviteMsg({ text: 'Minimum 6 caractères.', ok: false }); return }
    if (invitePassword !== invitePassword2) { setInviteMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false }); return }
    setInviteLoading(true); setInviteMsg(null)
    const { error } = await sb.auth.updateUser({ password: invitePassword, data: { passwordSet: true } })
    setInviteLoading(false)
    if (error) { setInviteMsg({ text: error.message, ok: false }); return }
    if (flowType === 'recovery') {
      // Redirect based on role — coaches land on /index.html, swimmers on /swimmer.html
      const role = pkceUser?.user_metadata?.role
      router.push(role === 'swimmer' ? '/swimmer.html' : '/index.html')
    } else {
      showWelcomeAndRedirect()
    }
  }

  // ── render ───────────────────────────────────────────────────────
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>SWIMDATA</div>
        <p className={styles.tagline}>La plateforme des coachs de natation</p>

        {/* HOME */}
        {state === 'home' && (
          <div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => showState('login')}>
              SE CONNECTER
            </button>
            <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => showState('signup')}>
              S'INSCRIRE
            </button>
          </div>
        )}

        {/* LOGIN */}
        {state === 'login' && (
          <div>
            <label className={styles.fieldLabel}>Email</label>
            <input
              type="email" className={styles.input}
              placeholder="coach@monclub.fr" autoComplete="email"
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loginPasswordRef.current?.focus()}
            />
            <label className={styles.fieldLabel}>Mot de passe</label>
            <input
              type="password" ref={loginPasswordRef} className={styles.input}
              placeholder="••••••••" autoComplete="current-password"
              value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitLogin()}
            />
            {loginMsg && <p className={`${styles.msg} ${styles.err}`}>{loginMsg}</p>}
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={submitLogin} disabled={loginLoading}
            >
              {loginLoading ? 'CONNEXION…' : 'SE CONNECTER'}
            </button>
            <button className={styles.linkBtn} onClick={() => setForgotOpen(v => !v)}>
              Mot de passe oublié ?
            </button>
            {forgotOpen && (
              <div>
                <input
                  type="email" className={styles.input}
                  placeholder="Votre email"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                />
                <button
                  className={`${styles.btn} ${styles.btnOutline}`}
                  style={{ marginTop: 0 }} onClick={submitForgot}
                >
                  ENVOYER LE LIEN
                </button>
                {forgotMsg && (
                  <p className={`${styles.msg} ${forgotMsg.ok ? styles.ok : styles.mute}`}>
                    {forgotMsg.text}
                  </p>
                )}
              </div>
            )}
            <button className={`${styles.linkBtn} ${styles.backLink}`} onClick={() => showState('home')}>
              ← Retour
            </button>
          </div>
        )}

        {/* SIGNUP */}
        {state === 'signup' && (
          <div>
            <label className={styles.fieldLabel}>Prénom</label>
            <input type="text" className={styles.input} placeholder="Prénom" autoComplete="given-name"
              value={signupFirstName} onChange={e => setSignupFirstName(e.target.value)} />
            <label className={styles.fieldLabel}>Nom</label>
            <input type="text" className={styles.input} placeholder="Nom" autoComplete="family-name"
              value={signupLastName} onChange={e => setSignupLastName(e.target.value)} />
            <label className={styles.fieldLabel}>Nom du club</label>
            <input type="text" className={styles.input} placeholder="ex: Canet 66 Natation"
              value={signupClub} onChange={e => setSignupClub(e.target.value)} />
            <label className={styles.fieldLabel}>Email</label>
            <input type="email" className={styles.input} placeholder="coach@monclub.fr" autoComplete="email"
              value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
            <label className={styles.fieldLabel}>Mot de passe</label>
            <input type="password" className={styles.input} placeholder="Minimum 6 caractères" autoComplete="new-password"
              value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
            {signupMsg && (
              <p className={`${styles.msg} ${signupMsg.ok ? styles.ok : styles.err}`}>{signupMsg.text}</p>
            )}
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={submitSignup} disabled={signupLoading}
            >
              {signupLoading ? 'CRÉATION…' : 'CRÉER MON COMPTE'}
            </button>
            <button className={`${styles.linkBtn} ${styles.backLink}`} onClick={() => showState('home')}>
              ← Retour
            </button>
          </div>
        )}

        {/* SET PASSWORD — invite nageur ou recovery */}
        {state === 'set-password' && (
          <div>
            <p className={styles.inviteWelcome}>
              {flowType === 'recovery'
                ? 'Choisissez un nouveau mot de passe.'
                : 'Bienvenue ! Choisissez un mot de passe pour activer votre compte.'}
            </p>
            {pkceUser?.email && (
              <p className={styles.inviteEmail}>{pkceUser.email}</p>
            )}
            <label className={styles.fieldLabel}>Mot de passe</label>
            <input type="password" className={styles.input} placeholder="Minimum 6 caractères" autoComplete="new-password"
              value={invitePassword} onChange={e => setInvitePassword(e.target.value)} />
            <label className={styles.fieldLabel}>Confirmer</label>
            <input type="password" className={styles.input} placeholder="Répétez le mot de passe" autoComplete="new-password"
              value={invitePassword2} onChange={e => setInvitePassword2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitSetPassword()} />
            {inviteMsg && (
              <p className={`${styles.msg} ${inviteMsg.ok ? styles.ok : styles.err}`}>{inviteMsg.text}</p>
            )}
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={submitSetPassword} disabled={inviteLoading}
            >
              {inviteLoading ? 'ACTIVATION…' : 'ACTIVER MON COMPTE'}
            </button>
          </div>
        )}

        {/* SUCCESS */}
        {state === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: 12 }}>✅</p>
            <p style={{ color: 'rgba(255,255,255,.9)', fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
              {successMsg}
            </p>
            <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.82rem' }}>Redirection en cours…</p>
          </div>
        )}
      </div>
    </main>
  )
}
