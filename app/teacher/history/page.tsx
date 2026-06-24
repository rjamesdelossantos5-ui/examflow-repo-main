import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import type { RequestStatus } from '@/lib/supabase/types'

export const metadata = { title: 'EXAMFLOW — Teacher History' }

export default async function TeacherHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name),
      subjects(subject_code, subject_name)
    `)
    .in('status', ['approved_by_teacher', 'accepted', 'receipt_uploaded', 'scheduled', 'rejected'])
    .order('submitted_at', { ascending: false })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Reviewed History</h2>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{(r as { snap_name?: string | null }).snap_name ?? (r.profiles as unknown as { full_name: string })?.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{(r.subjects as unknown as { subject_name: string })?.subject_name}</td>
                <td className="px-4 py-3 capitalize">{r.exam_type}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status as RequestStatus} /></td>
                <td className="px-4 py-3 text-gray-400">{new Date(r.submitted_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No reviewed requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
