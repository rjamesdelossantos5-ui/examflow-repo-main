'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Plays a section's scroll-in once, when it first comes into view.
 *
 * Nothing is hidden by default: the markup is fully visible on the server and
 * without JavaScript. Only when this mounts below the fold does it add
 * data-armed (CSS then holds the children back), and data-in when the section
 * arrives (CSS releases them with a transition). A section already on screen at
 * load is never armed, so it can't flash. Reduced motion is handled in CSS.
 */
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top
    if (top < window.innerHeight * 0.85 || !('IntersectionObserver' in window)) {
      el.setAttribute('data-in', '')
      return
    }
    el.setAttribute('data-armed', '')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.setAttribute('data-in', '')
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
