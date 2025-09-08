"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import {
  CreditCard,
  Smartphone,
  MapPin,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"

interface Order {
  id: string
  facility: string
  district: string
  amount: number
  status: "completed" | "pending" | "processing"
  date: string
  items: string[]
}

interface Transaction {
  id: string
  type: "payment" | "order" | "refund"
  description: string
  amount: number
  date: string
  status: "success" | "pending" | "failed"
}

export default function SalesPage() {
  const [user, setUser] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get user from localStorage
    const authUser = localStorage.getItem("authUser")
    if (authUser) {
      setUser(JSON.parse(authUser))
    }

    // Mock data for sales
    const mockOrders: Order[] = [
      {
        id: "ORD-001",
        facility: "Kampala Health Center IV",
        district: "Kampala",
        amount: 2500000,
        status: "completed",
        date: "2024-01-15",
        items: ["Hygiene Quest Hand Sanitizer (50 units)", "Hygiene Quest Soap (100 units)"],
      },
      {
        id: "ORD-002",
        facility: "Mbarara Regional Hospital",
        district: "Mbarara",
        amount: 1800000,
        status: "processing",
        date: "2024-01-14",
        items: ["Hygiene Quest Antiseptic (30 units)", "Hygiene Quest Wipes (200 packs)"],
      },
      {
        id: "ORD-003",
        facility: "Gulu General Hospital",
        district: "Gulu",
        amount: 3200000,
        status: "pending",
        date: "2024-01-13",
        items: ["Hygiene Quest Hand Wash (80 units)", "Hygiene Quest Surface Cleaner (40 units)"],
      },
    ]

    const mockTransactions: Transaction[] = [
      {
        id: "TXN-001",
        type: "payment",
        description: "Payment received from Kampala Health Center IV",
        amount: 2500000,
        date: "2024-01-15",
        status: "success",
      },
      {
        id: "TXN-002",
        type: "order",
        description: "New order from Mbarara Regional Hospital",
        amount: 1800000,
        date: "2024-01-14",
        status: "pending",
      },
      {
        id: "TXN-003",
        type: "payment",
        description: "Payment received from Fort Portal Hospital",
        amount: 1200000,
        date: "2024-01-12",
        status: "success",
      },
    ]

    setOrders(mockOrders)
    setTransactions(mockTransactions)
    setLoading(false)
  }, [])

  if (!user) {
    return <div>Loading...</div>
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0)
  const completedOrders = orders.filter((order) => order.status === "completed").length
  const pendingOrders = orders.filter((order) => order.status === "pending").length
  const totalFacilities = new Set(orders.map((order) => order.facility)).size

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "success":
        return "bg-emerald-100 text-emerald-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "success":
        return <CheckCircle className="w-4 h-4" />
      case "pending":
        return <Clock className="w-4 h-4" />
      case "processing":
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <DashboardSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">Hygiene Quest Sales Dashboard</h1>
              <p className="text-gray-600">Manage orders, payments, and partner facility relationships</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold">UGX {totalRevenue.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Completed Orders</p>
                      <p className="text-2xl font-bold">{completedOrders}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-100 text-sm font-medium">Pending Orders</p>
                      <p className="text-2xl font-bold">{pendingOrders}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">Partner Facilities</p>
                      <p className="text-2xl font-bold">{totalFacilities}</p>
                    </div>
                    <Users className="w-8 h-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods */}
              <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-t-lg">
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-5 h-5" />
                    <span>Payment Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Bank Transfer */}
                  <div className="p-4 border border-emerald-200 rounded-lg bg-emerald-50">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-emerald-800">Bank Transfer</h3>
                    </div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-medium">Account Name:</span> Partner Facilities Ltd.
                      </p>
                      <p>
                        <span className="font-medium">Account Number:</span> 1234 5678 9012 3456
                      </p>
                      <p>
                        <span className="font-medium">Bank:</span> Uganda Commercial Bank
                      </p>
                      <p>
                        <span className="font-medium">Branch:</span> Kampala Main Branch
                      </p>
                    </div>
                  </div>

                  {/* Mobile Money */}
                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-blue-800">Mobile Money</h3>
                    </div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-medium">MTN Mobile Money:</span> 0772 123 456
                      </p>
                      <p>
                        <span className="font-medium">Airtel Money:</span> 0752 987 654
                      </p>
                    </div>
                  </div>

                  {/* Physical Payment */}
                  <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-purple-800">Physical Payment</h3>
                    </div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-medium">Office Hours:</span> Mon - Fri: 8:00 AM - 5:00 PM
                      </p>
                      <p>
                        <span className="font-medium">Saturday:</span> 9:00 AM - 1:00 PM
                      </p>
                      <p>
                        <span className="font-medium">Address:</span> Plot 45, Kampala Road, Kampala
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>Partner Facilities Orders</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{order.facility}</h4>
                          <Badge className={getStatusColor(order.status)}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(order.status)}
                              <span className="capitalize">{order.status}</span>
                            </div>
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{order.district} District</p>
                        <p className="text-lg font-bold text-emerald-600 mb-2">UGX {order.amount.toLocaleString()}</p>
                        <div className="text-xs text-gray-500">
                          <p>Items: {order.items.join(", ")}</p>
                          <p>Date: {new Date(order.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Recent Order Activities</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.type === "payment"
                              ? "bg-emerald-100"
                              : transaction.type === "order"
                                ? "bg-blue-100"
                                : "bg-red-100"
                          }`}
                        >
                          {transaction.type === "payment" ? (
                            <DollarSign
                              className={`w-5 h-5 ${
                                transaction.type === "payment" ? "text-emerald-600" : "text-blue-600"
                              }`}
                            />
                          ) : transaction.type === "order" ? (
                            <Package className="w-5 h-5 text-blue-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{transaction.description}</p>
                          <p className="text-sm text-gray-500 flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(transaction.date).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">UGX {transaction.amount.toLocaleString()}</p>
                        <Badge className={getStatusColor(transaction.status)}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(transaction.status)}
                            <span className="capitalize">{transaction.status}</span>
                          </div>
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
