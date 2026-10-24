'use client'

import { useErrorToast, toastSuccess } from '@/components/Toaster'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Profile, Department } from '@/lib/supabase/types'
import { toggleUserActive, archiveUser, restoreUser, createUser, updateUser } from './actions'
import Select from '@/components/Select'
import SearchInput from '@/components/SearchInput'
import Pagination, { usePagination } from '@/components/Pagination'
import { Icon } from '@/components/Icon'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { initials } from '@/lib/initials'
import { programOf, yearOf } from '@/lib/schoolData'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

/** The order roles are listed in: the filter menu, and the table's sort. */
const ROLE_ORDER: string[] = ['admin', 'registrar', 'program_head', 'subject_teacher', 'student']

/**
 * One hue per role, used only as a light tint (avatar and role pill) with the
 * normal text colour on top, so it reads in light and dark mode alike. The
 * colour is a second cue; the role is always written out too.
 */
const ROLE_HUE: Record<string, string> = {
  admin: '#FDB913',
  registrar: '#3B82F6',
  program_head: '#8B5CF6',
  subject_teacher: '#10B981',
  student: '#64748B',
}
const tint = (role: string, pct: number) => `color-mix(in srgb, ${ROLE_HUE[role] ?? '#64748B'} ${pct}%, transparent)`

/** One class a teacher teaches: a subject in a section. */
export interface TeacherClass {
  section: string
  code: string
  name: string
}

/** One class (a subject in a section) a new teacher can be given. */
export interface ClassOption {
  id: string
  section: string
  code: string
  name: string
  /** Who teaches it now, or null when nobody does. */
  teacher: string | null
  /** That teacher's account id, so Edit can tick the classes a person already has. */
  teacherId?: string | null
}

/**
 * The Users page's role filter. Opens on hover for a mouse, and on click/tap
 * too, since touch screens have no hover. Kept here rather than changing the
 * shared Select, which every other dropdown uses.
 */
