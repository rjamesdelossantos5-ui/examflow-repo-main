'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import { exportSchoolFormat } from './exportExcel'
import { deleteFinishedRequest } from '../actions'
import type { RequestStatus } from '@/lib/supabase/types'

interface StudentRow {
  id: string
  status: RequestStatus
  exam_type: string
  excused_reason: string | null
  other_reason: string | null
  final_schedule: string | null
  submitted_at: string
  student_name: string
  student_number: string | null
  course: string | null
  year_level: number | null
  section: string | null
  subject_code: string
  subject_name: string
  teacher_name: string | null
  department_name: string | null
}

export default function StudentsList({ initial }: { initial: StudentRow[] }) {
  const [rows, setRows] = useState<StudentRow[]>(initial)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()

  const q = query.trim().toLowerCase()
  const visible = q ? rows.filter((r) => r.student_name.toLowerCase().includes(q)) : rows

  function handleDelete(id: string) {
    if (!confirm('Delete this record permanently? This removes the form and its uploaded files.')) return
    setPendingDelete(id)
    startTransition(async () => {
      const res = await deleteFinishedRequest(id)
      setPendingDelete(null)
      if (res.error) alert(res.error)
      else setRows((rs) => rs.filter((r) => r.id !== id))
    })
  }

  useEffect(() => {
    const supabase = createClient()

    // Realtime postgres_changes only supports simple filters (eq), not `in`, so
    // we subscribe to all changes on the table and re-fetch (fetchRows already
    // narrows to accepted/receipt_uploaded/scheduled). Refetches are coalesced
    // so a burst of changes triggers one query.
    let timer: ReturnType<typeof setTimeout> | null = null
    const refetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { fetchRows(supabase).then(setRows) }, 400)
    }

    const channel = supabase
      .channel('accepted-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_exam_requests' }, refetch)
      .subscribe()

    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel) }
  }, [])

  async function exportExcel() {
    await exportSchoolFormat(rows.map((r) => ({
      exam_type: r.exam_type,
      excused_reason: r.excused_reason,
      other_reason: r.other_reason,
      submitted_at: r.submitted_at,
      student_name: r.student_name,
      course: r.course,
      year_level: r.year_level,
      section: r.section,
      subject_code: r.subject_code,
      subject_name: r.subject_name,
    })))
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Accepted Students</h2>
          <p className="text-sm ef-muted">Live list — updates in real time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-56">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student name…"
              className="w-full rounded-lg px-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
              style={{ color: 'var(--card-foreground)' }}
            />
          </div>
          <button
            onClick={exportExcel}
            className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity shrink-0"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            ⬇ Export to Excel
          </button>
        </div>
      </div>

      <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-3">Student</th>
              <th className="px-3 py-3">No.</th>
              <th className="px-3 py-3">Course</th>
              <th className="px-3 py-3">Yr / Sec</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Teacher</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.student_name}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.student_number ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">{r.course ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">{r.year_level ?? '—'} / {r.section ?? '—'}</td>
                <td className="px-3 py-2">
                  <div>{r.subject_name}</div>
                  <div className="text-xs text-gray-400">{r.subject_code}</div>
                </td>
                <td className="px-3 py-2 text-gray-500">{r.teacher_name ?? '—'}</td>
                <td className="px-3 py-2 capitalize text-xs">{r.exam_type === 'paid' ? 'Paid' : 'Excused'}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={pendingDelete === r.id}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {pendingDelete === r.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">{rows.length === 0 ? 'No accepted students yet.' : 'No student matches your search.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function fetchRows(supabase: ReturnType<typeof createClient>): Promise<StudentRow[]> {
  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      profiles!student_id(full_name, student_number, course, year_level, section),
      subjects(
        subject_code, subject_name,
        profiles!teacher_id(full_name),
        departments(name)
      )
    `)
    .in('status', ['accepted', 'receipt_uploaded', 'scheduled'])
    .order('submitted_at', { ascending: false })

  return (data ?? []).map((r) => {
    const subj = r.subjects as unknown as {
      subject_code: string
      subject_name: string
      profiles: { full_name: string } | null
      departments: { name: string } | null
    }
    const student = r.profiles as unknown as {
      full_name: string
      student_number: string | null
      course: string | null
      year_level: number | null
      section: string | null
    } | null
    const s = r as { snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null; snap_year_level?: number | null; snap_section?: string | null }
    return {
      id: r.id,
      status: r.status as RequestStatus,
      exam_type: r.exam_type,
      excused_reason: (r.excused_reason as string | null) ?? null,
      other_reason: (r.other_reason as string | null) ?? null,
      final_schedule: r.final_schedule,
      submitted_at: r.submitted_at,
      student_name: s.snap_name ?? student?.full_name ?? '',
      student_number: s.snap_student_number ?? student?.student_number ?? null,
      course: s.snap_course ?? student?.course ?? null,
      year_level: s.snap_year_level ?? student?.year_level ?? null,
      section: s.snap_section ?? student?.section ?? null,
      subject_code: subj?.subject_code ?? '',
      subject_name: subj?.subject_name ?? '',
      teacher_name: subj?.profiles?.full_name ?? null,
      department_name: subj?.departments?.name ?? null,
    }
  }).filter((r) => r.status === 'scheduled' || (r.status === 'accepted' && r.exam_type === 'excused'))
}
