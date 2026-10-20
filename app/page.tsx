/*
 * Landing page — direction (impeccable, extension of the shipped world, made
 * livelier at the user's request; reviewers called the text-only version too plain)
 * THESIS: The page proves the product by showing a request being stamped, one
 *   signature at a time, until it is scheduled. The approval stamp is the one
 *   motif; everything else stays plain paper and ink.
 * OWN-WORLD: STI navy and gold only. Navy fields (first screen, closing call),
 *   one gold band, white and cool off-white paper between them. Hairline rules,
 *   Archivo (wide for headings). No cards, glass, gradients or icon tiles.
 * STORY: A student who missed an exam sees the route in the first screen, learns
 *   what to bring (parent with ID, document, paper form), then logs in.
 * FIRST VIEWPORT: Navy. Headline, one sentence and the gold Log in button on the
 *   left; on the right a phone whose request is stamped by the Teacher, then the
 *   Program Head, then Scheduled, on a 9 s loop (CSS only, no timers).
 * MOTION: Hero phone loop + one scroll-in each for the checklist and the route.
 *   Transform and opacity only; reduced motion shows the finished state.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */
import { archivo } from './fonts'
import LoginModal from './LoginModal'
import Reveal from './Reveal'

const NAVY = '#002F6C'
const NAVY_DEEP = '#001A3D' // the phone's frame: the navy, deepened
const GOLD = '#FDB913'
const ON_NAVY_SOFT = '#C9D6EA' // secondary text on navy, tinted from the hue
const INK_SOFT = '#3D4F6E' // secondary text on paper
const RULE = '#D5DCE6'
// Cool off-white (blue-grey, never cream); pure white between sections.
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

// Three plain facts for the gold band under the first screen.
const FACTS = [
  'Your parent or guardian verifies on your phone.',
  'Your teacher approves, then your Program Head accepts.',
  'You follow every step from your dashboard.',
]

const H2_STYLE = { fontStretch: '125%', fontSize: 'clamp(1.9rem, 3.6vw, 2.75rem)', letterSpacing: '-0.02em' } as const

