'use client'

import { useState } from 'react'
import type { Subject } from '@/lib/supabase/types'
import { submitRequest } from './actions'

const MAX_MB = 5
const ALLOWED = '.jpg,.jpeg,.png,.pdf'

export default function SubmitForm({ subjects, error }: { subjects: Subject[]; error?: string }) {
  const [examType, setExamType] = useState<'paid' | 'excused'>('paid')
  const [reason, setReason] = useState('')

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--sti-navy)' }}>Submit New Request</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={submitRequest} className="bg-white rounded-xl shadow p-6 space-y-5">
        {/* Exam type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Exam Type *</label>
          <div className="flex gap-4">
            {(['paid', 'excused'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exam_type"
                  value={t}
                  checked={examType === t}
                  onChange={() => setExamType(t)}
                  className="accent-[var(--sti-gold)]"
                />
                <span className="text-sm font-medium capitalize">
                  {t === 'paid' ? 'Paid (Unexcused)' : 'Excused (with reason)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
          <select name="subject_id" required className="w-full border rounded-lg px-3 py-2.5 text-sm">
            <option value="">— Select a subject —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_code} — {s.subject_name}
              </option>
            ))}
          </select>
        </div>

        {/* Excused reason */}
        {examType === 'excused' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select
              name="excused_reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">— Select reason —</option>
              <option value="medical">Medical</option>
              <option value="bereavement">Bereavement / Death in family</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}

        {examType === 'excused' && reason === 'other' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Please specify *</label>
            <input
              name="other_reason"
              required
              maxLength={500}
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
              placeholder="Briefly describe the reason"
            />
          </div>
        )}

        {/* Parent ID */}
        <FileField
          name="parent_id"
          label="Parent/Guardian Valid ID *"
          hint="JPG, PNG, or PDF · max 5 MB"
        />

        {/* Parent signature */}
        <FileField
          name="parent_signature"
          label="Parent Signature *"
          hint="JPG, PNG, or PDF · max 5 MB"
        />

        {/* Supporting document (excused only) */}
        {examType === 'excused' && (
          <FileField
            name="supporting_document"
            label="Supporting Document *"
            hint="Medical certificate, death certificate, etc. · JPG, PNG, or PDF · max 5 MB"
          />
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          Submit Request
        </button>
      </form>
    </div>
  )
}

function FileField({ name, label, hint }: { name: string; label: string; hint: string }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function validate(file: File) {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      return 'Only JPG, PNG, or PDF allowed'
    }
    if (file.size > MAX_MB * 1024 * 1024) return `Max ${MAX_MB} MB`
    return null
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="file"
        name={name}
        accept={ALLOWED}
        required
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            const err = validate(f)
            setFileError(err)
            setFileName(err ? null : f.name)
          }
        }}
        className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 file:cursor-pointer"
      />
      {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
      {fileName && !fileError && <p className="mt-1 text-xs text-green-600">Selected: {fileName}</p>}
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  )
}
