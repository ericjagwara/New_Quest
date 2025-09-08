export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

export const API_ENDPOINTS = {
  attendance: `${API_BASE_URL}/attendance`,
  users: `${API_BASE_URL}/users`,
  auth: `${API_BASE_URL}/auth`,
  sales: `${API_BASE_URL}/sales`,
} as const
