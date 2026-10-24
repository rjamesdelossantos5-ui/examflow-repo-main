/*
 * Landing page — direction (impeccable, seed d4bfd451, revised by the user to
 * text only, light)
 * THESIS: Words do the work. No cards or mock-ups; the page is a short, plain
 *   notice a student reads in under a minute. The one picture is a quiet navy
 *   line drawing behind the first screen (HeroDrawing): a form travelling to
 *   the three signatures and arriving on a phone.
 * OWN-WORLD: Navy nav bar (the same bar the dashboards use) over cool
 *   off-white and white paper, navy ink, hairline rules; gold only on the
 *   nav's Log in (and, in the drawing, on what is done). Archivo: wide for
 *   headings, normal width for reading.
 * STORY: A student who missed an exam learns what to prepare (parent with ID,
 *   document, paper form) and the order of the steps, then logs in.
 * FIRST VIEWPORT: Navy nav bar; on cool off-white the headline, one sentence
 *   and the navy Log in button, left-aligned, revealed once on load.
 */
import { archivo } from './fonts'
import LoginModal from './LoginModal'
import HeroDrawing from '@/components/HeroDrawing'

const NAVY = '#002F6C'
const GOLD = '#FDB913'
const ON_NAVY_SOFT = '#C9D6EA' // secondary text on navy, tinted from the hue
const INK_SOFT = '#3D4F6E' // secondary text on paper
const RULE = '#D5DCE6'
// Cool off-white (blue-grey, never cream) for the first screen and the steps;
// pure white between them.
const PAPER_COOL = '#F5F7FA'
// Matches the dashboard's content width + padding.
const CONTAINER = 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8'

const PREPARE = [
  { title: 'Your STI Microsoft account', note: 'You log in to EXAMFLOW with it.' },
  { title: 'Your parent or guardian, with a valid ID', note: 'They verify with a live face check and a photo of their ID, on your phone.' },
  { title: 'For a waived exam: your document', note: 'Medical certificate, death certificate, or another supporting document. JPG, PNG or PDF, up to 5 MB.' },
  { title: 'Time for one visit to the Registrar', note: 'Get the printed special exam form there and fill it in too. The Registrar counts exam takers from it, and the Cashier marks it if you pay.' },
]

const STEPS = [
  { title: 'Fill the form', body: 'Pick the subject, then waived or paid. Attach your document if it is waived.' },
  { title: 'Your parent or guardian verifies', body: 'They do the face and ID check. Then you press Submit.' },
  { title: 'Two signatures, in order', body: 'Your teacher approves, then the Program Head accepts. You can follow each one from your dashboard.' },
  { title: 'Your exam is scheduled', body: 'Waived: right after the Program Head accepts. Paid: after you pay at the Cashier and your uploaded receipt is checked.' },
  { title: 'Collect the printed form', body: 'Get it at the Registrar’s office and fill it in. If your exam is paid, the Cashier marks it when you pay.' },
]

const H2_STYLE = { fontStretch: '125%', fontSize: 'clamp(1.9rem, 3.6vw, 2.75rem)', letterSpacing: '-0.02em' } as const

