export type UserRole = 'admin' | 'registrar' | 'subject_teacher' | 'program_head' | 'student'
export type ExamType = 'paid' | 'excused'
export type RequestStatus =
  | 'submitted'
  | 'verified_by_registrar'
  | 'approved_by_teacher'
  | 'accepted'
  | 'receipt_uploaded'
  | 'scheduled'
  | 'rejected'
export type ExcusedReason = 'medical' | 'bereavement' | 'other'
export type MediaType = 'parent_id' | 'parent_signature' | 'supporting_document' | 'payment_receipt'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  department_id: string | null
  student_number: string | null
  course: string | null
  year_level: number | null
  section: string | null
  is_active: boolean
  can_override?: boolean
  created_at: string
}

export interface Department {
  id: string
  name: string
  created_at: string
}

export interface Subject {
  id: string
  subject_code: string
  subject_name: string
  department_id: string | null
  teacher_id: string | null
  created_at: string
}

export interface SpecialExamRequest {
  id: string
  student_id: string
  subject_id: string
  exam_type: ExamType
  excused_reason: ExcusedReason | null
  other_reason: string | null
  status: RequestStatus
  rejection_reason: string | null
  rejected_by_role: UserRole | null
  final_schedule: string | null
  submitted_at: string
  updated_at: string
}

export interface ApplicationMedia {
  id: string
  request_id: string
  media_type: MediaType
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
}

export interface ProgressLog {
  id: string
  request_id: string
  actor_id: string
  actor_role: UserRole
  action: string
  notes: string | null
  created_at: string
}

// Joined / extended types used in UI
export interface RequestWithDetails extends SpecialExamRequest {
  profiles: Profile
  subjects: Subject & { departments: Department | null; profiles: Profile | null }
  application_media: ApplicationMedia[]
  progress_logs: (ProgressLog & { profiles: Pick<Profile, 'full_name' | 'role'> })[]
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      departments: { Row: Department; Insert: Omit<Department, 'id' | 'created_at'>; Update: Partial<Department> }
      subjects: { Row: Subject; Insert: Omit<Subject, 'id' | 'created_at'>; Update: Partial<Subject> }
      special_exam_requests: { Row: SpecialExamRequest; Insert: Omit<SpecialExamRequest, 'id' | 'submitted_at' | 'updated_at'>; Update: Partial<SpecialExamRequest> }
      application_media: { Row: ApplicationMedia; Insert: Omit<ApplicationMedia, 'id' | 'uploaded_at'>; Update: Partial<ApplicationMedia> }
      progress_logs: { Row: ProgressLog; Insert: Omit<ProgressLog, 'id' | 'created_at'>; Update: never }
      settings: { Row: { key: string; value: string; updated_at: string }; Insert: { key: string; value: string }; Update: { value: string } }
    }
  }
}
