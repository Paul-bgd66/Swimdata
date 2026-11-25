'use client'

import { createContext, useContext } from 'react'
import type { Club, Nageur, Groupe } from './types'

export interface CoachInfo {
  id: string
  name: string
  email: string
  role: string
}

export interface CoachContextValue {
  club:               Club | null
  coach:              CoachInfo | null
  nageurs:            Nageur[]
  colors:             { c1: string; c2: string }
  theme:              string
  lang:               string
  coachMode:          'club' | 'indiv'
  setCoachMode:       (m: 'club' | 'indiv') => void
  setLang:            (l: string) => void
  showToast:          (msg: string) => void
  // Groupes
  groupes:            Groupe[]
  groupeActif:        Groupe | null
  sousGroupes:        Groupe[]
  sousGroupeActif:    Groupe | null
  nageursFiltres:    Nageur[]
  setGroupeActif:     (g: Groupe) => void
  setSousGroupeActif: (g: Groupe | null) => void
  showGroupeSelect:   () => void
  updateGroupes:         (gs: Groupe[]) => void
  updateNageurGroupeId:  (id: string, groupeId: string | null) => void
  updateNageur:          (id: string, updates: Partial<Pick<Nageur, 'prenom' | 'nom'>>) => void
  removeNageur:          (id: string) => void
}

export const CoachContext = createContext<CoachContextValue | null>(null)

export function useCoach(): CoachContextValue {
  const ctx = useContext(CoachContext)
  if (!ctx) throw new Error('useCoach must be used within CoachContext.Provider')
  return ctx
}