function RoleFilterMenu({
  value,
  onChange,
  counts,
  total,
}: {
  value: string
  onChange: (role: string) => void
  /** How many accounts each role has, shown beside its name. */
  counts: Record<string, number>
  total: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useEscapeKey(close, open)

  // A tap outside closes it (a mouse closes it on leave).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const options = [
    { value: '', label: `All roles (${total})` },
    ...ROLE_ORDER.map((r) => ({ value: r, label: `${ROLE_LABELS[r]} (${counts[r] ?? 0})` })),
  ]
  const selected = options.find((o) => o.value === value) ?? options[0]

  return (
    <div className="relative" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by role"
        className="w-52 rounded-lg px-3 py-2 text-sm border ef-border flex items-center justify-between text-left"
        style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
      >
        <span>{selected.label}</span>
        <Icon name="chevron-down" className={`w-4 h-4 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        // pt-1 (not mt-1) so the gap under the button is still part of this
        // element — moving the mouse down to the list doesn't close it.
        <div className="absolute z-30 top-full left-0 w-52 pt-1">
          <ul role="listbox" className="rounded-lg shadow-lg ef-card overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  style={
                    o.value === value
                      ? { backgroundColor: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)', color: 'var(--card-foreground)' }
                      : { color: 'var(--card-foreground)' }
                  }
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * A row's actions behind one "⋯" button. The list is position: fixed (placed
 * from the button's on-screen box) so the table's horizontal-scroll wrapper
 * can't clip it, and it opens upward when the row is near the bottom.
 */
function RowMenu({
  label,
  items,
}: {
  label: string
  items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; title?: string }[]
}) {
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setPos(null), [])
  useEscapeKey(close, !!pos)

  useEffect(() => {
    if (!pos) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setPos(null)
    }
    // The menu is pinned to where the button was; a scroll or resize would
    // leave it floating in the wrong place, so close it instead.
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos, close])

  function toggle() {
    if (pos) return setPos(null)
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const right = window.innerWidth - r.right
    const roomBelow = window.innerHeight - r.bottom
    setPos(roomBelow < 180 ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 })
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={`Actions for ${label}`}
        className="w-8 h-8 grid place-items-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        style={{ color: 'var(--card-foreground)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          className={`ef-menu fixed z-40 w-44 rounded-lg ef-card py-1 shadow-lg ${pos.bottom !== undefined ? 'ef-menu-up' : ''}`}
          style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              title={it.title}
              onClick={() => { setPos(null); it.onSelect() }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ color: it.danger ? 'var(--status-danger)' : 'var(--card-foreground)' }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const inputClass = 'w-full border rounded px-3 py-2 text-sm'

/**
 * Role, plus only the fields that role uses: a department for teachers and
 * Program Heads, student details for students, nothing extra for registrars
 * and admins. Shared by Create and Edit; `initial` pre-fills it for Edit.
 */
function RoleFields({
  role,
  onRoleChange,
  departments,
  sections,
  courseNames,
  classOptions,
  initialClassIds,
  initial,
  lockedStudentNumber,
}: {
  role: string
  onRoleChange: (role: string) => void
  departments: Department[]
  /** Every section that has classes, e.g. "BSIT 2-201". */
  sections: string[]
  /** Program code → full name, e.g. BSIT → Bachelor of Science in IT. */
  courseNames: Record<string, string>
  /** Classes a teacher can be given. */
  classOptions?: ClassOption[]
  /** Edit only: the classes this teacher already has, ticked when the form opens. */
  initialClassIds?: string[]
  initial?: Profile
  /** Set when the number comes from the person's school email: shown, not editable. */
  lockedStudentNumber?: string
}) {
  const usesDepartment = role === 'subject_teacher' || role === 'program_head'
  return (
    <>
      <div className={usesDepartment ? '' : 'col-span-2'}>
        <label className={labelClass}>Role *</label>
        <Select
          name="role"
          required
          value={role}
          onChange={onRoleChange}
          placeholder="— Select role —"
          options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          className={inputClass}
        />
      </div>
      {usesDepartment && (
        <div>
          <label className={labelClass}>Department{role === 'program_head' ? ' *' : ''}</label>
          <Select
            // Remounts when the role changes, so a choice made for one role
            // doesn't silently carry over to the other.
            key={role}
            name="department_id"
            required={role === 'program_head'}
            defaultValue={initial?.department_id ?? ''}
            placeholder={role === 'program_head' ? '— Select department —' : '— none —'}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            className={inputClass}
          />
        </div>
      )}
      {role === 'program_head' && (
        <p className="col-span-2 text-xs text-gray-500">They review the requests for subjects in this department.</p>
      )}
      {role === 'subject_teacher' && classOptions && classOptions.length > 0 && (
        <TeacherClassPicker classes={classOptions} initialPicked={initialClassIds} editing={!!initial} />
      )}
      {role === 'subject_teacher' && !(classOptions && classOptions.length > 0) && (
        <p className="col-span-2 text-xs text-gray-500">
          Their sections and subjects come from the Classes sheet of the School Data file — one row per class with this
          email as the Teacher Email. A section&apos;s teacher can also be changed on the Subjects page.
        </p>
      )}
      {role === 'student' && (
        <>
          <div>
            <label className={labelClass}>Student Number *</label>
            {lockedStudentNumber ? (
              <>
                <input name="student_number" value={lockedStudentNumber} readOnly className={`${inputClass} opacity-60 cursor-not-allowed`} />
                <p className="text-xs text-gray-500 mt-1">From their school email.</p>
              </>
            ) : (
              <input name="student_number" required defaultValue={initial?.student_number ?? ''} placeholder="02000123456" className={inputClass} />
            )}
          </div>
          <StudentClassFields sections={sections} courseNames={courseNames} initial={initial} />
        </>
      )}
    </>
  )
}

/**
 * The classes a NEW teacher takes over, picked from the classes that already
 * exist (from the School Data file), so adding a teacher needs no Excel import.
 * The picked ids are sent as `class_ids`. Taking a class over replaces its
 * current teacher; requests already sent keep the teacher they were sent to.
 */
function TeacherClassPicker({ classes, initialPicked = [], editing = false }: { classes: ClassOption[]; initialPicked?: string[]; editing?: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialPicked))
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? classes.filter((c) => [c.code, c.name, c.section].some((v) => v.toLowerCase().includes(q))) : classes
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="col-span-2">
      <label className={labelClass}>Classes they teach{editing ? '' : ' (optional)'} — {picked.size} selected</label>
      {/* Enter in the search box must not submit the whole form. */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
        placeholder="Search subject code, name or section…"
        className={inputClass}
      />
      <div className="mt-2 max-h-48 overflow-y-auto rounded border divide-y">
        {shown.map((c) => (
          <label key={c.id} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="mt-1" />
            <span className="min-w-0">
              <span className="font-mono text-xs">{c.code}</span> {c.name} · {c.section}
              <span className="block text-xs text-gray-500">{initialPicked.includes(c.id) ? 'They teach this class now' : c.teacher ? `Now taught by ${c.teacher} — picking it takes it over` : 'No teacher yet'}</span>
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-3 py-4 text-center text-xs text-gray-500">No class matches your search.</p>}
      </div>
      {[...picked].map((id) => <input key={id} type="hidden" name="class_ids" value={id} />)}
      {/* Tells Edit's save that this list was on screen, so an empty list means
          "no classes" and not "the list was never shown". */}
      {editing && <input type="hidden" name="class_ids_sent" value="1" />}
      <p className="mt-1 text-xs text-gray-500">
        {editing
          ? 'Untick a class to take it off this teacher; tick one to give it to them. Requests already sent keep their current teacher. For many people at once, use the Classes sheet of the School Data file.'
          : 'Requests already sent keep their current teacher. Classes can also be changed later on the Subjects page.'}
      </p>
    </div>
  )
}

/**
 * A student's course, year and section, picked from the sections that already
 * exist (the classes from the School Data file) instead of typed. Course, then
 * year, then section — each list narrows the next, the same as the student's
 * own submit form. With no sections yet (nothing imported) it falls back to
 * typing, so an account can still be made.
 */
function StudentClassFields({
  sections,
  courseNames,
  initial,
}: {
  sections: string[]
  courseNames: Record<string, string>
  initial?: Profile
}) {
  const [course, setCourse] = useState(initial?.course ?? '')
  const [year, setYear] = useState(initial?.year_level ? String(initial.year_level) : '')
  const [section, setSection] = useState(initial?.section ?? '')

  if (!sections.length) {
    return (
      <>
        <div>
          <label className={labelClass}>Course *</label>
          <input name="course" required defaultValue={initial?.course ?? ''} placeholder="BSIT" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Year Level *</label>
          <input name="year_level" required type="number" min={1} max={6} defaultValue={initial?.year_level ?? ''} placeholder="2" className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Section *</label>
          <input name="section" required defaultValue={initial?.section ?? ''} placeholder="BSIT 2-201" className={inputClass} />
        </div>
      </>
    )
  }

  // A value already saved on the account stays selectable even if no class uses
  // it any more, so editing that person never silently blanks it.
  const courses = [...new Set(sections.map(programOf).filter(Boolean))].sort()
  if (course && !courses.includes(course)) courses.push(course)
  const years = [...new Set(sections.filter((s) => programOf(s) === course).map(yearOf).filter((y): y is number => y !== null))].sort((a, b) => a - b)
  if (year && !years.includes(Number(year))) years.push(Number(year))
  const matching = sections.filter((s) => programOf(s) === course && String(yearOf(s)) === year)
  const sectionList = !section || matching.includes(section) ? matching : [...matching, section]

  return (
    <>
      <div>
        <label className={labelClass}>Course *</label>
        <Select
          name="course"
          required
          value={course}
          onChange={(v) => { setCourse(v); setYear(''); setSection('') }}
          placeholder="— Select course —"
          options={courses.map((c) => ({ value: c, label: courseNames[c] ? `${c} — ${courseNames[c]}` : c }))}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Year Level *</label>
        <Select
          name="year_level"
          required
          value={year}
          onChange={(v) => { setYear(v); setSection('') }}
          disabled={!course}
          placeholder={course ? '— Select year —' : 'Select a course first'}
          options={years.map((y) => ({ value: String(y), label: `Year ${y}` }))}
          className={inputClass}
        />
      </div>
      <div className="col-span-2">
        <label className={labelClass}>Section *</label>
        <Select
          name="section"
          required
          value={section}
          onChange={setSection}
          disabled={!year}
          placeholder={!year ? 'Select a year first' : sectionList.length ? '— Select section —' : 'No sections for that year'}
          options={sectionList.map((s) => ({ value: s, label: s }))}
          className={inputClass}
        />
      </div>
    </>
  )
}

/**
 * Admin user management: create accounts (any role), edit a person's role and
 * details, activate/deactivate, delete, and see what a teacher teaches. All
 * mutations go through the server actions in ./actions, which re-check the
 * admin role server-side.
 */
export default function UserTable({
  users,
  departments,
  classesByTeacher,
  currentUserId,
  sections,
  courseNames,
  classOptions,
  lockedStudentNumbers,
}: {
  users: Profile[]
  /** User id → student number taken from their school email; not editable. */
  lockedStudentNumbers: Record<string, string>
  departments: Department[]
  /** Every section that has classes — the choices for a student's section. */
  sections: string[]
  /** Program code → full name, for the course list. */
  courseNames: Record<string, string>
  /** Every class, for giving a new teacher their classes. */
  classOptions: ClassOption[]
  classesByTeacher: Record<string, TeacherClass[]>
  /** The signed-in admin — their own row gets no Deactivate/Archive. */
  currentUserId: string | null
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)
  // After a School Data import this list runs to hundreds — find by name,
  // email, student number or section, and narrow by role.
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  // Archived accounts are kept out of the main list and shown on their own.
  const [showArchived, setShowArchived] = useState(false)
  const archivedCount = useMemo(() => users.filter((u) => u.archived_at).length, [users])
  const listed = useMemo(() => users.filter((u) => !!u.archived_at === showArchived), [users, showArchived])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listed.filter((u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!q || [u.full_name, u.email, u.student_number, u.section].some((v) => (v ?? '').toLowerCase().includes(q))),
    )
  }, [listed, query, roleFilter])
  // One table, sorted by role (ROLE_ORDER) and then by name, which the page
  // already orders by. A role not in ROLE_ORDER sorts last; nobody is hidden.
  const rows = useMemo(() => {
    const rank = (r: string) => (ROLE_ORDER.includes(r) ? ROLE_ORDER.indexOf(r) : ROLE_ORDER.length)
    return [...visible].sort((a, b) => rank(a.role) - rank(b.role))
  }, [visible])
  const { items: pageRows, pagerProps } = usePagination(rows, `${query}|${roleFilter}|${showArchived}`)
  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of listed) c[u.role] = (c[u.role] ?? 0) + 1
    return c
  }, [listed])
  const [isPending, startTransition] = useTransition()

  const [newRole, setNewRole] = useState('')
  const closeCreate = useCallback(() => { setShowCreate(false); setNewRole('') }, [])
  useEscapeKey(closeCreate, showCreate)

  // The account being edited (null = dialog closed) and its chosen role.
  const [toEdit, setToEdit] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  useErrorToast(editError)
  const closeEdit = useCallback(() => { setToEdit(null); setEditError(null) }, [])
  useEscapeKey(closeEdit, !!toEdit && !isPending)

  // The teacher whose classes are shown (null = dialog closed).
  const [viewing, setViewing] = useState<Profile | null>(null)
  const closeViewing = useCallback(() => setViewing(null), [])
  useEscapeKey(closeViewing, !!viewing)

  // The account waiting for an Archive confirmation (null = dialog closed).
  const [toArchive, setToArchive] = useState<Profile | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  useErrorToast(archiveError)
  const closeArchive = useCallback(() => { setToArchive(null); setArchiveError(null) }, [])
  useEscapeKey(closeArchive, !!toArchive && !isPending)

  function handleToggle(userId: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleUserActive(userId, !current)
      if (res.error) setError(res.error)
      else toastSuccess(current ? 'User deactivated' : 'User activated')
    })
  }

  function confirmArchive() {
    if (!toArchive) return
    const userId = toArchive.id
    startTransition(async () => {
      const res = await archiveUser(userId)
      if (res.error) setArchiveError(res.error)
      else { setToArchive(null); toastSuccess('User archived') }
    })
  }

  function handleRestore(userId: string) {
    startTransition(async () => {
      const res = await restoreUser(userId)
      if (res.error) setError(res.error)
      else toastSuccess('User restored')
    })
  }

  function openEdit(u: Profile) {
    setEditError(null)
    setEditRole(u.role)
    setToEdit(u)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await createUser(fd)
      if (res.error) {
        setError(res.error)
      } else {
        closeCreate()
        form.reset()
        setError(null)
        toastSuccess('User created')
      }
    })
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!toEdit) return
    const userId = toEdit.id
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateUser(userId, fd)
      if (res.error) setEditError(res.error)
      else { closeEdit(); toastSuccess('User updated') }
    })
  }

  const editTeaches = toEdit ? classesByTeacher[toEdit.id]?.length ?? 0 : 0
  const viewingClasses = viewing ? classesByTeacher[viewing.id] ?? [] : []

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Users</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          + Add User
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="ef-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="ef-dialog bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--sti-navy)' }}>Create User</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Full Name *</label>
                <input name="full_name" required className={inputClass} />
              </div>
              {/* autoComplete stops the browser filling in the admin's own
                  saved login here — this form creates someone else's. */}
              <div className="col-span-2">
                <label className={labelClass}>Email *</label>
                <input name="email" type="email" required autoComplete="off" className={inputClass} />
                <p className="mt-1 text-xs text-gray-500">No password: they sign in with their Microsoft school account.</p>
              </div>
              <RoleFields role={newRole} onRoleChange={setNewRole} departments={departments} sections={sections} courseNames={courseNames} classOptions={classOptions} />
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => { closeCreate(); setError(null) }}
                  className="px-4 py-2 text-sm rounded border">Cancel</button>
                <button type="submit" disabled={isPending}
                  className="px-4 py-2 text-sm rounded font-semibold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                  {isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {toEdit && (
        <div className="ef-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={isPending ? undefined : closeEdit}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="ef-dialog bg-white rounded-2xl shadow-xl w-full max-w-[578px] md:max-w-3xl p-8 md:p-10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-user-title" className="text-lg md:text-2xl font-bold" style={{ color: 'var(--sti-navy)' }}>Edit User</h3>
            <p className="text-xs md:text-sm text-gray-500 mt-1 mb-4 md:mb-6 break-all">
              {toEdit.email} — the email is their login, so it can&apos;t be changed here.
            </p>
            {/* key: a fresh form per person, so one person's values never
                linger in another's. */}
            <form key={toEdit.id} onSubmit={handleEdit} className="grid grid-cols-2 gap-3 md:gap-5 md:text-base">
              <div className="col-span-2">
                <label className={labelClass}>Full Name *</label>
                <input name="full_name" required defaultValue={toEdit.full_name} className={inputClass} />
              </div>
              <RoleFields role={editRole} onRoleChange={setEditRole} departments={departments} sections={sections} courseNames={courseNames} classOptions={classOptions} initialClassIds={classOptions.filter((c) => c.teacherId === toEdit.id).map((c) => c.id)} initial={toEdit} lockedStudentNumber={lockedStudentNumbers[toEdit.id]} />
              {toEdit.role === 'subject_teacher' && editRole !== 'subject_teacher' && editTeaches > 0 && (
                <p className="col-span-2 rounded-md px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-800">
                  They teach {editTeaches} class{editTeaches === 1 ? '' : 'es'}. Those stay assigned to them — and new requests
                  for them still go to this person — until you pick another teacher on the Subjects page.
                </p>
              )}
              <p className="col-span-2 text-xs md:text-sm text-gray-500">
                If this person is in the School Data file, the next import sets these details from the file again.
              </p>
              {editError && (
                <p className="col-span-2 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700">{editError}</p>
              )}
              <div className="col-span-2 flex justify-end gap-2 md:gap-3 mt-2 md:mt-4">
                <button type="button" onClick={closeEdit} disabled={isPending}
                  className="px-4 py-2 md:px-6 md:py-2.5 text-sm md:text-base rounded border disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isPending}
                  className="px-4 py-2 md:px-6 md:py-2.5 text-sm md:text-base rounded font-semibold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
                  {isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* A teacher's classes */}
      {viewing && (
        <div className="ef-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeViewing}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-classes-title"
            className="ef-dialog ef-card rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="teacher-classes-title" className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>{viewing.full_name}</h3>
            <p className="text-xs ef-muted break-all">{viewing.email}</p>
            <p className="text-sm mt-3 mb-2" style={{ color: 'var(--card-foreground)' }}>
              Teaches <strong>{viewingClasses.length}</strong> class{viewingClasses.length === 1 ? '' : 'es'}
            </p>
            <div className="overflow-y-auto rounded-lg border ef-border">
              {viewingClasses.length ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b ef-border text-left text-xs font-semibold uppercase tracking-wide ef-muted">
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Section</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y ef-border">
                    {viewingClasses.map((c) => (
                      <tr key={`${c.code}|${c.section}`}>
                        <td className="px-3 py-2" style={{ color: 'var(--card-foreground)' }}>
                          <span className="font-mono text-xs">{c.code}</span> <span>{c.name}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--card-foreground)' }}>{c.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-3 py-6 text-center text-sm ef-muted">No classes yet — add them in the School Data file or on the Subjects page.</p>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button type="button" onClick={closeViewing} autoFocus
                className="px-4 py-2 text-sm rounded-lg font-semibold border ef-border" style={{ color: 'var(--card-foreground)' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {toArchive && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={isPending ? undefined : closeArchive}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-user-title"
            aria-describedby="archive-user-desc"
            className="ef-dialog ef-card rounded-lg md:rounded-2xl shadow-xl max-w-md md:max-w-xl w-full p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="archive-user-title" className="font-bold text-lg md:text-2xl" style={{ color: 'var(--card-foreground)' }}>Archive this account?</h3>

            {/* Who it is: name and email, the role as a small tag. No box. */}
            <div className="mt-4 md:mt-6 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm md:text-lg font-semibold break-words" style={{ color: 'var(--card-foreground)' }}>{toArchive.full_name}</p>
                {toArchive.email !== toArchive.full_name && <p className="text-xs md:text-sm ef-muted break-all mt-0.5">{toArchive.email}</p>}
              </div>
              <span className="shrink-0 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-semibold" style={{ background: 'color-mix(in srgb, var(--muted) 16%, transparent)', color: 'var(--card-foreground)' }}>
                {ROLE_LABELS[toArchive.role] ?? toArchive.role}
              </span>
            </div>

            <p id="archive-user-desc" className="mt-4 md:mt-6 text-sm md:text-base ef-muted">
              They can no longer log in and leave this list. Their data is kept, and you can restore the account from the Archived view.
            </p>

            {archiveError && (
              <p role="alert" className="mt-4 text-sm md:text-base" style={{ color: 'var(--status-danger)' }}>{archiveError}</p>
            )}

            <div className="mt-6 md:mt-8 flex justify-end gap-2 md:gap-3">
              <button
                type="button"
                onClick={closeArchive}
                disabled={isPending}
                autoFocus
                className="px-4 py-2.5 md:px-6 md:py-3 rounded-lg text-sm md:text-base font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50"
                style={{ color: 'var(--card-foreground)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={isPending}
                className="px-5 py-2.5 md:px-7 md:py-3 rounded-lg text-sm md:text-base font-semibold text-white transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--status-danger)' }}
              >
                {isPending ? 'Archiving…' : 'Archive account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, student no. or section…" label="Search users" />
        <RoleFilterMenu value={roleFilter} onChange={setRoleFilter} counts={roleCounts} total={listed.length} />
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          aria-label={showArchived ? 'Back to users' : `Show archived accounts (${archivedCount})`}
          className="px-3 py-2 rounded-lg text-sm font-semibold border ef-border transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          style={{ color: 'var(--card-foreground)', ...(showArchived ? { backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)', borderColor: 'transparent' } : {}) }}
        >
          {/* While the archive is open the same button takes you back to the users. */}
          {showArchived ? '← Back to users' : `Archived (${archivedCount})`}
        </button>
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {listed.length}</span>
      </div>

      {visible.length === 0 ? (
        <div className="ef-card rounded-xl px-4 py-8 text-center text-sm ef-muted">
          {listed.length ? 'No user matches your search.' : showArchived ? 'No archived accounts.' : 'No users found.'}
        </div>
      ) : (
        <>
        <div className="ef-card rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b ef-border text-left text-xs font-semibold ef-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden md:table-cell">Email</th>
                <th className="px-4 py-3 w-12"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y ef-border">
              {pageRows.map((u) => {
                const teaches = classesByTeacher[u.id]?.length ?? 0
                const isMe = u.id === currentUserId
                return (
                  <tr key={u.id} className="transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-3 ${u.is_active ? '' : 'opacity-60'}`}>
                        <span
                          aria-hidden
                          className="w-9 h-9 shrink-0 rounded-full grid place-items-center text-xs font-bold"
                          style={{ background: tint(u.role, 22), color: 'var(--card-foreground)' }}
                        >
                          {initials(u.full_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {u.role === 'subject_teacher' ? (
                              <button
                                type="button"
                                onClick={() => setViewing(u)}
                                className="text-left font-medium hover:underline underline-offset-2"
                                style={{ color: 'var(--card-foreground)' }}
                                title="See the subjects and sections they teach"
                              >
                                {u.full_name}
                              </button>
                            ) : (
                              <span className="font-medium" style={{ color: 'var(--card-foreground)' }}>{u.full_name}</span>
                            )}
                            {isMe && <span className="text-xs ef-muted">(you)</span>}
                            {/* No Status column: only the exception is marked. */}
                            {!u.is_active && (
                              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded ef-muted" style={{ border: '1px solid var(--border)' }}>
                                {u.archived_at ? 'Archived' : 'Inactive'}
                              </span>
                            )}
                          </div>
                          {u.role === 'subject_teacher' && (
                            <p className="text-xs ef-muted">{teaches ? `${teaches} class${teaches === 1 ? '' : 'es'}` : 'No classes'}</p>
                          )}
                          {/* The Email column is hidden on phones; show it here instead. */}
                          <p className="text-xs ef-muted break-all md:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: tint(u.role, 14), color: 'var(--card-foreground)' }}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 ef-muted hidden md:table-cell">{u.email}</td>
                    <td className="px-2 py-3 text-right">
                      <RowMenu
                        label={u.full_name}
                        items={u.archived_at ? [
                          { label: 'Restore', onSelect: () => handleRestore(u.id), disabled: isPending },
                        ] : [
                          { label: 'Edit', onSelect: () => openEdit(u), disabled: isPending },
                          ...(isMe
                            ? []
                            : [
                                {
                                  label: u.is_active ? 'Deactivate' : 'Activate',
                                  onSelect: () => handleToggle(u.id, u.is_active),
                                  disabled: isPending,
                                },
                                {
                                  label: 'Archive',
                                  danger: true,
                                  onSelect: () => { setArchiveError(null); setToArchive(u) },
                                  disabled: isPending,
                                },
                              ]),
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...pagerProps} />
        </>
      )}
    </div>
  )
}
