'use client'

import { useEffect, useState } from 'react'

/**
 * Standalone light/dark switch. Reads the class set by the no-flash script in
 * the root layout, then persists changes to localStorage.
 */
export default function ThemeToggle({ variant = 'menu' }: { variant?: 'menu' | 'icon' }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }

  // Avoid hydration mismatch flicker
  const label = !mounted ? 'Theme' : dark ? 'Light mode' : 'Dark mode'
  const icon = dark ? '☀️' : '🌙'

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base hover:bg-white/10 transition-colors"
      >
        {icon}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
