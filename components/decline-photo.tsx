//components/decline-photo.tsx
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { tmsDb } from "@/lib/supabase-client"

interface DeclinePhotoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainee: any
  onSuccess: () => void
}

export function DeclinePhotoDialog({
  open,
  onOpenChange,
  trainee,
  onSuccess,
}: DeclinePhotoDialogProps) {
  const [declineId, setDeclineId] = useState(false)
  const [decline2x2, setDecline2x2] = useState(false)
  const [reason, setReason] = useState("")
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!declineId && !decline2x2) {
      toast.error("Please select at least one photo to decline")
      return
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for declining")
      return
    }

    setSending(true)

    try {
      // Generate unique token for re-upload link
      const token = crypto.randomUUID()
      
      // Create re-upload link
      const reuploadUrl = `${window.location.origin}/reupload?token=${token}&traineeId=${trainee.id}`

      // Store decline information in database
      const { error: dbError } = await tmsDb
        .from("trainings")
        .update({
          declined_photos: {
            id_picture: declineId,
            picture_2x2: decline2x2,
            reason,
            token,
            declined_at: new Date().toISOString(),
          },
          status: "Declined (Waiting for Resubmission)" // ✅ Fixed status
        })
        .eq("id", trainee.id)

      if (dbError) throw dbError

      // Prepare email content
      const declinedPhotos = []
      if (declineId) declinedPhotos.push("ID Picture")
      if (decline2x2) declinedPhotos.push("2x2 Picture")

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .declined-list { background: white; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; }
            .reason-box { background: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Photo Submission Declined</h2>
            </div>
            <div class="content">
              <p>Dear ${trainee.first_name} ${trainee.last_name},</p>
              
              <p>We hope this message finds you well. Unfortunately, we need to inform you that some of your submitted photos require resubmission.</p>
              
              <div class="declined-list">
                <strong>Declined Photos:</strong>
                <ul>
                  ${declinedPhotos.map(photo => `<li>${photo}</li>`).join('')}
                </ul>
              </div>
              
              <div class="reason-box">
                <strong>Reason for Decline:</strong>
                <p>${reason}</p>
              </div>
              
              <p>Please re-upload the declined photo(s) by clicking the button below:</p>
              
              <a href="${reuploadUrl}" class="button" style="color: #fff;">
                  Re-upload Photos
                </a>

              
              <p><small>This link will expire in 7 days. If you have any questions, please contact us.</small></p>
              
              <div class="footer">
                <p>Petrosphere Training Institute</p>
                <p>This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      // Send email
      const emailResponse = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: trainee.email,
          subject: "Action Required: Photo Resubmission Needed",
          message: emailContent,
        }),
      })

      if (!emailResponse.ok) {
        throw new Error("Failed to send email")
      }

      toast.success("Decline notification sent successfully")
      onSuccess()
      onOpenChange(false)
      
      // Reset form
      setDeclineId(false)
      setDecline2x2(false)
      setReason("")
      
    } catch (error: any) {
      console.error("Error declining photos:", error)
      toast.error(error.message || "Failed to process decline")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Decline Photo Submission</DialogTitle>
          <DialogDescription>
            Select which photo(s) to decline and provide a reason. The trainee will receive an email with a re-upload link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Select Photos to Decline:</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="decline-id"
                checked={declineId}
                onCheckedChange={(checked) => setDeclineId(checked as boolean)}
              />
              <label
                htmlFor="decline-id"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                ID Picture
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="decline-2x2"
                checked={decline2x2}
                onCheckedChange={(checked) => setDecline2x2(checked as boolean)}
              />
              <label
                htmlFor="decline-2x2"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                2x2 Picture
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Decline</Label>
            <Textarea
              id="reason"
              placeholder="E.g., Photo is blurry, incorrect size, poor lighting..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={sending || (!declineId && !decline2x2) || !reason.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Decline & Send Email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}