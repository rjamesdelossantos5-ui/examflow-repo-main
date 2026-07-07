// "2" -> "2nd Year", "3" -> "3rd Year", etc. Used anywhere a student's year
// level is shown to a reviewer, instead of the plain "Year 2".
export function ordinalYear(n: number | null | undefined): string {
  if (n == null) return '—'
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix} Year`
}
