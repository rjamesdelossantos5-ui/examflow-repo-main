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
