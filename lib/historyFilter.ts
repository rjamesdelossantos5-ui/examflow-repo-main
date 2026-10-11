/**
 * Log lines kept in the database (the audit trail) but not listed in any
 * request's on-screen history. The data privacy consent entry is written by
 * app/student/submit/actions.ts as the record that consent was given; it stays
 * in progress_logs, it just isn't shown.
 */
const HIDDEN_PREFIXES = ['Data privacy consent given']

export function shownInHistory(action: string): boolean {
  return !HIDDEN_PREFIXES.some((p) => action.startsWith(p))
}
