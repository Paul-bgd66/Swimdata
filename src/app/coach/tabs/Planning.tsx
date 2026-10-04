'use client'

import { useState, useEffect } from 'react'
import { useCoach } from '@/lib/coach-context'
import { INTS_DEFAULT, ICOLORS_DEFAULT, ILABELS_DEFAULT } from '@/lib/constants'
import { localDateStr } from '@/lib/helpers'
import styles from './planning.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const IBG: Record<string, string> = {
  AEC1: 'rgba(33,118,232,.1)',  AEC2: 'rgba(34,197,94,.1)',
  AEC3: 'rgba(230,170,0,.12)', ANC:  'rgba(239,68,68,.1)',
  ANP:  'rgba(168,85,247,.1)', AEP:  'rgba(249,115,22,.1)',
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const
type Day = typeof DAYS[number]

const DAYS_SHORT: Record<string, string> = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
  jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
}
const DAYS_FULL: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SlotType = 'NAT' | 'NATMUSC' | 'MUSC' | 'OFF'

interface PlanSlot {
  type:       SlotType
  time:       string
  pool:       string
  km:         number | string
  desc:       string
  intensites: string[]
}

interface PlanDay  { slots: (PlanSlot | null | undefined)[] }
interface PlanWeek {
  id:        string
  startDate: string
  mcNum:     number
  days:      Record<string, PlanDay>
}

interface SlotModal {
  weekId:   string
  day:      string
  slotIdx:  number
  existing: PlanSlot | null
}

interface Confirm { title: string; msg: string; onConfirm: () => void }

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  return m
}

function fmtWeekDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function weekKm(week: PlanWeek): number {
  return DAYS.reduce((tot, d) => {
    const slots = week.days[d]?.slots ?? []
    return tot + slots.reduce((s, slot) => s + (slot ? parseFloat(String(slot.km ?? 0)) || 0 : 0), 0)
  }, 0)
}

function slotTypeEmoji(type: SlotType): string {
  if (type === 'OFF')     return '❌'
  if (type === 'NATMUSC') return '🏊💪'
  if (type === 'MUSC')    return '💪'
  return '🏊'
}

function slotBg(type: SlotType): string {
  if (type === 'OFF')     return '#fff8f8'
  if (type === 'MUSC')    return '#fffbeb'
  if (type === 'NATMUSC') return '#eff6ff'
  return ''
}

// ── SlotCell sub-component ────────────────────────────────────────────────────

interface SlotCellProps {
  slot:    PlanSlot | null
  label:   string
  slotIdx: number
  weekId:  string
  day:     string
  onOpen:  (weekId: string, day: string, slotIdx: number) => void
}

