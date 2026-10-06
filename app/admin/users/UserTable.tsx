'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Profile, Department } from '@/lib/supabase/types'
import { toggleUserActive, deleteUser, createUser, updateUser } from './actions'
import Select from '@/components/Select'
import SearchInput from '@/components/SearchInput'
import { Icon } from '@/components/Icon'
import { useEscapeKey } from '@/lib/useEscapeKey'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

/** The order the per-role tables appear in on the Users page. */
const ROLE_ORDER: string[] = ['admin', 'registrar', 'program_head', 'subject_teacher', 'student']

/** One class a teacher teaches: a subject in a section. */
export interface TeacherClass {
  section: string
  code: string
  name: string
}

/**
 * The Users page's role filter. Opens on hover for a mouse, and on click/tap
 * too, since touch screens have no hover. Kept here rather than changing the
 * shared Select, which every other dropdown uses.
 */
function RoleFilterMenu({ value, onChange }: { value: string; onChange: (role: string) => void }) {
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

  const options = [{ value: '', label: 'All roles' }, ...ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }))]
  const selected = options.find((o) => o.value === value) ?? options[0]

  return (
    <div className="relative" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by role"
        className="w-44 rounded-lg px-3 py-2 text-sm border ef-border flex items-center justify-between text-left"
        style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
      >
        <span>{selected.label}</span>
        <Icon name="chevron-down" className={`w-4 h-4 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        // pt-1 (not mt-1) so the gap under the button is still part of this
        // element — moving the mouse down to the list doesn't close it.
        <div className="absolute z-30 top-full left-0 w-44 pt-1">
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
  initial,
}: {
  role: string
  onRoleChange: (role: string) => void
  departments: Department[]
  initial?: Profile
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
      {role === 'subject_teacher' && (
        <p className="col-span-2 text-xs text-gray-500">
          Their sections and subjects come from the Classes sheet of the School Data file — one row per class with this
          email as the Teacher Email. A section&apos;s teacher can also be changed on the Subjects page.
        </p>
      )}
      {role === 'student' && (
        <>
          <div>
            <label className={labelClass}>Student Number</label>
            <input name="student_number" defaultValue={initial?.student_number ?? ''} placeholder="02000123456" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Course</label>
            <input name="course" defaultValue={initial?.course ?? ''} placeholder="BSIT" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Year Level</label>
            <input name="year_level" type="number" min={1} max={6} defaultValue={initial?.year_level ?? ''} placeholder="2" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Section</label>
            <input name="section" defaultValue={initial?.section ?? ''} placeholder="BSIT 2-201" className={inputClass} />
          </div>
        </>
      )}
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
  adminRemovalOn,
}: {
  users: Profile[]
  departments: Department[]
  classesByTeacher: Record<string, TeacherClass[]>
  /** The signed-in admin — their own row gets no Deactivate/Delete. */
  currentUserId: string | null
  /** "Allow removing admin accounts" in Admin → Settings. */
  adminRemovalOn: boolean
}) {
  // Mirrors blockedAccountRemoval in ./actions, which is the real check.
  const removalBlocked = (u: Profile) =>
    u.role === 'admin' && !adminRemovalOn
      ? 'Admin account — turn on "Allow removing admin accounts" in Settings to change this.'
      : null
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // After a School Data import this list runs to hundreds — find by name,
  // email, student number or section, and narrow by role.
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!q || [u.full_name, u.email, u.student_number, u.section].some((v) => (v ?? '').toLowerCase().includes(q))),
    )
  }, [users, query, roleFilter])
  // The visible users split into one table per role. A role not in ROLE_ORDER
  // still gets its own table at the end, so no account is ever hidden.
  const groups = useMemo(() => {
    const roles = [...ROLE_ORDER, ...new Set(visible.map((u) => u.role).filter((r) => !ROLE_ORDER.includes(r)))]
    return roles
      .map((role) => ({ role, label: ROLE_LABELS[role] ?? role, rows: visible.filter((u) => u.role === role) }))
      .filter((g) => g.rows.length > 0)
  }, [visible])
  const [isPending, startTransition] = useTransition()

  const [newRole, setNewRole] = useState('')
  const closeCreate = useCallback(() => { setShowCreate(false); setNewRole('') }, [])
  useEscapeKey(closeCreate, showCreate)

  // The account being edited (null = dialog closed) and its chosen role.
  const [toEdit, setToEdit] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const closeEdit = useCallback(() => { setToEdit(null); setEditError(null) }, [])
  useEscapeKey(closeEdit, !!toEdit && !isPending)

  // The teacher whose classes are shown (null = dialog closed).
  const [viewing, setViewing] = useState<Profile | null>(null)
  const closeViewing = useCallback(() => setViewing(null), [])
  useEscapeKey(closeViewing, !!viewing)

  // The account waiting for a Delete confirmation (null = dialog closed).
  const [toDelete, setToDelete] = useState<Profile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const closeDelete = useCallback(() => { setToDelete(null); setDeleteError(null) }, [])
  useEscapeKey(closeDelete, !!toDelete && !isPending)

  function handleToggle(userId: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleUserActive(userId, !current)
      if (res.error) setError(res.error)
    })
  }

  function confirmDelete() {
    if (!toDelete) return
    const userId = toDelete.id
    startTransition(async () => {
      const res = await deleteUser(userId)
      if (res.error) setDeleteError(res.error)
      else setToDelete(null)
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
      else closeEdit()
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
              <div>
                <label className={labelClass}>Email *</label>
                <input name="email" type="email" required autoComplete="off" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
              </div>
              <RoleFields role={newRole} onRoleChange={setNewRole} departments={departments} />
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
            className="ef-dialog bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-user-title" className="text-lg font-bold" style={{ color: 'var(--sti-navy)' }}>Edit User</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4 break-all">
              {toEdit.email} — the email is their login, so it can&apos;t be changed here.
            </p>
            {/* key: a fresh form per person, so one person's values never
                linger in another's. */}
            <form key={toEdit.id} onSubmit={handleEdit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Full Name *</label>
                <input name="full_name" required defaultValue={toEdit.full_name} className={inputClass} />
              </div>
              <RoleFields role={editRole} onRoleChange={setEditRole} departments={departments} initial={toEdit} />
              {toEdit.role === 'subject_teacher' && editRole !== 'subject_teacher' && editTeaches > 0 && (
                <p className="col-span-2 rounded-md px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-800">
                  They teach {editTeaches} class{editTeaches === 1 ? '' : 'es'}. Those stay assigned to them — and new requests
                  for them still go to this person — until you pick another teacher on the Subjects page.
                </p>
              )}
              <p className="col-span-2 text-xs text-gray-500">
                If this person is in the School Data file, the next import sets these details from the file again.
              </p>
              {editError && (
                <p className="col-span-2 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700">{editError}</p>
              )}
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeEdit} disabled={isPending}
                  className="px-4 py-2 text-sm rounded border disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isPending}
                  className="px-4 py-2 text-sm rounded font-semibold disabled:opacity-50"
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

      {/* Delete confirmation */}
      {toDelete && (
        <div className="ef-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={isPending ? undefined : closeDelete}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            aria-describedby="delete-user-desc"
            className="ef-dialog ef-card rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-user-title" className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Delete this account?</h3>

            <div className="mt-3 rounded-lg border ef-border px-3 py-2.5">
              <p className="text-sm font-semibold break-all" style={{ color: 'var(--card-foreground)' }}>{toDelete.full_name}</p>
              {toDelete.email !== toDelete.full_name && <p className="text-xs ef-muted break-all">{toDelete.email}</p>}
              <p className="text-xs ef-muted mt-0.5">{ROLE_LABELS[toDelete.role] ?? toDelete.role}</p>
            </div>

            <p id="delete-user-desc" className="mt-3 text-sm ef-muted">
              Their login and profile are removed for good. If they are in the School Data file, importing it again creates a new account for them.
            </p>

            {deleteError && (
              <p className="mt-3 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{deleteError}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={closeDelete}
                disabled={isPending}
                autoFocus
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border disabled:opacity-50"
                style={{ color: 'var(--card-foreground)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--status-danger)' }}
              >
                {isPending ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, student no. or section…" label="Search users" />
        <RoleFilterMenu value={roleFilter} onChange={setRoleFilter} />
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {users.length}</span>
      </div>

      {/* One table per role, in ROLE_ORDER; a role with no matching user is left out. */}
      {visible.length === 0 && (
        <div className="bg-white rounded-xl shadow px-4 py-8 text-center text-sm text-gray-400">
          {users.length ? 'No user matches your search.' : 'No users found.'}
        </div>
      )}
      <div className="space-y-6">
        {groups.map(({ role, label, rows }) => (
          <section key={role} aria-labelledby={`role-${role}`}>
            <h3 id={`role-${role}`} className="text-sm font-semibold text-gray-700 mb-2">
              {label} <span className="font-normal text-gray-500 tabular-nums">({rows.length})</span>
            </h3>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((u) => {
              const teaches = classesByTeacher[u.id]?.length ?? 0
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.role === 'subject_teacher' ? (
                      <button
                        type="button"
                        onClick={() => setViewing(u)}
                        className="text-left hover:underline underline-offset-2"
                        title="See the subjects and sections they teach"
                      >
                        {u.full_name}
                        <span className="block text-xs font-normal text-gray-500">
                          {teaches ? `${teaches} class${teaches === 1 ? '' : 'es'}` : 'No classes'}
                        </span>
                      </button>
                    ) : (
                      u.full_name
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    {u.id === currentUserId ? (
                      <span className="text-xs text-gray-500 self-center">This is you</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggle(u.id, u.is_active)}
                          // Activating is always allowed; deactivating may be blocked.
                          disabled={isPending || (u.is_active && !!removalBlocked(u))}
                          title={u.is_active ? removalBlocked(u) ?? undefined : undefined}
                          className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => { setDeleteError(null); setToDelete(u) }}
                          disabled={isPending || !!removalBlocked(u)}
                          title={removalBlocked(u) ?? undefined}
                          className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
