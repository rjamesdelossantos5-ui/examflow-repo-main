// Avatar initials from a person's name. Strips leading honorifics/titles so
// "Instructor Kid Valles" → "KV" (not "IK") and "Ms. Lara Camille Vergara" →
// "LV" (not "ML"), then takes the first + last remaining name initials.
const TITLES = new Set([
  'instructor', 'teacher', 'prof', 'professor', 'dr', 'doctor',
  'mr', 'mrs', 'ms', 'miss', 'sir', 'maam', "ma'am", 'madam',
  'engr', 'engineer', 'atty', 'attorney', 'hon',
])

export function initials(name: string): string {
  let parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  // Drop any leading title words (handles a trailing period, e.g. "Ms.").
  while (parts.length > 1 && TITLES.has(parts[0].replace(/[.,]/g, '').toLowerCase())) {
    parts = parts.slice(1)
  }
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || 'U'
}

/**
 * Tidies a name for display. Accounts get created with names typed all in
 * lowercase ("james") or all caps ("JAMES"), which reads like a database glitch
 * in a greeting.
 *
 * Only those two uniform-case forms are corrected — a name that already carries
 * deliberate internal capitals (McDonald, DeLeon, van Dyke) is left exactly as
 * the person entered it, since we can't know better than they do. Capitals are
 * restored after apostrophes and hyphens too, so "o'brien" → "O'Brien" and
 * "mary-jane" → "Mary-Jane".
 */
export function displayName(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const uniformCase = word === word.toLowerCase() || word === word.toUpperCase()
      if (!uniformCase) return word
      return word.toLowerCase().replace(/(^|['’-])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase())
    })
    .join(' ')
}
