// ── Distance formatting ───────────────────────────────────────────────────

export function fkm(m: number): string {
  return m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : m + ' m'
}

export function fkms(m: number): string {
  return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : m + ' m'
}

export function fmtDist(m: number): string {
  if (!m) return '0 m'
  return m >= 1000
    ? (Math.round(m / 100) / 10).toLocaleString('fr-FR') + ' km'
    : Math.round(m) + ' m'
}

export function fDistUnit(m: number, unit = 'm'): string {
  return unit === 'km' ? fkms(m) : fmtDist(m)
}

// ── Date helpers ──────────────────────────────────────────────────────────

export function localDateStr(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

export function todayStr(): string {
  return localDateStr(new Date())
}

export function fmtDate(iso: string, lang = 'fr'): string {
  if (!iso) return ''
  const locales: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' }
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(locales[lang] || 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── Performance time parsing ──────────────────────────────────────────────

export function parseTemps(t: string | null | undefined): number {
  if (t == null) return Infinity
  const s = String(t).trim().replace(',', '.')
  const m = s.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/)
  if (!m) return Infinity
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2])
}

export function seasonStart(): string {
  const now = new Date()
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${y}-09-01`
}
