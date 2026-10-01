import { createClient } from '@/lib/supabase/server'
import UserTable from './UserTable'

export const metadata = { title: 'EXAMFLOW Admin — Users' }

export default async function UsersPage() {
  const supabase = await createClient()

  const [{ data: users }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('departments').select('*').order('name'),
  ])

  return (
    <div className="space-y-6">
      {/* Accounts arrive in bulk from the School Data import; this page is for
          finding, adding one-off, deactivating and deleting accounts. */}
      <UserTable users={users ?? []} departments={departments ?? []} />
    </div>
  )
}
