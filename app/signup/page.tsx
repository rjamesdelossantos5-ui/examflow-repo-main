import Link from 'next/link'
import { signup } from './actions'
import SubmitButton from '@/components/SubmitButton'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'EXAMFLOW — Sign Up' }

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .order('name')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
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
          <h2 className="text-xl font-bold text-gray-800 mb-1">Create a student account</h2>
          <p className="text-sm text-gray-500 mb-6">Use your official school email address.</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={signup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fullName">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                School Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@yourschool.edu.ph"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="studentNumber">
                Student Number
              </label>
              <input
                id="studentNumber"
                name="studentNumber"
                type="text"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="departmentId">
                Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                required
                defaultValue=""
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
              >
                <option value="" disabled>Select department</option>
                {departments?.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="course">
                  Course
                </label>
                <input
                  id="course"
                  name="course"
                  type="text"
                  placeholder="e.g. BSIT"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="yearLevel">
                  Year
                </label>
                <input
                  id="yearLevel"
                  name="yearLevel"
                  type="number"
                  min={1}
                  max={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="section">
                Section
              </label>
              <input
                id="section"
                name="section"
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </div>

            <SubmitButton
              pendingText="Creating account…"
              className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              Sign Up
            </SubmitButton>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 rounded-lg font-medium text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Already have an account? Sign In
            </Link>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Special Exam Request System
        </p>
      </div>
    </div>
  )
}
