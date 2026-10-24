// Decorative hero background: one printed form travels from the student to
// the Teacher and the Program Head, and arrives on a phone as
// "Scheduled". Gold means "done": each stop fills gold as the route reaches it.
//
// Pure SVG, no images, no client JS. The route draws once on page load and then
// stays still; with reduced motion it simply shows the finished drawing.
//
// Usage: put it as the first child of the hero <section>, and give that
// section "relative isolate overflow-hidden" (see the notes that came with it).

const ROUTE =
  'M 90 348 C 135 348, 145 292, 190 285 C 245 277, 270 222, 320 215 C 370 208, 395 158, 440 150 C 462 146, 480 134, 498 124'

const NAVY = 'var(--sti-navy)'
const GOLD = 'var(--sti-gold)'

const STOPS = [
  { x: 320, y: 215, label: 'Teacher', delay: '1.8s', glyph: 'check' },
  { x: 440, y: 150, label: 'Program Head', delay: '2.5s', glyph: 'calendar' },
] as const

const PHONE_ROWS = [
  { y: 82, delay: '2.8s' },
  { y: 102, delay: '2.95s' },
  { y: 122, delay: '3.1s' },
]

function Glyph({ kind }: { kind: (typeof STOPS)[number]['glyph'] }) {
  const common = { stroke: NAVY, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  if (kind === 'check') {
    return (
      <g {...common}>
        <path d="M-8 0l5 5 11-11" />
      </g>
    )
  }
  return (
    <g {...common}>
      <rect x="-9" y="-7" width="18" height="16" rx="2.5" />
      <path d="M-9 -2h18" />
      <path d="M-4 -10v5M4 -10v5" />
    </g>
  )
}

export default function HeroDrawing() {
  return (
    <div
      aria-hidden="true"
      // Phones: the whole hero, behind the text, faded so the text stays easy to
      // read (the text fills the width there). From md up: the right 54%, full
      // height, full strength.
      className="pointer-events-none absolute -z-10 inset-0 w-full opacity-50 md:inset-x-auto md:inset-y-0 md:right-0 md:w-[54%] md:opacity-100"
    >
      <style>{`
        .efh-draw { stroke-dasharray: 1; stroke-dashoffset: 0; animation: efh-draw 2.4s linear .4s both; }
        .efh-fade { animation: efh-fade .4s ease-out both; }
        /* After the route arrives, each gold stop gives a slow, quiet pulse */
        .efh-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: efh-ring 4.5s ease-out infinite; }
        @keyframes efh-ring { 0% { transform: scale(1); opacity: .45; } 70%, 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes efh-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes efh-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .efh-draw, .efh-fade, .efh-ring { animation: none; } }
      `}</style>

      <svg
        viewBox="0 0 640 420"
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

        {/* Two stops; each turns gold when the route reaches it */}
        {STOPS.map((s) => (
          <g key={s.label} transform={`translate(${s.x} ${s.y})`}>
            <circle r="21" fill="#fff" />
            <circle r="21" fill={GOLD} className="efh-fade" style={{ animationDelay: s.delay }} />
            <circle r="21" stroke={GOLD} strokeWidth="2" className="efh-ring" style={{ animationDelay: `calc(${s.delay} + 1s)` }} />
            <circle r="21" stroke={NAVY} strokeWidth="2" />
            <Glyph kind={s.glyph} />
            <text
              x="0"
              y="43"
              textAnchor="middle"
              fill={NAVY}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {s.label}
            </text>
          </g>
        ))}

        {/* The student's phone: every step done, exam scheduled */}
        <rect x="498" y="40" width="92" height="136" rx="15" fill="#fff" stroke={NAVY} strokeWidth="2" />
        <path d="M531 54h26" stroke={NAVY} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        {PHONE_ROWS.map((r) => (
          <g key={r.y}>
            <circle cx="516" cy={r.y} r="5.5" fill={GOLD} className="efh-fade" style={{ animationDelay: r.delay }} />
            <path
              d={`M513.6 ${r.y}l1.8 1.8 3.2-3.6`}
              stroke={NAVY}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="efh-fade"
              style={{ animationDelay: r.delay }}
            />
            <path d={`M528 ${r.y}h46`} stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
          </g>
        ))}
        <rect x="510" y="140" width="68" height="22" rx="11" fill={GOLD} className="efh-fade" style={{ animationDelay: '3.3s' }} />
        <text
          x="544"
          y="155"
          textAnchor="middle"
          fill={NAVY}
          className="efh-fade"
          style={{ fontSize: 11, fontWeight: 700, animationDelay: '3.3s' }}
        >
          Scheduled
        </text>
      </svg>
    </div>
  )
}
