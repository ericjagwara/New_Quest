import type { User } from "./types"

export const SESSION_DURATION = 20 * 60 * 1000 // 20 minutes in milliseconds

export function isSessionValid(sessionData?: User): boolean {
  if (sessionData) {
    return Date.now() < sessionData.expiresAt
  } else {
    const sessionData = getValidSession()
    return sessionData !== null
  }
}

export function getValidSession(): User | null {
  try {
    if (typeof window === "undefined") return null

    const authUser = localStorage.getItem("authUser")
    if (!authUser) return null

    const sessionData: User = JSON.parse(authUser)

    // Check if session has required fields and is not expired
    if (!sessionData.expiresAt || !isSessionValid(sessionData)) {
      localStorage.removeItem("authUser")
      return null
    }

    return sessionData
  } catch (error) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("authUser")
    }
    return null
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("authUser")
  }
}

export function refreshSession(sessionData: User): void {
  if (typeof window === "undefined") return

  const refreshedSession = {
    ...sessionData,
    expiresAt: Date.now() + SESSION_DURATION,
  }
  localStorage.setItem("authUser", JSON.stringify(refreshedSession))
}

export function getSessionExpiry(): number | null {
  const sessionData = getValidSession()
  return sessionData ? sessionData.expiresAt : null
}
