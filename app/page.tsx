import LoginModal from './LoginModal'

const NAVY = '#002F6C'
const GOLD = '#FDB913'
const WHITE = '#ffffff'
const SOFT = '#f4f7fb' // gentle tint so it's "not full white"
// Matches the dashboard's content width + padding exactly.
const CONTAINER = 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8'

export default function LandingPage() {
  // Inline backgrounds (not Tailwind bg-* classes) so the app's dark-mode
  // overrides never touch this public page — it always renders light.
  return (
    <div style={{ background: WHITE, color: '#1e293b' }}>
      {/* ───────── Nav ───────── */}
      <header className="sticky top-0 z-50" style={{ background: NAVY, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div className={`${CONTAINER} h-16 flex items-center justify-between`}>
          <span className="font-black text-xl tracking-tight text-white">
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </span>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-blue-100/80">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#flow" className="hover:text-white transition-colors">How it works</a>
            <a href="#reviewers" className="hover:text-white transition-colors">Who reviews</a>
          </nav>
          <a
            href="#login"
            className="px-5 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow transition-all"
            style={{ background: GOLD, color: NAVY }}
          >
            Log In
          </a>
        </div>
      </header>

      {/* ───────── Hero (fills the whole first screen in navy) ───────── */}
      <section
        className="relative overflow-hidden flex items-center min-h-[calc(100vh-4rem)]"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #013a85 55%, #024aa6 100%)` }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30" style={{ background: GOLD }} />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full blur-3xl opacity-20 bg-blue-400" />

        <div className={`${CONTAINER} relative py-16 grid lg:grid-cols-2 gap-12 items-center w-full`}>
          <div>
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(253,185,19,0.15)', color: GOLD, border: '1px solid rgba(253,185,19,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
              For Students
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6">
              Missed an exam?<br />
              <span style={{ color: GOLD }}>Request it online.</span>
            </h1>

            <p className="text-lg text-blue-100/90 leading-relaxed mb-9 max-w-lg">
              File your special exam request in minutes, upload your documents, and watch it move through your
              registrar, teacher, and program head — all in real time. No lines, no lost forms.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#login"
                className="px-7 py-3.5 rounded-xl text-base font-bold shadow-lg hover:scale-[1.03] active:scale-95 transition-transform"
                style={{ background: GOLD, color: NAVY }}
              >
                Log In to Request
              </a>
              <a href="#flow" className="px-6 py-3.5 rounded-xl text-base font-semibold text-white border border-white/25 hover:bg-white/10 transition-colors">
                See how it works
              </a>
            </div>
          </div>

          {/* Mock request card */}
          <div className="relative">
            <div className="rounded-2xl shadow-2xl p-6 max-w-sm mx-auto rotate-1 hover:rotate-0 transition-transform duration-300" style={{ background: WHITE }}>
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
            <div className="hidden sm:block absolute -bottom-5 -left-3 rounded-xl shadow-xl px-4 py-3 -rotate-3" style={{ background: WHITE }}>
              <p className="text-xs text-slate-400">Documents</p>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>3 files verified ✓</p>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <a href="#features" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors" aria-label="Scroll down">
          <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </a>
      </section>

      {/* ───────── Stat band ───────── */}
      <section className="border-b border-slate-100" style={{ background: WHITE }}>
        <div className={`${CONTAINER} py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center`}>
          {[
            ['Minutes', 'To submit a request'],
            ['Real-time', 'Track every stage'],
            ['Paperless', 'Upload, no printing'],
            ['One place', 'All your requests'],
          ].map(([big, small]) => (
            <div key={big}>
              <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: NAVY }}>{big}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Features (soft tint) ───────── */}
      <section id="features" className="scroll-mt-16" style={{ background: SOFT }}>
        <div className={`${CONTAINER} py-20 sm:py-24`}>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: NAVY }}>Everything you need in one form</h2>
            <p className="text-slate-500 text-lg">From the moment you submit to the day your exam is scheduled.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📝', title: 'Submit online', body: 'Pick your subject, choose paid or excused, and attach your documents — all in one guided form.' },
              { icon: '📊', title: 'Track in real time', body: 'A clear progress tracker shows exactly which stage you’re at and what happens next.' },
              { icon: '📎', title: 'Upload your documents', body: 'Add your ID, signature, and certificates. Reviewers verify each file right in their dashboard.' },
              { icon: '🔁', title: 'Reviewed in order', body: 'Your request goes Registrar → Teacher → Program Head — nothing skipped, nothing lost.' },
              { icon: '🧾', title: 'Receipts & schedule', body: 'For paid exams, upload your payment receipt and get your final exam schedule once approved.' },
              { icon: '🔔', title: 'Always know the status', body: 'See approvals, rejections, and the reason for each — no more chasing people for updates.' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all" style={{ background: WHITE }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: 'rgba(0,47,108,0.06)' }}>{f.icon}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: NAVY }}>{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="flow" className="scroll-mt-16" style={{ background: WHITE }}>
        <div className={`${CONTAINER} py-20 sm:py-24`}>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: NAVY }}>What happens after you submit</h2>
            <p className="text-slate-500 text-lg">Four clear steps from your request to a scheduled exam.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: '1', t: 'You submit', d: 'Fill the form and upload your documents.' },
              { n: '2', t: 'Registrar verifies', d: 'Checks your request and paperwork.' },
              { n: '3', t: 'Teacher approves', d: 'Confirms the subject and your absence.' },
              { n: '4', t: 'Program Head schedules', d: 'Accepts and sets your exam date.' },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200 shadow-sm p-6 text-center" style={{ background: WHITE }}>
                <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center font-black text-lg" style={{ background: GOLD, color: NAVY }}>{s.n}</div>
                <h3 className="font-bold mb-2" style={{ color: NAVY }}>{s.t}</h3>
                <p className="text-sm text-slate-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Who reviews (soft tint) ───────── */}
      <section id="reviewers" className="scroll-mt-16" style={{ background: SOFT }}>
        <div className={`${CONTAINER} py-20 sm:py-24`}>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: NAVY }}>Who reviews your request</h2>
            <p className="text-slate-500 text-lg">Each reviewer has their own dashboard — you just track the progress.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: '🏫', role: 'Registrar', note: 'Verifies your submission' },
              { icon: '✅', role: 'Teacher', note: 'Approves the subject exam' },
              { icon: '👔', role: 'Program Head', note: 'Accepts & schedules it' },
            ].map((r) => (
              <div key={r.role} className="rounded-2xl border border-slate-200 shadow-sm p-6 text-center" style={{ background: WHITE }}>
                <div className="text-3xl mb-3">{r.icon}</div>
                <p className="font-bold" style={{ color: NAVY }}>{r.role}</p>
                <p className="text-xs text-slate-500 mt-1">{r.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-slate-100" style={{ background: WHITE }}>
        <div className={`${CONTAINER} py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400`}>
          <span className="font-black" style={{ color: NAVY }}>EXAM<span style={{ color: GOLD }}>FLOW</span></span>
          <span>&copy; {new Date().getFullYear()} EXAMFLOW · Special Exam Request System</span>
        </div>
      </footer>

      <LoginModal />
    </div>
  )
}
