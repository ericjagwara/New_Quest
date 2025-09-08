"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getValidSession, clearSession, type SessionData } from "@/lib/session"

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = () => {
      const validSession = getValidSession()
      setSession(validSession)
      setIsLoading(false)

      if (!validSession && window.location.pathname !== "/") {
        router.push("/")
      }
    }

    checkSession()

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [router])

  const logout = () => {
    clearSession()
    setSession(null)
    router.push("/")
  }

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    logout,
  }
}
