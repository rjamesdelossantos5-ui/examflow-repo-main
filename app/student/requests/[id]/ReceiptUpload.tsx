'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadReceipt } from './actions'
import { compressImage } from '@/lib/compressImage'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_MB = 5

/**
 * Paid-exam step: after acceptance the student pays the ₱200 fee at the
 * Cashier and uploads the official receipt here, which moves the request to
 * 'receipt_uploaded' for the Program Head's second approval. Photos are
 * compressed in the browser before upload (phone camera shots are huge).
 */
export default function ReceiptUpload({ requestId, rejectedReason }: { requestId: string; rejectedReason?: string | null }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function validateFile(file: File): string | null {
    if (!ALLOWED_MIME.includes(file.type)) return 'Only JPG, PNG, or PDF allowed'
    if (file.size > MAX_MB * 1024 * 1024) return `File must be under ${MAX_MB} MB`
    return null
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setFileError(err)
      setFileName(null)
      return
    }
    setFileError(null)
    setServerError(null)

    setBusy(true)
    const compressed = await compressImage(file)
    setBusy(false)
    // Swap the compressed file back INTO the <input> so the normal FormData
    // submit picks it up — the server action never knows compression happened.
    if (compressed !== file && inputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(compressed)
      inputRef.current.files = dt.files
    }
    setFileName(compressed.name)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (fileError || !fileName) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await uploadReceipt(requestId, fd)
      if (res.error) setServerError(res.error)
      else setSuccess(true)
    })
  }

  if (success) {
    return (
      <div className="ef-card rounded-xl p-6">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300">
          ✓ Receipt uploaded successfully. Awaiting verification by the Program Head.
        </div>
      </div>
    )
  }

  return (
    <div className="ef-card rounded-xl border-2 border-dashed p-6" style={{ borderColor: 'var(--sti-gold)' }}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 w-9 h-9 rounded-full bg-amber-500 text-white text-base font-bold grid place-items-center animate-pulse">
          !
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>
            Action Required: Upload Cashier Receipt
          </h3>
          <p className="text-sm ef-muted mt-0.5">
            Pay the <strong style={{ color: 'var(--card-foreground)' }}>₱200</strong> special exam fee at the Cashier window, then upload your official receipt below. One receipt is required per request.
          </p>
        </div>
      </div>

      {/* Previous receipt was rejected — tell the student why so they don't
          re-upload the same one. */}
      {rejectedReason && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          <strong>Your previous receipt was rejected:</strong> {rejectedReason}. Please upload a clear, correct receipt.
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium ef-muted mb-1">
            Receipt file <span className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            type="file"
            name="payment_receipt"
            accept=".jpg,.jpeg,.png,.pdf"
            required
            onChange={handleFileChange}
            className="w-full rounded-lg px-3 py-2 text-sm border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--sti-gold)]/20 file:text-[var(--card-foreground)] file:cursor-pointer"
            style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
          />
          {busy && <p className="mt-1 text-xs ef-muted">Optimizing photo…</p>}
          {fileError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>
          )}
          {fileName && !fileError && !busy && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ {fileName}</p>
          )}
          <p className="mt-1 text-xs ef-muted">JPG, PNG, or PDF · max {MAX_MB} MB</p>
        </div>

        <button
          type="submit"
          disabled={isPending || busy || !!fileError || !fileName}
          className="w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {isPending ? 'Uploading…' : 'Upload Receipt'}
        </button>
      </form>
    </div>
  )
}
