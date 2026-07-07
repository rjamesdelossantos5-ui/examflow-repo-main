'use client'

import { useState } from 'react'
import { OTHER } from '@/lib/rejectReasons'

/**
 * Preset reject reasons as quick-pick chips. Picking "Other" reveals a text box;
 * the effective reason (chip label, or the typed text for "Other") is reported
 * back through onChange so the parent can gate its confirm button.
 */
export default function RejectReasonPicker({
  presets,
  onChange,
}: {
  presets: string[]
  onChange: (reason: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [other, setOther] = useState('')

  function pick(p: string) {
    setSelected(p)
    onChange(p === OTHER ? other.trim() : p)
  }
  function typeOther(v: string) {
    setOther(v)
    onChange(v.trim())
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-medium ef-muted">Reason for rejection *</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const on = selected === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              className="text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors"
              style={on
                ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' }
                : { borderColor: 'var(--border)', color: 'var(--card-foreground)' }}
            >
              {p}
            </button>
          )
        })}
      </div>
      {selected === OTHER && (
        <textarea
          value={other}
          onChange={(e) => typeOther(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder="Describe the reason…"
          className="w-full rounded-lg px-3 py-2 text-sm bg-transparent border ef-border resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      )}
    </div>
  )
}
