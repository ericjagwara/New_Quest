"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Download, RefreshCw, GitPullRequest as FileRequest } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { fetchAttendanceData, fetchUsersData, processAbsenceReasons } from "@/lib/api"
import { exportToCSV, formatAttendanceDataForExport } from "@/lib/csv-export"
import { ExportRequestModal } from "@/components/export-request-modal"
import { ExportOTPModal } from "@/components/export-otp-modal" // Added missing import

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

interface UserRecord {
  id: string
  name: string
  phone: string
  school: string
  district: string
  role: string
}

interface User {
  id: string
  name: string
  phone: string
  role: string
  school?: string
  district?: string
}

interface EnhancedAttendanceRecord extends AttendanceRecord {
  teacher_name?: string
  school?: string
  district?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com";

export default function AttendanceAnalysisPage() {
  const [user, setUser] = useState<User | null>(null)
  const [attendanceData, setAttendanceData] = useState<EnhancedAttendanceRecord[]>([])
  const [usersData, setUsersData] = useState<UserRecord[]>([])
  const [filteredData, setFilteredData] = useState<EnhancedAttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDistrict, setSelectedDistrict] = useState("all")
  const [selectedSchool, setSelectedSchool] = useState("all")
  const [showExportRequestModal, setShowExportRequestModal] = useState(false)
  const [showExportOTPModal, setShowExportOTPModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      const authUser = localStorage.getItem("authUser")
      if (!authUser) {
        router.push("/")
        return
      }
      
      try {
        const userData = JSON.parse(authUser)
        // Check if token is expired
        if (userData.expiresAt && Date.now() > userData.expiresAt) {
          localStorage.removeItem("authUser")
          router.push("/")
          return
        }
        setUser(userData)
      } catch {
        localStorage.removeItem("authUser")
        router.push("/")
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (user) {
      fetchData()
      const intervalId = setInterval(fetchData, 5 * 60 * 1000)
      return () => clearInterval(intervalId)
    }
  }, [user])

  useEffect(() => {
    filterData()
  }, [attendanceData, searchTerm, selectedDistrict, selectedSchool])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [attendanceResult, usersResult] = await Promise.all([fetchAttendanceData(), fetchUsersData()])

      const enhancedAttendance = attendanceResult.map((record) => {
        const user = usersResult.find((u) => u.phone === record.phone)
        return {
          ...record,
          teacher_name: user?.name || "Unknown Teacher",
          school: user?.school || "Unknown School",
          district: user?.district || "Unknown District",
        }
      })

      setAttendanceData(enhancedAttendance)
      setUsersData(usersResult)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to load data. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const filterData = () => {
    let filtered = attendanceData

    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.absence_reason.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (selectedDistrict !== "all") {
      filtered = filtered.filter((record) => record.district === selectedDistrict)
    }

    if (selectedSchool !== "all") {
      filtered = filtered.filter((record) => record.school === selectedSchool)
    }

    setFilteredData(filtered)
  }

  const getUniqueDistricts = () => {
    return [...new Set(attendanceData.map((record) => record.district))].filter(Boolean)
  }

  const getUniqueSchools = () => {
    const schools =
      selectedDistrict === "all"
        ? attendanceData.map((record) => record.school)
        : attendanceData.filter((record) => record.district === selectedDistrict).map((record) => record.school)
    return [...new Set(schools)].filter(Boolean)
  }

  const getAbsenceReasonBadgeColor = (reason: string) => {
    const lowerReason = reason.toLowerCase()
    if (lowerReason.includes("sick") || lowerReason.includes("flu") || lowerReason.includes("malaria")) {
      return "destructive"
    } else if (lowerReason.includes("weather") || lowerReason.includes("rain")) {
      return "secondary"
    } else if (lowerReason.includes("fees")) {
      return "outline"
    }
    return "default"
  }

