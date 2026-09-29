// Avatar initials from a person's name. Strips leading honorifics/titles so
// "Instructor Kid Valles" → "KV" (not "IK") and "Ms. Lara Camille Vergara" →
// "LV" (not "ML"), then takes the first + last remaining name initials.
const TITLES = new Set([
  'instructor', 'teacher', 'prof', 'professor', 'dr', 'doctor',
  'mr', 'mrs', 'ms', 'miss', 'sir', 'maam', "ma'am", 'madam',
  'engr', 'engineer', 'atty', 'attorney', 'hon',
])

export function initials(name: string): string {
  // School Microsoft accounts are named "Surname, Given (Student)", e.g.
  // "Bejo, Gabriel (Student)" — which gave "B(". Drop anything in brackets,
  // then read "Surname, Given" as given name + surname: "GB".
  const clean = (name ?? '').replace(/\([^)]*\)/g, ' ').trim()
  const comma = clean.indexOf(',')
  if (comma > 0) {
    const surname = letters(clean.slice(0, comma))
    const given = letters(clean.slice(comma + 1))
    const out = (given[0]?.[0] ?? '') + (surname[0]?.[0] ?? '')
    if (out) return out.toUpperCase()
  }

  let parts = letters(clean)
  // Drop any leading title words (e.g. "Ms." → "Ms").
  while (parts.length > 1 && TITLES.has(parts[0].toLowerCase())) {
    parts = parts.slice(1)
  }
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || 'U'
}

/** The words of a name with punctuation removed ("R." → "R", "Bejo," → "Bejo"). */
function letters(s: string): string[] {
  return s
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}'’-]/gu, ''))
    .filter((w) => /\p{L}/u.test(w))
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
