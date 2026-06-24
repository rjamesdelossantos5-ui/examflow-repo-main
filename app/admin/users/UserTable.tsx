'use client'

import { useState, useTransition } from 'react'
import type { Profile, Department } from '@/lib/supabase/types'
import { toggleUserActive, deleteUser, createUser, toggleOverride } from './actions'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

export default function UserTable({
  users,
  departments,
}: {
  users: Profile[]
  departments: Department[]
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggle(userId: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleUserActive(userId, !current)
      if (res.error) setError(res.error)
    })
  }

  function handleDelete(userId: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const res = await deleteUser(userId)
      if (res.error) setError(res.error)
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
        setShowCreate(false)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--sti-navy)' }}>Create User</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input name="full_name" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input name="email" type="email" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                <input name="password" type="password" required minLength={8} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                <select name="role" required className="w-full border rounded px-3 py-2 text-sm">
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select name="department_id" className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">— none —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Student Number</label>
                <input name="student_number" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                <input name="course" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year Level</label>
                <input name="year_level" type="number" min={1} max={6} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
                <input name="section" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => { setShowCreate(false); setError(null) }}
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
            {users.map((u) => (
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
                    onClick={() => handleDelete(u.id, u.full_name)}
                    disabled={isPending}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
