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

interface OTPResponse {
  message: string
}

interface LoginResponse {
  id: number
  phone: string
  name: string
  role: string
  school?: string
}

interface ApiError extends Error {
  name: string
  message: string
}

export function LoginForm() {
  const [step, setStep] = useState<"initial" | "otp">("initial")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [loginRole, setLoginRole] = useState("fieldworker")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(false)
  const router = useRouter()

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    } else if (countdown === 0 && step === "otp") {
      setCanResend(true)
    }
    return () => clearTimeout(timer)
  }, [countdown, step])

  const openSecureLink = (url: string) => {
    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    link.click()
  }

  const startCountdown = () => {
    setCountdown(120)
    setCanResend(false)
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // For school admin login, we need to check if the phone exists in users table
      if (loginRole === "schooladmin") {
        // Check if phone exists in users table
        const checkResponse = await fetch(`${API_BASE_URL}/check-registration/${phone}`)

        if (checkResponse.ok) {
          const userData = await checkResponse.json()
          if (userData.registered) {
            // Phone exists, proceed with OTP
            const endpoint = `${API_BASE_URL}/send-otp`

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000)

            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ phone }),
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ detail: "Network error occurred" }))
              throw new Error(errorData.detail || `Server error: ${response.status}`)
            }

            setStep("otp")
            setSuccess("OTP sent to your phone number")
            startCountdown()
            setIsLoading(false)
            return
          } else {
            throw new Error("This phone number is not registered as a school. Please contact support.")
          }
        } else {
          throw new Error("Failed to check registration status.")
        }
      }

      // For other roles, use the dashboard endpoints
      const endpoint = `${API_BASE_URL}/dashboard/send-login-otp`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to send OTP")
      }

      setStep("otp")
      setSuccess("OTP sent to your phone number")
      startCountdown()
    } catch (err) {
      const error = err as ApiError
      if (error.name === "AbortError") {
        setError("Request timed out. Please check your connection and try again.")
      } else {
        setError(error.message || "Failed to send OTP. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsResending(true)
    setError("")
    setSuccess("")

    try {
      // For school admin, use the main OTP endpoint
      const endpoint =
        loginRole === "schooladmin" ? `${API_BASE_URL}/send-otp` : `${API_BASE_URL}/dashboard/send-login-otp`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to resend OTP")
      }

      setSuccess("OTP resent to your phone number")
      startCountdown()
      setOtp("")
    } catch (err) {
      const error = err as ApiError
      setError(error.message || "Failed to resend OTP")
    } finally {
      setIsResending(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      // Handle school admin login differently
      if (loginRole === "schooladmin") {
        const verifyResponse = await fetch(`${API_BASE_URL}/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone, otp }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({ detail: "OTP verification failed" }))
          throw new Error(errorData.detail || `OTP verification failed: ${verifyResponse.status}`)
        }

        // Get user data from registration
        const userResponse = await fetch(`${API_BASE_URL}/check-registration/${phone}`)
        if (!userResponse.ok) {
          throw new Error("Failed to fetch user data")
        }

        const userData = await userResponse.json()

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
        // Regular dashboard login for other roles
        const response = await fetch(`${API_BASE_URL}/dashboard/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone, otp }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Login failed" }))
          throw new Error(errorData.detail || `Login failed: ${response.status}`)
        }

        const loginResponse = await response.json()

        const sessionData = {
          ...loginResponse,
          loginTime: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("authUser", JSON.stringify(sessionData))
        }

        router.push("/dashboard")
      }
    } catch (err) {
      const error = err as ApiError
      if (error.name === "AbortError") {
        setError("Request timed out. Please check your connection and try again.")
      } else {
        setError(error.message || "Operation failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setStep("initial")
    setPhone("")
    setOtp("")
    setError("")
    setSuccess("")
    setCountdown(0)
    setCanResend(false)
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
              {step === "initial" ? "Enter your phone number to receive an OTP" : "Complete your login"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={step === "initial" ? handleSendOTP : handleVerifyOTP}>
            <CardContent className="space-y-4 px-6">
              {step === "initial" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-800 font-semibold text-sm">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter your phone number"
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

                  <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-400 rounded-lg p-3 shadow-sm">
                    <h4 className="text-xs font-bold text-green-900 mb-1">Data Collection Notice</h4>
                    <p className="text-xs text-green-800 leading-relaxed">
                      We collect your phone number for platform access and progress tracking.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-gray-800 font-semibold text-sm">
                      OTP Verification Code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter the OTP sent to your phone"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="h-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-lg transition-all duration-200 text-sm text-center tracking-widest"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-600 text-center font-medium">
                    We've sent a verification code to <span className="text-teal-600 font-semibold">{phone}</span>
                  </p>

                  {loginRole === "schooladmin" && (
                    <div className="bg-gradient-to-r from-teal-50 to-green-50 border-l-4 border-teal-400 rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-teal-800 text-center font-medium">
                        <strong>School Admin Login:</strong> You will be directed to your school's dashboard after
                        verification.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center">
                    {countdown > 0 ? (
                      <p className="text-xs text-gray-500 font-medium">
                        Resend OTP in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendOTP}
                        disabled={isResending || !canResend}
                        className="text-teal-600 border-2 border-teal-300 hover:bg-teal-50 bg-white font-medium transition-all duration-200 text-xs"
                      >
                        {isResending ? "Resending..." : "Resend OTP"}
                      </Button>
                    )}
                  </div>
                </>
              )}

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
                {isLoading
                  ? step === "initial"
                    ? "Sending OTP..."
                    : "Logging in..."
                  : step === "initial"
                    ? "Send OTP"
                    : "Login"}
              </Button>

              <div className="hidden">
                <p className="text-xs text-teal-600">Need an account? Register here</p>
              </div>

              <p className="text-xs text-teal-600 hover:text-teal-700 hover:underline cursor-pointer font-medium transition-colors duration-200">
                Forgot Password?
              </p>

              {step === "otp" && (
                <button
                  type="button"
                  onClick={() => setStep("initial")}
                  className="text-xs text-teal-600 hover:text-teal-700 hover:underline font-medium transition-colors duration-200"
                >
                  Change phone number
                </button>
              )}
            </CardFooter>
          </form>
        </div>
      </Card>

      {step === "initial" && (
        <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 shadow-lg">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">?</span>
              </div>
              <h3 className="font-bold text-green-800 text-base tracking-tight">How to Login - Complete Guide</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-gradient-to-r from-teal-100 to-green-100 border-2 border-teal-300 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">1</span>
                  </div>
                  <h4 className="font-bold text-teal-900 text-sm">OTP Verification Process (All Users)</h4>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-800 font-medium">Enter your registered phone number</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-800 font-medium">Click "Send OTP" to receive verification code</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-800 font-medium">Check your SMS for 6-digit OTP code</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold text-xs mt-0.5">•</span>
                    <p className="text-xs text-teal-800 font-medium">Enter OTP and click "Login" to access dashboard</p>
                  </div>
                  <div className="bg-teal-200 rounded-lg p-2 mt-2">
                    <p className="text-xs text-teal-900 font-semibold">
                      No OTP received? Wait 2 minutes, then use "Resend OTP" button
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
                      <p className="text-xs text-green-700 font-medium">Use dashboard-registered phone number</p>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-xs mt-0.5">•</span>
                      <p className="text-xs text-green-700 font-medium">Select correct role from dropdown</p>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-xs mt-0.5">•</span>
                      <p className="text-xs text-green-700 font-medium">Complete OTP verification for access</p>
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
                      <p className="text-xs text-teal-700 font-medium">Use school registration phone number</p>
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

                <div className="bg-white border-2 border-green-300 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-green-700 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xs">A</span>
                    </div>
                    <h4 className="font-bold text-green-800 text-sm">Super Admins</h4>
                  </div>
                  <ul className="space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-green-700 font-bold text-xs mt-0.5">•</span>
                      <p className="text-xs text-green-700 font-medium">Use admin-registered phone number</p>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-700 font-bold text-xs mt-0.5">•</span>
                      <p className="text-xs text-green-700 font-medium">Full system access after OTP verification</p>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-700 font-bold text-xs mt-0.5">•</span>
                      <p className="text-xs text-green-700 font-medium">Manage users, schools, and system settings</p>
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
                    OTP not received? Check network connection, wait 2 minutes, then use Resend. Contact your supervisor
                    if issues persist.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-xs text-gray-500 font-medium">© Hygiene Quest 2025</div>
    </div>
  )
}
