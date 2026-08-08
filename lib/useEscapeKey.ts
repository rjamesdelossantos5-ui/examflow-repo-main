'use client'

import { useEffect } from 'react'

/**
 * Closes an open overlay when the user presses Escape.
 *
 * Every dialog and the document lightbox used to be dismissable only by
 * clicking, which strands keyboard and assistive-tech users on the dialog —
 * Escape is the universal "get me out" and people press it by reflex. Pass
 * `active` so the listener is only bound while the overlay is actually open.
 */
export function useEscapeKey(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onEscape, active])
}
