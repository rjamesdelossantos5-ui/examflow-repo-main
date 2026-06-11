import Link from 'next/link'
import { login } from './actions'

export const metadata = { title: 'EXAMFLOW — Login' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: 'var(--sti-gold)' }}
          >
            <span className="text-2xl font-black" style={{ color: 'var(--sti-navy)' }}>EF</span>
          </div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--sti-navy)' }}>
            EXAMFLOW
          </h1>
          <p className="text-sm text-gray-500 mt-1">Special Exam Request System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={login} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--sti-gold)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          STI College · Special Exam Request System
        </p>
        <p className="text-center mt-3">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to Home
          </Link>
        </p>
      </div>
    </div>
  )
}
