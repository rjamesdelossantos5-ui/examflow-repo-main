import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'

export const metadata = { title: 'EXAMFLOW — My Requests' }

export default async function StudentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: requests } = await supabase
    .from('special_exam_requests')
    .select('*, subjects(subject_code, subject_name)')
    .eq('student_id', user.id)
    .order('submitted_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--sti-navy)' }}>
            Welcome, {profile?.full_name}
          </h1>
          <p className="text-sm text-gray-500">Manage your special exam requests below.</p>
        </div>
        <Link
          href="/student/submit"
          className="px-5 py-2.5 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          + Submit New Request
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(requests ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3">
                  <div className="font-medium">{(r.subjects as { subject_name: string })?.subject_name}</div>
                  <div className="text-xs text-gray-400">{(r.subjects as { subject_code: string })?.subject_code}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.exam_type === 'paid' ? 'bg-yellow-50 text-yellow-700' : 'bg-teal-50 text-teal-700'}`}>
                    {r.exam_type === 'paid' ? 'Paid' : 'Excused'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.submitted_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/student/requests/${r.id}`} className="text-xs text-blue-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(!requests || requests.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No requests yet.{' '}
                  <Link href="/student/submit" className="text-blue-600 hover:underline">Submit your first request.</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
