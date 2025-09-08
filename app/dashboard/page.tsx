"use client"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserX, TrendingUp, School } from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  fetchAttendanceData,
  fetchUsersData,
  calculateStats,
  processAbsenceReasons,
  processAttendanceByDistrict,
} from "@/lib/api"
import type { User, AttendanceRecord, UserRecord, DashboardStats } from "@/lib/types"

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [usersData, setUsersData] = useState<UserRecord[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalPresent: 0,
    totalAbsent: 0,
    attendanceRate: 0,
    totalSchools: 0,
    totalDistricts: 0,
    totalTeachers: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is logged in
    const authUser = localStorage.getItem("authUser")
    if (authUser) {
      setUser(JSON.parse(authUser))
    } else {
      // Redirect to login if not authenticated
      window.location.href = "/"
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchData()

      // Set up auto-refresh every 5 minutes
      const intervalId = setInterval(fetchData, 5 * 60 * 1000)
      return () => clearInterval(intervalId)
    }
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [attendance, users] = await Promise.all([fetchAttendanceData(), fetchUsersData()])

      setAttendanceData(attendance)
      setUsersData(users)
      setStats(calculateStats(attendance, users))
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
      setError("Failed to load data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  const absenceReasonsData = processAbsenceReasons(attendanceData)
  const attendanceByDistrictData = processAttendanceByDistrict(attendanceData, usersData)

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Sidebar */}
      <DashboardSidebar user={user} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader user={user} />

        {/* Dashboard Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <span>🏠</span>
              <span>/</span>
              <span className="font-medium">Dashboard</span>
            </div>

            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-emerald-800">Dashboard</h1>
              {loading && (
                <div className="flex items-center space-x-2 text-sm text-emerald-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  <span>Refreshing data...</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Statistics Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Present Card */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-600 mb-1 font-medium">Total Present</p>
                      <p className="text-3xl font-bold text-emerald-800">{stats.totalPresent}</p>
                      <p className="text-sm text-emerald-500">students attended</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Absent Card */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-blue-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 mb-1 font-medium">Total Absent</p>
                      <p className="text-3xl font-bold text-blue-800">{stats.totalAbsent}</p>
                      <p className="text-sm text-blue-500">students absent</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <UserX className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Rate Card */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-green-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 mb-1 font-medium">Attendance Rate</p>
                      <p className="text-3xl font-bold text-green-800">{stats.attendanceRate}%</p>
                      <p className="text-sm text-green-500">overall attendance</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Schools Card */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-pink-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-pink-600 mb-1 font-medium">Schools</p>
                      <p className="text-3xl font-bold text-pink-800">{stats.totalSchools}</p>
                      <p className="text-sm text-pink-500">across {stats.totalDistricts} districts</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                      <School className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Absence Reasons Pie Chart */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-emerald-800">Absence Reasons</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={absenceReasonsData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {absenceReasonsData.map((entry, index) => {
                            const colors = ["#ef4444", "#3b82f6", "#eab308", "#10b981", "#8b5cf6", "#f97316"]
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          })}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {absenceReasonsData.map((item, index) => {
                      const colors = ["#ef4444", "#3b82f6", "#eab308", "#10b981", "#8b5cf6", "#f97316"]
                      return (
                        <div key={index} className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[index % colors.length] }}
                          ></div>
                          <span className="text-emerald-600">{item.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Attendance by District Bar Chart */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-emerald-800">Attendance by District</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceByDistrictData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="district" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis
                          label={{ value: "Number of Students", angle: -90, position: "insideLeft" }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="present" fill="#3b82f6" name="Present" />
                        <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
