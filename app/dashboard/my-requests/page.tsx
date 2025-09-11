"use client"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { MyRequestsManager } from "@/components/my-requests-manager"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"

export default function MyRequestsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in
    const authUser = localStorage.getItem("authUser")
    if (authUser) {
      const userData = JSON.parse(authUser)
      setUser(userData)

      // Check if user has permission to access this page
      if (userData.role !== "fieldworker") {
        window.location.href = "/dashboard"
        return
      }
    } else {
      window.location.href = "/"
      return
    }
    setLoading(false)
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user || user.role !== "fieldworker") {
    return (
      <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
        <DashboardSidebar user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader user={user} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>Access denied. Only field workers can view their requests.</AlertDescription>
            </Alert>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Sidebar */}
      <DashboardSidebar user={user} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader user={user} />

        {/* Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <span>🏠</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="font-medium">My Requests</span>
            </div>

            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-emerald-800">My Export Requests</h1>
              <div className="flex items-center space-x-2 text-sm text-emerald-600">
                <Shield className="w-4 h-4" />
                <span>Field Worker Access</span>
              </div>
            </div>

            <MyRequestsManager user={user} />
          </div>
        </main>
      </div>
    </div>
  )
}
