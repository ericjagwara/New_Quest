"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import {
  Building2,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  CreditCard,
  Smartphone,
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
  const [activeView, setActiveView] = useState<"overview" | "orders" | "payments">("overview")

  useEffect(() => {
    // Get user from localStorage
    const authUser = localStorage.getItem("authUser")
    if (authUser) {
      setUser(JSON.parse(authUser))
    }

    const mockOrders: Order[] = [
      // 5 completed orders for 9/22/2025
      {
        id: "ORD-001",
        facility: "Nyakabingo P/S",
        district: "Kisoro",
        amount: 2500000,
        status: "completed",
        date: "2025-09-22",
        items: ["Hygiene Quest Hand Sanitizer (50 units)", "Hygiene Quest Soap (100 units)"],
      },
      {
        id: "ORD-002",
        facility: "Kayenje II Primary School",
        district: "Isingiro",
        amount: 1800000,
        status: "completed",
        date: "2025-09-22",
        items: ["Hygiene Quest Antiseptic (30 units)", "Hygiene Quest Wipes (200 packs)"],
      },
      {
        id: "ORD-003",
        facility: "Rwengwe II Primary School",
        district: "Ibanda",
        amount: 3200000,
        status: "completed",
        date: "2025-09-22",
        items: ["Hygiene Quest Hand Wash (80 units)", "Hygiene Quest Surface Cleaner (40 units)"],
      },
      {
        id: "ORD-004",
        facility: "Kigando II Primary School",
        district: "Ibanda",
        amount: 2100000,
        status: "completed",
        date: "2025-09-22",
        items: ["Hygiene Quest Disinfectant (60 units)", "Hygiene Quest Towels (150 packs)"],
      },
      {
        id: "ORD-005",
        facility: "Bisororo PS",
        district: "Ibanda",
        amount: 1900000,
        status: "completed",
        date: "2025-09-22",
        items: ["Hygiene Quest Hand Gel (45 units)", "Hygiene Quest Masks (300 units)"],
      },
      // 6 pending orders for 9/23/2025
      {
        id: "ORD-006",
        facility: "Lorengechora Primary School",
        district: "Amudat",
        amount: 2800000,
        status: "pending",
        date: "2025-09-23",
        items: ["Hygiene Quest Sanitizer Spray (70 units)", "Hygiene Quest Cleaning Cloths (120 packs)"],
      },
      {
        id: "ORD-007",
        facility: "Kalosarich Primary School",
        district: "Amudat",
        amount: 2300000,
        status: "pending",
        date: "2025-09-23",
        items: ["Hygiene Quest Liquid Soap (55 units)", "Hygiene Quest Paper Towels (180 rolls)"],
      },
      {
        id: "ORD-008",
        facility: "Loodoi Progressive Primary School",
        district: "Amudat",
        amount: 3100000,
        status: "pending",
        date: "2025-09-23",
        items: ["Hygiene Quest Multi-Surface Cleaner (65 units)", "Hygiene Quest Gloves (400 pairs)"],
      },
      {
        id: "ORD-009",
        facility: "Kochi Future Primary School",
        district: "Amudat",
        amount: 2600000,
        status: "pending",
        date: "2025-09-23",
        items: ["Hygiene Quest Floor Cleaner (50 units)", "Hygiene Quest Tissue Boxes (250 boxes)"],
      },
      {
        id: "ORD-010",
        facility: "Karenga Modern Primary School",
        district: "Amudat",
        amount: 2900000,
        status: "pending",
        date: "2025-09-23",
        items: ["Hygiene Quest Window Cleaner (40 units)", "Hygiene Quest Sponges (200 packs)"],
      },
      {
        id: "ORD-011",
        facility: "Lokales Town Shining Primary School",
        district: "Amudat",
        amount: 3400000,
        status: "pending",
        date: "2025-09-23",
        items: ["Hygiene Quest All-Purpose Cleaner (75 units)", "Hygiene Quest Mops (80 units)"],
      },
    ]

    const mockTransactions: Transaction[] = [
      {
        id: "TXN-001",
        type: "payment",
        description: "Payment received from Nyakabingo P/S",
        amount: 2500000,
        date: "2025-09-22",
        status: "success",
      },
      {
        id: "TXN-002",
        type: "payment",
        description: "Payment received from Kayenje II Primary School",
        amount: 1800000,
        date: "2025-09-22",
        status: "success",
      },
      {
        id: "TXN-003",
        type: "payment",
        description: "Payment received from Rwengwe II Primary School",
        amount: 3200000,
        date: "2025-09-22",
        status: "success",
      },
      {
        id: "TXN-004",
        type: "payment",
        description: "Payment received from Kigando II Primary School",
        amount: 2100000,
        date: "2025-09-22",
        status: "success",
      },
      {
        id: "TXN-005",
        type: "payment",
        description: "Payment received from Bisororo PS",
        amount: 1900000,
        date: "2025-09-22",
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
  const completedRevenue = orders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + order.amount, 0)
  const pendingRevenue = orders
    .filter((order) => order.status === "pending")
    .reduce((sum, order) => sum + order.amount, 0)
  const completedOrders = orders.filter((order) => order.status === "completed").length
  const pendingOrders = orders.filter((order) => order.status === "pending").length
  const totalSchools = new Set(orders.map((order) => order.facility)).size

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "success":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "processing":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "failed":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "success":
        return <CheckCircle className="w-3 h-3" />
      case "pending":
        return <Clock className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <DashboardSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <span>🏠</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="font-medium">Sales</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-emerald-800">Sales Overview</h1>
                <p className="text-emerald-600 mt-1">Educational hygiene solutions for Uganda's primary schools</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant={activeView === "overview" ? "default" : "ghost"}
                  onClick={() => setActiveView("overview")}
                  className={`text-sm ${
                    activeView === "overview"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Overview
                </Button>
                <Button
                  variant={activeView === "orders" ? "default" : "ghost"}
                  onClick={() => setActiveView("orders")}
                  className={`text-sm ${
                    activeView === "orders"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Orders
                </Button>
                <Button
                  variant={activeView === "payments" ? "default" : "ghost"}
                  onClick={() => setActiveView("payments")}
                  className={`text-sm ${
                    activeView === "payments"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Payments
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-600 mb-1 font-medium">Total Revenue</p>
                      <p className="text-3xl font-bold text-emerald-800">UGX {(totalRevenue / 1000000).toFixed(1)}M</p>
                      <p className="text-sm text-emerald-500">11 orders processed</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-green-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 mb-1 font-medium">Completed Orders</p>
                      <p className="text-3xl font-bold text-green-800">{completedOrders}</p>
                      <p className="text-sm text-green-500">UGX {(completedRevenue / 1000000).toFixed(1)}M received</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-amber-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-600 mb-1 font-medium">Pending Orders</p>
                      <p className="text-3xl font-bold text-amber-800">{pendingOrders}</p>
                      <p className="text-sm text-amber-500">UGX {(pendingRevenue / 1000000).toFixed(1)}M expected</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-blue-100 hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 mb-1 font-medium">Partner Schools</p>
                      <p className="text-3xl font-bold text-blue-800">{totalSchools}</p>
                      <p className="text-sm text-blue-500">Across 4 districts</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {activeView === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-emerald-800 flex items-center space-x-2">
                      <CreditCard className="w-5 h-5" />
                      <span>Payment Methods</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-emerald-800">Bank Transfer</h4>
                          <p className="text-xs text-emerald-600">Primary payment method</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-emerald-700">
                        <p>
                          <span className="font-medium">Account:</span> Chil Group of Companies
                        </p>
                        <p>
                          <span className="font-medium">Bank:</span> DFCU Bank of Uganda
                        </p>
                        <p>
                          <span className="font-medium">Number:</span> 1234 5678 9012 3456
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-blue-800">Mobile Money</h4>
                          <p className="text-xs text-blue-600">Alternative payment</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-blue-700">
                        <p>
                          <span className="font-medium">MTN:</span> 0772 123 456
                        </p>
                        <p>
                          <span className="font-medium">Airtel:</span> 0752 987 654
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-emerald-800 flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5" />
                      <span>Recent Payment Activities</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {transactions.slice(0, 5).map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/50 border border-emerald-100 hover:bg-emerald-50 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                              <DollarSign className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-emerald-800">{transaction.description}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Calendar className="w-3 h-3 text-emerald-600" />
                                <span className="text-xs text-emerald-600">
                                  {new Date(transaction.date).toLocaleDateString()}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  <div className="flex items-center space-x-1">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Success</span>
                                  </div>
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm text-emerald-800">
                              UGX {transaction.amount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeView === "orders" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-green-100">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-green-800 flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Completed Orders ({completedOrders})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {orders
                          .filter((order) => order.status === "completed")
                          .map((order) => (
                            <div
                              key={order.id}
                              className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:shadow-md transition-all"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-medium text-sm text-green-800">{order.facility}</h4>
                                  <p className="text-xs text-green-600 flex items-center space-x-1 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{order.district} District</span>
                                  </p>
                                </div>
                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                  <div className="flex items-center space-x-1">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Completed</span>
                                  </div>
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-lg font-bold text-green-700">UGX {order.amount.toLocaleString()}</p>
                                <p className="text-xs text-green-600">{new Date(order.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-amber-100">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-amber-800 flex items-center space-x-2">
                        <Clock className="w-5 h-5" />
                        <span>Pending Orders ({pendingOrders})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {orders
                          .filter((order) => order.status === "pending")
                          .map((order) => (
                            <div
                              key={order.id}
                              className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:shadow-md transition-all"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-medium text-sm text-amber-800">{order.facility}</h4>
                                  <p className="text-xs text-amber-600 flex items-center space-x-1 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{order.district} District</span>
                                  </p>
                                </div>
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                  <div className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span>Pending</span>
                                  </div>
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-lg font-bold text-amber-700">UGX {order.amount.toLocaleString()}</p>
                                <p className="text-xs text-amber-600">{new Date(order.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeView === "payments" && (
              <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-emerald-800 flex items-center space-x-2">
                    <DollarSign className="w-5 h-5" />
                    <span>Payment History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/50 border border-emerald-100 hover:bg-emerald-50 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-emerald-800">{transaction.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Calendar className="w-3 h-3 text-emerald-600" />
                              <span className="text-xs text-emerald-600">
                                {new Date(transaction.date).toLocaleDateString()}
                              </span>
                              <Badge className="text-xs bg-green-50 text-green-700 border-green-200">
                                <div className="flex items-center space-x-1">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Success</span>
                                </div>
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg text-emerald-800">
                            UGX {transaction.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-emerald-600">Transaction ID: {transaction.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
