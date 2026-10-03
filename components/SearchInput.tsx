'use client'

import { Icon } from './Icon'

/**
 * Search box for the admin lists. It sits on the grey page canvas, so it gets
 * the card background, a visible border and a magnifier — a transparent input
 * there was nearly invisible.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="relative flex-1 min-w-[14rem]">
      <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ef-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-lg pl-9 pr-3 py-2 text-sm border shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]"
        style={{
          backgroundColor: 'var(--card)',
          color: 'var(--card-foreground)',
          borderColor: 'color-mix(in srgb, var(--muted) 35%, var(--border))',
        }}
      />
    </div>
  )
}
