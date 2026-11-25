export interface EtatJour {
  date:      string
  sommeilH?: number | null  // heures de sommeil (wearable)
  recup?:    number | null  // récupération 0–100 (wearable)
  effort?:   number | null  // charge d'effort 0–100 (wearable)
}

export type Couleur = 'rouge' | 'orange' | 'vert'

export interface SerieResult {
  couleur:  Couleur | null
  streak:   number
  derniere: number | null
}

function normalize(e: EtatJour): number | null {
  if (e.recup != null) return Math.max(0, Math.min(100, e.recup))
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
