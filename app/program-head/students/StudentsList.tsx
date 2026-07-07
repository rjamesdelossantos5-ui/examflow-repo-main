'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import { Icon } from '@/components/Icon'
import { exportSchoolFormat } from './exportExcel'
import { deleteFinishedRequest } from '../actions'
import { ordinalYear } from '@/lib/ordinal'
import type { RequestStatus } from '@/lib/supabase/types'

interface StudentGroup {
  key: string
  student: StudentRow
  forms: StudentRow[]
}

// Group a student's per-subject forms under one row. A student takes up to ~8
// subjects a term, so this collapses 8 rows into 1 expandable entry keyed by
// student number (falling back to name when no number is on record).
function groupByStudent(rows: StudentRow[]): StudentGroup[] {
  const map = new Map<string, StudentGroup>()
  for (const r of rows) {
    const key = r.student_number || r.student_name
    const g = map.get(key)
    if (g) g.forms.push(r)
    else map.set(key, { key, student: r, forms: [r] })
  }
  return [...map.values()]
}

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

  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const q = query.trim().toLowerCase()
  const visible = q ? rows.filter((r) => r.student_name.toLowerCase().includes(q)) : rows
  const groups = groupByStudent(visible)

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

      {groups.length === 0 ? (
        <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center ef-muted">
          {rows.length === 0 ? 'No accepted students yet.' : 'No student matches your search.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const open = openKeys.has(g.key)
            return (
              <div key={g.key} className="ef-card rounded-xl shadow-sm overflow-hidden">
                {/* Student header — click to expand all their forms */}
                <button
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                >
                  <span className="w-9 h-9 rounded-lg grid place-items-center font-bold text-sm shrink-0" style={{ background: 'var(--sti-navy)', color: 'var(--sti-gold)' }}>
                    {g.student.student_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate" style={{ color: 'var(--card-foreground)' }}>{g.student.student_name}</p>
                    <p className="text-xs ef-muted truncate">
                      {g.student.student_number ?? '—'} · {g.student.course ?? '—'} · {ordinalYear(g.student.year_level)} · {g.student.section ?? '—'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--sti-gold) 20%, transparent)', color: 'var(--card-foreground)' }}>
                    {g.forms.length} form{g.forms.length === 1 ? '' : 's'}
                  </span>
                  <Icon name="chevron-right" className={`w-4 h-4 ef-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>

                {/* Per-subject forms */}
                {open && (
                  <div className="border-t ef-border divide-y">
                    {g.forms.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 pl-16">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--card-foreground)' }}>{r.subject_name}</p>
                          <p className="text-xs ef-muted truncate">{r.subject_code}{r.teacher_name ? ` · ${r.teacher_name}` : ''}</p>
                        </div>
                        <span className="text-[11px] capitalize ef-muted shrink-0">{r.exam_type === 'paid' ? 'Paid' : 'Excused'}</span>
                        <StatusBadge status={r.status} />
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={pendingDelete === r.id}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 shrink-0"
                        >
                          {pendingDelete === r.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

async function fetchRows(supabase: ReturnType<typeof createClient>): Promise<StudentRow[]> {
  const { data } = await supabase
    .from('special_exam_requests')
    .select(`
      *,
      student:profiles!student_id(full_name, student_number, course, year_level, section),
      routed_teacher:profiles!teacher_id(full_name),
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
    const student = r.student as unknown as {
      full_name: string
      student_number: string | null
      course: string | null
      year_level: number | null
      section: string | null
    } | null
    const routedTeacher = r.routed_teacher as unknown as { full_name: string } | null
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
      teacher_name: routedTeacher?.full_name ?? subj?.profiles?.full_name ?? null,
      department_name: subj?.departments?.name ?? null,
    }
  }).filter((r) => r.status === 'scheduled' || (r.status === 'accepted' && r.exam_type === 'excused'))
}
