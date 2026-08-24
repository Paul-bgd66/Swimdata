'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import styles from './profil.module.css'
import type { SwimmerMeta } from '../lib/types'

const SB_URL  = 'https://girspxdolhsuvmkkgngb.supabase.co'
const SB_ANON = 'sb_publishable_0g2OLZxdskIL3tSUllA5vQ_2WNKpFLv'
const sb = createClient(SB_URL, SB_ANON)

interface Props {
  meta:           SwimmerMeta
  email:          string
  theme:          string
  colors:         { c1: string; c2: string }
  clubColors:     { c1: string; c2: string }
  onMetaChange:   (patch: Partial<SwimmerMeta>) => void
  onThemeChange:  (t: string) => void
  onColorsChange: (c: { c1: string; c2: string }) => void
  showToast:      (msg: string) => void
  onLogout:       () => void
}

export default function Profil({
  meta, email, theme, colors, clubColors,
  onMetaChange, onThemeChange, onColorsChange, showToast, onLogout,
}: Props) {

  // ── Profil ────────────────────────────────────────────────────────────────
  const [firstName,      setFirstName]      = useState(meta.firstName ?? '')
  const [lastName,       setLastName]       = useState(meta.lastName  ?? '')
  const [profileMsg,     setProfileMsg]     = useState<{ text: string; ok: boolean } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  async function saveProfile() {
    if (!firstName.trim()) { setProfileMsg({ text: 'Prénom requis.', ok: false }); return }
    setProfileLoading(true); setProfileMsg(null)
    const { error } = await sb.auth.updateUser({
      data: { firstName: firstName.trim(), lastName: lastName.trim() },
    })
    setProfileLoading(false)
    if (error) { setProfileMsg({ text: error.message, ok: false }); return }
    onMetaChange({ firstName: firstName.trim(), lastName: lastName.trim() })
    setProfileMsg({ text: 'Profil mis à jour ✓', ok: true })
  }

  // ── Langue ────────────────────────────────────────────────────────────────
  const [lang, setLang] = useState(
    meta.lang ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('swimmerLang') : null) ||
    'fr'
  )

  function saveLang(v: string) {
    setLang(v)
    if (typeof localStorage !== 'undefined') localStorage.setItem('swimmerLang', v)
    onMetaChange({ lang: v })
    sb.auth.updateUser({ data: { lang: v } }).catch(() => {})
    showToast('Langue enregistrée ✓')
  }

  // ── Thème ─────────────────────────────────────────────────────────────────
  function handleTheme(t: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem('swimmerTheme', t)
    onThemeChange(t)
    sb.auth.updateUser({ data: { swimmerTheme: t } }).catch(() => {})
  }

  // ── Couleurs ──────────────────────────────────────────────────────────────
  const [localC1, setLocalC1] = useState(colors.c1)
  const [localC2, setLocalC2] = useState(colors.c2)

  function handleColorChange(c1: string, c2: string) {
    setLocalC1(c1); setLocalC2(c2)
    onColorsChange({ c1, c2 })
    sb.auth.updateUser({ data: { swimmerColor1: c1, swimmerColor2: c2 } }).catch(() => {})
  }

  function resetColors() {
    setLocalC1(clubColors.c1); setLocalC2(clubColors.c2)
    onColorsChange(clubColors)
    sb.auth.updateUser({ data: { swimmerColor1: null, swimmerColor2: null } }).catch(() => {})
    showToast('Couleurs du club restaurées ✓')
  }

  // ── Mot de passe ──────────────────────────────────────────────────────────
  const [pw1,       setPw1]       = useState('')
  const [pw2,       setPw2]       = useState('')
  const [pwMsg,     setPwMsg]     = useState<{ text: string; ok: boolean } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  async function changePassword() {
    setPwMsg(null)
    if (pw1.length < 6) { setPwMsg({ text: 'Minimum 6 caractères.', ok: false }); return }
    if (pw1 !== pw2) { setPwMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false }); return }
    setPwLoading(true)
    const { error } = await sb.auth.updateUser({ password: pw1 })
    setPwLoading(false)
    if (error) { setPwMsg({ text: error.message, ok: false }); return }
    setPw1(''); setPw2('')
    setPwMsg({ text: 'Mot de passe modifié ✓', ok: true })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Profil ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Profil</div>
        <label className={styles.fLabel}>Email</label>
        <div className={styles.emailDisplay}>{email}</div>
        <div className={styles.setRow}>
          <div>
            <label className={styles.fLabel}>Prénom</label>
            <input
              type="text" className={styles.fInput} placeholder="Prénom"
              value={firstName} onChange={e => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className={styles.fLabel}>Nom</label>
            <input
              type="text" className={styles.fInput} placeholder="Nom"
              value={lastName} onChange={e => setLastName(e.target.value)}
            />
          </div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
          onClick={saveProfile} disabled={profileLoading}
        >
          {profileLoading ? 'ENREGISTREMENT…' : 'ENREGISTRER'}
        </button>
        {profileMsg && (
          <div className={`${styles.msg} ${profileMsg.ok ? styles.ok : styles.err}`}>
            {profileMsg.text}
          </div>
        )}
      </div>

      {/* ── Langue ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Langue</div>
        <select
          className={styles.fSelect}
          value={lang}
          onChange={e => saveLang(e.target.value)}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>

      {/* ── Thème ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Thème</div>
        <div className={styles.themeBtns}>
          <button
            className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`}
            onClick={() => handleTheme('light')}
          >
            ☀️ Clair
          </button>
          <button
            className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`}
            onClick={() => handleTheme('dark')}
          >
            🌙 Sombre
          </button>
        </div>
      </div>

      {/* ── Couleurs ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Mes couleurs</div>
        <div className={styles.cardSub}>Personnalise ton espace — n'impacte que ton compte.</div>
        <div className={styles.setRow} style={{ marginTop: 12 }}>
          <div>
            <label className={styles.fLabel}>Couleur principale</label>
            <input
              type="color" className={styles.colorInput}
              value={localC1}
              onChange={e => handleColorChange(e.target.value, localC2)}
            />
          </div>
          <div>
            <label className={styles.fLabel}>Couleur secondaire</label>
            <input
              type="color" className={styles.colorInput}
              value={localC2}
              onChange={e => handleColorChange(localC1, e.target.value)}
            />
          </div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnOutline} ${styles.btnBlock}`}
          onClick={resetColors}
        >
          REVENIR AUX COULEURS DU CLUB
        </button>
      </div>

      {/* ── Mot de passe ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Mot de passe</div>
        <input
          type="password" className={styles.fInput}
          placeholder="Nouveau mot de passe" autoComplete="new-password"
          value={pw1} onChange={e => setPw1(e.target.value)}
        />
        <input
          type="password" className={styles.fInput}
          placeholder="Confirmer le mot de passe" autoComplete="new-password"
          value={pw2} onChange={e => setPw2(e.target.value)}
          style={{ marginTop: 8 }}
        />
        {pwMsg && (
          <div className={`${styles.msg} ${pwMsg.ok ? styles.ok : styles.err}`}>
            {pwMsg.text}
          </div>
        )}
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
          style={{ marginTop: 4 }}
          onClick={changePassword} disabled={pwLoading}
        >
          {pwLoading ? 'MODIFICATION…' : 'CHANGER MON MOT DE PASSE'}
        </button>
      </div>

      {/* ── Wearables ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Wearables</div>
        <div className={styles.phBtns}>
          <button
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => showToast('Whoop — Bientôt disponible')}
          >CONNECTER WHOOP</button>
          <button
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => showToast('Oura — Bientôt disponible')}
          >CONNECTER OURA</button>
        </div>
      </div>

      {/* ── Déconnexion ── */}
      <button
        className={`${styles.btn} ${styles.btnDanger} ${styles.btnBlock}`}
        onClick={onLogout}
      >
        SE DÉCONNECTER
      </button>
    </>
  )
}
