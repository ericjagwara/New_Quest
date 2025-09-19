"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Send, Download } from "lucide-react"

interface ExportOTPModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  dataType: string
  recordCount: number
  user: any
}

export function ExportOTPModal({ isOpen, onClose, onVerified, dataType, recordCount, user }: ExportOTPModalProps) {
  const [step, setStep] = useState<"send" | "verify">("send")
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(false)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    } else if (countdown === 0 && step === "verify") {
      setCanResend(true)
    }
    return () => clearTimeout(timer)
  }, [countdown, step])

  const startCountdown = () => {
    setCountdown(120) // 2 minutes
    setCanResend(false)
  }

  const handleSendOTP = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = user.role === "manager" 
        ? `${API_BASE_URL}/dashboard/send-export-otp`
        : `${API_BASE_URL}/dashboard/send-login-otp`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": user.role === "manager" ? `Bearer ${user.access_token}` : undefined,
        },
        body: JSON.stringify({
          phone: user.phone,
          user_id: user.user_id || user.id,
          data_type: dataType,
          record_count: recordCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to send OTP" }))
        throw new Error(errorData.detail || "Failed to send OTP")
      }

      setStep("verify")
      setSuccess("OTP sent to your phone number for export verification")
      startCountdown()
    } catch (err: any) {
      setError(err.message || "Failed to send OTP")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setError("Please enter the OTP code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const endpoint = user.role === "manager" 
        ? `${API_BASE_URL}/dashboard/verify-export-otp`
        : `${API_BASE_URL}/dashboard/login`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": user.role === "manager" ? `Bearer ${user.access_token}` : undefined,
        },
        body: JSON.stringify({
          phone: user.phone,
          otp: otp.trim(),
          user_id: user.user_id || user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Invalid OTP" }))
        throw new Error(errorData.detail || "Invalid OTP")
      }

      const result = await response.json();
      
      if (user.role === "manager" && result.access_token) {
        // Store the temporary export token
        localStorage.setItem('export_token', result.access_token);
      }

      setSuccess("OTP verified successfully! Starting download...")
      setTimeout(() => {
        onVerified()
        handleClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || "Invalid OTP")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/send-export-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: user.phone,
          user_id: user.id,
          data_type: dataType,
          record_count: recordCount,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to resend OTP")
      }

      setSuccess("OTP resent to your phone number")
      startCountdown()
      setOtp("")
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      setStep("send")
      setOtp("")
      setError("")
      setSuccess("")
      setCountdown(0)
      setCanResend(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-emerald-800">
            <Shield className="w-5 h-5 mr-2" />
            Security Verification Required
          </DialogTitle>
          <DialogDescription>
            {step === "send"
              ? "For security purposes, we need to verify your identity before allowing data export."
              : "Enter the OTP code sent to your phone to proceed with the download."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <p className="text-sm text-emerald-800">
              <strong>Data Type:</strong> {dataType}
            </p>
            <p className="text-sm text-emerald-800">
              <strong>Records:</strong> {recordCount} items
            </p>
            <p className="text-sm text-emerald-800">
              <strong>Phone:</strong> {user.phone}
            </p>
          </div>

          {step === "verify" && (
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
                className="border-emerald-200 focus:border-emerald-500"
                disabled={isLoading}
                maxLength={6}
              />

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
                    disabled={isLoading || !canResend}
                    className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 bg-transparent"
                  >
                    {isLoading ? "Resending..." : "Resend OTP"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={step === "send" ? handleSendOTP : handleVerifyOTP}
            disabled={isLoading || (step === "verify" && !otp.trim())}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? (
              step === "send" ? (
                "Sending..."
              ) : (
                "Verifying..."
              )
            ) : (
              <>
                {step === "send" ? (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send OTP
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Verify & Download
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
