import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { isApproved } from '@/lib/didit'

/**
 * The Didit session behind a request the current user may review at first
 * approval — the ONE access check for the Program Head's view of a parent's ID
 * and selfie. The photo route and the "which photos exist" action both go
 * through here, so they cannot drift apart.
 *
 * Mirrors the First Approval queue (app/program-head/page.tsx): a Program Head
 * or admin; the request is waiting at first approval with the parent verified;
 * and a viewer with a department only sees that department's subjects
 * (keepMyDepartment in lib/deptFilter.ts). Read with the viewer's own RLS-bound
 * client, so the database's policies apply on top.
 *
 * sessionId is null for a request submitted before parent verification existed
 * — nothing to show, but not an error.
 */
export async function reviewableSession(requestId: string): Promise<
  { ok: true; sessionId: string | null } | { ok: false; reason: 'unauthorized' | 'not_found' }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthorized' }

  const { data: me } = await supabase.from('profiles').select('role, department_id').eq('id', user.id).single()
  if (!me || !['program_head', 'admin'].includes(me.role)) return { ok: false, reason: 'unauthorized' }

  const { data: req } = await supabase
    .from('special_exam_requests')
    .select('status, didit_session_id, didit_status, subjects(department_id)')
    .eq('id', requestId)
    .maybeSingle()
  if (!req || req.status !== 'approved_by_teacher') return { ok: false, reason: 'not_found' }

  const dept = (req.subjects as unknown as { department_id: string | null } | null)?.department_id ?? null
  if (me.department_id && dept !== me.department_id) return { ok: false, reason: 'not_found' }

  if (!req.didit_status) return { ok: true, sessionId: null }
  // Returned for re-verification and not passed again yet: the old photos were
  // deleted, and the new ones are not the Program Head's to see until it is
  // back in their queue.
  if (!isApproved(req.didit_status)) return { ok: false, reason: 'not_found' }
  return { ok: true, sessionId: (req.didit_session_id as string | null) ?? null }
}
