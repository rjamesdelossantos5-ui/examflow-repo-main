'use client'

import { useEffect, useRef } from 'react'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { Icon } from '@/components/Icon'
import PrivacyNoticeContent from '@/components/PrivacyNoticeContent'

/**
 * The Privacy Notice as a pop-up on the submit form, so a student on a phone
 * reads it without leaving the form for a new tab. A sheet from the bottom on
 * phones, a centred dialog from sm up (.ef-sheet in globals.css).
 *
 * "I agree" sits at the end of the text, not pinned: the student reaches it by
 * reading down. It is never locked behind scrolling — scrolling proves nothing,
 * and a locked button strands keyboard and screen-reader users. The consent
 * record is the ticked box, saved with a timestamp in the request's history.
 */
export default function PrivacyNoticeSheet({ onClose, onAgree }: { onClose: () => void; onAgree: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEscapeKey(onClose)

  // Focus the panel so the keyboard and screen readers start inside it, and
  // stop the form behind from scrolling under the student's thumb.
  useEffect(() => {
    panelRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="ef-overlay fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-sheet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="ef-sheet ef-card w-full sm:max-w-2xl h-[88dvh] sm:h-auto sm:max-h-[85vh] flex flex-col rounded-t-xl sm:rounded-lg shadow-xl outline-none"
        style={{ '--pn-ink': 'var(--card-foreground)', '--pn-soft': 'var(--muted)', '--pn-rule': 'var(--border)' } as React.CSSProperties}
      >
        <div className="shrink-0 flex items-center justify-between gap-4 h-14 pl-5 pr-2 sm:pl-7 sm:pr-3 border-b ef-border">
          <h2 id="privacy-sheet-title" className="font-bold" style={{ color: 'var(--card-foreground)' }}>Privacy Notice</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ef-press w-10 h-10 grid place-items-center rounded-md ef-muted transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7">
          <p className="pt-5 text-sm ef-muted">
            How EXAMFLOW collects and handles your information, under the Data Privacy Act of 2012 (RA 10173).
          </p>
          <PrivacyNoticeContent heading="h3" />

          <div className="border-t ef-border pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm ef-muted">Agreeing ticks the consent box on the form.</p>
            <button
              type="button"
              onClick={onAgree}
              className="ef-press w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: 'var(--sti-yellow)', color: 'var(--sti-navy)' }}
            >
              I agree
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
