import Link from 'next/link'

export const metadata = { title: 'EXAMFLOW — Check Your Email' }

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: 'var(--sti-gold)' }}
        >
          <span className="text-2xl font-black" style={{ color: 'var(--sti-navy)' }}>EF</span>
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--sti-navy)' }}>
          Check your email
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          We&apos;ve sent a confirmation link to your school email address.
          Please click it to activate your account before signing in.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 rounded-lg font-medium text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