export default function LandingPage() {
  // Inline colours (not bg-white / border / text-gray-* classes) so the app's
  // dark-mode overrides never touch this public page; it always renders light.
  return (
    <div className={`${archivo.variable} ef-landing min-h-screen flex flex-col pb-12`} style={{ background: '#FFFFFF', color: NAVY, fontFamily: 'var(--font-archivo), Arial, sans-serif' }}>
      {/* ───────── Nav: the dashboards' navy bar ───────── */}
      <header className="sticky top-0 z-50" style={{ background: NAVY, color: '#FFFFFF' }}>
        <div className={`${CONTAINER} h-16 flex items-center justify-between gap-4`}>
          <span className="font-black text-lg leading-none" style={{ fontStretch: '115%' }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </span>
          <nav className="flex items-center gap-8 lg:gap-10 text-sm font-medium">
            <a href="#prepare" className="hidden md:inline ef-landing-link" style={{ color: ON_NAVY_SOFT }}>Before you start</a>
            <a href="#steps" className="hidden md:inline ef-landing-link" style={{ color: ON_NAVY_SOFT }}>How it works</a>
            <a href="#login" className="ef-press px-4 py-2 rounded-[4px] font-semibold" style={{ background: GOLD, color: NAVY }}>
              Log in
            </a>
          </nav>
        </div>
      </header>

      {/* ───────── First viewport ───────── */}
      {/* "relative isolate overflow-hidden": the drawing is positioned inside
          this section and sits behind the text (-z-10 within the isolated
          stacking context), clipped to the section. */}
      <section className="relative isolate overflow-hidden" style={{ background: PAPER_COOL }}>
        <HeroDrawing />
        <div className={`${CONTAINER} pt-20 pb-24 lg:pt-32 lg:pb-36`}>
          <h1
            className="ef-reveal font-extrabold leading-[0.98] text-balance"
            // marginLeft: optical alignment. At this size the M's built-in side
            // space pushes it visibly right of the text below; pull it back.
            style={{ fontStretch: '125%', fontSize: 'clamp(2.4rem, 5.2vw, 4.25rem)', letterSpacing: '-0.03em', marginLeft: '-0.04em' }}
          >
            Missed an exam?
          </h1>
          <p className="ef-reveal mt-6 text-lg sm:text-xl leading-relaxed max-w-[44ch]" style={{ color: INK_SOFT, animationDelay: '90ms' }}>
            Request your special exam here. It goes to your teacher and your Program Head in order,
            and you can follow every step from your phone.
          </p>
          <div className="ef-reveal mt-10 flex flex-wrap items-center gap-x-6 gap-y-4" style={{ animationDelay: '180ms' }}>
            <a href="#login" className="ef-press px-6 py-3.5 rounded-[4px] text-base font-bold" style={{ background: NAVY, color: '#FFFFFF' }}>
              Log in to start a request
            </a>
            <a href="#prepare" className="ef-landing-link text-base font-semibold" style={{ color: NAVY }}>
              What you need first
            </a>
          </div>
        </div>
      </section>

      {/* ───────── Before you start ───────── */}
      <section id="prepare" className="scroll-mt-16" style={{ borderTop: `1px solid ${RULE}` }}>
        <div className={`${CONTAINER} py-20 lg:py-28 grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16`}>
          <div>
            <h2 className="font-extrabold leading-tight text-balance" style={H2_STYLE}>
              Before you start
            </h2>
            <p className="mt-4 text-base leading-relaxed max-w-[40ch]" style={{ color: INK_SOFT }}>
              Have these ready. The request can&apos;t be sent without your parent or guardian&apos;s check.
            </p>
          </div>
          <ul style={{ borderTop: `2px solid ${NAVY}` }}>
            {PREPARE.map((p) => (
              <li key={p.title} className="ef-prep ef-in flex gap-4 py-5" style={{ borderBottom: `1px solid ${RULE}` }}>
                {/* An empty form checkbox: drawn, not a glyph. Ticks gold on hover. */}
                <span aria-hidden className="relative mt-1 w-5 h-5 shrink-0 rounded-[2px]" style={{ border: `2px solid ${NAVY}` }}>
                  <span className="ef-prep-tick absolute -inset-[2px] grid place-items-center rounded-[2px]" style={{ background: GOLD }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7.5l3 3 6-7" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
                <div>
                  <p className="font-bold text-lg leading-snug">{p.title}</p>
                  <p className="mt-1 text-base leading-relaxed max-w-[60ch]" style={{ color: INK_SOFT }}>{p.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="steps" className="scroll-mt-16" style={{ background: PAPER_COOL, borderTop: `1px solid ${RULE}` }}>
        <div className={`${CONTAINER} py-20 lg:py-28`}>
          <h2 className="font-extrabold leading-tight text-balance max-w-[18ch]" style={H2_STYLE}>
            How your request moves
          </h2>
          {/* A real sequence, so the numbers carry information */}
          <ol className="mt-12 grid gap-x-10 lg:grid-cols-5" style={{ borderTop: `2px solid ${NAVY}` }}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="ef-step ef-in relative py-6 lg:pr-2" style={{ borderBottom: `1px solid ${RULE}` }}>
                <span aria-hidden className="ef-step-bar absolute left-0 -top-[2px] h-[2px] w-full" style={{ background: GOLD }} />
                <span className="font-extrabold text-3xl tabular-nums" style={{ fontStretch: '125%', color: NAVY }}>{i + 1}</span>
                <p className="mt-3 font-bold text-lg leading-snug">{s.title}</p>
                <p className="mt-2 text-base leading-relaxed" style={{ color: INK_SOFT }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── Footer: pinned to the bottom of the window, always in view.
          The page has bottom padding (see the wrapper) so the last section is
          never hidden behind it. Below the login pop-up's layer (z-[100]). ───────── */}
      <footer
        className="fixed bottom-0 inset-x-0 z-40"
        style={{ background: '#FFFFFF', color: NAVY, borderTop: `1px solid ${RULE}`, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className={`${CONTAINER} h-12 flex items-center justify-center gap-3 text-xs sm:text-sm`}>
          <span className="font-black leading-none" style={{ fontStretch: '115%' }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </span>
          <span aria-hidden style={{ color: RULE }}>|</span>
          <span style={{ color: INK_SOFT }}>© {new Date().getFullYear()} STI College Sta. Maria</span>
        </div>
      </footer>

      <LoginModal />
    </div>
  )
}
