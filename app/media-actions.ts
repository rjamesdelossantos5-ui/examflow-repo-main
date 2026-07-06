'use server'

import { createClient } from '@/lib/supabase/server'

// On-demand signed URL for a single document, fetched only when a reviewer
// actually opens it — instead of pre-signing every file in the whole queue on
// each page load. Storage RLS still gates access to authenticated users.
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.storage.from('exam-documents').createSignedUrl(storagePath, 60 * 10)
  return data?.signedUrl ?? null
}