/** A drawn tick, one stroke, used by the checklist and by the phone. */
function Tick({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5l3 3 6-7" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The first screen's picture: a phone showing an example request being stamped
 * by the Teacher, then the Program Head, then scheduled. Pure markup; the loop is
 * CSS (see .ef-ph-* in globals.css). Labelled as an example: no real data.
 */
function PhoneDemo() {
  const nodes = ['Submitted', 'Teacher', 'Program Head', 'Scheduled']
  return (
    <div
      role="img"
      aria-label="Example: a waived request is stamped by the teacher, then the Program Head, and ends as Scheduled."
      className="ef-phone mx-auto"
      style={{ background: NAVY_DEEP }}
    >
      <div className="ef-phone-screen" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-4 h-11 shrink-0" style={{ background: NAVY, color: '#FFFFFF' }}>
          <span className="font-black text-[13px] leading-none" style={{ fontStretch: '115%' }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </span>
          <span className="text-[11px]" style={{ color: ON_NAVY_SOFT }}>Example</span>
        </div>

        <div className="px-4 pt-4 pb-5 flex flex-col gap-3">
          <p className="font-extrabold text-[15px]" style={{ color: NAVY }}>My Requests</p>

          {/* The request that gets stamped */}
          <div className="relative rounded-[8px] p-3.5" style={{ border: `1px solid ${RULE}` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-[14px] leading-tight" style={{ color: NAVY }}>Your subject</p>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#E6ECF6', color: NAVY }}>Waived</span>
            </div>

            <div className="relative mt-5">
              <span aria-hidden className="absolute left-3 right-3 top-3 h-[2px]" style={{ background: RULE }} />
              <span aria-hidden className="ef-ph-line absolute left-3 right-3 top-3 h-[2px]" style={{ background: GOLD }} />
              <ol className="relative grid grid-cols-4">
                {nodes.map((n, i) => (
                  <li key={n} className="flex flex-col items-center gap-1.5">
                    <span
                      className="relative grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold"
                      style={{ background: '#FFFFFF', border: `2px solid ${RULE}`, color: INK_SOFT }}
                    >
                      {i + 1}
                      <span
                        aria-hidden
                        className={`ef-ph-fill ef-ph-fill-${i} absolute -inset-[2px] grid place-items-center rounded-full`}
                        style={{ background: GOLD, border: `2px solid ${GOLD}` }}
                      >
                        <Tick size={12} />
                      </span>
                    </span>
                    <span className="text-[10px] leading-tight text-center" style={{ color: INK_SOFT }}>{n}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="relative mt-4 h-5 text-[13px] font-bold" style={{ color: NAVY }}>
              <span className="ef-ph-say ef-ph-say-0 absolute inset-0">Waiting for your teacher</span>
              <span className="ef-ph-say ef-ph-say-1 absolute inset-0">Waiting for the Program Head</span>
              <span className="ef-ph-say ef-ph-say-2 absolute inset-0">Signed by both</span>
            </div>

            <span
              aria-hidden
              className="ef-ph-stamp absolute right-3 bottom-3 px-2.5 py-1 text-[12px] font-black tracking-wide rounded-[4px]"
              style={{ color: NAVY, border: `2px solid ${NAVY}`, background: 'rgba(255,255,255,0.92)', fontStretch: '115%' }}
            >
              SCHEDULED
            </span>
          </div>

          {/* A paid request, waiting on the Registrar's fee assessment (static) */}
          <div className="rounded-[8px] p-3.5" style={{ border: `1px solid ${RULE}` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-[14px] leading-tight" style={{ color: NAVY }}>Another subject</p>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FFF3CC', color: NAVY }}>Paid</span>
            </div>
            <div className="mt-3 flex gap-[3px]" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span key={i} className="h-[4px] flex-1 rounded-full" style={{ background: i < 3 ? NAVY : i === 3 ? GOLD : RULE }} />
              ))}
            </div>
            <p className="mt-2 text-[12px]" style={{ color: INK_SOFT }}>Next: the Registrar assesses your fee.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  // Inline colours (not bg-white / border / text-gray-* classes) so the app's
  // dark-mode overrides never touch this public page; it always renders light.
  return (
    <div className={`${archivo.variable} ef-landing`} style={{ background: '#FFFFFF', color: NAVY, fontFamily: 'var(--font-archivo), Arial, sans-serif' }}>
      {/* ───────── Nav: the dashboards' navy bar ───────── */}
      <header className="sticky top-0 z-50" style={{ background: NAVY, color: '#FFFFFF', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
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

      {/* ───────── First screen: navy, with the request being stamped ───────── */}
      <section className="relative isolate overflow-hidden" style={{ background: NAVY, color: '#FFFFFF' }}>
        {/* One large gold ring, cropped by the edge: the stamp's outline, enlarged. */}
        <span aria-hidden className="absolute -z-10 -right-56 -top-40 w-[700px] h-[700px] rounded-full" style={{ border: '2px solid rgba(253,185,19,0.28)' }} />
        <span aria-hidden className="absolute -z-10 -right-24 top-24 w-[420px] h-[420px] rounded-full hidden md:block" style={{ border: '1px solid rgba(253,185,19,0.18)' }} />

        <div className={`${CONTAINER} pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-[1.15fr_0.85fr] gap-14 lg:gap-10 items-center`}>
          <div>
            <h1
              className="ef-reveal font-extrabold leading-[0.98] text-balance"
              // marginLeft: optical alignment. At this size the M's built-in side
              // space pushes it visibly right of the text below; pull it back.
              style={{ fontStretch: '125%', fontSize: 'clamp(2.6rem, 6vw, 5rem)', letterSpacing: '-0.03em', marginLeft: '-0.04em' }}
            >
              Missed an exam?
              <span className="block" style={{ color: GOLD }}>Request it here.</span>
            </h1>
            <p className="ef-reveal mt-7 text-lg sm:text-xl leading-relaxed max-w-[44ch]" style={{ color: ON_NAVY_SOFT, animationDelay: '90ms' }}>
              It goes to your teacher and your Program Head in order,
              and you can follow every step from your phone.
            </p>
            <div className="ef-reveal mt-10 flex flex-wrap items-center gap-x-7 gap-y-4" style={{ animationDelay: '180ms' }}>
              <a href="#login" className="ef-press px-7 py-4 rounded-[4px] text-base font-bold" style={{ background: GOLD, color: NAVY }}>
                Log in to start a request
              </a>
              <a href="#prepare" className="ef-landing-link text-base font-semibold" style={{ color: '#FFFFFF' }}>
                What you need first
              </a>
            </div>
          </div>

          <div className="ef-reveal" style={{ animationDelay: '260ms' }}>
            <PhoneDemo />
          </div>
        </div>
      </section>

      {/* ───────── Gold band: three plain facts ───────── */}
      <section style={{ background: GOLD, color: NAVY }}>
        <ul className={`${CONTAINER} grid md:grid-cols-3`}>
          {FACTS.map((f, i) => (
            <li
              key={f}
              className={`py-5 md:py-8 md:px-8 md:first:pl-0 md:last:pr-0 font-bold text-base sm:text-lg leading-snug ${i ? 'border-t md:border-t-0 md:border-l' : ''}`}
              style={{ borderColor: 'rgba(0,47,108,0.25)' }}
            >
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── Before you start: the list ticks itself off on arrival ───────── */}
      <section id="prepare" className="scroll-mt-16">
        <Reveal className={`${CONTAINER} py-20 lg:py-28 grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16`}>
          <div>
            <h2 className="font-extrabold leading-tight text-balance" style={H2_STYLE}>
              Before you start
            </h2>
            <p className="mt-4 text-base leading-relaxed max-w-[40ch]" style={{ color: INK_SOFT }}>
              Have these ready. The request can&apos;t be sent without your parent or guardian&apos;s check.
            </p>
          </div>
          <ul style={{ borderTop: `2px solid ${NAVY}` }}>
            {PREPARE.map((p, i) => (
              <li key={p.title} className="flex gap-4 py-5" style={{ borderBottom: `1px solid ${RULE}`, ['--i' as string]: i }}>
                <span aria-hidden className="relative mt-1 w-5 h-5 shrink-0 rounded-[2px]" style={{ border: `2px solid ${NAVY}` }}>
                  <span className="ef-rv-tick absolute -inset-[2px] grid place-items-center rounded-[2px]" style={{ background: GOLD }}>
                    <Tick size={13} />
                  </span>
                </span>
                <div>
                  <p className="font-bold text-lg leading-snug">{p.title}</p>
                  <p className="mt-1 text-base leading-relaxed max-w-[60ch]" style={{ color: INK_SOFT }}>{p.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ───────── How it works: the route draws itself, each stop is stamped ───────── */}
      <section id="steps" className="scroll-mt-16" style={{ background: PAPER_COOL, borderTop: `1px solid ${RULE}` }}>
        <Reveal className={`${CONTAINER} py-20 lg:py-28`}>
          <h2 className="font-extrabold leading-tight text-balance max-w-[18ch]" style={H2_STYLE}>
            How your request moves
          </h2>
          <ol className="relative mt-14 grid gap-10 lg:grid-cols-5 lg:gap-8">
            {/* The route: horizontal on wide screens, down the left on phones */}
            <span aria-hidden className="ef-rv-route-h hidden lg:block absolute left-5 right-0 top-5 h-[2px]" style={{ background: NAVY }} />
            <span aria-hidden className="ef-rv-route-v lg:hidden absolute left-5 top-5 bottom-5 w-[2px]" style={{ background: NAVY }} />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-5 lg:block" style={{ ['--i' as string]: i }}>
                <span
                  className="ef-rv-node relative z-10 grid place-items-center shrink-0 w-10 h-10 rounded-full font-extrabold text-base tabular-nums"
                  style={{ background: GOLD, color: NAVY, border: `2px solid ${NAVY}` }}
                >
                  {i + 1}
                </span>
                <div className="lg:mt-5">
                  <p className="font-bold text-lg leading-snug">{s.title}</p>
                  <p className="mt-2 text-base leading-relaxed" style={{ color: INK_SOFT }}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* ───────── Close: navy, one action ───────── */}
      <section style={{ background: NAVY, color: '#FFFFFF' }}>
        <div className={`${CONTAINER} py-20 lg:py-28 flex flex-wrap items-end justify-between gap-x-12 gap-y-8`}>
          <div>
            <h2 className="font-extrabold leading-tight text-balance max-w-[20ch]" style={H2_STYLE}>
              Ready? Log in and start your request.
            </h2>
            <p className="mt-4 text-base leading-relaxed max-w-[44ch]" style={{ color: ON_NAVY_SOFT }}>
              Use your STI Microsoft account. Have your parent or guardian and their ID with you.
            </p>
          </div>
          <a href="#login" className="ef-press px-8 py-4 rounded-[4px] text-base font-bold" style={{ background: GOLD, color: NAVY }}>
            Log in
          </a>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer style={{ background: '#FFFFFF', color: NAVY, borderTop: `1px solid ${RULE}` }}>
        <div className={`${CONTAINER} h-16 flex items-center justify-center`}>
          <span className="font-black text-lg leading-none" style={{ fontStretch: '115%' }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </span>
        </div>
      </footer>

      <LoginModal />
    </div>
  )
}
