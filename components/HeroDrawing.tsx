// Decorative hero background: one printed form travels along the same seven
// steps as the student dashboard's progress bar (Submitted, Teacher, Program
// Head, Fee Assessment, Receipt, Checking, Scheduled) and arrives on a phone as
// "Scheduled". Gold means "done": each stop fills gold as the route reaches it.
// This is the paid route; a waived exam skips the three payment steps.
//
// Pure SVG, no images, no client JS. The route draws once on page load and then
// stays still; with reduced motion it simply shows the finished drawing.
//
// Usage: put it as the first child of the hero <section>, and give that
// section "relative isolate overflow-hidden" (see the notes that came with it).

const NAVY = 'var(--sti-navy)'
const GOLD = 'var(--sti-gold)'

// Labels match RequestStepper's STEPS_PAID.
const STOPS = [
  { x: 170, y: 305, label: 'Teacher', delay: '1.1s', glyph: 'check' },
  { x: 270, y: 267, label: 'Program Head', delay: '1.6s', glyph: 'check' },
  { x: 370, y: 229, label: 'Fee Assessment', delay: '2.1s', glyph: 'fee' },
  { x: 470, y: 191, label: 'Receipt', delay: '2.6s', glyph: 'receipt' },
  { x: 570, y: 153, label: 'Checking', delay: '3.1s', glyph: 'search' },
] as const

// Start at the form, pass through every stop with a gentle S between them, end
// at the phone.
const POINTS: [number, number][] = [[92, 346], ...STOPS.map((s) => [s.x, s.y] as [number, number]), [640, 118]]
const ROUTE = POINTS.slice(1).reduce((d, [x, y], i) => {
  const [px, py] = POINTS[i]
  const mx = (px + x) / 2
  return `${d} C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`
}, `M ${POINTS[0][0]} ${POINTS[0][1]}`)

const PHONE_ROWS = [
  { y: 82, delay: '3.4s' },
  { y: 102, delay: '3.55s' },
  { y: 122, delay: '3.7s' },
]

function Glyph({ kind }: { kind: (typeof STOPS)[number]['glyph'] }) {
  const common = { stroke: NAVY, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  switch (kind) {
    case 'check':
      return (
        <g {...common}>
          <path d="M-8 0l5 5 11-11" />
        </g>
      )
    case 'fee': // a bill with a line of figures
      return (
        <g {...common}>
          <rect x="-9" y="-7" width="18" height="14" rx="2.5" />
          <path d="M-4 -2h8M-4 3h5" />
        </g>
      )
    case 'receipt': // an arrow going up into a tray: the upload
      return (
        <g {...common}>
          <path d="M0 5v-12M-5 -3l5 -5 5 5" />
          <path d="M-8 8h16" />
        </g>
      )
    default: // search: the Program Head checks the receipt
      return (
        <g {...common}>
          <circle cx="-1.5" cy="-1.5" r="6" />
          <path d="M3 3l6 6" />
        </g>
      )
  }
}

export default function HeroDrawing() {
  return (
    <div
      aria-hidden="true"
      // Phones: the whole hero, behind the text, faded so the text stays easy to
      // read (the text fills the width there). From md up: the right 56%, full
      // height, full strength.
      className="pointer-events-none absolute -z-10 inset-0 w-full opacity-50 md:inset-x-auto md:inset-y-0 md:right-0 md:w-[56%] md:opacity-100"
    >
      <style>{`
        .efh-draw { stroke-dasharray: 1; stroke-dashoffset: 0; animation: efh-draw 3s linear .4s both; }
        .efh-fade { animation: efh-fade .4s ease-out both; }
        /* After the route arrives, each gold stop gives a slow, quiet pulse */
        .efh-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: efh-ring 4.5s ease-out infinite; }
        @keyframes efh-ring { 0% { transform: scale(1); opacity: .45; } 70%, 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes efh-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes efh-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .efh-draw, .efh-fade, .efh-ring { animation: none; } }
      `}</style>

      <svg
        viewBox="0 0 780 420"
        preserveAspectRatio="xMaxYMid meet"
        className="h-full w-full"
        fill="none"
        focusable="false"
      >
        {/* The form the student starts with */}
        <g transform="rotate(-5 60 350)">
          <rect x="30" y="312" width="60" height="76" rx="4" fill="#fff" stroke={NAVY} strokeWidth="2" />
          <path d="M40 330h28" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 343h40M40 353h32" stroke={NAVY} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <rect x="40" y="365" width="9" height="9" rx="2" stroke={NAVY} strokeWidth="1.6" />
          <path d="M42 369.5l2.2 2.2 3.6-4" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M54 370h26" stroke={NAVY} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        </g>
        <text x="60" y="406" textAnchor="middle" fill={NAVY} className="efh-fade" style={{ fontSize: 13, fontWeight: 600, animationDelay: '.2s' }}>
          Submitted
        </text>

        {/* The route: dotted ahead of the pen, solid once travelled */}
        <path d={ROUTE} stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 7" opacity="0.35" />
        <path d={ROUTE} pathLength={1} className="efh-draw" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />

        {/* The five stops between; each turns gold when the route reaches it */}
        {STOPS.map((s) => (
          <g key={s.label} transform={`translate(${s.x} ${s.y})`}>
            <circle r="20" fill="#fff" />
            <circle r="20" fill={GOLD} className="efh-fade" style={{ animationDelay: s.delay }} />
            <circle r="20" stroke={GOLD} strokeWidth="2" className="efh-ring" style={{ animationDelay: `calc(${s.delay} + 1s)` }} />
            <circle r="20" stroke={NAVY} strokeWidth="2" />
            <Glyph kind={s.glyph} />
            <text x="0" y="41" textAnchor="middle" fill={NAVY} style={{ fontSize: 13, fontWeight: 600 }}>
              {s.label}
            </text>
          </g>
        ))}

        {/* The student's phone: every step done, exam scheduled */}
        <rect x="640" y="40" width="92" height="136" rx="15" fill="#fff" stroke={NAVY} strokeWidth="2" />
        <path d="M673 54h26" stroke={NAVY} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        {PHONE_ROWS.map((r) => (
          <g key={r.y}>
            <circle cx="658" cy={r.y} r="5.5" fill={GOLD} className="efh-fade" style={{ animationDelay: r.delay }} />
            <path
              d={`M655.6 ${r.y}l1.8 1.8 3.2-3.6`}
              stroke={NAVY}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="efh-fade"
              style={{ animationDelay: r.delay }}
            />
            <path d={`M670 ${r.y}h46`} stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
          </g>
        ))}
        <rect x="652" y="140" width="68" height="22" rx="11" fill={GOLD} className="efh-fade" style={{ animationDelay: '3.9s' }} />
        <text
          x="686"
          y="155"
          textAnchor="middle"
          fill={NAVY}
          className="efh-fade"
          style={{ fontSize: 11, fontWeight: 700, animationDelay: '3.9s' }}
        >
          Scheduled
        </text>
      </svg>
    </div>
  )
}
