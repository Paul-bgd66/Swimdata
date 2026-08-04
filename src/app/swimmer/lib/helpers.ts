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

export function todayStr(): string {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
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
