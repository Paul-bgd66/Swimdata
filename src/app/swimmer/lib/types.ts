export interface Perf {
  bassin: number
  nage: string
  distance: number
  temps: string
  date: string
  note?: string
}

export interface VideoEntry {
  id: string
  swimmer_id?: string
  name?: string
  date?: string
  type?: string
  notes?: string
  storage_path?: string
  swimmer_prenom?: string
  swimmer_nom?: string
}

export interface HrvEntry {
  date: string
  rmssd: number | null
  note?: number | null
  source?: string
  commentaire?: string
}

export interface PoidsEntry {
  date: string
  weight: number
}

export interface SwimmerMeta {
  role?: string
  clubId?: string
  coachId?: string
  firstName?: string
  lastName?: string
  lang?: string
  swimmerTheme?: string
  swimmerColor1?: string
  swimmerColor2?: string
  clubName?: string
  passwordSet?: boolean
}
