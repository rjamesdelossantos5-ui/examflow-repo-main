// A student's number is the school prefix plus the digits already in their
// school email: bejo.344860@stamaria.sti.edu.ph → 02000344860 (prefix given by
// the project team, 2026-09-28). Used only to pre-fill forms — the student can
// still correct it, and nothing is saved until they submit or press Save.
export const STUDENT_NUMBER_PREFIX = '02000'

export function studentNumberFromEmail(email: string | null | undefined): string | null {
  const domain = process.env.SCHOOL_EMAIL_DOMAIN?.trim().toLowerCase()
  const e = (email ?? '').trim().toLowerCase()
  if (!domain || !e.endsWith(domain)) return null
  const digits = e.slice(0, -domain.length).match(/\.(\d{4,})$/)?.[1]
  return digits ? STUDENT_NUMBER_PREFIX + digits : null
}
