"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

interface User {
  id: number
  phone: string
  name: string
  role: string
}

interface ApiError extends Error {
  name: string
  message: string
}

export function LoginForm() {
  const [phone, setPhone] = useState("")
  const [loginRole, setLoginRole] = useState("fieldworker")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

  const openSecureLink = (url: string) => {
    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    link.click()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // For school admin login, check if phone exists in users table
      if (loginRole === "schooladmin") {
        const checkResponse = await fetch(`${API_BASE_URL}/check-registration/${phone}`)

        if (!checkResponse.ok) {
          throw new Error("Failed to check registration status.")
        }

        const userData = await checkResponse.json()
        if (!userData.registered) {
          throw new Error("This phone number is not registered as a school. Please contact support.")
        }

        // Create school admin session
        const sessionData = {
          id: userData.id || 0,
          phone: phone,
          name: userData.name || "School Admin",
          role: "schooladmin",
          school: userData.school,
          loginTime: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("authUser", JSON.stringify(sessionData))
        }

        router.push("/dashboard/school")
      } else {
        // For dashboard users, check if phone exists in dashboard users
        const userResponse = await fetch(`${API_BASE_URL}/dashboard/users/phone/${phone}`)
        
        if (!userResponse.ok) {
          if (userResponse.status === 404) {
            throw new Error("User not found. Please register first.")
          }
          throw new Error("Failed to check user existence.")
        }

        const userData = await userResponse.json()

        // Create session data based on user role
        const sessionData = {
          id: userData.id,
          phone: userData.phone,
          name: userData.name,
          role: userData.role,
          loginTime: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          access_token: "temporary-bypass-token", // Add dummy token for compatibility
          token_type: "bearer"
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("authUser", JSON.stringify(sessionData))
        }

        router.push("/dashboard")
      }
    } catch (err) {
      const error = err as ApiError
      setError(error.message || "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setPhone("")
    setError("")
    setSuccess("")
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-3">
        <div className="flex justify-center mb-3">
          <div className="relative">
            <Image
              src="/hygiene-quest-logo.jpg"
              alt="Hygiene Quest Logo"
              width={70}
              height={70}
              className="rounded-full shadow-lg ring-4 ring-white ring-opacity-50"
            />
            <div className="absolute inset-0 rounded-full bg-teal-400 opacity-20 blur-xl -z-10"></div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-teal-700 tracking-tight">Hygiene Quest</h1>
          <h2 className="text-lg font-semibold text-gray-800 leading-tight">Welcome to the Hygiene Quest Dashboard</h2>
          <p className="text-gray-600 text-sm leading-relaxed max-w-lg mx-auto">
            Track progress, access resources, and support better hygiene practices in Ugandan schools.
          </p>
        </div>
      </div>

      <Card className="shadow-2xl border-0 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/30 to-blue-50/30"></div>
        <div className="relative">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-center text-white bg-gradient-to-r from-teal-600 to-teal-500 py-2 px-4 rounded-t-lg -mx-6 -mt-6 mb-3 shadow-md">
              Sign In
            </CardTitle>
            <CardDescription className="text-center text-teal-600 font-medium text-sm">
              Enter your registered phone number and role to login
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 px-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-800 font-semibold text-sm">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your registered phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-lg transition-all duration-200 text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginRole" className="text-gray-800 font-semibold text-sm">
                  Login As
                </Label>
                <select
                  id="loginRole"
                  value={loginRole}
                  onChange={(e) => setLoginRole(e.target.value)}
                  className="w-full h-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-lg px-3 text-sm bg-white transition-all duration-200"
                  required
                >
                  <option value="fieldworker">Field Worker</option>
                  <option value="manager">Manager</option>
                  <option value="superadmin">Super Admin</option>
                  <option value="schooladmin">School Admin</option>
                </select>
                {loginRole === "schooladmin" && (
                  <p className="text-xs text-teal-600 font-medium">
                    Use the phone number you registered with for your school
                  </p>
                )}
              </div>

              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg p-3 shadow-sm mb-6">
                <h4 className="text-xs font-bold text-yellow-900 mb-1">Temporary Login</h4>
                <p className="text-xs text-yellow-800 leading-relaxed">
                  OTP verification is temporarily disabled. You can login directly with your registered phone number.
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="border-l-4 border-red-500 bg-red-50 shadow-sm">
                  <AlertDescription className="text-red-800 font-medium text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-l-4 border-green-500 bg-green-50 shadow-sm">
                  <AlertDescription className="text-green-800 font-medium text-xs">{success}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 px-6 pb-6">
              <Button
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>

              <div className="hidden">
                <p className="text-xs text-teal-600">Need an account? Register here</p>
              </div>
            </CardFooter>
          </form>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 shadow-lg">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">?</span>
            </div>
            <h3 className="font-bold text-green-800 text-base tracking-tight">How to Login - Simplified Process</h3>
          </div>

          <div className="space-y-3">
            <div className="bg-gradient-to-r from-teal-100 to-green-100 border-2 border-teal-300 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">1</span>
                </div>
                <h4 className="font-bold text-teal-900 text-sm">Login Process (OTP Temporarily Disabled)</h4>
              </div>
              <div className="grid gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                  <p className="text-xs text-teal-800 font-medium">Enter your registered phone number</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                  <p className="text-xs text-teal-800 font-medium">Select your correct role from dropdown</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                  <p className="text-xs text-teal-800 font-medium">Click "Login" to access your dashboard</p>
                </div>
                <div className="bg-yellow-100 border-l-4 border-yellow-500 rounded-lg p-2 mt-2">
                  <p className="text-xs text-yellow-900 font-semibold">
                    Note: OTP verification is temporarily disabled for maintenance.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="bg-white border-2 border-green-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">F</span>
                  </div>
                  <h4 className="font-bold text-green-800 text-sm">Field Workers & Managers</h4>
                </div>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-green-700 font-medium">Use your dashboard-registered phone number</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-green-700 font-medium">Select correct role from dropdown</p>
                  </li>
                </ul>
              </div>

              <div className="bg-white border-2 border-teal-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">S</span>
                  </div>
                  <h4 className="font-bold text-teal-800 text-sm">School Admins</h4>
                </div>
                <ul className="space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-700 font-medium">Use your school registration phone number</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-700 font-medium">Select "School Admin" from dropdown</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-700 font-medium">Access your school's dedicated dashboard</p>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">!</span>
                </div>
                <h4 className="font-bold text-green-800 text-sm">Troubleshooting</h4>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <p className="text-xs text-green-800 font-medium leading-relaxed">
                  Can't login? Ensure you're using the correct phone number and role. Contact your supervisor if issues persist.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-gray-500 font-medium">© Hygiene Quest 2025</div>
    </div>
  )
} 