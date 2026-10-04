// ── Intensités (identiques à index.html) ─────────────────────────────────

export const INTS_DEFAULT = ['AEC1', 'AEC2', 'AEC3', 'ANC', 'ANP', 'AEP'] as const
export type IntKey = typeof INTS_DEFAULT[number]

export const ICOLORS_DEFAULT: Record<string, string> = {
  AEC1: '#2176e8',
  AEC2: '#22c55e',
  AEC3: '#e6aa00',
  ANC:  '#ef4444',
  ANP:  '#a855f7',
  AEP:  '#f97316',
}

export const ILABELS_DEFAULT: Record<string, string> = {
  AEC1: 'AEC1',
  AEC2: 'AEC2',
  AEC3: 'AEC3',
  ANC:  'ANC',
  ANP:  'ANP',
  AEP:  'AEP',
}

// ── Thèmes couleurs club (identiques à index.html THEMES) ────────────────

export const THEMES: Record<string, { name: string; color1: string; color2: string; navBg: string }> = {
  default:  { name: 'Bleu / Or',          color1: '#1560bd', color2: '#f5c400', navBg: '#0b2550' },
  red:      { name: 'Rouge / Blanc',       color1: '#dc2626', color2: '#ffffff', navBg: '#1a0505' },
  green:    { name: 'Vert / Noir',         color1: '#16a34a', color2: '#111827', navBg: '#052e16' },
  purple:   { name: 'Violet / Orange',     color1: '#7c3aed', color2: '#f97316', navBg: '#1e1040' },
  dark:     { name: 'Noir / Bleu',         color1: '#1e3a5f', color2: '#38bdf8', navBg: '#0a0f1a' },
  ocean:    { name: 'Cyan / Doré',         color1: '#0891b2', color2: '#eab308', navBg: '#082f3a' },
  cherry:   { name: 'Cerise / Rose',       color1: '#be123c', color2: '#fda4af', navBg: '#1c0712' },
  forest:   { name: 'Forêt / Lime',        color1: '#15803d', color2: '#a3e635', navBg: '#052e16' },
  navy:     { name: 'Marine / Argent',     color1: '#1e40af', color2: '#cbd5e1', navBg: '#0c1a3d' },
  sunset:   { name: 'Orange / Jaune',      color1: '#ea580c', color2: '#fbbf24', navBg: '#1a0c02' },
  royal:    { name: 'Bleu roi / Or',       color1: '#2563eb', color2: '#d4af37', navBg: '#0f1d3d' },
  mint:     { name: 'Menthe / Blanc',      color1: '#0d9488', color2: '#f0fdfa', navBg: '#042f2e' },
  wine:     { name: 'Bordeaux / Crème',    color1: '#7f1d1d', color2: '#fef3c7', navBg: '#1c0606' },
  electric: { name: 'Bleu élec. / Rose',   color1: '#2176e8', color2: '#ec4899', navBg: '#0a1628' },
  earth:    { name: 'Terre / Sable',       color1: '#78350f', color2: '#fde68a', navBg: '#1c1004' },
  ice:      { name: 'Glace / Blanc',       color1: '#0ea5e9', color2: '#f8fafc', navBg: '#0c2d3f' },
  fire:     { name: 'Feu / Noir',          color1: '#ef4444', color2: '#1f2937', navBg: '#1a0505' },
  gold:     { name: 'Or / Marine',         color1: '#d4af37', color2: '#1e3a5f', navBg: '#1a1505' },
}

export function resolveClubColors(club: { theme?: string; color1?: string; color2?: string }): { c1: string; c2: string } {
  const th = THEMES[club.theme || 'default'] ?? THEMES.default
  return {
    c1: club.color1 || th.color1,
    c2: club.color2 || th.color2,
  }
}
