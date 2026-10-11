import { redirect } from 'next/navigation'

// The admin's home (after login, and the header logo): Requests, the first
// tab and the daily work.
export default function AdminPage() {
  redirect('/admin/requests')
}
