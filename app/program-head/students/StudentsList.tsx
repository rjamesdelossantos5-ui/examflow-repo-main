'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import StatusBadge from '@/components/StatusBadge'
import type { RequestStatus } from '@/lib/supabase/types'

interface StudentRow {
  id: string
  status: RequestStatus
  exam_type: string
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

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('accepted-students')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'special_exam_requests',
          filter: "status=in.(accepted,receipt_uploaded,scheduled)",
        },
        () => {
          // Re-fetch on any relevant change
          fetchRows(supabase).then(setRows)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function exportExcel() {
    const data = rows.map((r) => ({
      'Student Name': r.student_name,
      'Student Number': r.student_number ?? '',
      'Course': r.course ?? '',
      'Year Level': r.year_level ?? '',
      'Section': r.section ?? '',
      'Subject Code': r.subject_code,
      'Subject Name': r.subject_name,
      'Department': r.department_name ?? '',
      'Teacher': r.teacher_name ?? '',
      'Exam Type': r.exam_type === 'paid' ? 'Paid (Unexcused)' : 'Excused',
      'Status': r.status,
      'Schedule': r.final_schedule ? new Date(r.final_schedule).toLocaleString() : '',
      'Date Submitted': new Date(r.submitted_at).toLocaleDateString(),
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Accepted Students')
    XLSX.writeFile(wb, `examflow_accepted_students_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Accepted Students</h2>
          <p className="text-sm ef-muted">Live list — updates in real time</p>
        </div>
        <button
          onClick={exportExcel}
          className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity shrink-0"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          ⬇ Export to Excel
        </button>
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
              <th className="px-3 py-3">Schedule</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
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
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {r.final_schedule ? new Date(r.final_schedule).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No accepted students yet.</td></tr>
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
  })
}
