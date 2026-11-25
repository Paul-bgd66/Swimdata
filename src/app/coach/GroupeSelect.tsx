'use client'

import { useState, useEffect } from 'react'
import { useCoach } from '@/lib/coach-context'
import type { Groupe, Nageur } from '@/lib/types'
import styles from './groupe-select.module.css'

interface Confirm {
  title: string
  msg:   string
  onConfirm: () => Promise<void>
}

interface CreatingState {
  parentId: string | null
}

export default function GroupeSelect() {
  const { club, coach, nageurs, groupes, colors, updateGroupes, setGroupeActif } = useCoach()

  const [creating,  setCreating]  = useState<CreatingState | false>(false)
  const [newNom,    setNewNom]    = useState('')
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editNom,   setEditNom]   = useState('')
  const [confirm,   setConfirm]   = useState<Confirm | null>(null)
  const [errMsg,    setErrMsg]    = useState('')
  const [showMgr,   setShowMgr]   = useState(false)
  const [nageurGids, setNageurGids] = useState<Record<string, string | null>>({})
  const [saving,    setSaving]    = useState(false)

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
    const sg = sousGrMap[id] || []
    const direct = nageurs.filter(n => n.groupe_id === id).length
    const sub    = sg.reduce((s, g) => s + nageurs.filter(n => n.groupe_id === g.id).length, 0)
    return direct + sub
  }

  async function apiPost(nom: string, parentId: string | null): Promise<Groupe | null> {
    if (!club || !coach) return null
    const r = await fetch('/api/groupes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: coach.id, clubId: club.id, nom, parentId }),
    })
    const data = await r.json() as Groupe & { error?: string }
    if (!r.ok) throw new Error(data.error || 'Erreur serveur')
    return data
  }

  async function apiPatch(id: string, nom: string): Promise<void> {
    if (!coach) return
    const r = await fetch('/api/groupes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, coachId: coach.id, nom }),
    })
    const data = await r.json() as { error?: string }
    if (!r.ok) throw new Error(data.error || 'Erreur serveur')
  }

  async function apiDelete(id: string): Promise<void> {
    if (!coach) return
    const r = await fetch(`/api/groupes?id=${encodeURIComponent(id)}&coachId=${encodeURIComponent(coach.id)}`, {
      method: 'DELETE',
    })
    const data = await r.json() as { error?: string }
    if (!r.ok) throw new Error(data.error || 'Erreur serveur')
  }

  async function handleCreate() {
    if (creating === false || !newNom.trim()) return
    setSaving(true)
    setErrMsg('')
    try {
      const created = await apiPost(newNom.trim(), creating.parentId)
      if (!created) return
      updateGroupes([...groupes, created])
      setCreating(false)
      setNewNom('')
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
      await apiPatch(editId, editNom.trim())
      updateGroupes(groupes.map(g => g.id === editId ? { ...g, nom: editNom.trim() } : g))
      setEditId(null)
      setEditNom('')
    } catch (e) {
      setErrMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function askDelete(g: Groupe) {
    setConfirm({
      title: `Supprimer "${g.nom}" ?`,
      msg:   'Cette action est irréversible.',
      onConfirm: async () => {
        await apiDelete(g.id)
        updateGroupes(groupes.filter(x => x.id !== g.id))
        setConfirm(null)
      },
    })
  }

  async function handleNageurGroupe(nageur: Nageur, groupeId: string | null) {
    setNageurGids(prev => ({ ...prev, [nageur.id]: groupeId }))
    await fetch('/api/nageurs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      setSaving(false)
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
        <div key={g.id} className={styles.groupCard}>
          <div className={styles.groupCardHdr}>
            {editId === g.id ? (
              <div className={styles.inlineEdit} style={{ flex: 1 }}>
                <input
                  className={styles.inlineInput}
                  value={editNom}
                  onChange={e => setEditNom(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditId(null) }}
                  autoFocus
                />
                <button className={styles.inlineSave} style={{ background: colors.c1 }} onClick={handleRename} disabled={saving}>✓</button>
                <button className={styles.inlineCancel} onClick={() => setEditId(null)}>✕</button>
              </div>
            ) : (
              <>
                <span className={styles.groupNom}>{g.nom}</span>
                <span className={styles.groupCount}>{nagCount(g.id)} nageur{nagCount(g.id) !== 1 ? 's' : ''}</span>
                <button className={styles.iconBtn} title="Renommer" onClick={() => { setEditId(g.id); setEditNom(g.nom) }}>✏️</button>
                <button className={styles.iconBtn} title="Supprimer" onClick={() => askDelete(g)}>🗑️</button>
                <button className={styles.enterBtn} style={{ background: colors.c1 }} onClick={() => setGroupeActif(g)}>
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
                  <div className={styles.inlineEdit} style={{ flex: 1 }}>
                    <input
                      className={styles.inlineInput}
                      value={editNom}
                      onChange={e => setEditNom(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditId(null) }}
                      autoFocus
                    />
                    <button className={styles.inlineSave} style={{ background: colors.c1 }} onClick={handleRename} disabled={saving}>✓</button>
                    <button className={styles.inlineCancel} onClick={() => setEditId(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <span className={styles.sgNom}>↳ {sg.nom}</span>
                    <button className={styles.iconBtn} onClick={() => { setEditId(sg.id); setEditNom(sg.nom) }}>✏️</button>
                    <button className={styles.iconBtn} onClick={() => askDelete(sg)}>🗑️</button>
                  </>
                )}
              </div>
            ))}

            {creating !== false && creating.parentId === g.id ? (
              <div className={styles.inlineEdit}>
                <input
                  className={styles.inlineInput}
                  placeholder="Nom du sous-groupe"
                  value={newNom}
                  onChange={e => setNewNom(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewNom('') } }}
                  autoFocus
                />
                <button className={styles.inlineSave} style={{ background: colors.c1 }} onClick={handleCreate} disabled={saving}>✓</button>
                <button className={styles.inlineCancel} onClick={() => { setCreating(false); setNewNom('') }}>✕</button>
              </div>
            ) : (
              <button
                className={styles.addSgBtn}
                onClick={() => { setCreating({ parentId: g.id }); setNewNom('') }}
              >
                + Sous-groupe
              </button>
            )}
          </div>
        </div>
      ))}

      {/* create new root group */}
      {creating !== false && creating.parentId === null ? (
        <div className={styles.inlineEdit}>
          <input
            className={styles.inlineInput}
            placeholder="Nom du groupe"
            value={newNom}
            onChange={e => setNewNom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewNom('') } }}
            autoFocus
          />
          <button className={styles.inlineSave} style={{ background: colors.c1 }} onClick={handleCreate} disabled={saving}>✓</button>
          <button className={styles.inlineCancel} onClick={() => { setCreating(false); setNewNom('') }}>✕</button>
        </div>
      ) : (
        <button className={styles.addGroupBtn} onClick={() => { setCreating({ parentId: null }); setNewNom('') }}>
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
        <div className={styles.confirmOverlay} onClick={() => setConfirm(null)}>
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
