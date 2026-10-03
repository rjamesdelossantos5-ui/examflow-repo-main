'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import type { Profile, Department } from '@/lib/supabase/types'
import { toggleUserActive, deleteUser, createUser, toggleOverride } from './actions'
import Select from '@/components/Select'
import { useEscapeKey } from '@/lib/useEscapeKey'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

/**
 * Admin user management: create accounts (any role), activate/deactivate,
 * delete, and grant Program Heads the "override" power (accept a request that
 * the registrar/teacher haven't acted on yet). All mutations go through the
 * server actions in ./actions, which re-check the admin role server-side.
 */
export default function UserTable({
  users,
  departments,
}: {
  users: Profile[]
  departments: Department[]
}) {
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
  const [isPending, startTransition] = useTransition()
  // The Create form shows only what the chosen role uses: student details for
  // students, a department for teachers and Program Heads, nothing extra for
  // registrars and admins.
  const [newRole, setNewRole] = useState('')
  const closeCreate = useCallback(() => { setShowCreate(false); setNewRole('') }, [])
  useEscapeKey(closeCreate, showCreate)
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

  function handleOverride(userId: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleOverride(userId, !current)
      if (res.error) setError(res.error)
    })
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input name="full_name" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              {/* autoComplete stops the browser filling in the admin's own
                  saved login here — this form creates someone else's. */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input name="email" type="email" required autoComplete="off" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                <input name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className={newRole === 'subject_teacher' || newRole === 'program_head' ? '' : 'col-span-2'}>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                <Select
                  name="role"
                  required
                  value={newRole}
                  onChange={setNewRole}
                  placeholder="— Select role —"
                  options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {(newRole === 'subject_teacher' || newRole === 'program_head') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Department{newRole === 'program_head' ? ' *' : ''}
                  </label>
                  <Select
                    // Remounts when the role changes, so a choice made for one
                    // role doesn't silently carry over to the other.
                    key={newRole}
                    name="department_id"
                    required={newRole === 'program_head'}
                    placeholder={newRole === 'program_head' ? '— Select department —' : '— none —'}
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              )}
              {newRole === 'program_head' && (
                <p className="col-span-2 text-xs text-gray-500">
                  They review the requests for subjects in this department.
                </p>
              )}
              {newRole === 'subject_teacher' && (
                <p className="col-span-2 text-xs text-gray-500">
                  Their sections and subjects come from the Classes sheet of the School Data file — one row per class with
                  this email as the Teacher Email, as many sections as they teach.
                </p>
              )}
              {newRole === 'student' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Student Number</label>
                    <input name="student_number" placeholder="02000123456" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                    <input name="course" placeholder="BSIT" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Year Level</label>
                    <input name="year_level" type="number" min={1} max={6} placeholder="2" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
                    <input name="section" placeholder="BSIT 2-201" className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </>
              )}
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
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, student no. or section…"
          aria-label="Search users"
          className="flex-1 min-w-[14rem] rounded-lg px-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
          style={{ color: 'var(--card-foreground)' }}
        />
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          options={[{ value: '', label: 'All roles' }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
          className="w-44 rounded-lg px-3 py-2 text-sm border ef-border"
          style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
        />
        <span className="text-xs ef-muted tabular-nums">{visible.length} of {users.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 flex flex-wrap gap-2">
                  {u.role === 'program_head' && (
                    <button
                      onClick={() => handleOverride(u.id, !!u.can_override)}
                      disabled={isPending}
                      title="Allow this Program Head to accept requests even if the registrar/teacher haven't acted"
                      className={`text-xs px-2 py-1 rounded border disabled:opacity-50 ${
                        u.can_override
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {u.can_override ? '⚡ Override ON' : 'Grant override'}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(u.id, u.is_active)}
                    disabled={isPending}
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { setDeleteError(null); setToDelete(u) }}
                    disabled={isPending}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{users.length ? 'No user matches your search.' : 'No users found.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
