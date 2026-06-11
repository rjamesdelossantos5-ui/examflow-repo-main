'use client'

import { useState, useTransition } from 'react'
import { updateSubmissionWindow } from '../actions'

export default function SettingsForm({ currentDays }: { currentDays: number }) {
  const [days, setDays] = useState(currentDays)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const res = await updateSubmissionWindow(days)
      if (res.error) setError(res.error)
      else setSuccess(true)
    })
  }

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Submission Timeframe</h2>
      <p className="text-sm text-gray-500 mb-6">
        Set how many days students are allowed to submit special exam requests for the current period.
      </p>

      <div className="bg-white rounded-xl shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Setting saved successfully.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Submission window (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Currently: {currentDays} day{currentDays !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
          >
            {isPending ? 'Saving…' : 'Save Setting'}
          </button>
        </form>
      </div>
    </div>
  )
}
