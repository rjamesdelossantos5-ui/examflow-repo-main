import StudentsPage from '@/app/program-head/students/page'

export const metadata = { title: 'EXAMFLOW Admin — Accepted Students' }

// The same Accepted Students list the Program Head sees (/program-head/students),
// with the Excel export. Its delete action (deleteFinishedRequest in
// app/program-head/actions.ts) already accepts 'admin', and the
// requests_student_select (read) and requests_ph_admin_delete policies cover admins.
export default StudentsPage
