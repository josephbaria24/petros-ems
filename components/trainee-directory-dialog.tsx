// components/participant-directory-dialog.tsx
"use client"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase-client"
import { Download, Mail, Loader2, Award, CalendarCheck, Trophy } from "lucide-react"
import { exportTraineeExcel } from "@/lib/exports/export-excel"
import { exportCertificatesNew } from "@/lib/exports/export-certificate"
import { batchAssignCertificateSerials } from "@/lib/certificate-serial"


interface ParticipantDirectoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string | null
  courseName: string
  scheduleRange: string
}

interface Trainee {
  id: string
  first_name: string
  last_name: string
  middle_initial?: string
  picture_2x2_url?: string
  schedule_id: string
  status?: string
  email?: string
  certificate_number?: string
  course_id: string   // <-- ADD THIS
  batch_number?: number // <-- ADD THIS
}

type TemplateType = "participation" | "completion" | "excellence"

const TEMPLATE_OPTIONS = [
  { value: "participation" as TemplateType, label: "Participation", icon: Award },
  { value: "completion" as TemplateType, label: "Completion", icon: CalendarCheck },
  { value: "excellence" as TemplateType, label: "Excellence", icon: Trophy },
]

export default function ParticipantDirectoryDialog({
  open,
  onOpenChange,
  scheduleId,
  courseName,
  scheduleRange,
}: ParticipantDirectoryDialogProps) {
  const [trainees, setTrainees] = useState<Trainee[]>([])
  const [scheduleStatus, setScheduleStatus] = useState<string>("planned")
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null)
  const [isTraineeDialogOpen, setIsTraineeDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType>("completion")
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTitle, setAlertTitle] = useState("")
  const [alertMessage, setAlertMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
// Add this function inside your component, before the return statement
const ensureCertificateNumbers = async () => {
  if (!scheduleId) return

  try {
    // Get course info
    const { data: scheduleData } = await supabase
      .from("schedules")
      .select("course_id")
      .eq("id", scheduleId)
      .single()

    if (!scheduleData) return

    const { data: courseData } = await supabase
      .from("courses")
      .select("id, name")
      .eq("id", scheduleData.course_id)
      .single()

    if (!courseData) return

    // Check if any trainees are missing certificate numbers
    const traineesNeedingSerials = trainees.filter((t) => !t.certificate_number)

    if (traineesNeedingSerials.length > 0) {
      setAlertTitle("Generating Certificate Numbers")
      setAlertMessage(`Generating serial numbers for ${traineesNeedingSerials.length} trainee(s)...`)
      setAlertOpen(true)

      // Generate and assign certificate numbers
      await batchAssignCertificateSerials(
        trainees,
        courseData.id,
        courseData.name
      )

      // Refresh the trainee list
      await fetchTrainees()

      setAlertMessage("Certificate numbers generated successfully!")
      
      // Auto-close alert after 2 seconds
      setTimeout(() => {
        setAlertOpen(false)
      }, 2000)
    }
  } catch (error) {
    console.error("Error ensuring certificate numbers:", error)
    setAlertTitle("Error")
    setAlertMessage("Failed to generate certificate numbers")
  }
}


useEffect(() => {
  if (open && scheduleId) {
    fetchTrainees().then(() => {
      // Auto-generate certificate numbers if missing
      ensureCertificateNumbers()
    })
    fetchScheduleStatus()
  }
}, [open, scheduleId])




// Also call before downloading certificates:
const handleDownloadCertificates = async () => {
  if (!scheduleId) return

  // Ensure all trainees have certificate numbers first
  await ensureCertificateNumbers()

  setIsGenerating(true)
  setAlertTitle("Generating Certificates")
  setAlertMessage("Preparing downloads...")
  setAlertOpen(true)

  try {
    await exportCertificatesNew(
      scheduleId,
      selectedTemplateType,
      courseName,
      scheduleRange,
      trainees,
      trainees[0]?.course_id,
      (current, total) => {
        const percent = Math.floor((current / total) * 100)
        setProgress(percent)
        setAlertMessage(`Generating ${current} of ${total} certificates...`)
      }
    )

    setAlertMessage("Download completed!")
  } catch (err: any) {
    setAlertTitle("Error")
    setAlertMessage(err.message)
  } finally {
    setIsGenerating(false)
  }
}



  useEffect(() => {
    if (open && scheduleId) {
      fetchTrainees()
      fetchScheduleStatus()
    }
  }, [open, scheduleId])

  const fetchTrainees = async () => {
    if (!scheduleId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, first_name, last_name, middle_initial, schedule_id, picture_2x2_url, status, email, certificate_number, course_id, batch_number")
        .eq("schedule_id", scheduleId)
        .order("last_name", { ascending: true })
      
      if (error) {
        console.error("Error fetching trainees:", error)
        alert("Failed to fetch trainees: " + error.message)
      } else {
        console.log("✅ Fetched trainees:", data)
        setTrainees(data || [])
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  

  const fetchScheduleStatus = async () => {
    if (!scheduleId) return
    
    try {
      const { data, error } = await supabase
        .from("schedules")
        .select("status")
        .eq("id", scheduleId)
        .single()

      if (error) {
        console.error("Error fetching schedule status:", error)
      } else {
        setScheduleStatus(data?.status || "planned")
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
      case "verified":
        return "default"
      case "cancelled":
      case "declined":
        return "destructive"
      case "finished":
      case "completed":
        return "secondary"
      default:
        return "outline"
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTrainee) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await res.json()
      
      if (result.url) {
        const { data, error } = await supabase
          .from("trainings")
          .update({ picture_2x2_url: result.url })
          .eq("id", selectedTrainee.id)
          .select()
          .single()

        if (error) {
          console.error("❌ Failed to update picture in database:", error)
          alert("Failed to update picture. Please try again.")
        } else if (data) {
          console.log("✅ Picture updated successfully:", data)
          
          setSelectedTrainee((prev: any) => ({
            ...prev,
            picture_2x2_url: result.url,
          }))

          setTrainees((prev) =>
            prev.map((t) => (t.id === selectedTrainee.id ? { ...t, picture_2x2_url: result.url } : t))
          )

          alert("Picture updated successfully!")
        }
      } else {
        console.error("Upload failed:", result.error)
        alert("Upload failed. Please try again.")
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("An error occurred during upload.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadExcel = () => {
    if (!scheduleId) return
    exportTraineeExcel(scheduleId, scheduleRange)
  }



const handleSendCertificates = async () => {
  if (!scheduleId) return

  // Ensure all trainees have certificate numbers first
  await ensureCertificateNumbers()

  setAlertTitle("Sending Certificates")
  setAlertMessage(`Preparing to send ${selectedTemplateType} certificates...`)
  setAlertOpen(true)
  setIsSendingEmails(true)
  setProgress(0)

    try {
      const response = await fetch("/api/send-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          scheduleId,
          templateType: selectedTemplateType
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        setAlertTitle("Error")
        setAlertMessage(result.error || "Failed to send certificates.")
        setIsSendingEmails(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("Failed to get response reader")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6))

              if (data.type === "progress") {
                const progressPercent = Math.floor((data.current / data.total) * 100)
                setProgress(progressPercent)
                setAlertMessage(
                  `${data.message}${data.lastSent ? `\nLast sent: ${data.lastSent}` : ""}${
                    data.lastError ? `\nError: ${data.lastError}` : ""
                  }`
                )
              } else if (data.type === "complete") {
                setProgress(100)
                setAlertTitle("Done")
                setAlertMessage(
                  `Successfully sent ${data.successCount} certificate(s). ${
                    data.failCount > 0 ? `${data.failCount} failed.` : ""
                  }`
                )
                setIsSendingEmails(false)
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending certificates:", error)
      setAlertTitle("Error")
      setAlertMessage("An error occurred while sending certificates.")
      setIsSendingEmails(false)
    }
  }

  const handleSaveTrainee = async () => {
    if (!selectedTrainee) return

    console.log("Submitting update for:", selectedTrainee)

    const { data, error } = await supabase
      .from("trainings")
      .update({
        first_name: selectedTrainee.first_name,
        last_name: selectedTrainee.last_name,
        middle_initial: selectedTrainee.middle_initial,
      })
      .eq("id", selectedTrainee.id)
      .select()
      .single()

    if (error) {
      console.error("❌ Supabase update error:", error)
      alert("Failed to save changes. Please try again.")
    } else if (data) {
      console.log("✅ Supabase update success:", data)
      
      setIsTraineeDialogOpen(false)
      setTrainees((prev) =>
        prev.map((t) => (t.id === selectedTrainee.id ? data as Trainee : t))
      )
      alert("Changes saved successfully!")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:w-[70vw] sm:w-[90vw] max-h-[90vh] overflow-y-auto pt-10">
        {/* Alert Dialog for Progress */}
        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{alertMessage}</p>
              {(isGenerating || isSendingEmails) && (
                <Progress value={progress} className="h-2" />
              )}
            </div>
            <AlertDialogFooter className="pt-4">
              <Button
                onClick={() => setAlertOpen(false)}
                disabled={isGenerating || isSendingEmails}
              >
                Close
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white bg-primary p-2 rounded-md flex justify-between items-center">
            Directory of Participants
            <Button variant="default" onClick={handleDownloadExcel}>
              <Download className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Course Info Banner */}
        <div className="bg-yellow-400 dark:bg-blue-950 dark:text-white p-4 rounded-md">
          <div className="text-sm font-semibold uppercase mb-1">
            <Badge variant={getStatusBadgeVariant(scheduleStatus)} className="text-xs">
              {scheduleStatus}
            </Badge>
          </div>
          <div className="text-xl font-bold">{courseName}</div>
          <div className="text-sm">{scheduleRange}</div>
        </div>

        {/* Certificate Template Type Selector */}
        <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
          <Label htmlFor="template-type" className="font-semibold">Certificate Template Type</Label>
          <Select
            value={selectedTemplateType}
            onValueChange={(value: TemplateType) => setSelectedTemplateType(value)}
          >
            <SelectTrigger id="template-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select which certificate template to use when generating certificates
          </p>
        </div>

        {/* Attendee Details Section */}
        <div className="border rounded-md text-sm font-semibold px-4 py-2 bg-secondary">
          Attendee Details ({trainees.length} participants)
        </div>

        {/* Participants Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : trainees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No participants found</p>
            <p className="text-sm">No trainees are enrolled in this schedule yet.</p>
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto border border-border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-sm font-medium">Last Name</TableHead>
                  <TableHead className="text-sm font-medium">First Name</TableHead>
                  <TableHead className="text-sm font-medium">Middle Initial</TableHead>
                  <TableHead className="text-sm font-medium">Status</TableHead>
                  <TableHead className="text-sm font-medium">ID Picture</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {trainees.map((trainee) => (
                  <TableRow
                    key={trainee.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => {
                      setSelectedTrainee(trainee)
                      setIsTraineeDialogOpen(true)
                    }}
                  >
                    <TableCell className="dark:text-white capitalize">
                      {trainee.last_name}
                    </TableCell>
                    <TableCell className="dark:text-white capitalize">
                      {trainee.first_name}
                    </TableCell>
                    <TableCell className="dark:text-white capitalize">
                      {trainee.middle_initial ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(trainee.status || "pending")}>
                        {trainee.status ?? "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={trainee.picture_2x2_url} alt="ID Picture" />
                        <AvatarFallback>
                          {trainee.first_name?.[0]}
                          {trainee.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="justify-start pt-4 gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={handleDownloadCertificates}
          disabled={isGenerating || trainees.length === 0}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Certificates
            </>
          )}
        </Button>

          <Button 
            variant="secondary" 
            onClick={handleSendCertificates}
            disabled={isSendingEmails || trainees.length === 0}
          >
            {isSendingEmails ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send {TEMPLATE_OPTIONS.find(t => t.value === selectedTemplateType)?.label} Certificates
              </>
            )}
          </Button>
        </DialogFooter>

        {/* View/Edit Trainee Dialog */}
        <Dialog open={isTraineeDialogOpen} onOpenChange={setIsTraineeDialogOpen}>
          <DialogContent className="lg:w-[40vw] sm:w-[90vw]">
            <DialogHeader>
              <DialogTitle>Edit Participant Details</DialogTitle>
            </DialogHeader>
            {selectedTrainee && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Picture</Label>
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={selectedTrainee.picture_2x2_url} alt="Current Picture" />
                    <AvatarFallback>
                      {selectedTrainee.first_name?.[0]}
                      {selectedTrainee.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="space-y-2">
                  <Label>Upload New Picture</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  {isUploading && (
                    <p className="text-sm text-muted-foreground">Uploading and saving...</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={selectedTrainee.last_name}
                    onChange={(e) =>
                      setSelectedTrainee({ ...selectedTrainee, last_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={selectedTrainee.first_name}
                    onChange={(e) =>
                      setSelectedTrainee({ ...selectedTrainee, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Middle Initial</Label>
                  <Input
                    value={selectedTrainee.middle_initial || ""}
                    onChange={(e) =>
                      setSelectedTrainee({ ...selectedTrainee, middle_initial: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter className="pt-4 gap-2 flex-col sm:flex-row">
              <Button 
                variant="outline" 
                onClick={() => setIsTraineeDialogOpen(false)} 
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleSaveTrainee}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}