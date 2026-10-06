import { createClient } from '@/lib/supabase/server'
import LoginHistoryTable, { type LoginRow } from './LoginHistoryTable'

export const metadata = { title: 'EXAMFLOW Admin — Login History' }

/** Most rows the page loads at once; far above a normal 90 days. */
const LIMIT = 3000

// Every successful sign-in from the last 90 days, newest first
// (supabase/migration_login_history.sql; recorded by lib/loginHistory.ts).
export default async function LoginHistoryPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('login_history')
    .select('id, full_name, email, role, method, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  // Formatted here, in the school's time zone, so the server and the browser
  // can't disagree about the time shown.
  const fmt = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
  const rows: LoginRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.full_name as string,
    email: r.email as string,
    role: r.role as string,
    method: r.method as string,
    when: fmt.format(new Date(r.created_at as string)),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Login History</h2>
        <p className="text-sm ef-muted">
          Every sign-in from the last 90 days, newest first. Older entries are deleted automatically. Staying signed in
          doesn&apos;t add entries — only signing in does.
        </p>
      </div>
      {error ? (
        <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
          Login history isn&apos;t set up yet. Run <code>supabase/migration_login_history.sql</code> in the Supabase SQL
          editor.
        </div>
      ) : (
        <LoginHistoryTable rows={rows} capped={rows.length >= LIMIT} />
      )}
    </div>
  )
}
