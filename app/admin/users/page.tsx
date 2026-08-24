import { createClient } from '@/lib/supabase/server'
import UserTable from './UserTable'
import UserUpload from './UserUpload'

export const metadata = { title: 'EXAMFLOW Admin — Users' }

export default async function UsersPage() {
  const supabase = await createClient()

  const [{ data: users }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('departments').select('*').order('name'),
  ])

  return (
    <div className="space-y-6">
      {/* Bulk import first: creating accounts one at a time doesn't scale past a
          handful, so the Excel path is the primary route for a new term. */}
      <UserUpload />
      <UserTable users={users ?? []} departments={departments ?? []} />
    </div>
  )
}
