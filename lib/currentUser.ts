import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Deduped for the lifetime of ONE server request. Every navigation renders a
// layout + a page (+ notifications helpers), and each of those independently
// asked "who is the user?" — and auth.getUser() is a network call to the
// Supabase auth server. cache() collapses them into a single call per request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
