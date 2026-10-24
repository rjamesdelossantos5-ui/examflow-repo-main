import { createClient } from '@/lib/supabase/server'
import { HIDDEN_PREFIXES } from '@/lib/historyFilter'
import ActivityTable, { type ActivityRow } from './ActivityTable'

export const metadata = { title: 'EXAMFLOW Admin — User Activity' }

/** Most rows the page loads at once. */
const LIMIT = 1000

// What every user did to a request, newest first, from progress_logs (the audit
// trail written by each submit / review / receipt / verification action). Admins
// can read all of it (logs_select policy). Rows are deleted with their request
// (on delete cascade), so a request purged after its exam takes its activity
// with it. Sign-ins are not here — they are in Login History.
export default async function UserActivityPage() {
  const supabase = await createClient()
  let query = supabase
    .from('progress_logs')
    .select(`
      id, actor_role, action, notes, created_at,
      actor:profiles!actor_id(full_name, email),
      request:special_exam_requests(
        student:profiles!student_id(full_name),
        subjects(subject_code)
      )
    `)
  // The consent record stays in the database but is not listed here (the same
  // lines every request's own history leaves out). Filtered in the query so the
  // hidden rows don't use up the LIMIT below.
  for (const prefix of HIDDEN_PREFIXES) query = query.not('action', 'like', `${prefix}%`)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  // Formatted here, in the school's time zone, so the server and the browser
  // can't disagree about the time shown.
  const fmt = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  const rows: ActivityRow[] = (data ?? []).map((r) => {
    const actor = r.actor as unknown as { full_name: string; email: string } | null
    const req = r.request as unknown as {
      student: { full_name: string } | null
      subjects: { subject_code: string } | null
    } | null
    return {
      id: r.id as string,
      name: actor?.full_name ?? '—',
      email: actor?.email ?? '',
      role: r.actor_role as string,
      action: r.action as string,
      notes: (r.notes as string | null) ?? null,
      subject: req?.subjects?.subject_code ?? null,
      student: req?.student?.full_name ?? null,
      when: fmt.format(new Date(r.created_at as string)),
    }
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>User Activity</h2>
        <p className="text-sm ef-muted">
          What students, teachers, the registrar, program heads and admins did on special exam requests, newest first.
          A request&apos;s activity is removed when the request is deleted. Sign-ins are in Login History.
        </p>
      </div>
      {error ? (
        <div role="alert" className="rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          Couldn&apos;t load user activity. Try reloading the page.
        </div>
      ) : (
        <ActivityTable rows={rows} capped={rows.length >= LIMIT} />
      )}
    </div>
  )
}
