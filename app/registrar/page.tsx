import { redirect } from 'next/navigation'

// The Registrar no longer reviews submissions — they go straight to the Subject
// Teacher. Their work is the fee assessment for paid exams and the parent list.
export default function RegistrarPage() {
  redirect('/registrar/assessment')
}
