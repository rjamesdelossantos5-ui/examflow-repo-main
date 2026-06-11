'use client'

import { useState, useTransition } from 'react'
import { uploadReceipt } from './actions'

export default function ReceiptUpload({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await uploadReceipt(requestId, fd)
      if (res.error) setError(res.error)
      else setSuccess(true)
    })
  }

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
        Receipt uploaded successfully. Awaiting verification by the Program Head.
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-dashed p-6 text-center" style={{ borderColor: 'var(--sti-gold)' }}>
      <h3 className="font-semibold mb-2" style={{ color: 'var(--sti-navy)' }}>Upload Payment Receipt</h3>
      <p className="text-xs text-gray-500 mb-4">JPG, PNG, or PDF · max 5 MB</p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
        <input
          type="file"
          name="payment_receipt"
          accept=".jpg,.jpeg,.png,.pdf"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {isPending ? 'Uploading…' : 'Upload Receipt'}
        </button>
      </form>
    </div>
  )
}
