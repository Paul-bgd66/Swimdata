// Minimal i18n — keys from index.html t() system (fr/en/es).
// Add keys progressively as onglets are migrated.

const DICT: Record<string, Record<string, string>> = {
  // ── Nav ──
  'nav.seance':    { fr: 'Séance',      en: 'Session',   es: 'Sesión' },
  'nav.dashboard': { fr: 'Tableau',     en: 'Dashboard', es: 'Panel' },
  'nav.history':   { fr: 'Historique',  en: 'History',   es: 'Historial' },
  'nav.planning':  { fr: 'Planning',    en: 'Planner',   es: 'Plan' },
  'nav.video':     { fr: 'Vidéo',       en: 'Video',     es: 'Vídeo' },
  'nav.hrv':       { fr: 'HRV',         en: 'HRV',       es: 'HRV' },
  'nav.weight':    { fr: 'Poids',       en: 'Weight',    es: 'Peso' },
  'nav.perf':      { fr: 'Perfs',       en: 'Perfs',     es: 'Rendim.' },
  'nav.swimmers':  { fr: 'Nageurs',     en: 'Swimmers',  es: 'Nadores' },
  'nav.coachs':    { fr: 'Coachs',      en: 'Coaches',   es: 'Entren.' },
  'nav.settings':  { fr: 'Réglages',    en: 'Settings',  es: 'Ajustes' },

  // ── Common ──
  'loading':       { fr: 'Chargement…', en: 'Loading…',  es: 'Cargando…' },
  'error':         { fr: 'Erreur',      en: 'Error',     es: 'Error' },
  'logout':        { fr: 'Déconnexion', en: 'Logout',    es: 'Salir' },
  'not.migrated':  { fr: 'Pas encore migré — en cours de développement.', en: 'Not yet migrated — in development.', es: 'Aún no migrado.' },
  'old.version':   { fr: 'Ouvrir l\'ancienne version', en: 'Open old version', es: 'Abrir versión anterior' },
}

export function t(key: string, lang = 'fr'): string {
  return DICT[key]?.[lang] ?? DICT[key]?.['fr'] ?? key
}