  // New function to fetch and export unmasked data
  const fetchAndExportUnmaskedData = async () => {
    try {
      setLoading(true);
      
      // Use the export token to fetch unmasked data
      const exportToken = localStorage.getItem('export_token');
      
      const response = await fetch(`${API_BASE_URL}/attendances`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${exportToken}`
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch unmasked data");
      }

      const unmaskedData = await response.json();
      
      // Export the unmasked data
      const exportData = formatAttendanceDataForExport(unmaskedData);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `attendance-data-unmasked-${timestamp}`;
      exportToCSV(exportData, filename);
      
    } catch (err) {
      console.error("Error exporting unmasked data:", err);
      alert("Failed to export data. Please try again.");
      // Clear invalid token and show OTP modal again
      localStorage.removeItem('export_token');
      localStorage.removeItem('export_token_timestamp');
      setShowExportOTPModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerified = async () => {
    // After OTP verification, the export token should be stored in localStorage
    // Now fetch and export the unmasked data
    await fetchAndExportUnmaskedData();
  };

  const handleExportData = async () => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    // Check if user is manager - they need OTP verification for unmasked data
    if (user?.role === "manager") {
      try {
        // First check if they already have a valid export token
        const exportToken = localStorage.getItem('export_token');
        const tokenTimestamp = localStorage.getItem('export_token_timestamp');
        
        if (exportToken && tokenTimestamp) {
          const tokenTime = parseInt(tokenTimestamp, 10);
          const currentTime = Date.now();
          // Check if token is still valid (30 minutes)
          if (currentTime - tokenTime <= 30 * 60 * 1000) {
            // Token is valid, fetch unmasked data
            await fetchAndExportUnmaskedData();
            return;
          } else {
            // Token expired, clear it
            localStorage.removeItem('export_token');
            localStorage.removeItem('export_token_timestamp');
          }
        }
        
        // No valid token, show OTP modal
        setShowExportOTPModal(true);
        
      } catch (error) {
        console.error("Error checking export token:", error);
        setShowExportOTPModal(true);
      }
      return;
    }

    // Superadmins can export directly without OTP
    if (user?.role === "superadmin") {
      const exportData = formatAttendanceDataForExport(filteredData);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `attendance-data-${timestamp}`;
      exportToCSV(exportData, filename);
      return;
    }

    // Fieldworkers need to request permission
    if (user?.role === "fieldworker") {
      setShowExportRequestModal(true);
      return;
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  const absenceReasonsData = processAbsenceReasons(filteredData)

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
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
              <span className="font-medium">Attendance Analysis</span>
            </div>

            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-emerald-800">Attendance Analysis</h1>
              <Button onClick={fetchData} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm mb-3">{error}</p>
                <Button
                  onClick={fetchData}
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-300 hover:bg-red-100 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Connection
                </Button>
              </div>
            )}

            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
              <CardHeader>
                <CardTitle className="text-emerald-800 flex items-center">
                  <Filter className="w-5 h-5 mr-2" />
                  Filters & Search
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search teachers, schools, topics..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-emerald-200 focus:border-emerald-500"
                    />
                  </div>

                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                    <SelectTrigger className="border-emerald-200 focus:border-emerald-500">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {getUniqueDistricts().map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger className="border-emerald-200 focus:border-emerald-500">
                      <SelectValue placeholder="Select School" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Schools</SelectItem>
                      {getUniqueSchools().map((school) => (
                        <SelectItem key={school} value={school}>
                          {school}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                     variant="outline"
                     className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent"
                     onClick={handleExportData}
                     disabled={loading}
                 >
  {user?.role === "fieldworker" ? (
    <>
      <FileRequest className="w-4 h-4 mr-2" />
      Request Export
    </>
  ) : user?.role === "manager" ? (
    <>
      <Download className="w-4 h-4 mr-2" />
      Export Data (OTP Required)
    </>
  ) : (
    <>
      <Download className="w-4 h-4 mr-2" />
      Export Data
    </>
  )}
</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-emerald-100 text-sm">Total Records</p>
                    <p className="text-3xl font-bold">{filteredData.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-blue-100 text-sm">Total Present</p>
                    <p className="text-3xl font-bold">
                      {filteredData.reduce((sum, record) => sum + record.students_present, 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-pink-100 text-sm">Total Absent</p>
                    <p className="text-3xl font-bold">
                      {filteredData.reduce((sum, record) => sum + record.students_absent, 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
              <CardHeader>
                <CardTitle className="text-emerald-800">Absence Reasons Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={absenceReasonsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#065f46" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#065f46" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ecfdf5",
                          border: "1px solid #10b981",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
              <CardHeader>
                <CardTitle className="text-emerald-800">Detailed Attendance Records</CardTitle>
                <p className="text-sm text-emerald-600">
                  Showing {filteredData.length} of {attendanceData.length} records
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-emerald-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-emerald-50">
                      <TableRow>
                        <TableHead className="text-emerald-800 font-semibold">Teacher</TableHead>
                        <TableHead className="text-emerald-800 font-semibold">School</TableHead>
                        <TableHead className="text-emerald-800 font-semibold">District</TableHead>
                        <TableHead className="text-emerald-800 font-semibold">Subject</TableHead>
                        <TableHead className="text-emerald-800 font-semibold text-center">Present</TableHead>
                        <TableHead className="text-emerald-800 font-semibold text-center">Absent</TableHead>
                        <TableHead className="text-emerald-800 font-semibold">Absence Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.length > 0 ? (
                        filteredData.map((record) => (
                          <TableRow key={record.id} className="hover:bg-emerald-50/50">
                            <TableCell className="font-medium text-gray-900">{record.teacher_name}</TableCell>
                            <TableCell className="text-gray-700">{record.school}</TableCell>
                            <TableCell className="text-gray-700">{record.district}</TableCell>
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
                            <TableCell>
                              <Badge variant={getAbsenceReasonBadgeColor(record.absence_reason)} className="text-xs">
                                {record.absence_reason}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            {loading ? "Loading attendance data..." : "No attendance records found"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Export Modals */}
      <ExportOTPModal
        isOpen={showExportOTPModal}
        onClose={() => setShowExportOTPModal(false)}
        onVerified={handleOTPVerified}
        dataType="Attendance Analysis"
        recordCount={filteredData.length}
        user={user}
      />

      <ExportRequestModal
        isOpen={showExportRequestModal}
        onClose={() => setShowExportRequestModal(false)}
        dataType="Attendance Analysis"
        recordCount={filteredData.length}
        user={user}
      />
    </div>
  )
}