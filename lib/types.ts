export interface User {
  id: number
  phone: string
  name: string
  role: "fieldworker" | "manager" | "superadmin"
  school?: string
  district?: string
  loginTime: number
  expiresAt: number
}

export interface AttendanceRecord {
  id: number
  phone: string
  students_present: number
  students_absent: number
  absence_reason: string
  topic_covered: string
  teacher_name?: string
  school?: string
  district?: string
}

export interface UserRecord {
  id: number
  phone: string
  name: string
  school: string
  district: string
  language: string
}

export interface DashboardStats {
  totalPresent: number
  totalAbsent: number
  attendanceRate: number
  totalSchools: number
  totalDistricts: number
  totalTeachers: number
}

export interface ExportRequest {
  id: number
  requester_name: string
  requester_phone: string
  data_type: string
  record_count: number
  reason: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
}

export interface ApiError {
  message: string
  status?: number
  code?: string
}
