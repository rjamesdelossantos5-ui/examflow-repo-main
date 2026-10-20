/**
 * The ONE definition of "a request a reviewer may see".
 *
 * A request reaches the Subject Teacher only once the parent has passed identity
 * verification AND the student has pressed Submit afterwards. Filling in the
 * form is not enough. The Program Head's First Approval uses the same rule, so a
 * request returned for re-verification stays out of sight until it is back.
 *
 * This used to be written out separately in several places — the queue, the nav
 * badge and the notification bell. Only the queue applied it, so the badge and
 * the bell announced forms that had not been submitted. Every caller now goes
 * through here so they cannot drift apart again.
 *
 * didit_status NULL is let through on purpose: those rows were submitted before
 * parent verification existed and have nothing to wait for. New rows are
 * stamped 'Not Started' in the same insert that creates them
 * (app/student/submit/actions.ts), so a new request can never be NULL.
 *
 * Tiers, tried in order, each one step less strict — a missing column makes
 * PostgREST error, and failing to an empty queue with no explanation is worse
 * than degrading to the rule the database can still express:
 */
const GATES: (string | null)[] = [
  // Full rule. Needs migration_didit.sql + migration_confirm_submit.sql.
  'didit_status.is.null,and(didit_status.eq.Approved,student_confirmed_at.not.is.null)',
  // student_confirmed_at missing: gate on the parent having passed.
  'didit_status.is.null,didit_status.eq.Approved',
  // didit_status missing too: the pre-verification behaviour, ungated.
  null,
]

/**
 * Runs `query` with the strictest gate the database supports. `query` receives
 * the PostgREST `or` filter to apply (or null for "no gate") and must apply it
 * with `.or(gate)` itself, since each caller builds a different query.
 */
export async function withSubmissionGate<R extends { error: unknown }>(
  query: (gate: string | null) => PromiseLike<R>,
): Promise<R> {
  let result!: R
  for (let i = 0; i < GATES.length; i++) {
    result = await query(GATES[i])
    if (!result.error) return result
    if (i < GATES.length - 1) {
      console.error(`[submissionGate] tier ${i + 1} unavailable — is ${i === 0 ? 'migration_confirm_submit.sql' : 'migration_didit.sql'} applied?`, result.error)
    }
  }
  return result
}
