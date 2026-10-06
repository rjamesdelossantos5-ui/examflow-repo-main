'use client'

import { useState, useTransition } from 'react'
import { formatPeso, MAX_SPECIAL_EXAM_FEE } from '@/lib/fees'
import { updateSpecialExamFee } from './actions'

/** The special-exam fee per subject, edited by the admin. */
export default function FeeForm({ fee }: { fee: number }) {
  const [value, setValue] = useState(String(fee))
  const [saved, setSaved] = useState(fee)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateSpecialExamFee(value)
      if (res.error) { setError(res.error); return }
      setSaved(res.fee!)
      setValue(String(res.fee))
      setMessage(`Saved — the fee is now ${formatPeso(res.fee!)} per subject.`)
    })
  }

  return (
    <form onSubmit={save} className="ef-card rounded-xl shadow-sm p-5 max-w-xl space-y-4">
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Special exam fee</h3>
        <p className="text-sm ef-muted mt-1">
          Charged per subject for paid special exams. The Registrar uses it when assessing a student, and the student
          sees the total on their receipt page.
        </p>
      </div>

      <label className="block">
        <span className="block text-xs font-medium ef-muted mb-1">Fee per subject (₱)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SPECIAL_EXAM_FEE}
          step={1}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40 rounded-lg px-3 py-2 text-sm border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
          style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
        />
      </label>

      <p className="text-xs ef-muted">
        Changing it only affects students the Registrar hasn&apos;t assessed yet. Students already assessed keep the
        amount they were given ({formatPeso(saved)} is the current fee).
      </p>

      {error && (
        <p role="alert" className="rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</p>
      )}
      {message && (
        <p role="status" className="rounded-md px-3 py-2 text-sm bg-green-50 border border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">{message}</p>
      )}

      <button
        type="submit"
        disabled={isPending || value === String(saved)}
        className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
      >
        {isPending ? 'Saving…' : 'Save fee'}
      </button>
    </form>
  )
}
