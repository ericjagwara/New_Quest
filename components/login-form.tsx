"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles } from "lucide-react"
import Image from "next/image"
import { Checkbox } from "@/components/ui/checkbox"

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
  const [isLogin, setIsLogin] = useState(true)
  const [step, setStep] = useState<"initial" | "otp">("initial")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("fieldworker")
  const [loginRole, setLoginRole] = useState("fieldworker") // Separate state for login role
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasConsented, setHasConsented] = useState(false)
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

    if (!isLogin && !hasConsented) {
      setError("Please accept the privacy policy and terms of service to continue.")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // For school admin login, we need to check if the phone exists in users table
      if (isLogin && loginRole === "schooladmin") {
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
            throw new Error("This phone number is not registered as a school. Please register first.")
          }
        } else {
          throw new Error("Failed to check registration status.")
        }
      }

      // For other roles, use the dashboard endpoints
      const endpoint = isLogin
        ? `${API_BASE_URL}/dashboard/send-login-otp`
        : `${API_BASE_URL}/dashboard/send-registration-otp`

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
      const endpoint = loginRole === "schooladmin" 
        ? `${API_BASE_URL}/send-otp`
        : isLogin
          ? `${API_BASE_URL}/dashboard/send-login-otp`
          : `${API_BASE_URL}/dashboard/send-registration-otp`

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

      if (isLogin) {
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
      } else {
        // Registration flow
        const verifyResponse = await fetch(`${API_BASE_URL}/dashboard/verify-registration-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone, otp }),
          signal: controller.signal,
        })

        if (!verifyResponse.ok) {
          clearTimeout(timeoutId)
          const errorData = await verifyResponse.json().catch(() => ({ detail: "OTP verification failed" }))
          throw new Error(errorData.detail || `OTP verification failed: ${verifyResponse.status}`)
        }

        const registerResponse = await fetch(`${API_BASE_URL}/dashboard/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone, name, role }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!registerResponse.ok) {
          const errorData = await registerResponse.json().catch(() => ({ detail: "Registration failed" }))
          throw new Error(errorData.detail || `Registration failed: ${registerResponse.status}`)
        }

        setSuccess("Registration successful! Please login with your phone number.")

        setTimeout(() => {
          setIsLogin(true)
          resetForm()
        }, 2000)
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
    setName("")
    setRole("fieldworker")
    setLoginRole("fieldworker")
    setError("")
    setSuccess("")
    setHasConsented(false)
    setCountdown(0)
    setCanResend(false)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 rounded-full blur-2xl animate-pulse"></div>
            <Image
              src="/hygiene-quest-logo.jpg"
              alt="Hygiene Quest Logo"
              width={120}
              height={120}
              className="drop-shadow-2xl relative z-10 hover:scale-105 transition-transform duration-300 rounded-full"
            />
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-bounce" />
            <Sparkles className="absolute -bottom-1 -left-2 w-4 h-4 text-pink-400 animate-bounce delay-300" />
            <Sparkles className="absolute top-2 -left-3 w-3 h-3 text-blue-400 animate-bounce delay-700" />
            <Sparkles className="absolute -top-1 left-8 w-3 h-3 text-purple-400 animate-bounce delay-1000" />
          </div>
        </div>

        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent animate-pulse">
          Hygiene Quest
        </h1>
        <h2 className="text-xl font-semibold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
          Welcome to the Hygiene Quest Dashboard
        </h2>
        <p className="text-gray-600 text-sm leading-relaxed">
          Track progress, access resources, and support better hygiene practices in Ugandan schools.
        </p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          This platform helps schools monitor hand-washing facilities, distribute learning materials, and measure the
          impact of hygiene education across Uganda.
        </p>
      </div>

      <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-md relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-t-lg"></div>
        <div className="absolute inset-0 border-2 border-transparent bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 rounded-lg"></div>
        <div className="relative bg-white/95 m-0.5 rounded-lg">
          <CardHeader className="space-y-1 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-t-lg">
            <CardTitle className="text-xl text-center bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
              {isLogin ? "Sign In" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-center bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-medium">
              {isLogin
                ? "Enter your phone number to receive an OTP"
                : step === "initial"
                  ? "Enter your phone number to register"
                  : "Complete your registration"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={step === "initial" ? handleSendOTP : handleVerifyOTP}>
            <CardContent className="space-y-4 pt-6">
              {step === "initial" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-emerald-700 font-semibold">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="border-2 border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white/80"
                      required
                    />
                  </div>

                  {isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="loginRole" className="text-emerald-700 font-semibold">
                        Login As
                      </Label>
                      <select
                        id="loginRole"
                        value={loginRole}
                        onChange={(e) => setLoginRole(e.target.value)}
                        className="w-full border-2 border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white/80 rounded-md px-3 py-2"
                        required
                      >
                        <option value="fieldworker">Field Worker</option>
                        <option value="manager">Manager</option>
                        <option value="superadmin">Super Admin</option>
                        <option value="schooladmin">School Admin</option>
                      </select>
                      {loginRole === "schooladmin" && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Use the phone number you registered with for your school
                        </p>
                      )}
                    </div>
                  )}

                  {!isLogin && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-emerald-700 font-semibold">
                          Full Name
                        </Label>
                        <Input
                          id="name"
                          type="text"
                          placeholder="Enter your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="border-2 border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white/80"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role" className="text-emerald-700 font-semibold">
                          Role
                        </Label>
                        <select
                          id="role"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full border-2 border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white/80 rounded-md px-3 py-2"
                          required
                        >
                          <option value="fieldworker">Field Worker</option>
                          <option value="manager">Manager</option>
                          <option value="superadmin">Super Admin</option>
                        </select>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="consent"
                            checked={hasConsented}
                            onCheckedChange={(checked) => setHasConsented(checked as boolean)}
                            className="mt-1"
                          />
                          <div className="space-y-1">
                            <Label htmlFor="consent" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                              I agree to the collection and processing of my personal data as described in the{" "}
                              <button
                                type="button"
                                className="text-emerald-600 hover:text-emerald-800 underline font-medium"
                                onClick={() => openSecureLink("/privacy-policy")}
                              >
                                Privacy Policy
                              </button>{" "}
                              and{" "}
                              <button
                                type="button"
                                className="text-emerald-600 hover:text-emerald-800 underline font-medium"
                                onClick={() => openSecureLink("/terms-of-service")}
                              >
                                Terms of Service
                              </button>
                            </Label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Data Collection Notice</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      We collect your phone number and profile information to provide access to the Hygiene Quest
                      platform. Your data is used to track hygiene education progress in schools and is protected
                      according to our privacy policy.
                      {isLogin ? " By logging in, you acknowledge our data practices." : ""}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-emerald-700 font-semibold">
                      OTP Verification Code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter the OTP sent to your phone"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="border-2 border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white/80"
                      required
                    />
                  </div>
                  <p className="text-sm text-gray-600 text-center">We've sent a verification code to {phone}</p>

                  {loginRole === "schooladmin" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs text-emerald-700 text-center">
                        <strong>School Admin Login:</strong> You will be directed to your school's dashboard after verification.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-gray-500">
                        Resend OTP in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendOTP}
                        disabled={isResending || !canResend}
                        className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 bg-transparent"
                      >
                        {isResending ? "Resending..." : "Resend OTP"}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-0"
                style={{
                  backgroundColor: "#059669",
                  color: "white",
                  backgroundImage: "linear-gradient(to right, #059669, #0d9488, #0891b2)",
                }}
                disabled={isLoading}
              >
                {isLoading
                  ? step === "initial"
                    ? isLogin
                      ? "Sending OTP..."
                      : "Sending OTP..."
                    : isLogin
                      ? "Logging in..."
                      : "Registering..."
                  : step === "initial"
                    ? isLogin
                      ? "Send OTP"
                      : "Send OTP"
                    : isLogin
                      ? "Login"
                      : "Complete Registration"}
              </Button>

              {step === "initial" ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    resetForm()
                  }}
                  className="text-sm bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent hover:from-emerald-800 hover:to-teal-800 hover:underline font-semibold transition-all duration-200"
                >
                  {isLogin ? "Need an account? Register here" : "Already have an account? Login here"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep("initial")}
                  className="text-sm bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent hover:from-emerald-800 hover:to-teal-800 hover:underline font-semibold transition-all duration-200"
                >
                  Change phone number
                </button>
              )}

              {isLogin && step === "initial" && (
                <button
                  type="button"
                  className="text-sm bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent hover:from-emerald-800 hover:to-teal-800 hover:underline font-semibold transition-all duration-200"
                >
                  Forgot Password?
                </button>
              )}
            </CardFooter>
          </form>
        </div>
      </Card>

      <div className="text-center text-xs bg-gradient-to-r from-gray-500 to-gray-700 bg-clip-text text-transparent font-semibold">
        © Hygiene Quest 2025
      </div>

      {isLogin && step === "initial" && (
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400"></div>
          <CardContent className="pt-4">
            <p className="text-xs font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-blue-600" />
              How to Login:
            </p>
            <div className="space-y-2 text-xs">
              <div className="bg-white/90 p-3 rounded-lg shadow-sm border border-blue-100 font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                1. Enter your registered phone number
              </div>
              <div className="bg-white/90 p-3 rounded-lg shadow-sm border border-blue-100 font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                2. Select your role
              </div>
              <div className="bg-white/90 p-3 rounded-lg shadow-sm border border-blue-100 font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                3. Click "Send OTP" to receive a verification code
              </div>
              <div className="bg-white/90 p-3 rounded-lg shadow-sm border border-blue-100 font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                4. Enter the OTP sent to your phone to login
              </div>
              <div className="bg-white/90 p-3 rounded-lg shadow-sm border border-blue-100">
                5. Use "Resend OTP" if you don't receive the code within 2 minutes
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
