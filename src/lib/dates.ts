// Local-time date utilities — never use toISOString() (UTC drift in UTC+1)

export function toLocalISO(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function todayLocal(): string {
  return toLocalISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalISO(d)
}

export function formatFr(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
