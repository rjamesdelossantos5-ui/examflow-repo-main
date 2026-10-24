'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import type { SelectOption } from './Select'

interface Props {
  options: SelectOption[]
  /** The ticked option values. */
  values: string[]
  /** Called with one option's value each time it is ticked or unticked. */
  onToggle: (value: string) => void
  /** No more than this many can be ticked; the rest are greyed out. */
  max?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * Dropdown that lets several options be ticked, matching the look of Select. The
 * list stays open while ticking so a person can pick a few in one go; it closes
 * on a click outside or Escape. It holds no form value itself — the caller
 * renders whatever hidden inputs the form needs for the ticked values.
 */
export default function MultiSelect({ options, values, onToggle, max, placeholder = '— Select —', disabled, className = '', style }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const full = max != null && values.length >= max
  const summary = values.length === 0 ? placeholder : `${values.length} subject${values.length === 1 ? '' : 's'} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${className} flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed`}
        style={style}
      >
        <span className={values.length ? '' : 'opacity-60'}>{summary}</span>
        <Icon name="chevron-down" className={`w-4 h-4 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg shadow-lg ef-card"
          style={{ border: '1px solid var(--border)' }}
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm ef-muted">No options</li>}
          {options.map((o) => {
            const on = values.includes(o.value)
            const blocked = !on && full
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={blocked}
                  onClick={() => onToggle(o.value)}
                  className="w-full flex items-start gap-3 text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: 'var(--card-foreground)',
                    ...(on ? { backgroundColor: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)' } : null),
                  }}
                >
                  <input type="checkbox" checked={on} readOnly tabIndex={-1} className="mt-0.5 w-4 h-4 accent-[var(--sti-gold)] pointer-events-none" aria-hidden />
                  <span>{o.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
