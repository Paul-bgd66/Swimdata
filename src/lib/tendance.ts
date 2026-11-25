export interface EtatJour {
  date:   string
  rmssd?: number | null
  note?:  number | null
  fc?:    number | null
}

export type Couleur = 'rouge' | 'orange' | 'vert'

export interface SerieResult {
  couleur:  Couleur | null
  streak:   number
  derniere: number | null
}

function normalize(e: EtatJour): number | null {
  if (e.note != null) return Math.max(0, Math.min(100, e.note))
  if (e.rmssd != null) return Math.round(Math.min(100, Math.max(0, (e.rmssd - 20) / 50 * 100)))
  return null
}

function toCouleur(val: number): Couleur {
  if (val < 34) return 'rouge'
  if (val < 67) return 'orange'
  return 'vert'
}

export function serieRecup(etats: EtatJour[]): SerieResult {
  const sorted = [...etats].sort((a, b) => a.date.localeCompare(b.date))
  const vals   = sorted.map(normalize).filter((v): v is number => v != null)

  if (vals.length === 0) return { couleur: null, streak: 0, derniere: null }

  const derniere = vals[vals.length - 1]
  const couleur  = toCouleur(derniere)

  // streak: consecutive non-orange zone at the end
  let streak = 0
  for (let i = vals.length - 1; i >= 0; i--) {
    if (toCouleur(vals[i]) === 'orange') break
    streak++
  }

  return { couleur, streak, derniere }
}

export async function chargerEtats(_nageurId: string): Promise<EtatJour[]> {
  return []
}
