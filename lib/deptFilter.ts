// Keep only requests whose subject belongs to the given department. A null
// department (e.g. an admin, or a PH with no department set) means "see all",
// so nothing is filtered. Used to scope a Program Head's approval queues to
// their own department — the Accepted-Students live list deliberately does NOT
// use this, so it shows every department.
interface WithSubjectDept {
  subjects?: { department_id?: string | null } | null
}

export function keepMyDepartment<T extends WithSubjectDept>(rows: T[], departmentId: string | null): T[] {
  if (!departmentId) return rows
  return rows.filter((r) => (r.subjects?.department_id ?? null) === departmentId)
}
