'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/StatusBadge'
import { Icon } from '@/components/Icon'
import { toastError, toastSuccess } from '@/components/Toaster'
import { exportSchoolFormat, type ExportHeader } from './exportExcel'
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
  contact_number: string | null
  course: string | null
  year_level: number | null
  section: string | null
  subject_code: string
  subject_name: string
  teacher_name: string | null
  department_name: string | null
}

const REASON_LABEL: Record<string, string> = { medical: 'Medical', bereavement: 'Bereavement', other: 'Other' }

// "Oct 24, 2026, 4:14 PM" in the school's time zone.
const stampFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
})

// The request in a pop-up: who, what, when, and where it stands.
function RequestInfoModal({ r, onClose }: { r: StudentRow; onClose: () => void }) {
  useEscapeKey(onClose)
  const waived = r.exam_type !== 'paid'
  const reason = waived
    ? [REASON_LABEL[r.excused_reason ?? ''] ?? null, r.other_reason].filter(Boolean).join(': ') || null
    : null
  const fields: [string, string][] = [
    ['Student', r.student_name || '—'],
    ['Student no.', r.student_number ?? '—'],
    ['Contact no.', r.contact_number ?? '—'],
    ['Course', r.course ?? '—'],
    ['Year', r.year_level ? ordinalYear(r.year_level) : '—'],
    ['Section', r.section ?? '—'],
    ['Subject', `${r.subject_code ? `${r.subject_code} — ` : ''}${r.subject_name}`],
    ['Teacher', r.teacher_name ?? 'Not assigned'],
    ['Department', r.department_name ?? '—'],
    ['Exam type', waived ? (reason ? `Waived — ${reason}` : 'Waived') : 'Paid (Unexcused)'],
    ['Submitted', stampFmt.format(new Date(r.submitted_at))],
    ...(r.final_schedule ? [['Scheduled for', stampFmt.format(new Date(r.final_schedule))] as [string, string]] : []),
  ]
  return (
    <div className="ef-overlay fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-info-title"
        className="ef-dialog ef-card rounded-2xl shadow-xl max-w-lg md:max-w-3xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="request-info-title" className="font-bold text-lg md:text-2xl" style={{ color: 'var(--card-foreground)' }}>Request details</h3>
            <p className="text-sm md:text-base ef-muted">{r.subject_name}</p>
          </div>
          <StatusBadge status={r.status} />
        </div>
        <dl className="mt-4 md:mt-6 grid grid-cols-2 md:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-3 md:gap-y-5 text-sm md:text-base">
          {fields.map(([label, value]) => (
            <div key={label} className={label === 'Subject' || label === 'Exam type' ? 'col-span-2 md:col-span-3' : ''}>
              <dt className="text-xs md:text-sm ef-muted">{label}</dt>
              <dd className="font-medium break-words" style={{ color: 'var(--card-foreground)' }}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: 'var(--sti-yellow)', color: 'var(--sti-navy)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StudentsList({ initial, exportHeader }: { initial: StudentRow[]; exportHeader: ExportHeader }) {
  const [rows, setRows] = useState<StudentRow[]>(initial)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Find by student name or number, subject (code or name) or section.
  const [info, setInfo] = useState<StudentRow | null>(null)
  const closeInfo = useCallback(() => setInfo(null), [])
  const q = query.trim().toLowerCase()
  const visible = q
    ? rows.filter((r) =>
        [r.student_name, r.student_number, r.subject_code, r.subject_name, r.section].some((v) => (v ?? '').toLowerCase().includes(q)),
      )
    : rows
  const groups = groupByStudent(visible)

  function handleDelete(id: string) {
    if (!confirm('Delete this record permanently? This removes the form and its uploaded files.')) return
    setPendingDelete(id)
    startTransition(async () => {
      const res = await deleteFinishedRequest(id)
      setPendingDelete(null)
      if (res.error) toastError(res.error)
      else {
        setRows((rs) => rs.filter((r) => r.id !== id))
        toastSuccess('Record deleted')
      }
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
    if (rows.length === 0) {
      setExportMessage('No accepted students to export yet.')
      return
    }
    setExportMessage(null)
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
    })), exportHeader)
    toastSuccess('Excel file downloaded')
  }

  return (
    <div>
      {exportMessage && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          {exportMessage} <button className="underline ml-1" onClick={() => setExportMessage(null)}>Dismiss</button>
        </div>
      )}

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
              placeholder="Search name, subject or section…"
              aria-label="Search accepted students"
              className="w-full rounded-lg px-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-blue)]"
              style={{ color: 'var(--card-foreground)' }}
            />
          </div>
          <button
            onClick={exportExcel}
            className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity shrink-0"
            style={{ backgroundColor: 'var(--sti-yellow)', color: 'var(--sti-navy)' }}
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
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate" style={{ color: 'var(--card-foreground)' }}>{g.student.student_name}</p>
                    <p className="text-xs ef-muted truncate">
                      {g.student.student_number ?? '—'} · {g.student.course ?? '—'} · {ordinalYear(g.student.year_level)} · {g.student.section ?? '—'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--sti-yellow) 20%, transparent)', color: 'var(--card-foreground)' }}>
                    {g.forms.length} form{g.forms.length === 1 ? '' : 's'}
                  </span>
                  <Icon name="chevron-right" className={`w-4 h-4 ef-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>

                {/* Per-subject forms */}
                {open && (
                  <div className="border-t ef-border divide-y">
                    {g.forms.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 pl-16">
                        {/* Opens the request's details. Delete stays its own button. */}
                        <button
                          type="button"
                          onClick={() => setInfo(r)}
                          className="min-w-0 flex-1 text-left rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors -my-1 py-1 px-1 -mx-1"
                          title="View request details"
                        >
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--card-foreground)' }}>{r.subject_name}</p>
                          <p className="text-xs ef-muted truncate">{r.subject_code}{r.teacher_name ? ` · ${r.teacher_name}` : ''}</p>
                        </button>
                        <span className="text-2xs capitalize ef-muted shrink-0">{r.exam_type === 'paid' ? 'Paid' : 'Waived'}</span>
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

      {info && <RequestInfoModal r={info} onClose={closeInfo} />}
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
    const s = r as { snap_name?: string | null; snap_student_number?: string | null; snap_course?: string | null; snap_year_level?: number | null; snap_section?: string | null; snap_contact_number?: string | null }
    return {
      id: r.id,
      contact_number: s.snap_contact_number ?? null,
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
