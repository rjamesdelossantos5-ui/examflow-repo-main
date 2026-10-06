'use client'

import { useState, useTransition } from 'react'
import { updateToggleSetting } from './actions'

/** One on/off switch in Admin → Settings (lib/settings.ts). */
export default function ToggleSetting({
  settingKey,
  title,
  description,
  initialOn,
}: {
  settingKey: string
  title: string
  description: React.ReactNode
  initialOn: boolean
}) {
  const [on, setOn] = useState(initialOn)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function flip() {
    const next = !on
    setError(null)
    startTransition(async () => {
      const res = await updateToggleSetting(settingKey, next)
      if (res.error) setError(res.error)
      else setOn(next)
    })
  }

  return (
    <div className="ef-card rounded-xl shadow-sm p-5 max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>{title}</h3>
          <div className="text-sm ef-muted mt-1">{description}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={title}
          onClick={flip}
          disabled={isPending}
          className="relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
          style={{ backgroundColor: on ? 'var(--sti-gold)' : 'var(--border)' }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>
      {/* Status in words too, never colour alone (PRODUCT.md, Accessibility). */}
      <p className="text-xs font-semibold mt-3" style={{ color: 'var(--card-foreground)' }}>
        {isPending ? 'Saving…' : on ? 'On' : 'Off'}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-md px-3 py-2 text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">{error}</p>
      )}
    </div>
  )
}
