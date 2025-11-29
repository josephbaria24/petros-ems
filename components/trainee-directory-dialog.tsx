// components/participant-directory-dialog.tsx - PART 1 OF 3
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabase-client"
import { Download, Mail, Loader2, Award, CalendarCheck, Trophy, MoreVertical, Database, RefreshCw, Trash2 } from "lucide-react"
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

interface DownloadTrainee {
  id: string
  first_name: string
  last_name: string
  middle_initial?: string
  picture_2x2_url?: string
  schedule_id: string
  status?: string
  email?: string
  certificate_number?: string
  course_id: string
  batch_number?: number
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
  course_id: string
  batch_number?: number
}

type TemplateType = "participation" | "completion" | "excellence"

const TEMPLATE_OPTIONS = [
  { value: "participation" as TemplateType, label: "Participation", icon: Award },
  { value: "completion" as TemplateType, label: "Completion", icon: CalendarCheck },
  { value: "excellence" as TemplateType, label: "ID Template", icon: Trophy },
]

async function downloadFromServer(
  trainee: DownloadTrainee,
  templateType: TemplateType,
  courseName: string,
  scheduleRange: string,
  givenThisDate: string = new Date().toLocaleDateString(),
  courseTitle: string = courseName,
) {
  console.log("🔽 Downloading certificate for:", trainee.first_name, trainee.last_name);
  console.log("📚 Using courseTitle:", courseTitle);

  try {
    const res = await fetch("/api/generate-certificate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainee,
        courseName,
        courseTitle,
        scheduleRange,
        courseId: trainee.course_id,
        templateType,
        givenThisDate,
      }),
    })

    console.log("📄 Response status:", res.status);
    console.log("📄 Response content-type:", res.headers.get('content-type'));

    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      let errorMessage = "Failed to download certificate.";
      
      if (contentType?.includes('application/json')) {
        const err = await res.json();
        errorMessage = err.error || errorMessage;
        console.error("❌ JSON Error:", err);
      } else {
        const text = await res.text();
        errorMessage = `Server error: ${text.substring(0, 200)}`;
        console.error("❌ HTML/Text Error:", text.substring(0, 500));
      }
      
      throw new Error(errorMessage);
    }

    const blob = await res.blob();
    console.log("✅ Blob received, size:", blob.size);

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
    console.log("✅ Certificate downloaded successfully");
  } catch (error) {
    console.error("❌ Download error:", error);
    throw error;
  }
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
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType>("completion")
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertTitle, setAlertTitle] = useState("")
  const [alertMessage, setAlertMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isDownloadingDirectory, setIsDownloadingDirectory] = useState(false)
  
  // ✅ NEW: Checkbox selection state
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // ✅ NEW: Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedTraineeIds(new Set(trainees.map(t => t.id)))
    } else {
      setSelectedTraineeIds(new Set())
    }
  }

  const handleSelectTrainee = (traineeId: string, checked: boolean) => {
    const newSelected = new Set(selectedTraineeIds)
    if (checked) {
      newSelected.add(traineeId)
    } else {
      newSelected.delete(traineeId)
      setSelectAll(false)
    }
    setSelectedTraineeIds(newSelected)
    
    if (newSelected.size === trainees.length && trainees.length > 0) {
      setSelectAll(true)
    }
  }

  // ✅ NEW: Get selected trainees
  const getSelectedTrainees = () => {
    return trainees.filter(t => selectedTraineeIds.has(t.id))
  }

  const callDatabaseAPI = async (action: string, method: 'GET' | 'POST' = 'GET') => {
    const response = await fetch(`/api/database/${action}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `Failed to ${action}`)
    }
    
    return response.json()
  }

  const fetchDatabaseStats = async () => {
    setIsLoadingStats(true)
    try {
      const data = await callDatabaseAPI('stats', 'GET')
      setDatabaseStats(data)
      
      setAlertTitle("Database Statistics")
      setAlertMessage(
        `Total Records: ${data.records}\n` +
        `Database Exists: ${data.exists ? "Yes" : "No"}\n` +
        `Hostinger Configured: ${data.hostinger_configured ? "Yes" : "No"}`
      )
      setAlertOpen(true)
    } catch (error: any) {
      console.error("Error fetching stats:", error)
      setAlertTitle("Error")
      setAlertMessage(error.message || "Failed to fetch database statistics")
      setAlertOpen(true)
    } finally {
      setIsLoadingStats(false)
    }
  }

  const handleResetDatabase = async () => {
    if (!confirm("Are you sure you want to reset the master database?")) return

    startLongOperation("Resetting Database", "Creating backup and resetting... This may take up to a minute due to server cold start.")

    try {
      const data = await callDatabaseAPI('reset', 'POST')

      if (data.status === "success") {
        setAlertTitle("Success")
        setAlertMessage(
          `Database reset successfully!\nBackup: ${data.backup_file}\nTimestamp: ${data.timestamp}`
        )
      } else {
        setAlertTitle("Error")
        setAlertMessage(`Reset failed: ${data.error}`)
      }
    } catch (error: any) {
      setAlertTitle("Error")
      setAlertMessage(`Failed to reset: ${error.message}`)
    }
  }

  const handleBackupDatabase = async () => {
    startLongOperation("Creating Backup", "Backing up master database... This may take up to a minute due to server cold start.")

    try {
      const data = await callDatabaseAPI('backup', 'GET')

      if (data.status === "success") {
        setAlertTitle("Success")
        setAlertMessage(
          `Backup created!\n\nFile: ${data.backup_file}\nSize: ${(data.file_size / 1024).toFixed(2)} KB\nTimestamp: ${data.timestamp}`
        )
      } else {
        setAlertTitle("Error")
        setAlertMessage(`Backup failed: ${data.error}`)
      }
    } catch (error: any) {
      setAlertTitle("Error")
      setAlertMessage(`Failed: ${error.message}`)
    }
  }

  const handleDeleteAllRecords = async () => {
    if (!confirm("⚠️ WARNING: Delete ALL records?")) return

    startLongOperation("Deleting Records", "Deleting all records... This may take up to a minute due to server cold start.")

    try {
      const data = await callDatabaseAPI('delete-all-records', 'POST')

      if (data.status === "success") {
        setAlertTitle("Success")
        setAlertMessage(`Deleted ${data.records_deleted} records.`)
      } else {
        setAlertTitle("Error")
        setAlertMessage(`Delete failed: ${data.error}`)
      }
    } catch (error: any) {
      setAlertTitle("Error")
      setAlertMessage(`Failed to delete: ${error.message}`)
    }
  }

// PART 2 OF 3 - Continue from Part 1

  const ensureCertificateNumbers = async () => {
    if (!scheduleId) return

    try {
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

      const traineesNeedingSerials = trainees.filter((t) => !t.certificate_number)

      if (traineesNeedingSerials.length > 0) {
        setAlertTitle("Generating Certificate Numbers")
        setAlertMessage(`Generating serial numbers for ${traineesNeedingSerials.length} trainee(s)...`)
        setAlertOpen(true)

        await batchAssignCertificateSerials(
          trainees,
          courseData.id,
          courseData.name
        )

        await fetchTrainees()

        setAlertMessage("Certificate numbers generated successfully!")
        
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
        ensureCertificateNumbers()
      })
      fetchScheduleStatus()
      setSelectedTraineeIds(new Set())
      setSelectAll(false)
    }
  }, [open, scheduleId])

  const handleDownloadCertificates = async () => {
    if (!scheduleId) return

    const selectedTrainees = getSelectedTrainees()
    if (selectedTrainees.length === 0) {
      setAlertTitle("No Selection")
      setAlertMessage("Please select at least one participant to download certificates.")
      setAlertOpen(true)
      return
    }

    await ensureCertificateNumbers()

    setIsGenerating(true)
    startLongOperation(
      "Generating Certificates",
      "Preparing downloads... This may take up to a minute due to server cold start."
    )

    try {
      console.log("📊 Starting certificate download for", selectedTrainees.length, "selected trainees");

      const { data: scheduleData } = await supabase
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()

      let courseTitle = courseName
      let courseId = ""

      if (scheduleData) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("id, title, name")
          .eq("id", scheduleData.course_id)
          .single()

        if (courseData) {
          courseId = courseData.id
          courseTitle = courseData.title || courseData.name
          console.log("📚 Course Name:", courseData.name);
          console.log("📚 Course Title:", courseTitle);
        }
      }

      const { data: templateCheck } = await supabase
        .from("certificate_templates")
        .select("template_type")
        .eq("course_id", courseId)
        .eq("template_type", selectedTemplateType)
        .maybeSingle()

      if (!templateCheck) {
        setAlertTitle("Template Not Found")
        setAlertMessage(
          `No ${selectedTemplateType} template found for this course.\n\n` +
          `Please create a ${selectedTemplateType} template first in the template editor.`
        )
        setIsGenerating(false)
        return
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedTrainees.length; i++) {
        const trainee = selectedTrainees[i];
        
        try {
          await downloadFromServer(
            trainee,
            selectedTemplateType,
            courseName,
            scheduleRange,
            new Date().toLocaleDateString(),
            courseTitle
          )
          successCount++;
          
          setProgress(Math.floor(((i + 1) / selectedTrainees.length) * 100))
          setAlertMessage(
            `Downloaded ${successCount} of ${selectedTrainees.length} certificates...\n` +
            `Last: ${trainee.first_name} ${trainee.last_name}`
          );
        } catch (error: any) {
          failCount++;
          console.error(`Failed to download for ${trainee.first_name} ${trainee.last_name}:`, error);
        }
      }

      setAlertTitle("Download Complete");
      setAlertMessage(
        `Successfully downloaded ${successCount} certificate(s).` +
        (failCount > 0 ? `\n${failCount} failed.` : "")
      );
    } catch (err: any) {
      console.error("❌ Critical error:", err);
      setAlertTitle("Error");
      setAlertMessage(`Critical error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }

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

  const handleDownloadExcel = async () => {
    if (!scheduleId) return

    setIsDownloadingDirectory(true)
    setAlertTitle("Downloading Participant Directory")
    setAlertMessage("Preparing Excel file... This may take up to a minute due to server cold start.")
    setAlertOpen(true)

    try {
      await exportTraineeExcel(scheduleId, scheduleRange)
      setAlertMessage("Download complete!")
    } catch (error) {
      setAlertTitle("Error")
      setAlertMessage("Failed to download directory.")
    } finally {
      setIsDownloadingDirectory(false)
    }
  }

  const handleSendCertificates = async () => {
    if (!scheduleId) return

    const selectedTrainees = getSelectedTrainees()
    if (selectedTrainees.length === 0) {
      setAlertTitle("No Selection")
      setAlertMessage("Please select at least one participant to send certificates.")
      setAlertOpen(true)
      return
    }

    await ensureCertificateNumbers()

    setIsSendingEmails(true)
    setProgress(0)

    startLongOperation(
      "Sending Certificates",
      `Preparing to send ${selectedTemplateType} certificates to ${selectedTrainees.length} participant(s)...`
    )

    try {
      const { data: scheduleData } = await supabase
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()

      let courseTitle = courseName
      let courseId = ""

      if (scheduleData) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("id, title, name")
          .eq("id", scheduleData.course_id)
          .single()

        if (courseData) {
          courseId = courseData.id
          courseTitle = courseData.title || courseData.name
          console.log("📚 Using course title for emails:", courseTitle)
        }
      }

      const { data: templateCheck } = await supabase
        .from("certificate_templates")
        .select("template_type")
        .eq("course_id", courseId)
        .eq("template_type", selectedTemplateType)
        .maybeSingle()

      if (!templateCheck) {
        setAlertTitle("Template Not Found")
        setAlertMessage(
          `No ${selectedTemplateType} template found for this course.\n\n` +
          `Please create a ${selectedTemplateType} template first in the template editor.`
        )
        setIsSendingEmails(false)
        return
      }

      const selectedIds = Array.from(selectedTraineeIds)

      const response = await fetch("/api/send-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          scheduleId,
          templateType: selectedTemplateType,
          courseTitle,
          selectedTraineeIds: selectedIds
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

      if (!reader) throw new Error("Failed to get response reader")

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

  const startLongOperation = (title: string, message: string = "") => {
    setAlertTitle(title)
    setAlertMessage(
      message || "Please wait... This may take up to a minute due to server cold start."
    )
    setAlertOpen(true)
  }

// PART 3 OF 3 - JSX Return

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:w-[70vw] sm:w-[90vw] max-h-[90vh] overflow-y-auto pt-10">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-primary-foreground/20">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadExcel} disabled={isDownloadingDirectory}>
                  {isDownloadingDirectory ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</>
                  ) : (
                    <><Download className="mr-2 h-4 w-4" />Download Excel</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Database Management</DropdownMenuLabel>
                <DropdownMenuItem onClick={fetchDatabaseStats} disabled={isLoadingStats}>
                  <Database className="mr-2 h-4 w-4" />View Statistics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBackupDatabase}>
                  <Download className="mr-2 h-4 w-4" />Create Backup
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleResetDatabase} className="text-orange-600">
                  <RefreshCw className="mr-2 h-4 w-4" />Reset Database
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteAllRecords} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />Delete All Records
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
          <Label htmlFor="template-type" className="font-semibold">Certificate Template Type</Label>
          <Select value={selectedTemplateType} onValueChange={(value: TemplateType) => setSelectedTemplateType(value)}>
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

        <div className="border rounded-md text-sm font-semibold px-4 py-2 bg-secondary">
          Attendee Details ({trainees.length} participants)
        </div>

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
                  <TableHead className="w-12">
                    <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="text-sm font-medium">Last Name</TableHead>
                  <TableHead className="text-sm font-medium">First Name</TableHead>
                  <TableHead className="text-sm font-medium">Middle Initial</TableHead>
                  <TableHead className="text-sm font-medium">Status</TableHead>
                  <TableHead className="text-sm font-medium">ID Picture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainees.map((trainee) => (
                  <TableRow key={trainee.id} className="hover:bg-muted">
                    <TableCell>
                      <Checkbox
                        checked={selectedTraineeIds.has(trainee.id)}
                        onCheckedChange={(checked) => handleSelectTrainee(trainee.id, checked as boolean)}
                        aria-label={`Select ${trainee.first_name} ${trainee.last_name}`}
                      />
                    </TableCell>
                    <TableCell className="dark:text-white capitalize cursor-pointer" onClick={() => { setSelectedTrainee(trainee); setIsTraineeDialogOpen(true) }}>
                      {trainee.last_name}
                    </TableCell>
                    <TableCell className="dark:text-white capitalize cursor-pointer" onClick={() => { setSelectedTrainee(trainee); setIsTraineeDialogOpen(true) }}>
                      {trainee.first_name}
                    </TableCell>
                    <TableCell className="dark:text-white capitalize cursor-pointer" onClick={() => { setSelectedTrainee(trainee); setIsTraineeDialogOpen(true) }}>
                      {trainee.middle_initial ?? "-"}
                    </TableCell>
                    <TableCell onClick={() => { setSelectedTrainee(trainee); setIsTraineeDialogOpen(true) }}>
                      <Badge variant={getStatusBadgeVariant(trainee.status || "pending")}>
                        {trainee.status ?? "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => { setSelectedTrainee(trainee); setIsTraineeDialogOpen(true) }}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={trainee.picture_2x2_url} alt="ID Picture" />
                        <AvatarFallback>{trainee.first_name?.[0]}{trainee.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="justify-start pt-4 gap-2 flex-wrap">
          <div className="w-full text-sm text-muted-foreground mb-2">
            {selectedTraineeIds.size > 0 ? (
              <span className="font-medium text-primary">{selectedTraineeIds.size} of {trainees.length} selected</span>
            ) : (
              <span>No participants selected. Please select participants to download or send certificates.</span>
            )}
          </div>
          <Button variant="outline" onClick={handleDownloadCertificates} disabled={isGenerating || trainees.length === 0 || selectedTraineeIds.size === 0}>
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" />{selectedTemplateType === "excellence" ? "Download IDs" : "Download Certificates"}</>
            )}
          </Button>
          <Button variant="secondary" onClick={handleSendCertificates} disabled={isSendingEmails || trainees.length === 0 || selectedTraineeIds.size === 0}>
            {isSendingEmails ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
            ) : (
              <><Mail className="mr-2 h-4 w-4" />Send {TEMPLATE_OPTIONS.find(t => t.value === selectedTemplateType)?.label}{selectedTemplateType === "excellence" ? " IDs" : " Certificates"}</>
            )}
          </Button>
        </DialogFooter>

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
                    <AvatarFallback>{selectedTrainee.first_name?.[0]}{selectedTrainee.last_name?.[0]}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-2">
                  <Label>Upload New Picture</Label>
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                  {isUploading && <p className="text-sm text-muted-foreground">Uploading and saving...</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={selectedTrainee.last_name} onChange={(e) => setSelectedTrainee({ ...selectedTrainee, last_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={selectedTrainee.first_name} onChange={(e) => setSelectedTrainee({ ...selectedTrainee, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Middle Initial</Label>
                  <Input value={selectedTrainee.middle_initial || ""} onChange={(e) => setSelectedTrainee({ ...selectedTrainee, middle_initial: e.target.value })} />
                </div>
              </div>
            )}
            <DialogFooter className="pt-4 gap-2 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setIsTraineeDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button className="w-full sm:w-auto" onClick={handleSaveTrainee}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}