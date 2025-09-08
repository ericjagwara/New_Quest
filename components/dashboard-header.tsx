"use client"

import { Button } from "@/components/ui/button"
import { User, Bell } from "lucide-react"
import { SessionTimer } from "./session-timer"

interface DashboardHeaderProps {
  user: {
    username: string
    role: string
  }
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const handleUserAccount = () => {
    console.log("Opening user account management for:", user.username)
    // TODO: Implement user account management modal/page
  }

  const handleNotifications = () => {
    console.log("Opening notifications")
    // TODO: Implement notifications panel
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Session Timer */}
        <div className="flex items-center space-x-4">
          <SessionTimer />
        </div>

        {/* Right side - User Actions */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900"
            onClick={handleUserAccount}
            title="User Account Management"
          >
            <User className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900"
            onClick={handleNotifications}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
