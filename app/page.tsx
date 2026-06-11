import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #002F6C 0%, #004494 60%, #FDB913 100%)' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-8 py-5">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black text-[#002F6C] text-lg select-none">
          S
        </div>
        <span className="text-white font-bold text-xl tracking-wide">STI College</span>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="max-w-2xl">
          <div
            className="inline-block text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6"
            style={{ background: 'rgba(253,185,19,0.18)', color: '#FDB913', border: '1px solid rgba(253,185,19,0.35)' }}
          >
            Student Services Portal
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight mb-5">
            Exam<span style={{ color: '#FDB913' }}>Flow</span>
          </h1>

          <p className="text-lg sm:text-xl text-blue-100 mb-10 leading-relaxed">
            Special exam requests — submitted, tracked, and approved in one place.
            No paperwork, no guesswork.
          </p>

          <Link
            href="/login"
            className="inline-block px-10 py-4 rounded-xl text-base font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#FDB913', color: '#002F6C' }}
          >
            Log In to Your Account
          </Link>

          <p className="mt-5 text-sm text-blue-200">
            Use the credentials provided by your registrar.
          </p>
        </div>
      </section>

      {/* Feature pills */}
      <section className="flex flex-wrap justify-center gap-3 px-6 pb-12">
        {[
          'Submit requests online',
          'Real-time status tracking',
          'Role-based approvals',
          'Document uploads',
          'Automated notifications',
        ].map((f) => (
          <span
            key={f}
            className="text-xs font-medium px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {f}
          </span>
        ))}
      </section>

      {/* Footer */}
      <footer className="text-center pb-6 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        &copy; {new Date().getFullYear()} STI College &mdash; ExamFlow
      </footer>
    </main>
  )
}