function SlotCell({ slot, label, slotIdx, weekId, day, onOpen }: SlotCellProps) {
  return (
    <div
      className={`${styles.slotCell} ${slotIdx === 0 ? styles.slotMatin : styles.slotSoir}`}
      style={slot ? { background: slotBg(slot.type) } : {}}
      onClick={() => onOpen(weekId, day, slotIdx)}
    >
      <span className={styles.slotLbl}>{label}</span>
      {slot ? (
        <div className={styles.slotContent}>
          <span className={styles.slotEmoji}>{slotTypeEmoji(slot.type)}</span>
          {slot.desc && slot.type !== 'OFF' && (
            <span className={styles.slotDesc}>{slot.desc}</span>
          )}
          {(slot.intensites ?? []).length > 0 && (
            <div className={styles.slotInts}>
              {slot.intensites.map(k => (
                <span key={k} className={styles.itag}
                  style={{ background: IBG[k] ?? 'transparent', color: ICOLORS_DEFAULT[k] ?? '#555' }}>
                  {ILABELS_DEFAULT[k] ?? k}
                </span>
              ))}
            </div>
          )}
          {parseFloat(String(slot.km ?? 0)) > 0 && (
            <span className={styles.slotKm}>{slot.km}km</span>
          )}
        </div>
      ) : (
        <span className={styles.slotAdd}>+</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Planning() {
  const { club, coach, colors, showToast } = useCoach()

  const [weeks,   setWeeks]   = useState<PlanWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [slotMod, setSlotMod] = useState<SlotModal | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  // Slot editor form
  const [seType, setSeType] = useState<SlotType>('NAT')
  const [seTime, setSeTime] = useState('')
  const [sePool, setSePool] = useState('50m')
  const [seKm,   setSeKm]   = useState('')
  const [seDesc, setSeDesc] = useState('')
  const [seInts, setSeInts] = useState<string[]>([])

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!club || !coach) return
    fetch(`/api/planning?clubId=${encodeURIComponent(club.id)}&coachId=${encodeURIComponent(coach.id)}`)
      .then(r => r.ok ? r.json() : { weeks: [] })
      .then((data: { weeks?: PlanWeek[] }) => {
        const ws = (data.weeks ?? []).slice().sort((a, b) => a.startDate.localeCompare(b.startDate))
        ws.forEach((w, i) => { w.mcNum = i + 1 })
        setWeeks(ws)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [club, coach])

  // ── Add week ────────────────────────────────────────────────────────────────

  function handleAddWeek() {
    if (!club || !coach) return
    let startDate: string
    if (weeks.length) {
      const d = new Date(weeks[weeks.length - 1].startDate + 'T12:00')
      d.setDate(d.getDate() + 7)
      startDate = localDateStr(d)
    } else {
      startDate = localDateStr(getMonday(new Date()))
    }
    const week: PlanWeek = {
      id: uid(),
      startDate,
      mcNum: weeks.length + 1,
      days: Object.fromEntries(DAYS.map(d => [d, { slots: [] }])),
    }
    setWeeks(prev => [...prev, week])
    fetch('/api/planning', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: club.id, coachId: coach.id, weeks: [week] }),
    }).catch(e => console.warn('[addWeek]', e))
    showToast('Semaine ajoutée ✓')
  }

  // ── Delete week ─────────────────────────────────────────────────────────────

  function handleDeleteWeek(id: string) {
    setConfirm({
      title: 'Supprimer cette semaine ?',
      msg:   'Toutes les séances planifiées seront supprimées.',
      onConfirm: () => {
        setWeeks(prev =>
          prev.filter(w => w.id !== id).map((w, i) => ({ ...w, mcNum: i + 1 }))
        )
        setConfirm(null)
        if (!club || !coach) return
        fetch('/api/planning?' + new URLSearchParams({ clubId: club.id, coachId: coach.id, weekId: id }), { method: 'DELETE' })
          .catch(e => console.warn('[deleteWeek]', e))
        showToast('Semaine supprimée.')
      },
    })
  }

  // ── Open slot editor ────────────────────────────────────────────────────────

  function openSlotEditor(weekId: string, day: string, slotIdx: number) {
    const week = weeks.find(w => w.id === weekId)
    if (!week) return
    const existing = (week.days[day]?.slots?.[slotIdx] ?? null) as PlanSlot | null
    setSeType(existing?.type ?? 'NAT')
    setSeTime(existing?.time ?? '')
    setSePool(existing?.pool ?? '50m')
    setSeKm(existing?.km != null && parseFloat(String(existing.km)) > 0 ? String(existing.km) : '')
    setSeDesc(existing?.desc ?? '')
    setSeInts(existing?.intensites ?? [])
    setSlotMod({ weekId, day, slotIdx, existing })
  }

  // ── Save slot ───────────────────────────────────────────────────────────────

  function handleSaveSlot() {
    if (!slotMod || !club || !coach) return
    const newSlot: PlanSlot = {
      type: seType, time: seTime, pool: sePool,
      km: parseFloat(seKm) || 0, desc: seDesc, intensites: seInts,
    }
    setWeeks(prev => prev.map(w => {
      if (w.id !== slotMod.weekId) return w
      const slots = [...(w.days[slotMod.day]?.slots ?? [])] as (PlanSlot | null | undefined)[]
      slots[slotMod.slotIdx] = newSlot
      const updated: PlanWeek = { ...w, days: { ...w.days, [slotMod.day]: { slots } } }
      fetch('/api/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: club.id, coachId: coach.id, weeks: [updated] }),
      }).catch(e => console.warn('[saveSlot]', e))
      return updated
    }))
    setSlotMod(null)
    showToast('Séance enregistrée ✓')
  }

  // ── Delete slot ─────────────────────────────────────────────────────────────

  function handleDeleteSlot() {
    if (!slotMod || !club || !coach) return
    setWeeks(prev => prev.map(w => {
      if (w.id !== slotMod.weekId) return w
      const slots = [...(w.days[slotMod.day]?.slots ?? [])] as (PlanSlot | null | undefined)[]
      slots.splice(slotMod.slotIdx, 1)
      const updated: PlanWeek = { ...w, days: { ...w.days, [slotMod.day]: { slots } } }
      fetch('/api/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: club.id, coachId: coach.id, weeks: [updated] }),
      }).catch(e => console.warn('[deleteSlot]', e))
      return updated
    }))
    setSlotMod(null)
    showToast('Créneau supprimé.')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <p className={styles.muted}>Chargement…</p>

  const slotModalDay   = slotMod?.day ?? ''
  const slotModalLabel = slotMod ? (slotMod.slotIdx === 0 ? 'Matin' : 'Soir') : ''

  return (
    <div className={styles.root}>
      <button
        className={styles.addWeekBtn}
        style={{ borderColor: colors.c1, color: colors.c1 }}
        onClick={handleAddWeek}
      >
        + Semaine
      </button>

      {weeks.length === 0 ? (
        <p className={styles.muted}>
          Aucune semaine planifiée — cliquez sur «&nbsp;+ Semaine&nbsp;» pour commencer.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thMc}>MC</th>
                {DAYS.map(d => <th key={d} className={styles.thDay}>{DAYS_SHORT[d]}</th>)}
                <th className={styles.thKm}>km</th>
                <th className={styles.thDel}></th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(week => {
                const km = weekKm(week)
                return (
                  <tr key={week.id}>
                    <td className={styles.tdMc}>
                      <div className={styles.mcNum}>MC{week.mcNum}</div>
                      <div className={styles.mcDate}>{fmtWeekDate(week.startDate)}</div>
                    </td>

                    {DAYS.map(day => {
                      const slots = week.days[day]?.slots ?? []
                      const m = (slots[0] as PlanSlot | null | undefined) || null
                      const s = (slots[1] as PlanSlot | null | undefined) || null
                      return (
                        <td key={day} className={styles.tdDay}>
                          <SlotCell slot={m} label="M" slotIdx={0} weekId={week.id} day={day} onOpen={openSlotEditor} />
                          <SlotCell slot={s} label="S" slotIdx={1} weekId={week.id} day={day} onOpen={openSlotEditor} />
                        </td>
                      )
                    })}

                    <td className={styles.tdKm}>
                      {km > 0
                        ? <><strong>{km.toFixed(1)}</strong><br /><span className={styles.kmSub}>km</span></>
                        : <span className={styles.kmDash}>—</span>}
                    </td>

                    <td className={styles.tdDelCell}>
                      <button className={styles.delWeekBtn} onClick={() => handleDeleteWeek(week.id)} title="Supprimer la semaine">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Slot editor modal ── */}
      {slotMod && (
        <div className={styles.modalBk} onClick={() => setSlotMod(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHdr}>
              <span className={styles.modalTitle}>
                {DAYS_FULL[slotModalDay]} — {slotModalLabel}
              </span>
              <button className={styles.modalClose} onClick={() => setSlotMod(null)}>✕</button>
            </div>

            {/* Type */}
            <div className={styles.fLabel}>Type</div>
            <div className={styles.typeRow}>
              {(['NAT', 'NATMUSC', 'MUSC', 'OFF'] as SlotType[]).map(tp => (
                <button
                  key={tp}
                  className={`${styles.typeBtn} ${seType === tp ? styles.typeBtnOn : ''}`}
                  style={seType === tp ? { background: colors.c1, borderColor: colors.c1, color: '#fff' } : {}}
                  onClick={() => setSeType(tp)}
                >
                  {tp === 'NATMUSC' ? 'NAT+MUSC' : tp}
                </button>
              ))}
            </div>

            {seType !== 'OFF' && (
              <>
                <div className={styles.fLabel}>Heure</div>
                <input
                  type="time"
                  className={styles.fInput}
                  value={seTime}
                  onChange={e => setSeTime(e.target.value)}
                />

                <div className={styles.fLabel}>Bassin</div>
                <select className={styles.fInput} value={sePool} onChange={e => setSePool(e.target.value)}>
                  <option value="25m">25 m</option>
                  <option value="50m">50 m</option>
                </select>

                <div className={styles.fLabel}>Distance (km)</div>
                <input
                  type="number"
                  step="0.1"
                  className={styles.fInput}
                  placeholder="ex: 4.5"
                  inputMode="decimal"
                  value={seKm}
                  onChange={e => setSeKm(e.target.value)}
                />

                <div className={styles.fLabel}>Description</div>
                <input
                  type="text"
                  className={styles.fInput}
                  placeholder="Type de séance…"
                  value={seDesc}
                  onChange={e => setSeDesc(e.target.value)}
                />

                <div className={styles.fLabel}>Intensités</div>
                <div className={styles.intsRow}>
                  {INTS_DEFAULT.map(k => (
                    <button
                      key={k}
                      className={`${styles.intBtn} ${seInts.includes(k) ? styles.intBtnOn : ''}`}
                      style={seInts.includes(k)
                        ? { background: IBG[k] ?? 'transparent', borderColor: ICOLORS_DEFAULT[k], color: ICOLORS_DEFAULT[k] }
                        : {}}
                      onClick={() => setSeInts(prev =>
                        prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
                      )}
                    >
                      {ILABELS_DEFAULT[k]}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className={styles.modalBtns}>
              {slotMod.existing && (
                <button className={styles.deleteSlotBtn} onClick={handleDeleteSlot}>
                  Supprimer
                </button>
              )}
              <button className={styles.cancelBtn} onClick={() => setSlotMod(null)}>
                Annuler
              </button>
              <button
                className={styles.saveBtn}
                style={{ background: colors.c1 }}
                onClick={handleSaveSlot}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirm && (
        <div className={styles.confirmOverlay} onClick={() => setConfirm(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmTitle}>{confirm.title}</div>
            <div className={styles.confirmMsg}>{confirm.msg}</div>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>Annuler</button>
              <button className={styles.confirmDelete} onClick={confirm.onConfirm}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
