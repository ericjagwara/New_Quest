// app/dashboard/school/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { fetchAttendanceData, fetchUsersData } from "@/lib/api"

interface AttendanceRecord {
  id: string
  phone: string
  subject: string
  students_present: number
  students_absent: number
  absence_reason: string
  district: string
  teacher_name?: string
  school?: string
}

interface User {
  id: string
  name: string
  phone: string
  role: string
  school?: string
  district?: string
}

export default function SchoolDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBlurred, setIsBlurred] = useState(false)
  const router = useRouter()

  // Screenshot prevention effects
  useEffect(() => {
    // 1. CSS-based screenshot prevention
    const style = document.createElement('style')
    style.textContent = `
      .screenshot-protected {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      @media print {
        .screenshot-protected {
          display: none !important;
        }
        body::after {
          content: "Screenshots and printing are not allowed for this content.";
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 24px;
          color: red;
          z-index: 9999;
        }
      }
      
      .blur-overlay {
        filter: blur(10px);
        pointer-events: none;
        transition: filter 0.3s ease;
      }
    `
    document.head.appendChild(style)

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  useEffect(() => {
    // 2. Keyboard shortcuts prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent common screenshot shortcuts
      const forbiddenKeys = [
        // Print Screen
        'PrintScreen',
        // Windows + Print Screen
        'F12', // DevTools
        // Ctrl/Cmd + Shift + S (Firefox screenshot)
        // Ctrl/Cmd + Shift + I (DevTools)
        // Ctrl/Cmd + U (View Source)
      ]

      const isForbiddenCombination = 
        // Ctrl+Shift+S (Firefox screenshot)
        (e.ctrlKey && e.shiftKey && e.key === 'S') ||
        // Ctrl+Shift+I (DevTools)
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        // Ctrl+U (View Source)
        (e.ctrlKey && e.key === 'u') ||
        // F12 (DevTools)
        e.key === 'F12' ||
        // Print Screen
        e.key === 'PrintScreen' ||
        // Windows + Print Screen
        (e.metaKey && e.key === 'PrintScreen') ||
        // Ctrl+P (Print)
        (e.ctrlKey && e.key === 'p') ||
        // Cmd combinations on Mac
        (e.metaKey && e.shiftKey && e.key === 'S') ||
        (e.metaKey && e.shiftKey && e.key === 'I') ||
        (e.metaKey && e.key === 'u') ||
        (e.metaKey && e.key === 'p')

      if (forbiddenKeys.includes(e.key) || isForbiddenCombination) {
        e.preventDefault()
        e.stopPropagation()
        alert('Screenshots and developer tools are disabled for security reasons.')
        return false
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  useEffect(() => {
    // 3. Right-click prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  useEffect(() => {
    // 4. Mobile screenshot detection (approximate)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true)
        // Blur content when tab becomes hidden (potential screenshot attempt)
        setTimeout(() => setIsBlurred(false), 1000)
      }
    }

    // 5. Focus/blur detection for potential screen recording
    const handleWindowBlur = () => {
      setIsBlurred(true)
      setTimeout(() => setIsBlurred(false), 500)
    }

    const handleWindowFocus = () => {
      setIsBlurred(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [])

  useEffect(() => {
    // 6. DevTools detection
    let devtools = { open: false }
    
    const checkDevTools = () => {
      const threshold = 160
      
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true
          alert('Developer tools detected. Please close them for security reasons.')
          // Optionally redirect or blur content
          setIsBlurred(true)
        }
      } else {
        if (devtools.open) {
          devtools.open = false
          setIsBlurred(false)
        }
      }
    }

    const interval = setInterval(checkDevTools, 500)
    return () => clearInterval(interval)
  }, [])

  // Original authentication and data fetching logic
  useEffect(() => {
    const checkAuth = () => {
      try {
        const authUser = localStorage.getItem("authUser")
        if (!authUser) {
          router.push("/")
          return
        }
        const userData = JSON.parse(authUser)
        if (userData.expiresAt && Date.now() > userData.expiresAt) {
          localStorage.removeItem("authUser")
          router.push("/")
          return
        }
        setUser(userData)
      } catch (error) {
        console.error("Auth check error:", error)
        localStorage.removeItem("authUser")
        router.push("/")
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    if (user) {
      fetchSchoolData()
    }
  }, [user])

  const fetchSchoolData = async () => {
    try {
      setLoading(true)
      setError(null)
      const usersData = await fetchUsersData()
      const currentUserData = usersData.find(u => u.phone === user?.phone)
      if (!currentUserData) {
        setError("School information not found")
        setLoading(false)
        return
      }
      const attendanceResult = await fetchAttendanceData()
      const schoolAttendance = attendanceResult.filter(record => {
        const recordUser = usersData.find(u => u.phone === record.phone)
        return recordUser?.school === currentUserData.school
      })
      const enhancedAttendance = schoolAttendance.map((record) => {
        const user = usersData.find((u) => u.phone === record.phone)
        return {
          ...record,
          teacher_name: user?.name || "Unknown Teacher",
          school: user?.school || "Unknown School",
          district: user?.district || "Unknown District",
        }
      })
      setAttendanceData(enhancedAttendance)
    } catch (err) {
      console.error("Error fetching school data:", err)
      setError("Failed to load school data. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  // Show loading state
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading school data...</div>
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Authentication failed. Redirecting...</div>
  }

  const totalPresent = attendanceData.reduce((sum, record) => sum + record.students_present, 0)
  const totalAbsent = attendanceData.reduce((sum, record) => sum + record.students_absent, 0)
  const totalStudents = totalPresent + totalAbsent
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0

  return (
    <div className={`flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50 screenshot-protected ${isBlurred ? 'blur-overlay' : ''}`}>
      {/* Security watermark overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-50 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23000' font-size='20' transform='rotate(-45 100 100)'%3ECONFIDENTIAL%3C/text%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px'
        }}
      />
      
      <DashboardSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <span>🏠</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="font-medium">School Dashboard</span>
            </div>
            
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-emerald-800">School Dashboard</h1>
              <Button 
                onClick={fetchSchoolData} 
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm mb-3">{error}</p>
                <Button 
                  onClick={fetchSchoolData} 
                  size="sm" 
                  variant="outline"
                  className="text-red-700 border-red-300 hover:bg-red-100 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Connection
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-emerald-100 text-sm">Total Attendance Records</p>
                    <p className="text-3xl font-bold">{attendanceData.length}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-blue-100 text-sm">Attendance Rate</p>
                    <p className="text-3xl font-bold">{attendanceRate}%</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-purple-100 text-sm">Total Students</p>
                    <p className="text-3xl font-bold">{totalStudents}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
              <CardHeader>
                <CardTitle className="text-emerald-800">School Attendance Records</CardTitle>
                <p className="text-sm text-emerald-600">
                  Showing {attendanceData.length} records for your school
                </p>
              </CardHeader>
              <CardContent>
                {attendanceData.length > 0 ? (
                  <div className="rounded-lg border border-emerald-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-emerald-50">
                        <TableRow>
                          <TableHead className="text-emerald-800 font-semibold">Teacher</TableHead>
                          <TableHead className="text-emerald-800 font-semibold">Subject</TableHead>
                          <TableHead className="text-emerald-800 font-semibold text-center">Present</TableHead>
                          <TableHead className="text-emerald-800 font-semibold text-center">Absent</TableHead>
                          <TableHead className="text-emerald-800 font-semibold">Absence Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceData.map((record) => (
                          <TableRow key={record.id} className="hover:bg-emerald-50/50">
                            <TableCell className="font-medium text-gray-900">{record.teacher_name}</TableCell>
                            <TableCell className="text-gray-700 max-w-xs truncate">{record.subject}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                {record.students_present}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                {record.students_absent}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-700 text-sm">{record.absence_reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {loading ? "Loading attendance data..." : "No attendance records found for your school"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}