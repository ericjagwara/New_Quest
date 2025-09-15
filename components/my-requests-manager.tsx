"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { FileText, Clock, CheckCircle, XCircle, Calendar, User, Download } from "lucide-react"
import { exportToCSV } from "@/lib/csv-export"

interface ExportRequest {
  id: number
  requester_id: number
  requester_name: string
  requester_phone: string
  data_type: string
  record_count: number
  reason: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  approved_by?: string
  approved_at?: string
}

interface MyRequestsManagerProps {
  user: {
    id: number
    phone: string
    name: string
    role: string
    access_token: string
  }
}

export function MyRequestsManager({ user }: MyRequestsManagerProps) {
  const [requests, setRequests] = useState<ExportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

  const fetchMyRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/dashboard/export-requests/user/${user.id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      } else {
        console.error("Failed to fetch requests")
        setRequests([])
      }
    } catch (error) {
      console.error("Error fetching requests:", error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyRequests()
  }, [user.id, user.access_token])

  const handleDownloadApprovedData = async (request: ExportRequest) => {
    try {
      // Fetch the actual data (non-masked) for approved requests
      const dataResponse = await fetch(`${API_BASE_URL}/attendances`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
      })

      if (dataResponse.ok) {
        const data = await dataResponse.json()
        const timestamp = new Date().toISOString().split("T")[0]
        const filename = `${request.data_type.toLowerCase().replace(" ", "-")}-${timestamp}-approved-${request.id}`

        exportToCSV(data, filename)
      } else {
        console.error("Failed to fetch export data")
      }
    } catch (err) {
      console.error("Error downloading data:", err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const filterRequests = (status?: string) => {
    if (!status || status === "all") return requests
    return requests.filter((request) => request.status === status)
  }

  const getRequestCounts = () => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    }
  }

  const counts = getRequestCounts()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-2 text-emerald-600">Loading your requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-emerald-100 text-sm">Total Requests</p>
              <p className="text-3xl font-bold">{counts.all}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-blue-100 text-sm">Pending</p>
              <p className="text-3xl font-bold">{counts.pending}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-pink-100 text-sm">Approved</p>
              <p className="text-3xl font-bold">{counts.approved}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-emerald-100 text-sm">Rejected</p>
              <p className="text-3xl font-bold">{counts.rejected}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <RequestsList requests={filterRequests("all")} onDownload={handleDownloadApprovedData} />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <RequestsList requests={filterRequests("pending")} onDownload={handleDownloadApprovedData} />
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <RequestsList requests={filterRequests("approved")} onDownload={handleDownloadApprovedData} />
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <RequestsList requests={filterRequests("rejected")} onDownload={handleDownloadApprovedData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RequestsList({ requests, onDownload }: { requests: ExportRequest[], onDownload: (request: ExportRequest) => void }) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
          <p className="text-gray-500 text-center">You haven't submitted any export requests yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {request.status === "pending" && <Clock className="w-4 h-4 text-yellow-500" />}
                {request.status === "approved" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {request.status === "rejected" && <XCircle className="w-4 h-4 text-red-500" />}
                <CardTitle className="text-lg">{request.data_type} Export Request</CardTitle>
              </div>
              {request.status === "pending" && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Pending
                </Badge>
              )}
              {request.status === "approved" && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Approved
                </Badge>
              )}
              {request.status === "rejected" && (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  Rejected
                </Badge>
              )}
            </div>
            <CardDescription>Requested {request.record_count} records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Reason</p>
                <p className="text-sm text-gray-600">{request.reason}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Submitted</p>
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(request.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {request.status === "approved" && request.approved_by && (
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Approved</span>
                </div>
                <div className="mt-1 text-sm text-green-700">
                  <div className="flex items-center space-x-1">
                    <User className="w-3 h-3" />
                    <span>By: {request.approved_by}</span>
                  </div>
                  {request.approved_at && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>On: {new Date(request.approved_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button 
                    onClick={() => onDownload(request)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Data
                  </Button>
                </div>
              </div>
            )}

            {request.status === "rejected" && (
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-red-800">
                  <XCircle className="w-4 h-4" />
                  <span className="font-medium">Rejected</span>
                </div>
                <div className="mt-1 text-sm text-red-700">
                  <p>Your export request was not approved.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}