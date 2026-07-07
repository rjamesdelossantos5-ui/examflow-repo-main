import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActivePeriod, type ExamPeriod } from '@/lib/examSettings'

// The active term is looked up several times on one navigation (the layout's
// notifications + each nav badge count + the page itself). cache() makes that a
// single query per request instead of 3–4. Server-only wrapper so examSettings
// stays safe to import from client components.
export const getActivePeriodCached = cache(async (): Promise<ExamPeriod | null> => {
  const supabase = await createClient()
  return getActivePeriod(supabase)
})

export const activePeriodIdCached = cache(async (): Promise<string | null> => {
  return (await getActivePeriodCached())?.id ?? null
})
