'use client'

import { useFormStatus } from 'react-dom'

/**
 * Submit button bound to the parent <form>'s server-action status.
 * Disables itself while the action is in flight — prevents double/triple submits.
 */
export default function SubmitButton({
  children,
  pendingText,
  className,
  style,
}: {
  children: React.ReactNode
  pendingText: string
  className?: string
  style?: React.CSSProperties
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className} style={style} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  )
}
