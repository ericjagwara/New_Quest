"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Send } from "lucide-react"

interface ExportRequestModalProps {
  isOpen: boolean
  onClose: () => void
  dataType: string
  recordCount: number
  user: any
}

export function ExportRequestModal({ isOpen, onClose, dataType, recordCount, user }: ExportRequestModalProps) {
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for the export request");
      return;
    }
  
    setIsSubmitting(true);
    setError("");
    setSuccess("");
  
    try {
      let userName = "Field Worker";
      let userPhone = "0000000000";
      
      // Try to fetch user details from the dashboard users endpoint
      try {
        console.log("Fetching dashboard user details for user_id:", user.user_id);
        const userDetailsResponse = await fetch(`${API_BASE_URL}/dashboard/users/${user.user_id}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${user.access_token}`,
            "Content-Type": "application/json"
          }
        });
        
        if (userDetailsResponse.ok) {
          const userDetails = await userDetailsResponse.json();
          console.log("Dashboard user details fetched:", userDetails);
          userName = userDetails.name || userName;
          userPhone = userDetails.phone || userPhone;
        } else {
          console.warn("Failed to fetch dashboard user details, status:", userDetailsResponse.status);
          // Try alternative endpoint as fallback
          try {
            const altResponse = await fetch(`${API_BASE_URL}/users/${user.user_id}`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${user.access_token}`,
                "Content-Type": "application/json"
              }
            });
            if (altResponse.ok) {
              const altUserDetails = await altResponse.json();
              userName = altUserDetails.name || userName;
              userPhone = altUserDetails.phone || userPhone;
            }
          } catch (altError) {
            console.log("Alternative endpoint also failed:", altError);
          }
        }
      } catch (fetchError) {
        console.log("User details fetch failed, using fallbacks:", fetchError);
      }
  
      const requestPayload = {
        requester_id: user.user_id,
        requester_name: userName,
        requester_phone: userPhone,
        data_type: dataType,
        record_count: Number(recordCount),
        reason: reason.trim(),
        status: "pending",
      };
  
      console.log("Submitting export request:", requestPayload);
  
      const response = await fetch(`${API_BASE_URL}/dashboard/export-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.access_token}`
        },
        body: JSON.stringify(requestPayload),
      });
  
      const responseData = await response.json();
  
      if (!response.ok) {
        if (response.status === 422) {
          const errorDetails = responseData.detail || "Validation failed";
          throw new Error(`Validation error: ${JSON.stringify(errorDetails)}`);
        }
        throw new Error(responseData.detail || "Failed to submit export request");
      }
  
      setSuccess("Export request submitted successfully! You will be notified when approved.");
      setTimeout(() => {
        handleClose();
        setReason("");
        setSuccess("");
      }, 2000);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "Failed to submit export request");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setReason("");
      setError("");
      setSuccess("");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-emerald-800">
            <Download className="w-5 h-5 mr-2" />
            Request Data Export
          </DialogTitle>
          <DialogDescription>
            As a field worker, you need approval from a super admin to export data. Please provide a reason for your
            request.
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-emerald-700 font-semibold">
              Reason for Export Request *
            </Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you need to export this data (e.g., for reporting, analysis, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-emerald-200 focus:border-emerald-500 min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>

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
            disabled={isSubmitting}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitRequest}
            disabled={isSubmitting || !reason.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
