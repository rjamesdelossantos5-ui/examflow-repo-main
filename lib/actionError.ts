/**
 * Turns a raw database/storage error into a message that's safe and useful to
 * show a user, while keeping the real one in the server logs.
 *
 * Returning `error.message` straight from a server action (the old pattern) put
 * raw Postgres text in front of students and staff — e.g. "new row violates
 * row-level security policy for table \"special_exam_requests\"". That tells the
 * user nothing actionable, and it leaks table, column and policy names to
 * anyone who can trigger a failure.
 *
 * Usage:
 *   if (error) return { error: friendlyError('verifyRequest', error, 'Couldn't verify this request.') }
 */
export function friendlyError(context: string, error: unknown, userMessage: string): string {
  // Server-side only — visible in the Vercel logs, never sent to the browser.
  console.error(`[${context}]`, error)
  return userMessage
}

// Appended to most messages: nearly every failure here is a transient network /
// connection blip, and retrying genuinely fixes it.
export const RETRY_HINT = 'Please try again.'
