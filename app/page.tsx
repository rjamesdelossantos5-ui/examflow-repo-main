import Link from 'next/link'

const NAVY = '#002F6C'
const GOLD = '#FDB913'

export default function LandingPage() {
  return (
    <div className="bg-white text-slate-800">
      {/* ───────── Nav ───────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="font-black text-xl tracking-tight" style={{ color: NAVY }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </span>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#flow" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#roles" className="hover:text-slate-900 transition-colors">Roles</a>
          </nav>
          <Link
            href="/login"
            className="px-5 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow transition-all"
            style={{ background: GOLD, color: NAVY }}
          >
            Log In
          </Link>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #013a85 55%, #024aa6 100%)` }}>
        {/* glow accents */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30" style={{ background: GOLD }} />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full blur-3xl opacity-20 bg-blue-400" />

        <div className="relative max-w-6xl mx-auto px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(253,185,19,0.15)', color: GOLD, border: '1px solid rgba(253,185,19,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
              Special Exam Request System
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6">
              Special exams,<br />
              <span style={{ color: GOLD }}>without the paperwork.</span>
            </h1>

            <p className="text-lg text-blue-100/90 leading-relaxed mb-9 max-w-lg">
              Students file a request in minutes. Registrars, teachers, and program heads review it in order —
              each with their own dashboard. Everyone sees exactly where it stands, in real time.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="px-7 py-3.5 rounded-xl text-base font-bold shadow-lg hover:scale-[1.03] active:scale-95 transition-transform"
                style={{ background: GOLD, color: NAVY }}
              >
                Log In to Get Started
              </Link>
              <a href="#flow" className="px-6 py-3.5 rounded-xl text-base font-semibold text-white border border-white/25 hover:bg-white/10 transition-colors">
                See how it works
              </a>
            </div>
          </div>

          {/* Mock request card */}
          <div className="relative">
            <div className="rounded-2xl bg-white shadow-2xl p-6 max-w-sm mx-auto rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold" style={{ color: NAVY }}>IT101 — Special Exam</p>
                  <p className="text-xs text-slate-400">Submitted today</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">In review</span>
              </div>
              <div className="space-y-3">
                {[
                  ['Submitted', true],
                  ['Verified by Registrar', true],
                  ['Approved by Teacher', false],
                  ['Accepted & Scheduled', false],
                ].map(([label, done]) => (
                  <div key={label as string} className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={done ? { background: GOLD, color: NAVY } : { background: '#eef1f5', color: '#94a3b8' }}
                    >
                      {done ? '✓' : '•'}
                    </span>
                    <span className={`text-sm ${done ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden sm:block absolute -bottom-5 -left-3 rounded-xl bg-white shadow-xl px-4 py-3 -rotate-3">
              <p className="text-xs text-slate-400">Documents</p>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>3 files verified ✓</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Stat band ───────── */}
      <section className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ['4 steps', 'From request to scheduled'],
            ['5 roles', 'Student to administrator'],
            ['Real-time', 'Live status tracking'],
            ['Paperless', 'Everything in one place'],
          ].map(([big, small]) => (
            <div key={big}>
              <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: NAVY }}>{big}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20 sm:py-24 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: NAVY }}>Everything a special exam needs</h2>
          <p className="text-slate-500 text-lg">Built for the whole approval chain — not just a form that lands in someone&apos;s inbox.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '📝', title: 'Online submission', body: 'Pick a subject, choose paid or excused, and attach the required documents — all in one guided form.' },
            { icon: '🔁', title: 'Ordered approvals', body: 'Each request moves Registrar → Teacher → Program Head. No one gets skipped, nothing slips through.' },
            { icon: '📎', title: 'Document verification', body: 'Upload IDs, signatures, and certificates. Reviewers open and verify each file right in their dashboard.' },
            { icon: '📊', title: 'Live tracking', body: 'A clear progress tracker shows students exactly which stage they’re at — and what happens next.' },
            { icon: '🧾', title: 'Receipts & scheduling', body: 'Paid exams collect a payment receipt; program heads confirm it and set the final exam schedule.' },
            { icon: '📤', title: 'Export & records', body: 'Program heads export accepted students to Excel and keep a full audit trail of every action taken.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:-translate-y-1 transition-all bg-white">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: 'rgba(0,47,108,0.06)' }}>{f.icon}</div>
              <h3 className="font-bold text-lg mb-2" style={{ color: NAVY }}>{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="flow" className="scroll-mt-16" style={{ background: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto px-5 py-20 sm:py-24">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: NAVY }}>How a request flows</h2>
            <p className="text-slate-500 text-lg">One clear path from submission to a scheduled exam.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {[
              { n: '1', t: 'Student submits', d: 'Fills the form and uploads documents.' },
              { n: '2', t: 'Registrar verifies', d: 'Checks the request and the paperwork.' },
              { n: '3', t: 'Teacher approves', d: 'Confirms the subject and absence.' },
              { n: '4', t: 'Program Head accepts', d: 'Sets the schedule — done.' },
            ].map((s) => (
              <div key={s.n} className="relative rounded-2xl bg-white border border-slate-200 p-6 text-center">
                <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center font-black text-lg" style={{ background: GOLD, color: NAVY }}>{s.n}</div>
                <h3 className="font-bold mb-2" style={{ color: NAVY }}>{s.t}</h3>
                <p className="text-sm text-slate-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Roles ───────── */}
      <section id="roles" className="max-w-6xl mx-auto px-5 py-20 sm:py-24 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: NAVY }}>A dashboard for every role</h2>
          <p className="text-slate-500 text-lg">Each person sees only what they need to act on.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { icon: '🎓', role: 'Student', note: 'Submit & track requests' },
            { icon: '🏫', role: 'Registrar', note: 'Verify submissions' },
            { icon: '✅', role: 'Teacher', note: 'Approve subject exams' },
            { icon: '👔', role: 'Program Head', note: 'Accept & schedule' },
            { icon: '⚙️', role: 'Administrator', note: 'Manage users & data' },
          ].map((r) => (
            <div key={r.role} className="rounded-2xl border border-slate-200 p-5 text-center hover:border-[color:var(--g)] transition-colors" style={{ ['--g' as string]: GOLD }}>
              <div className="text-3xl mb-3">{r.icon}</div>
              <p className="font-bold" style={{ color: NAVY }}>{r.role}</p>
              <p className="text-xs text-slate-500 mt-1">{r.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="px-5 pb-20">
        <div className="max-w-5xl mx-auto rounded-3xl px-8 py-16 text-center relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY}, #024aa6)` }}>
          <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ background: GOLD }} />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Ready to file your request?</h2>
            <p className="text-blue-100/90 text-lg mb-8 max-w-xl mx-auto">Log in with the account from your registrar and submit a special exam request in minutes.</p>
            <Link
              href="/login"
              className="inline-block px-9 py-4 rounded-xl text-base font-bold shadow-lg hover:scale-[1.03] active:scale-95 transition-transform"
              style={{ background: GOLD, color: NAVY }}
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <span className="font-black" style={{ color: NAVY }}>EXAM<span style={{ color: GOLD }}>FLOW</span></span>
          <span>&copy; {new Date().getFullYear()} EXAMFLOW · Special Exam Request System</span>
        </div>
      </footer>
    </div>
  )
}
