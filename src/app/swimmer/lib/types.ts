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

export interface SessionEntry {
  id:              string
  club_id?:        string
  coach_id?:       string
  name?:           string
  titre?:          string
  title?:          string
  date?:           string
  session_date?:   string
  day?:            string
  pool?:           string
  notes?:          string
  rows?:           unknown[]
  distance?:       number
  total_distance?: number
  total?:          number
  volume?:         number
  km?:             number
  saved_at?:       string
  created_at?:     string
  updated_at?:     string
  [key: string]:   unknown
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
