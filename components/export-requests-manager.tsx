"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Clock, RefreshCw, Download, FileText, Users, TrendingUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { exportToCSV } from "@/lib/csv-export"

interface ExportRequest {
  id: number
  requester_id: number // Added missing property
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

interface ExportRequestsManagerProps {
  user: any
}

export function ExportRequestsManager({ user }: ExportRequestsManagerProps) {
  const [requests, setRequests] = useState<ExportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [processingId, setProcessingId] = useState<number | null>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

  useEffect(() => {
    fetchRequests()
    // Refresh every 30 seconds
    const interval = setInterval(fetchRequests, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchRequests = async () => {
    try {
      setError("")
      const response = await fetch(`${API_BASE_URL}/dashboard/export-requests`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch export requests")
      }

      const data = await response.json()
      setRequests(data)
    } catch (err: any) {
      setError(err.message || "Failed to load export requests")
    } finally {
      setLoading(false)
    }
  }

  const handleRequestAction = async (requestId: number, action: "approve" | "reject") => {
    setProcessingId(requestId)
    setError("")

    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/export-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          status: action === "approve" ? "approved" : "rejected",
          approved_by: user.name || "Super Admin",
          approved_at: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to ${action} request`)
      }

      // Refresh the requests list
      await fetchRequests()
    } catch (err: any) {
      setError(err.message || `Failed to ${action} request`)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDownloadApprovedData = async (request: ExportRequest) => {
    try {
      setError("")
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
        const filename = `attendance-data-${timestamp}-request-${request.id}`

        exportToCSV(data, filename)
      } else {
        throw new Error("Failed to fetch export data")
      }
    } catch (err: any) {
      setError(err.message || "Failed to download export data")
    }
  }

  // Function to check if user can export (currently unused)
  const canUserExport = (userId: number, dataType: string): boolean => {
    const userRequests = requests.filter(
      (req) => req.requester_id === userId && req.data_type === dataType && req.status === "approved",
    )
    return userRequests.length > 0
  }

  const generateExportForRequest = async (requestId: number) => {
    try {
      const request = requests.find((req) => req.id === requestId)
      if (!request) return

      // Fetch the actual data based on request type
      const dataResponse = await fetch(
        `${API_BASE_URL}/dashboard/${request.data_type.toLowerCase().replace(" ", "-")}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.access_token}`,
          },
        },
      )

      if (dataResponse.ok) {
        const data = await dataResponse.json()
        const timestamp = new Date().toISOString().split("T")[0]
        const filename = `${request.data_type.toLowerCase().replace(" ", "-")}-${timestamp}-approved-${requestId}`

        // Generate CSV export
        exportToCSV(data, filename)

        // Notify about successful export generation
        setError("")
      }
    } catch (err) {
      console.error("Error generating export:", err)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const pendingRequests = requests.filter((req) => req.status === "pending")
  const processedRequests = requests.filter((req) => req.status !== "pending")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Pending Requests</p>
                <p className="text-3xl font-bold">{pendingRequests.length}</p>
              </div>
              <Clock className="w-8 h-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Approved Today</p>
                <p className="text-3xl font-bold">
                  {
                    requests.filter(
                      (req) =>
                        req.status === "approved" &&
                        req.approved_at &&
                        new Date(req.approved_at).toDateString() === new Date().toDateString(),
                    ).length
                  }
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-sm">Total Requests</p>
                <p className="text-3xl font-bold">{requests.length}</p>
              </div>
              <FileText className="w-8 h-8 text-pink-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Pending Requests */}
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-emerald-600" />
              Pending Export Requests ({pendingRequests.length})
            </CardTitle>
            <Button
              onClick={fetchRequests}
              disabled={loading}
              variant="outline"
              size="sm"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No pending export requests</p>
              <p className="text-sm">All requests have been processed</p>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-emerald-50">
                  <TableRow>
                    <TableHead className="text-emerald-800 font-semibold">Requester</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Data Type</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Records</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Reason</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Requested</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-emerald-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.requester_name}</p>
                            <p className="text-sm text-gray-500">{request.requester_phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          {request.data_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {request.record_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-gray-700 truncate" title={request.reason}>
                          {request.reason}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleRequestAction(request.id, "approve")}
                            disabled={processingId === request.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRequestAction(request.id, "reject")}
                            disabled={processingId === request.id}
                            className="border-red-200 text-red-700 hover:bg-red-50 shadow-sm"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Processed Requests */}
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
        <CardHeader>
          <CardTitle className="text-emerald-800 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
            Recent Processed Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No processed requests yet</p>
              <p className="text-sm">Approved and rejected requests will appear here</p>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-emerald-50">
                  <TableRow>
                    <TableHead className="text-emerald-800 font-semibold">Requester</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Data Type</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Status</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Processed By</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Date</TableHead>
                    <TableHead className="text-emerald-800 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRequests.slice(0, 10).map((request) => (
                    <TableRow key={request.id} className="hover:bg-emerald-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.requester_name}</p>
                            <p className="text-sm text-gray-500">{request.requester_phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          {request.data_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-gray-700">{request.approved_by || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {request.approved_at
                          ? formatDistanceToNow(new Date(request.approved_at), { addSuffix: true })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {request.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => handleDownloadApprovedData(request)}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
