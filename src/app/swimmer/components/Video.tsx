'use client'

import { useState } from 'react'
import styles from './video.module.css'
import { fmtDate, todayStr } from '../lib/helpers'
import type { VideoEntry, SwimmerMeta } from '../lib/types'

// ── Play icon (▶) ─────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ConfirmState {
  title:     string
  message:   string
  onConfirm: () => void
}

interface Props {
  videos:         VideoEntry[]
  userId:         string
  meta:           SwimmerMeta
  onVideosChange: (v: VideoEntry[]) => void
  showToast:      (msg: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Video({ videos, userId, meta, onVideosChange, showToast }: Props) {
  const coachVideos = videos.filter(v => v.type !== 'swimmer-upload')
  const myVideos    = videos.filter(v => v.type === 'swimmer-upload')

  // ── Play modal ─────────────────────────────────────────────────────────────

  const [playVid,    setPlayVid]    = useState<VideoEntry | null>(null)
  const [signedUrl,  setSignedUrl]  = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [playError,  setPlayError]  = useState<string | null>(null)

  async function openPlay(v: VideoEntry) {
    if (!v.storage_path) { showToast('Vidéo introuvable'); return }
    setPlayVid(v); setSignedUrl(null); setPlayError(null); setLoadingUrl(true)
    try {
      const q = new URLSearchParams({
        clubId:      meta.clubId    ?? '',
        coachId:     meta.coachId   ?? '',
        storagePath: v.storage_path,
      })
      const r = await fetch('/api/videos?' + q.toString())
      const data = await r.json()
      if (!r.ok || !data.signedUrl) throw new Error(data.error || 'URL indisponible')
      setSignedUrl(data.signedUrl)
    } catch (e) {
      setPlayError((e as Error).message)
    } finally {
      setLoadingUrl(false)
    }
  }

  function closePlay() { setPlayVid(null); setSignedUrl(null); setPlayError(null) }

  // ── Upload modal ───────────────────────────────────────────────────────────

  const [uploadOpen,  setUploadOpen]  = useState(false)
  const [uploadFile,  setUploadFile]  = useState<File | null>(null)
  const [uploadName,  setUploadName]  = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadMsg,   setUploadMsg]   = useState('')
  const [uploading,   setUploading]   = useState(false)

  function openUpload() {
    setUploadFile(null); setUploadName(''); setUploadNotes('')
    setUploadMsg(''); setUploading(false); setUploadOpen(true)
  }

  function closeUpload() { setUploadOpen(false) }

  async function submitUpload() {
    if (!uploadFile) { setUploadMsg('Sélectionne un fichier vidéo.'); return }
    setUploading(true); setUploadMsg('')
    try {
      const videoId = crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(36).slice(2)
      const ext = (uploadFile.name.split('.').pop() ?? 'mp4').toLowerCase()

      // Step 1 — get signed upload URL
      const q = new URLSearchParams({
        clubId:      meta.clubId  ?? '',
        coachId:     meta.coachId ?? '',
        videoId, ext,
        contentType: uploadFile.type || 'video/mp4',
      })
      const r1   = await fetch('/api/videos-upload?' + q.toString())
      const d1   = await r1.json()
      if (!r1.ok || !d1.signedUrl) throw new Error(d1.error || 'Signed URL indisponible')

      // Step 2 — upload file directly to storage
      const r2 = await fetch(d1.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type || 'video/mp4' },
        body: uploadFile,
      })
      if (!r2.ok) throw new Error(`Échec de l'upload (${r2.status})`)

      // Step 3 — save metadata
      const vidMeta = {
        clubId:        meta.clubId, coachId: meta.coachId,
        swimmerId:     userId,
        swimmerPrenom: meta.firstName ?? '',
        swimmerNom:    meta.lastName  ?? '',
        videoId,
        name:          uploadName || uploadFile.name,
        date:          todayStr(),
        type:          'swimmer-upload',
        notes:         uploadNotes,
        storagePath:   d1.storagePath,
        annotations:   [],
      }
      const r3 = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vidMeta),
      })
      const d3 = await r3.json()
      if (!r3.ok) throw new Error(d3.error || 'Erreur métadonnées')

      const newVid: VideoEntry = {
        id:           videoId,
        swimmer_id:   userId,
        name:         vidMeta.name,
        date:         vidMeta.date,
        type:         'swimmer-upload',
        notes:        uploadNotes,
        storage_path: d1.storagePath,
      }
      onVideosChange([...videos, newVid])
      closeUpload()
      showToast('Vidéo envoyée à ton coach ✓')
    } catch (e) {
      setUploadMsg((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // ── Delete — swimmer-upload uniquement, avec confirm ──────────────────────

  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  function handleDelete(v: VideoEntry) {
    setConfirm({
      title:   'Supprimer cette vidéo ?',
      message: v.name || 'Vidéo sans titre',
      onConfirm: () => {
        onVideosChange(videos.filter(x => x.id !== v.id))
        setConfirm(null)
        const q = new URLSearchParams({
          clubId:      meta.clubId    ?? '',
          coachId:     meta.coachId   ?? '',
          videoId:     v.id,
          storagePath: v.storage_path ?? '',
        })
        fetch('/api/videos?' + q.toString(), { method: 'DELETE' })
          .catch(e => console.warn('[delVideo]', (e as Error).message))
      },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Coach videos ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Vidéos de mon coach</div>
        {coachVideos.length === 0 ? (
          <div className={styles.empty}>Aucune vidéo de ton coach pour le moment.</div>
        ) : (
          coachVideos.map(v => (
            <div key={v.id} className={styles.vidRow} onClick={() => openPlay(v)}>
              <div className={styles.vidThumb}><PlayIcon /></div>
              <div className={styles.vidInfo}>
                <div className={styles.vidName}>{v.name || 'Vidéo'}</div>
                <div className={styles.vidMeta}>
                  {fmtDate(v.date ?? '')}{v.notes ? ' · ' + v.notes : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── My videos ── */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Mes vidéos</div>
        {myVideos.length === 0 ? (
          <div className={styles.empty}>Tu n'as pas encore envoyé de vidéo.</div>
        ) : (
          myVideos.map(v => (
            <div key={v.id} className={styles.vidRow} onClick={() => openPlay(v)}>
              <div className={styles.vidThumb}><PlayIcon /></div>
              <div className={styles.vidInfo}>
                <div className={styles.vidName}>{v.name || 'Vidéo'}</div>
                <div className={styles.vidMeta}>
                  {fmtDate(v.date ?? '')}{v.notes ? ' · ' + v.notes : ''}
                </div>
              </div>
              {/* × uniquement sur les vidéos uploadées par le nageur */}
              <button
                className={styles.delBtn}
                title="Supprimer"
                onClick={e => { e.stopPropagation(); handleDelete(v) }}
              >×</button>
            </div>
          ))
        )}
        <button
          className={`${styles.btn} ${styles.btnOutline} ${styles.btnBlock}`}
          style={{ marginTop: 12 }}
          onClick={openUpload}
        >
          + ENVOYER UNE VIDÉO À MON COACH
        </button>
      </div>

      {/* ── Play modal ── */}
      {playVid && (
        <div className={styles.modalBk} onClick={closePlay}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              {playVid.name || 'Vidéo'}
              <button className={styles.modalX} onClick={closePlay}>×</button>
            </div>
            {loadingUrl && <div className={styles.empty}>Chargement de la vidéo…</div>}
            {playError && <div className={`${styles.msg} ${styles.err}`}>{playError}</div>}
            {signedUrl && (
              <>
                <video
                  controls playsInline
                  style={{ width: '100%', borderRadius: 10, background: '#000' }}
                  src={signedUrl}
                />
                {playVid.notes && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 10 }}>
                    {playVid.notes}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Upload modal ── */}
      {uploadOpen && (
        <div className={styles.modalBk} onClick={closeUpload}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              Envoyer une vidéo
              <button className={styles.modalX} onClick={closeUpload}>×</button>
            </div>
            <label className={styles.fLabel}>Fichier vidéo</label>
            <input
              type="file" accept="video/*" className={styles.fInput}
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <label className={styles.fLabel}>Titre</label>
            <input
              type="text" className={styles.fInput}
              placeholder="ex: Virage crawl"
              value={uploadName} onChange={e => setUploadName(e.target.value)}
            />
            <label className={styles.fLabel}>Commentaire pour le coach</label>
            <textarea
              className={`${styles.fInput} ${styles.fTextarea}`}
              rows={3} placeholder="Optionnel"
              value={uploadNotes} onChange={e => setUploadNotes(e.target.value)}
            />
            {uploadMsg && <div className={`${styles.msg} ${styles.err}`}>{uploadMsg}</div>}
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
              style={{ marginTop: 4 }}
              onClick={submitUpload} disabled={uploading}
            >
              {uploading ? 'ENVOI EN COURS…' : 'ENVOYER'}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirm && (
        <div className={styles.confirmOverlay} onClick={() => setConfirm(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>{confirm.title}</div>
            <div className={styles.confirmMsg}>{confirm.message}</div>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>
                Annuler
              </button>
              <button className={styles.confirmDelete} onClick={confirm.onConfirm}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
