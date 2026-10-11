/*
 * Privacy Notice — same world as the landing page (app/page.tsx): navy bar,
 * cool off-white then white paper, navy ink, hairline rules, Archivo. No card:
 * the notice is a document, so it reads like one. Each section is a row with
 * its heading on the left and the text on the right (stacked on phones). The
 * text itself lives in components/PrivacyNoticeContent.tsx.
 *
 * Required because EXAMFLOW collects SENSITIVE personal information under the
 * Data Privacy Act of 2012 (RA 10173) — government-issued IDs and (for medical
 * excuses) health documents. Sensitive personal information may generally only
 * be processed with consent given BEFORE processing and specific to the
 * purpose, which is why the submit form carries its own declaration rather than
 * relying on a blanket sign-up tick.
 *
 * Public route (no auth) so a person can read what will be collected before
 * they hand anything over.
 */
import Link from 'next/link'
import { archivo } from '../fonts'
import PrivacyNoticeContent from '@/components/PrivacyNoticeContent'

export const metadata = { title: 'EXAMFLOW — Privacy Notice' }

const NAVY = '#002F6C'
const GOLD = '#FDB913'
const INK_SOFT = '#3D4F6E'
const RULE = '#D5DCE6'
const PAPER_COOL = '#F5F7FA'
const CONTAINER = 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8'

export default function PrivacyPage() {
  // Inline colours, like the landing page, so the app's dark-mode overrides
  // never touch this public page.
  return (
    <div className={`${archivo.variable} ef-landing min-h-screen`} style={{ background: '#FFFFFF', color: NAVY, fontFamily: 'var(--font-archivo), Arial, sans-serif', '--pn-ink': NAVY, '--pn-soft': INK_SOFT, '--pn-rule': RULE } as React.CSSProperties}>
      <header style={{ background: NAVY, color: '#FFFFFF' }}>
        <div className={`${CONTAINER} h-16 flex items-center`}>
          <Link href="/" className="font-black text-lg leading-none" style={{ fontStretch: '115%' }} aria-label="EXAMFLOW home">
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </Link>
        </div>
      </header>

      <section style={{ background: PAPER_COOL }}>
        <div className={`${CONTAINER} pt-16 pb-14 lg:pt-24 lg:pb-20`}>
          <h1
            className="ef-reveal font-extrabold leading-[0.98] text-balance"
            style={{ fontStretch: '125%', fontSize: 'clamp(2.2rem, 4.4vw, 3.5rem)', letterSpacing: '-0.03em', marginLeft: '-0.03em' }}
          >
            Privacy Notice
          </h1>
          <p className="ef-reveal mt-5 text-lg leading-relaxed max-w-[52ch]" style={{ color: INK_SOFT, animationDelay: '90ms' }}>
            How EXAMFLOW collects and handles your information, under the Data Privacy Act of 2012 (RA 10173).
          </p>
        </div>
      </section>

      <main className={`${CONTAINER} pb-16`} style={{ borderTop: `1px solid ${RULE}` }}>
        {/* First rule comes from <main>'s border, so the first row skips its own */}
        <PrivacyNoticeContent />
      </main>

      <footer style={{ borderTop: `1px solid ${RULE}` }}>
        <div className={`${CONTAINER} h-16 flex items-center justify-center`}>
          <Link href="/" className="font-black text-lg leading-none" style={{ fontStretch: '115%' }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}
