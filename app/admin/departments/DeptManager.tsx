'use client'

import { useState, useTransition } from 'react'
import type { Department } from '@/lib/supabase/types'
import { createDepartment, updateDepartment, deleteDepartment } from './actions'

// Admin department list: inline add / rename / delete, one row per
// department. All writes go through the server actions in ./actions.
export default function DeptManager({ departments }: { departments: Department[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      const res = await createDepartment(fd)
      if (res.error) setError(res.error)
      else { form.reset(); setError(null) }
    })
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateDepartment(id, fd)
      if (res.error) setError(res.error)
      else { setEditing(null); setError(null) }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete department "${name}"?`)) return
    startTransition(async () => {
      const res = await deleteDepartment(id)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Departments</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error} <button className="underline ml-2" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input name="name" required placeholder="Department name" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <button type="submit" disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
          Add
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
            {editing === d.id ? (
              <form onSubmit={(e) => handleUpdate(d.id, e)} className="flex gap-2 flex-1">
                <input name="name" defaultValue={d.name} required className="flex-1 border rounded px-2 py-1 text-sm" />
                <button type="submit" disabled={isPending} className="text-xs px-3 py-1 rounded font-semibold"
                  style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>Save</button>
                <button type="button" onClick={() => setEditing(null)} className="text-xs px-3 py-1 border rounded">Cancel</button>
              </form>
            ) : (
              <>
                <span className="flex-1 font-medium">{d.name}</span>
                <button onClick={() => setEditing(d.id)} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">Edit</button>
                <button onClick={() => handleDelete(d.id, d.name)} disabled={isPending}
                  className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
        {departments.length === 0 && (
          <p className="px-4 py-6 text-center text-gray-400 text-sm">No departments yet.</p>
        )}
      </div>
    </div>
  )
}
