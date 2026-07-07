'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * Custom-styled dropdown that replaces native <select> everywhere in the app.
 * A native <select> hands rendering of its option list to the OS — on mobile
 * that's a full-screen, unstyled picker with no relation to the rest of the
 * UI, and it can't be restyled with CSS. This draws the dropdown ourselves so
 * it looks and behaves the same on every device and screen size.
 *
 * A real <select> is still kept in the DOM (visually hidden via sr-only, not
 * display:none/hidden — those are excluded from constraint validation, but
 * sr-only isn't) so native form submission (FormData picks it up by `name`)
 * and required-field validation keep working with zero changes at call sites.
 */
export default function Select({
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder = '— Select —',
  required,
  disabled,
  className = '',
  style,
}: Props) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const current = isControlled ? value! : internal
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function select(v: string) {
    if (!isControlled) setInternal(v)
    onChange?.(v)
    setOpen(false)
  }

  const selected = options.find((o) => o.value === current)

  return (
    <div className="relative" ref={ref}>
      <select
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="" disabled={required}>{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${className} flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed`}
        style={style}
      >
        <span className={selected ? '' : 'opacity-60'}>{selected?.label ?? placeholder}</span>
        <Icon name="chevron-down" className={`w-4 h-4 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg shadow-lg ef-card"
          style={{ border: '1px solid var(--border)' }}
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm ef-muted">No options</li>}
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === current}
                onClick={() => select(o.value)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                style={
                  o.value === current
                    ? { backgroundColor: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)', color: 'var(--card-foreground)' }
                    : { color: 'var(--card-foreground)' }
                }
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
