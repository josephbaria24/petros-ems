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
import { supabase } from "@/lib/supabase-client"
import { Download, Mail, Loader2 } from "lucide-react"
import { exportTraineeExcel } from "@/lib/exports/export-excel"
import { exportCertificates } from "@/lib/exports/export-certificate"

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
  schedules?: {
    id: string
    course_id: string
    courses?: {
      id: string
      name: string
    }
  }
}

interface SupabaseTrainee {
  id: string
  first_name: string
  last_name: string
  middle_initial?: string
  picture_2x2_url?: string
  schedule_id: string
  status?: string   
  schedules: Array<{
    id: string
    course_id: string
    courses: Array<{
      id: string
      name: string
    }>
  }>
}

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [, setTotalCount] = useState(0)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTitle, setAlertTitle] = useState("")
  const [alertMessage, setAlertMessage] = useState("")
  const [isSendingEmails, setIsSendingEmails] = useState(false)

  const handleDownloadCertificates = async () => {
    if (!scheduleId) return
    
    setAlertTitle("Generating Certificates")
    setAlertMessage("Please wait while we generate certificates...")
    setAlertOpen(true)
    setIsGenerating(true)
    setProgress(0)
    
    const onProgress = (current: number, total: number) => {
      setProgress(Math.floor((current / total) * 100))
      setTotalCount(total)
    }
    
    try {
      await exportCertificates(scheduleId, scheduleRange, onProgress)
      setAlertTitle("Done")
      setAlertMessage("Certificates were successfully downloaded.")
    } catch (err) {
      console.error("❌ Export error:", err)
      setAlertTitle("Error")
      setAlertMessage("Failed to generate certificates.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendCertificates = async () => {
    if (!scheduleId) return

    setAlertTitle("Sending Certificates")
    setAlertMessage("Preparing to send certificates...")
    setAlertOpen(true)
    setIsSendingEmails(true)
    setProgress(0)

    try {
      const response = await fetch("/api/send-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      })

      if (!response.ok) {
        const result = await response.json()
        setAlertTitle("Error")
        setAlertMessage(result.error || "Failed to send certificates.")
        setIsSendingEmails(false)
        return
      }

      // Read the SSE stream
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
                setTotalCount(data.total)
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

  const handleDownloadExcel = () => {
    if (!scheduleId) return
    exportTraineeExcel(scheduleId, scheduleRange)
  }

  useEffect(() => {
    if (!scheduleId) return

    const fetchTrainees = async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select(`
          id,
          first_name,
          last_name,
          middle_initial,
          schedule_id,
          picture_2x2_url,
          status, 
          schedules!inner (
            id,
            course_id,
            courses (
              id,
              name
            )
          )
        `)
        .eq("schedule_id", scheduleId)
        .order("last_name", { ascending: true })
      
      if (error) {
        console.error("Error fetching trainees:", error)
      } else {
        const transformedData: Trainee[] = (data as SupabaseTrainee[])?.map(trainee => ({
          ...trainee,
          schedules: trainee.schedules?.[0] ? {
            ...trainee.schedules[0],
            courses: trainee.schedules[0].courses?.[0]
          } : undefined
        })) || []
        
        setTrainees(transformedData)
      }
    }

    const fetchScheduleStatus = async () => {
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
    }

    fetchTrainees()
    fetchScheduleStatus()
  }, [scheduleId])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default"
      case "cancelled":
        return "destructive"
      case "finished":
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

        if (error) {
          console.error("❌ Failed to update picture in database:", error)
          alert("Failed to update picture. Please try again.")
        } else if (data && data[0]) {
          console.log("✅ Picture updated successfully:", data[0])
          
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:w-[40vw] sm:w-[90vw] pt-10">

        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{alertMessage}</p>
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
            <Button className="cursor-pointer" variant="default" onClick={handleDownloadExcel}>
              <Download/>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="bg-yellow-400 dark:bg-blue-950 dark:text-white p-4 rounded-md">
          <div className="text-sm font-semibold uppercase mb-1">
            <Badge variant={getStatusBadgeVariant(scheduleStatus)} className="text-xs">
              {scheduleStatus}
            </Badge>
          </div>
          <div className="text-xl font-bold">{courseName}</div>
          <div className="text-sm">{scheduleRange}</div>
        </div>

        <div className="border-1 rounded-md text-sm font-semibold px-4 py-2">
          Attendee Details
        </div>

        <div className="max-h-[350px] overflow-y-auto border border-border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-sm font-medium">Last Name</TableHead>
                <TableHead className="text-sm font-medium">First Name</TableHead>
                <TableHead className="text-sm font-medium">Middle Name</TableHead>
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
                    <Badge
                      variant={
                        trainee.status === "verified"
                          ? "default"
                          : trainee.status === "declined"
                          ? "destructive"
                          : "outline"
                      }
                    >
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

        <DialogFooter className="justify-start pt-4 gap-2 flex-wrap">
          <Button 
            variant="outline" 
            className="cursor-pointer" 
            onClick={handleDownloadCertificates}
            disabled={isGenerating}
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
            className="cursor-pointer"
            onClick={handleSendCertificates}
            disabled={isSendingEmails}
          >
            {isSendingEmails ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Manual & Digital Certificates
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
              <Button variant="outline" onClick={() => setIsTraineeDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={async () => {
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
                    .select(`
                      id,
                      first_name,
                      last_name,
                      middle_initial,
                      schedule_id,
                      picture_2x2_url,
                      schedules!inner (
                        id,
                        course_id,
                        courses (
                          id,
                          name
                        )
                      )
                    `)

                  if (error) {
                    console.error("❌ Supabase update error:", error)
                    alert("Failed to save changes. Please try again.")
                  } else if (data && data[0]) {
                    console.log("✅ Supabase update success:", data)
                    
                    const supabaseData = data as SupabaseTrainee[]
                    const transformedData: Trainee = {
                      ...supabaseData[0],
                      schedules: supabaseData[0].schedules?.[0] ? {
                        ...supabaseData[0].schedules[0],
                        courses: supabaseData[0].schedules[0].courses?.[0]
                      } : undefined
                    }
                    
                    setIsTraineeDialogOpen(false)
                    setTrainees((prev) =>
                      prev.map((t) => (t.id === selectedTrainee.id ? transformedData : t))
                    )
                    alert("Changes saved successfully!")
                  }
                }}
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