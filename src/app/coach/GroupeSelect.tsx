'use client'

import { useState, useEffect } from 'react'
import { useCoach } from '@/lib/coach-context'
import { getToken } from '@/lib/supabase'
import type { Groupe, Nageur } from '@/lib/types'
import styles from './groupe-select.module.css'

const COLOR_PALETTE = [
  '#2176FF', '#22C55E', '#EF4444', '#F59E0B',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
]

interface Confirm {
  title: string
  msg:   string
  onConfirm: () => Promise<void>
}

interface CreatingState { parentId: string | null }

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className={styles.colorRow}>
      {COLOR_PALETTE.map(c => (
        <button
          key={c}
          type="button"
          className={`${styles.colorDot} ${value === c ? styles.colorDotOn : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  )
}

export default function GroupeSelect() {
  const { club, coach, nageurs, groupes, colors, updateGroupes, setGroupeActif } = useCoach()

  const [creating,   setCreating]   = useState<CreatingState | false>(false)
  const [newNom,     setNewNom]     = useState('')
  const [newCouleur, setNewCouleur] = useState(COLOR_PALETTE[0])
  const [editId,     setEditId]     = useState<string | null>(null)
  const [editNom,    setEditNom]    = useState('')
  const [editCouleur, setEditCouleur] = useState(COLOR_PALETTE[0])
  const [confirm,    setConfirm]    = useState<Confirm | null>(null)
  const [errMsg,     setErrMsg]     = useState('')
  const [showMgr,    setShowMgr]    = useState(false)
  const [nageurGids, setNageurGids] = useState<Record<string, string | null>>({})
  const [saving,     setSaving]     = useState(false)

  const racine    = groupes.filter(g => !g.parentId)
  const sousGrMap = groupes.reduce<Record<string, Groupe[]>>((acc, g) => {
    if (g.parentId) {
      acc[g.parentId] = acc[g.parentId] || []
      acc[g.parentId].push(g)
    }
    return acc
  }, {})

  useEffect(() => {
    const map: Record<string, string | null> = {}
    nageurs.forEach(n => { map[n.id] = n.groupe_id ?? null })
    setNageurGids(map)
  }, [nageurs])

  function nagCount(id: string): number {
    const sg     = sousGrMap[id] || []
    const direct = nageurs.filter(n => n.groupe_id === id).length
    const sub    = sg.reduce((s, g) => s + nageurs.filter(n => n.groupe_id === g.id).length, 0)
    return direct + sub
  }

  function startEdit(g: Groupe) {
    setEditId(g.id)
    setEditNom(g.nom)
    setEditCouleur(g.couleur || COLOR_PALETTE[0])
    setErrMsg('')
  }

  async function apiCall(path: string, method: string, body?: object) {
    const token = await getToken()
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status)
    return data
  }

  async function handleCreate() {
    if (creating === false || !newNom.trim() || !club) return
    setSaving(true)
    setErrMsg('')
    try {
      const created = await apiCall('/api/groupes', 'POST', {
        clubId:   club.id,
        nom:      newNom.trim(),
        parentId: creating.parentId,
        couleur:  newCouleur,
      }) as Groupe & { error?: string }
      updateGroupes([...groupes, created])
      setCreating(false)
      setNewNom('')
      setNewCouleur(COLOR_PALETTE[0])
    } catch (e) {
      setErrMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRename() {
    if (!editId || !editNom.trim()) return
    setSaving(true)
    setErrMsg('')
    try {
      await apiCall('/api/groupes', 'PATCH', { id: editId, nom: editNom.trim(), couleur: editCouleur })
      updateGroupes(groupes.map(g =>
        g.id === editId ? { ...g, nom: editNom.trim(), couleur: editCouleur } : g
      ))
      setEditId(null)
    } catch (e) {
      setErrMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function askDelete(g: Groupe) {
    setErrMsg('')
    setConfirm({
      title: `Supprimer "${g.nom}" ?`,
      msg:   'Cette action est irréversible.',
      onConfirm: async () => {
        const token = await getToken()
        const res = await fetch(`/api/groupes?id=${encodeURIComponent(g.id)}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token },
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status)
        updateGroupes(groupes.filter(x => x.id !== g.id))
        setConfirm(null)
      },
    })
  }

  async function handleNageurGroupe(nageur: Nageur, groupeId: string | null) {
    setNageurGids(prev => ({ ...prev, [nageur.id]: groupeId }))
    const token = await getToken()
    fetch('/api/nageurs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ id: nageur.id, groupeId }),
    }).catch(() => {})
  }

  async function confirmAction() {
    if (!confirm) return
    setSaving(true)
    setErrMsg('')
    try {
      await confirm.onConfirm()
    } catch (e) {
      setErrMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.title}>Mes groupes</div>

      {racine.length === 0 && (
        <p className={styles.muted}>Aucun groupe. Créez votre premier groupe ci-dessous.</p>
      )}

      {racine.map(g => (
        <div key={g.id} className={styles.groupCard} style={{ borderColor: g.couleur || colors.c1 }}>
          <div className={styles.groupCardHdr}>
            {editId === g.id ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className={styles.inlineEdit}>
                  <input
                    className={styles.inlineInput}
                    value={editNom}
                    onChange={e => setEditNom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditId(null) }}
                    autoFocus
                  />
                  <button className={styles.inlineSave} style={{ background: editCouleur }} onClick={handleRename} disabled={saving}>✓</button>
                  <button className={styles.inlineCancel} onClick={() => setEditId(null)}>✕</button>
                </div>
                <ColorPicker value={editCouleur} onChange={setEditCouleur} />
              </div>
            ) : (
              <>
                <span className={styles.groupNom} style={{ color: g.couleur || colors.c1 }}>{g.nom}</span>
                <span className={styles.groupCount}>{nagCount(g.id)} nageur{nagCount(g.id) !== 1 ? 's' : ''}</span>
                <button className={styles.iconBtn} title="Renommer" onClick={() => startEdit(g)}>✏️</button>
                <button className={styles.iconBtn} title="Supprimer" onClick={() => askDelete(g)}>🗑️</button>
                <button className={styles.enterBtn} style={{ background: g.couleur || colors.c1 }} onClick={() => setGroupeActif(g)}>
                  Entrer →
                </button>
              </>
            )}
          </div>

          {/* sous-groupes */}
          <div className={styles.sgSection}>
            {(sousGrMap[g.id] || []).map(sg => (
              <div key={sg.id} className={styles.sgRow}>
                {editId === sg.id ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className={styles.inlineEdit}>
                      <input
                        className={styles.inlineInput}
                        value={editNom}
                        onChange={e => setEditNom(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditId(null) }}
                        autoFocus
                      />
                      <button className={styles.inlineSave} style={{ background: editCouleur }} onClick={handleRename} disabled={saving}>✓</button>
                      <button className={styles.inlineCancel} onClick={() => setEditId(null)}>✕</button>
                    </div>
                    <ColorPicker value={editCouleur} onChange={setEditCouleur} />
                  </div>
                ) : (
                  <>
                    <span className={styles.sgNom} style={{ color: sg.couleur || undefined }}>
                      ↳ {sg.nom}
                    </span>
                    <button className={styles.iconBtn} onClick={() => startEdit(sg)}>✏️</button>
                    <button className={styles.iconBtn} onClick={() => askDelete(sg)}>🗑️</button>
                  </>
                )}
              </div>
            ))}

            {creating !== false && creating.parentId === g.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className={styles.inlineEdit}>
                  <input
                    className={styles.inlineInput}
                    placeholder="Nom du sous-groupe"
                    value={newNom}
                    onChange={e => setNewNom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewNom('') } }}
                    autoFocus
                  />
                  <button className={styles.inlineSave} style={{ background: newCouleur }} onClick={handleCreate} disabled={saving}>✓</button>
                  <button className={styles.inlineCancel} onClick={() => { setCreating(false); setNewNom('') }}>✕</button>
                </div>
                <ColorPicker value={newCouleur} onChange={setNewCouleur} />
              </div>
            ) : (
              <button
                className={styles.addSgBtn}
                onClick={() => { setCreating({ parentId: g.id }); setNewNom(''); setNewCouleur(COLOR_PALETTE[0]) }}
              >
                + Sous-groupe
              </button>
            )}
          </div>
        </div>
      ))}

      {/* create new root group */}
      {creating !== false && creating.parentId === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className={styles.inlineEdit}>
            <input
              className={styles.inlineInput}
              placeholder="Nom du groupe"
              value={newNom}
              onChange={e => setNewNom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewNom('') } }}
              autoFocus
            />
            <button className={styles.inlineSave} style={{ background: newCouleur }} onClick={handleCreate} disabled={saving}>✓</button>
            <button className={styles.inlineCancel} onClick={() => { setCreating(false); setNewNom('') }}>✕</button>
          </div>
          <ColorPicker value={newCouleur} onChange={setNewCouleur} />
        </div>
      ) : (
        <button className={styles.addGroupBtn} onClick={() => { setCreating({ parentId: null }); setNewNom(''); setNewCouleur(COLOR_PALETTE[0]) }}>
          + Nouveau groupe
        </button>
      )}

      {errMsg && <p className={styles.errMsg}>{errMsg}</p>}

      {/* Manage swimmers */}
      {nageurs.length > 0 && (
        <>
          <button className={styles.mgrToggle} onClick={() => setShowMgr(v => !v)}>
            {showMgr ? '▲ Masquer' : '▼ Gérer les nageurs'}
          </button>
          {showMgr && (
            <div className={styles.mgrSection}>
              <div className={styles.mgrTitle}>Affectation des nageurs</div>
              {nageurs.map(n => (
                <div key={n.id} className={styles.mgrRow}>
                  <span className={styles.mgrName}>{n.prenom} {n.nom}</span>
                  <select
                    className={styles.mgrSelect}
                    value={nageurGids[n.id] ?? ''}
                    onChange={e => handleNageurGroupe(n, e.target.value || null)}
                  >
                    <option value="">— Sans groupe —</option>
                    {groupes.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.parentId ? `  ↳ ${g.nom}` : g.nom}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className={styles.confirmOverlay} onClick={() => { setConfirm(null); setErrMsg('') }}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>{confirm.title}</div>
            <div className={styles.confirmMsg}>{confirm.msg}</div>
            {errMsg && <p className={styles.errMsg}>{errMsg}</p>}
            <div className={styles.confirmBtns}>
              <button className={styles.confirmCancel} onClick={() => { setConfirm(null); setErrMsg('') }}>Annuler</button>
              <button className={styles.confirmDelete} onClick={confirmAction} disabled={saving}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
