"use client"

import { useState, useEffect } from "react"
import { Clock, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

export function SessionTimer() {
  const [timeLeft, setTimeLeft] = useState<number>(20 * 60 * 1000) // 20 minutes in milliseconds
  const [isWarning, setIsWarning] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const updateTimer = () => {
      setTimeLeft((prevTime) => {
        const newTime = Math.max(0, prevTime - 1000) // Decrease by 1 second
        setIsWarning(newTime < 5 * 60 * 1000) // Warning when less than 5 minutes

        if (newTime === 0) {
          router.push("/")
          return 0
        }

        return newTime
      })
    }

    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [router])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  if (timeLeft === 0) return null

  return (
    <div
      className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm ${
        isWarning ? "bg-red-50 text-red-700 border border-red-200" : "bg-gray-50 text-gray-600 border border-gray-200"
      }`}
    >
      {isWarning ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      <span className="text-xs font-medium">Timeout Counter:</span>
      <span className="font-medium">{formatTime(timeLeft)}</span>
      {isWarning && <span className="text-xs">Session expires soon</span>}
    </div>
  )
}
