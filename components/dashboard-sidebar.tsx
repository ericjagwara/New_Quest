"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  LogOut,
  GitPullRequest as FileRequest,
  School,
  Send,
} from "lucide-react"
import Image from "next/image"
import { useSession } from "@/hooks/use-session"

interface DashboardSidebarProps {
  user: {
    username: string
    role: string
    school?: string // Add school property
  }
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const [activeItem, setActiveItem] = useState("Dashboard")
  const { logout } = useSession()

  // Define menu items based on user role
  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      roles: ["superadmin", "manager", "fieldworker", "schooladmin"],
    },
    {
      name: "Attendance Analysis",
      icon: BarChart3,
      href: "/dashboard/attendance",
      roles: ["superadmin", "manager", "fieldworker"],
    },
    {
      name: "School Dashboard",
      icon: School,
      href: "/dashboard/school",
      roles: ["schooladmin"],
    },
    {
      name: "Hygiene Quest Sales",
      icon: ShoppingCart,
      href: "/dashboard/sales",
      roles: ["superadmin", "manager"],
    },
    {
      name: "Export Requests",
      icon: FileRequest,
      href: "/dashboard/export-requests",
      roles: ["superadmin"],
    },
    {
      name: "My Requests",
      icon: Send,
      href: "/dashboard/my-requests",
      roles: ["fieldworker"],
    },
  ]

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(user.role))

  const handleLogout = () => {
    logout()
  }

  const handleNavigation = (item: any) => {
    setActiveItem(item.name)
    window.location.href = item.href
  }

  return (
    <div className="w-64 bg-gradient-to-b from-emerald-800 to-emerald-900 text-white flex flex-col shadow-xl">
      {/* Logo and Brand */}
      <div className="p-6 border-b border-emerald-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 relative">
            <Image
              src="/hygiene-quest-logo.jpg"
              alt="Hygiene Quest Logo"
              width={40}
              height={40}
              className="rounded-full ring-2 ring-emerald-400"
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-emerald-100">Hygiene Quest</h2>
            {user.role === "schooladmin" && user.school && (
              <p className="text-xs text-emerald-300 mt-1 truncate max-w-[150px]">{user.school}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.name}
              onClick={() => handleNavigation(item)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                activeItem === item.name
                  ? "bg-emerald-600 text-white shadow-lg transform scale-105"
                  : "text-emerald-200 hover:bg-emerald-700 hover:text-white hover:transform hover:scale-105"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.name}</span>
            </button>
          )
        })}
      </nav>

      {/* User Info and Logout */}
      <div className="p-4 border-t border-emerald-700">
        <div className="mb-4">
          <p className="text-sm text-emerald-300">Logged in as:</p>
          <p className="text-sm font-semibold capitalize text-emerald-100">{user.username}</p>
          <p className="text-xs text-emerald-400 capitalize">{user.role}</p>
          {user.role === "schooladmin" && user.school && (
            <p className="text-xs text-emerald-300 mt-1">School: {user.school}</p>
          )}
        </div>

        {/* Program Badge */}
        <div className="mb-4 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg text-center shadow-lg">
          <p className="text-xs font-bold text-white">HYGIENE QUEST PROGRAM</p>
        </div>

        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="w-full bg-transparent border-emerald-600 text-emerald-300 hover:bg-emerald-700 hover:text-white hover:border-emerald-500 transition-all duration-200"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  )
}
