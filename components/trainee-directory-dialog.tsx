// components\trainee-directory-dialog.tsx
"use client"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { tmsDb } from "@/lib/supabase-client"
import { Download, Mail, Loader2, Award, CalendarCheck, Trophy, MoreVertical, Database, RefreshCw, Trash2, PenSquare, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { exportTraineeExcel } from "@/lib/exports/export-excel"
import { exportCertificatesNew } from "@/lib/exports/export-certificate"
import { batchAssignCertificateSerials } from "@/lib/certificate-serial"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import EmailComposeDialog from "./email-composed-dialog"
import { useToast } from "@/hooks/use-toast"


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

interface CertificateGenerationData {
  training_id: string;
  first_name: string;
  last_name: string;
  middle_initial?: string;
  suffix?: string;
  certificate_number: string;
  batch_number?: number;
  picture_2x2_url?: string;
  schedule_id: string;
  course_id: string;
  schedule_type: string;
  range_start_date?: string;
  range_end_date?: string;
  staggered_dates?: string[];
  offset_x: number;
  offset_y: number;
  field_overrides: any;
  override_template_type?: string;
  course_name: string;
  course_title: string;
}

type TemplateField = {
  id: string
  label: string
  value: string
  x: number
  y: number
  fontSize: number
  boxWidth?: number
  boxHeight?: number
  fontWeight: "normal" | "bold" | "extrabold"
  fontStyle: "normal" | "italic"
  fontFamily: "Helvetica" | "Montserrat" | "Poppins"
  color: string
  align: "left" | "center" | "right"
  lineHeight?: number
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
  layoutOverride?: any
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
        layoutOverride
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
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `${trainee.last_name} ${trainee.first_name}_${trainee.certificate_number}_${dateStr}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
    console.log("✅ Certificate downloaded successfully");
  } catch (error) {
    console.error("❌ Download error:", error);
    throw error;
  }
}


// Default email content generator
function generateDefaultEmailContent(
  courseName: string,
  courseTitle: string,
  scheduleRange: string
): { subject: string; message: string } {
  const subject = `Your ${courseName} Certificate - Petrosphere Incorporated`

  const message = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: #4F46E5; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 5px 5px; }
        .certificate-info { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 3px; }
        .certificate-info strong { color: #92400E; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1> Certificate of Completion</h1></div>
        <div class="content">
          <p>Dear Participant,</p>
          <p>Congratulations on successfully completing your training!</p>
          <div class="certificate-info">
            <strong>Course:</strong> ${courseTitle}<br>
            <strong>Training Dates:</strong> ${scheduleRange}
          </div>
          <p>Your official certificate is attached as a PDF.</p>
          <p><strong>Note:</strong> Keep this certificate for your professional records.</p>
          <p>Thank you for choosing Petrosphere Incorporated!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Petrosphere Incorporated. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return { subject, message }
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
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isDownloadingDirectory, setIsDownloadingDirectory] = useState(false)

  const [scheduleDateText, setScheduleDateText] = useState<string>("");
  const [batchNumber, setBatchNumber] = useState<number | null>(null); // ADD THIS LINE

  // ✅ NEW: Checkbox selection state
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // ✅ NEW: Email compose dialog state
  const [emailComposeOpen, setEmailComposeOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")

  // ✅ NEW: Templates availability state
  const [availableTemplates, setAvailableTemplates] = useState<Set<TemplateType>>(new Set())

  // Fetch available templates for this course
  useEffect(() => {
    if (!open || !scheduleId) return

    const fetchAvailable = async () => {
      // First get course ID for this schedule
      const { data: schedData } = await tmsDb
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()
        
      if (!schedData) return

      const { data } = await tmsDb
        .from("certificate_templates")
        .select("template_type, image_url")
        .eq("course_id", schedData.course_id)
      
      if (data) {
        const available = new Set<TemplateType>()
        data.forEach(t => {
          if (t.image_url) available.add(t.template_type as TemplateType)
        })
        setAvailableTemplates(available)
        
        // If current selection is not available, default to one that is
        if (!available.has(selectedTemplateType as TemplateType) && available.size > 0) {
          const firstAvailable = Array.from(available)[0]
          setSelectedTemplateType(firstAvailable)
        }
      }
    }

    fetchAvailable()
  }, [open, scheduleId, selectedTemplateType])

  // ✅ NEW: Certificate preview viewer state
  const [isCertificateViewerOpen, setIsCertificateViewerOpen] = useState(false)
  const [certificatePreviews, setCertificatePreviews] = useState<{ trainee: DownloadTrainee; url: string | null; error?: string }[]>([])
  const [activePreviewIndex, setActivePreviewIndex] = useState(0)
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false)
  const [layoutOffset, setLayoutOffset] = useState<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 })
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, any>>({})
  const [templateFields, setTemplateFields] = useState<{ id: string; label: string }[]>([])
  const [templateForViewer, setTemplateForViewer] = useState<{ imageUrl: string; fields: TemplateField[] } | null>(null)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [isSavingLayout, setIsSavingLayout] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(1)

  // ✅ NEW: Performance & Caching State
  const [generationDataMap, setGenerationDataMap] = useState<Map<string, CertificateGenerationData>>(new Map())
  const [isPreFetching, setIsPreFetching] = useState(false)
  const preFetchQueueRef = useRef<string[]>([])
  const isPreFetchingRunningRef = useRef(false)
  const [preFetchProgress, setPreFetchProgress] = useState(0)
  const [preFetchTotal, setPreFetchTotal] = useState(0)

  const isIdTemplateSelected = selectedTemplateType === "excellence"
  const canvasSize = useMemo(() => {
    return isIdTemplateSelected ? { w: 1350, h: 850 } : { w: 842, h: 595 }
  }, [isIdTemplateSelected])

  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const livePreviewTimerRef = useRef<number | null>(null)
  const livePreviewRequestIdRef = useRef(0)
  const dragStateRef = useRef<{
    fieldId: string | null
    mode: "move" | "resize" | "pan"
    dx: number
    dy: number
    handle?: "corner" | "right" | "bottom" | "left" | "top"
    startW?: number
    startH?: number
    startX?: number
    startY?: number
    startMouseX?: number
    startMouseY?: number
    startScrollLeft?: number
    startScrollTop?: number
  }>({ fieldId: null, mode: "move", dx: 0, dy: 0 })

  const handleFitToScreen = useCallback(() => {
    if (!previewContainerRef.current) return
    const isID = isIdTemplateSelected
    const canvasW = isID ? 1350 : 842
    const canvasH = isID ? 850 : 595

    // Use container dimensions, with a fallback if they are too small initially
    const containerW = Math.max(previewContainerRef.current.clientWidth, 400)
    const containerH = Math.max(previewContainerRef.current.clientHeight, 400)

    // Add 40px padding
    const scaleW = (containerW - 40) / canvasW
    const scaleH = (containerH - 40) / canvasH
    const fitScale = Math.min(scaleW, scaleH, 1.0)

    setPreviewZoom(Number(fitScale.toFixed(2)))
  }, [isIdTemplateSelected])

  // Auto-fit on open or template change
  useEffect(() => {
    if (isCertificateViewerOpen) {
      // Delay slightly to ensure container is rendered and has dimensions
      const timer = setTimeout(handleFitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [isCertificateViewerOpen, isIdTemplateSelected, handleFitToScreen])

  const getFontString = (field: TemplateField, canvasH: number) => {
    const px = Math.max(1, (field.fontSize || 0.02) * canvasH)
    const italic = field.fontStyle === "italic" ? "italic " : ""
    const weight =
      field.fontWeight === "extrabold"
        ? "900 "
        : field.fontWeight === "bold"
          ? "bold "
          : ""
    const family = field.fontFamily || "Helvetica"
    return `${italic}${weight}${px}px ${family}`
  }

  const formatDisguisedRange = (dates: Date[]) => {
    if (!dates.length) return ""
    const start = [...dates].sort((a, b) => a.getTime() - b.getTime())[0]
    const end = new Date(start)
    end.setDate(start.getDate() + (dates.length - 1))

    // Simple Range Formatting: "Month Day – Day, Year" or "Month Day – Month Day, Year"
    const startMonth = start.toLocaleString("en-US", { month: "long" })
    const endMonth = end.toLocaleString("en-US", { month: "long" })
    const startDay = start.getDate()
    const endDay = end.getDate()
    const year = start.getFullYear()

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`
    } else {
      const shortStart = start.toLocaleString("en-US", { month: "short" })
      const shortEnd = end.toLocaleString("en-US", { month: "short" })
      return `${shortStart}. ${startDay} – ${shortEnd}. ${endDay}, ${year}`
    }
  }

  const getDisplayText = (raw: string, trainee: DownloadTrainee) => {
    const genData = generationDataMap.get(trainee.id)
    let completionDate = new Date()
    let displayScheduleRange = scheduleRange

    if (genData) {
      if (genData.range_end_date) {
        completionDate = new Date(genData.range_end_date)
      } else if (genData.staggered_dates && genData.staggered_dates.length > 0) {
        const dates = genData.staggered_dates.map(d => new Date(d))
        const start = dates.sort((a, b) => a.getTime() - b.getTime())[0]

        // DISGUISE: Start Date to (Start Date + N-1 days)
        const disguisedEnd = new Date(start)
        disguisedEnd.setDate(start.getDate() + (dates.length - 1))

        completionDate = disguisedEnd
        displayScheduleRange = formatDisguisedRange(dates)
      }
    }

    const dateStr = completionDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })

    const fullName = `${trainee.first_name || ""} ${trainee.middle_initial ? trainee.middle_initial + ". " : ""}${trainee.last_name || ""}`.trim()
    return raw
      .replace(/\{\{trainee_name\}\}/g, fullName || "Trainee Name")
      .replace(/\{\{course_name\}\}/g, courseName)
      .replace(/\{\{course_title\}\}/g, courseName)
      .replace(/\{\{completion_date\}\}/g, dateStr)
      .replace(/\{\{certificate_number\}\}/g, trainee.certificate_number || "")
      .replace(/\{\{batch_number\}\}/g, trainee.batch_number?.toString() || "")
      .replace(/\{\{held_on\}\}/g, displayScheduleRange)
      .replace(/\{\{given_this\}\}/g, dateStr)
      .replace(/\{\{schedule_range\}\}/g, displayScheduleRange)
  }

  // Draw draggable preview (client-side) so you can drag instead of sliders
  useEffect(() => {
    if (!isCertificateViewerOpen) return
    const current = certificatePreviews[activePreviewIndex]
    if (!current?.trainee) return
    if (!templateForViewer?.imageUrl || !templateForViewer.fields?.length) return
    const canvas = previewCanvasRef.current
    if (!canvas) return

    canvas.width = canvasSize.w
    canvas.height = canvasSize.h
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const drawImageCover = (
      image: HTMLImageElement,
      dx: number,
      dy: number,
      dWidth: number,
      dHeight: number
    ) => {
      const iw = image.naturalWidth || image.width
      const ih = image.naturalHeight || image.height
      if (!iw || !ih || !dWidth || !dHeight) return

      const scale = Math.max(dWidth / iw, dHeight / ih)
      const sw = dWidth / scale
      const sh = dHeight / scale
      const sx = (iw - sw) / 2
      const sy = (ih - sh) / 2

      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dWidth, dHeight)
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const traineePhoto = new Image()
      const hasPhoto = !!current.trainee.picture_2x2_url

      const fields = templateForViewer.fields
      const drawFields = () => fields.forEach((f) => {
        const fo = fieldOverrides[f.id] || {}
        let normX = f.x + layoutOffset.offsetX
        let normY = f.y + layoutOffset.offsetY
        if (typeof fo.x === "number") normX = fo.x
        if (typeof fo.y === "number") normY = fo.y

        const x = normX * canvas.width
        const y = normY * canvas.height

        const isPhoto = f.value?.includes("{{trainee_picture}}")
        if (isPhoto) {
          const baseW = typeof f.boxWidth === "number" ? f.boxWidth * canvas.width : (f.fontSize || 0.12) * canvas.height
          const baseH = typeof f.boxHeight === "number" ? f.boxHeight * canvas.height : (f.fontSize || 0.12) * canvas.height
          const w = typeof fo.boxWidth === "number" ? fo.boxWidth * canvas.width : (typeof fo.fontSize === "number" ? fo.fontSize * canvas.height : baseW)
          const h = typeof fo.boxHeight === "number" ? fo.boxHeight * canvas.height : (typeof fo.fontSize === "number" ? fo.fontSize * canvas.height : baseH)
          ctx.setLineDash([6, 4])
          ctx.strokeStyle = f.id === activeFieldId ? "#0ea5e9" : "#22c55e"
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, w, h)
          ctx.setLineDash([])

          // Draw actual trainee photo if available and loaded
          if (hasPhoto && (traineePhoto.complete && (traineePhoto.naturalWidth || traineePhoto.width))) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(x, y, w, h)
            ctx.clip()
            drawImageCover(traineePhoto, x, y, w, h)
            ctx.restore()
          } else {
            // Fallback placeholder (helps debug CORS / missing photos)
            ctx.fillStyle = "rgba(0,0,0,0.35)"
            ctx.font = "12px Arial"
            ctx.textAlign = "center"
            ctx.fillText(
              hasPhoto ? "Photo not available" : "No photo",
              x + w / 2,
              y + h / 2
            )
          }
          return
        }

        ctx.font = getFontString(f, canvas.height)
        ctx.fillStyle = (typeof fo.color === "string" ? fo.color : f.color) || "#000000"
        ctx.textAlign = f.align === "center" ? "center" : f.align === "right" ? "right" : "left"

        const text = getDisplayText(f.value || "", current.trainee)
        const lines = text.split("\n")
        const fontPx = Math.max(1, (typeof fo.fontSize === "number" ? fo.fontSize : f.fontSize) * canvas.height)
        const lh = (f.lineHeight || 1.2) * fontPx

        let yy = y
        lines.forEach((line) => {
          ctx.fillText(line, x, yy)
          yy += lh
        })

        if (f.id === activeFieldId) {
          ctx.save()
          ctx.textAlign = "left"
          ctx.font = getFontString({ ...f, fontSize: (typeof fo.fontSize === "number" ? fo.fontSize : f.fontSize) }, canvas.height)
          const maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 10)
          let boxX = x
          if (f.align === "center") boxX = x - maxW / 2
          if (f.align === "right") boxX = x - maxW
          ctx.strokeStyle = "#0ea5e9"
          ctx.lineWidth = 2
          ctx.strokeRect(boxX - 6, y - fontPx, maxW + 12, lines.length * lh + 8)
          ctx.restore()
        }
      })

      if (hasPhoto) {
        traineePhoto.onload = () => {
          // redraw background and fields once photo is loaded
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          drawFields()
        }
        traineePhoto.onerror = () => {
          // Try again without any special settings (some hosts break when crossOrigin is set)
          // If this still fails, we keep the placeholder text in the photo box.
          try {
            const retry = new Image()
            retry.onload = () => {
              // swap in successful image and redraw
              ; (traineePhoto as any).src = retry.src
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              // drawFields will now see retry-loaded dimensions via traineePhoto.complete check on next tick
              drawImageCover(retry, 0, 0, 1, 1) // no-op warm-up
              // draw with retry directly
              fields.forEach((f) => {
                if (!f.value?.includes("{{trainee_picture}}")) return
                const fo = fieldOverrides[f.id] || {}
                let normX = f.x + layoutOffset.offsetX
                let normY = f.y + layoutOffset.offsetY
                if (typeof fo.x === "number") normX = fo.x
                if (typeof fo.y === "number") normY = fo.y
                const x = normX * canvas.width
                const y = normY * canvas.height
                const size = (typeof fo.fontSize === "number" ? fo.fontSize : f.fontSize) * canvas.height
                ctx.save()
                ctx.beginPath()
                ctx.rect(x, y, size, size)
                ctx.clip()
                drawImageCover(retry, x, y, size, size)
                ctx.restore()
              })
              drawFields()
            }
            retry.onerror = () => {
              drawFields()
            }
            retry.src = current.trainee.picture_2x2_url!
          } catch {
            drawFields()
          }
        }
        traineePhoto.src = current.trainee.picture_2x2_url!
      }

      drawFields()
    }
    img.src = templateForViewer.imageUrl
  }, [
    isCertificateViewerOpen,
    activePreviewIndex,
    templateForViewer,
    fieldOverrides,
    layoutOffset.offsetX,
    layoutOffset.offsetY,
    activeFieldId,
    canvasSize.w,
    canvasSize.h,
    courseName,
    scheduleRange,
  ])



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

      toast({
        title: "Database Statistics",
        description: `Total Records: ${data.records}\n` +
          `Database Exists: ${data.exists ? "Yes" : "No"}\n` +
          `Hostinger Configured: ${data.hostinger_configured ? "Yes" : "No"}`
      })
    } catch (error: any) {
      console.error("Error fetching stats:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch database statistics"
      })
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
        toast({
          title: "Success",
          description: `Database reset successfully!\nBackup: ${data.backup_file}\nTimestamp: ${data.timestamp}`
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Reset failed: ${data.error}`
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to reset: ${error.message}`
      })
    }
  }

  const handleBackupDatabase = async () => {
    startLongOperation("Creating Backup", "Backing up master database... This may take up to a minute due to server cold start.")

    try {
      const data = await callDatabaseAPI('backup', 'GET')

      if (data.status === "success") {
        toast({
          title: "Success",
          description: `Backup created!\n\nFile: ${data.backup_file}\nSize: ${(data.file_size / 1024).toFixed(2)} KB\nTimestamp: ${data.timestamp}`
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Backup failed: ${data.error}`
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed: ${error.message}`
      })
    }
  }

  const handleDeleteAllRecords = async () => {
    if (!confirm("⚠️ WARNING: Delete ALL records?")) return

    startLongOperation("Deleting Records", "Deleting all records... This may take up to a minute due to server cold start.")

    try {
      const data = await callDatabaseAPI('delete-all-records', 'POST')

      if (data.status === "success") {
        toast({
          title: "Success",
          description: `Deleted ${data.records_deleted} records.`
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Delete failed: ${data.error}`
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete: ${error.message}`
      })
    }
  }

  // PART 2 OF 3 - Continue from Part 1

  const ensureCertificateNumbers = async () => {
    if (!scheduleId) return

    try {
      const { data: scheduleData } = await tmsDb
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()

      if (!scheduleData) return

      const { data: courseData } = await tmsDb
        .from("courses")
        .select("id, name")
        .eq("id", scheduleData.course_id)
        .single()

      if (!courseData) return

      const traineesNeedingSerials = trainees.filter((t) => !t.certificate_number)

      if (traineesNeedingSerials.length > 0) {
        toast({
          title: "Generating Certificate Numbers",
          description: `Generating serial numbers for ${traineesNeedingSerials.length} trainee(s)...`,
        })

        await batchAssignCertificateSerials(
          trainees,
          courseData.id,
          courseData.name
        )

        await fetchTrainees()

        toast({
          title: "Success",
          description: "Certificate numbers generated successfully!",
        })
      }
    } catch (error) {
      console.error("Error ensuring certificate numbers:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate certificate numbers"
      })
    }
  }

  useEffect(() => {
    if (open && scheduleId) {
      fetchTrainees().then(() => {
        ensureCertificateNumbers()
      })
      fetchCertificateGenerationData()
      fetchScheduleStatus()
      setSelectedTraineeIds(new Set())
      setSelectAll(false)
      // Clean any existing preview URLs when dialog is reopened or template changed
      setCertificatePreviews(prev => {
        prev.forEach(p => {
          if (p.url) URL.revokeObjectURL(p.url)
        })
        return []
      })
    }
  }, [open, scheduleId, selectedTemplateType])

  // When active preview changes, load its layout override
  useEffect(() => {
    if (!isCertificateViewerOpen || certificatePreviews.length === 0) return
    loadLayoutOverrideForActive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewIndex, isCertificateViewerOpen])

  // Live preview: regenerate current participant PDF while adjusting sliders (debounced)
  useEffect(() => {
    if (!isCertificateViewerOpen) return
    const current = certificatePreviews[activePreviewIndex]
    if (!current) return

    // debounce
    if (livePreviewTimerRef.current) {
      window.clearTimeout(livePreviewTimerRef.current)
    }

    livePreviewTimerRef.current = window.setTimeout(async () => {
      const requestId = ++livePreviewRequestIdRef.current
      try {
        const res = await fetch("/api/generate-certificate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainee: current.trainee,
            courseName,
            courseTitle: courseName,
            scheduleRange,
            courseId: current.trainee.course_id,
            templateType: selectedTemplateType,
            givenThisDate: new Date().toLocaleDateString(),
            layoutOverride: {
              offsetX: layoutOffset.offsetX,
              offsetY: layoutOffset.offsetY,
              fieldOverrides,
            },
          }),
        })

        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)

        // ignore stale responses
        if (requestId !== livePreviewRequestIdRef.current) {
          URL.revokeObjectURL(url)
          return
        }

        setCertificatePreviews((prev) =>
          prev.map((item, idx) => {
            if (idx !== activePreviewIndex) return item
            if (item.url) URL.revokeObjectURL(item.url)
            return { ...item, url, error: undefined }
          })
        )
      } catch {
        // ignore
      }
    }, 350)

    return () => {
      if (livePreviewTimerRef.current) {
        window.clearTimeout(livePreviewTimerRef.current)
        livePreviewTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCertificateViewerOpen,
    activePreviewIndex,
    selectedTemplateType,
    layoutOffset.offsetX,
    layoutOffset.offsetY,
    fieldOverrides,
  ])

  const handleDownloadCertificates = async () => {
    if (!scheduleId) return;

    const selectedTrainees = getSelectedTrainees();
    if (selectedTrainees.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one participant to download certificates.",
      });
      return;
    }

    setIsGenerating(true);
    startLongOperation(
      "Generating Certificates",
      "Preparing downloads... This may take up to a minute due to server cold start."
    );

    try {
      console.log("📊 Starting certificate download for", selectedTrainees.length, "selected trainees");

      const { data: scheduleData } = await tmsDb
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single();

      if (!scheduleData) throw new Error("Missing schedule data");

      const { data: courseData } = await tmsDb
        .from("courses")
        .select("id, name, title, serial_number, serial_number_pad")
        .eq("id", scheduleData.course_id)
        .single();

      if (!courseData) throw new Error("Missing course data");

      const courseTitle = courseData.title || courseData.name;
      const serialBase = Number(courseData.serial_number ?? 1);
      const serialPad = Number(courseData.serial_number_pad ?? 5);

      // Sort trainees alphabetically by last name + first name
      const sortedTrainees = [...selectedTrainees].sort((a, b) => {
        const aName = `${a.last_name} ${a.first_name}`.toLowerCase();
        const bName = `${b.last_name} ${b.first_name}`.toLowerCase();
        return aName.localeCompare(bName);
      });

      // Assign serials without saving to DB
      const updatedTrainees = sortedTrainees.map((trainee, index) => {
        const serial = serialBase + index + 1;
        const padded = serial.toString().padStart(serialPad, "0");
        const certificate_number = `PSI-${courseData.name}-${padded}`;
        return { ...trainee, certificate_number };
      });

      const { data: templateCheck } = await tmsDb
        .from("certificate_templates")
        .select("template_type")
        .eq("course_id", courseData.id)
        .eq("template_type", selectedTemplateType)
        .maybeSingle();

      if (!templateCheck) {
        toast({
          variant: "destructive",
          title: "Template Not Found",
          description: `No ${selectedTemplateType} template found for this course.\n\nPlease create a ${selectedTemplateType} template first in the template editor.`
        });
        setIsGenerating(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < updatedTrainees.length; i++) {
        const trainee = updatedTrainees[i];

        try {
          await downloadFromServer(
            trainee,
            selectedTemplateType,
            courseData.name,
            scheduleRange,
            new Date().toLocaleDateString(),
            courseTitle,
            isCertificateViewerOpen ? {
              offsetX: layoutOffset.offsetX,
              offsetY: layoutOffset.offsetY,
              fieldOverrides,
            } : undefined
          );
          successCount++;

          setProgress(Math.floor(((i + 1) / updatedTrainees.length) * 100));
        } catch (error: any) {
          failCount++;
          console.error(`Failed to download for ${trainee.first_name} ${trainee.last_name}:`, error);
        }
      }

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${successCount} certificate(s).` +
          (failCount > 0 ? `\n${failCount} failed.` : "")
      });
    } catch (err: any) {
      console.error("❌ Critical error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Critical error: ${err.message}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ✅ NEW: Generate inline preview PDFs for selected trainees (no download)
  const handleOpenCertificateViewer = async () => {
    if (!scheduleId) return

    const selectedTrainees = getSelectedTrainees()
    if (selectedTrainees.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one participant to view certificates.",
      })
      return
    }

    setIsLoadingPreviews(true)
    setProgress(0)
    startLongOperation(
      "Generating Certificate Previews",
      "Rendering certificates for selected participants..."
    )

    try {
      const { data: scheduleData } = await tmsDb
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()

      if (!scheduleData) throw new Error("Missing schedule data")

      const { data: courseData } = await tmsDb
        .from("courses")
        .select("id, name, title, serial_number, serial_number_pad")
        .eq("id", scheduleData.course_id)
        .single()

      if (!courseData) throw new Error("Missing course data")

      const courseTitle = courseData.title || courseData.name
      const serialBase = Number(courseData.serial_number ?? 1)
      const serialPad = Number(courseData.serial_number_pad ?? 5)

      // Load template fields for per-field controls
      const { data: templateData } = await tmsDb
        .from("certificate_templates")
        .select("fields, image_url")
        .eq("course_id", courseData.id)
        .eq("template_type", selectedTemplateType)
        .maybeSingle()

      if (templateData?.fields) {
        setTemplateFields(
          (templateData.fields as any[]).map((f) => ({
            id: f.id as string,
            label: (f.label as string) || (f.id as string),
          }))
        )
        setTemplateForViewer({
          imageUrl: (templateData as any).image_url as string,
          fields: templateData.fields as any,
        })
      } else {
        setTemplateFields([])
        setTemplateForViewer(null)
      }

      // Sort trainees alphabetically to keep consistent serial assignment
      const sortedTrainees = [...selectedTrainees].sort((a, b) => {
        const aName = `${a.last_name} ${a.first_name}`.toLowerCase()
        const bName = `${b.last_name} ${b.first_name}`.toLowerCase()
        return aName.localeCompare(bName)
      })

      // Assign serials without saving to DB
      const updatedTrainees: DownloadTrainee[] = sortedTrainees.map((trainee, index) => {
        const serial = serialBase + index + 1
        const padded = serial.toString().padStart(serialPad, "0")
        const certificate_number = `PSI-${courseData.name}-${padded}`
        return { ...trainee, certificate_number }
      })

      const previews: { trainee: DownloadTrainee; url: string | null; error?: string }[] = []

      for (let i = 0; i < updatedTrainees.length; i++) {
        const trainee = updatedTrainees[i]
        const genData = generationDataMap.get(trainee.id)

        // Check if we already have a background-generated URL in the existing State
        const existingPreview = certificatePreviews.find(p => p.trainee.id === trainee.id)
        if (existingPreview?.url) {
          previews.push({ ...existingPreview, trainee }) // reuse the URL
          setProgress(Math.round(((i + 1) / updatedTrainees.length) * 100))
          continue
        }

        try {
          const res = await fetch("/api/generate-certificate-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trainee,
              courseName: courseData.name,
              courseTitle,
              scheduleRange,
              courseId: trainee.course_id,
              templateType: selectedTemplateType,
              precomputed: genData ? {
                layout: {
                  offsetX: genData.offset_x,
                  offsetY: genData.offset_y,
                  fieldOverrides: genData.field_overrides
                }
              } : undefined
            }),
          })

          if (!res.ok) {
            const text = await res.text()
            previews.push({
              trainee,
              url: null,
              error: text.substring(0, 200) || "Failed to generate preview",
            })
          } else {
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            previews.push({ trainee, url })
          }

          setProgress(Math.floor(((i + 1) / updatedTrainees.length) * 100))
        } catch (err: any) {
          previews.push({
            trainee,
            url: null,
            error: err?.message || "Failed to generate preview",
          })
        }
      }

      setCertificatePreviews(previews)
      setActivePreviewIndex(0)
      setIsCertificateViewerOpen(true)

      toast({
        title: "Previews Ready",
        description: "Certificate previews generated. You can now review them before sending or downloading.",
      })
    } catch (err: any) {
      console.error("❌ Error generating previews:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to generate certificate previews.",
      })
    } finally {
      setIsLoadingPreviews(false)
    }
  }

  const fetchTrainees = async () => {
    if (!scheduleId) return

    setLoading(true)
    try {
      // ADD THIS: Fetch schedule batch number
      const { data: scheduleData } = await tmsDb
        .from("schedules")
        .select("batch_number")
        .eq("id", scheduleId)
        .single()

      if (scheduleData) {
        setBatchNumber(scheduleData.batch_number)
      }
      const { data, error } = await tmsDb
        .from("trainings")
        .select("id, first_name, last_name, middle_initial, schedule_id, picture_2x2_url, status, email, certificate_number, course_id, batch_number")
        .eq("schedule_id", scheduleId)
        .order("last_name", { ascending: true })

      if (error) {
        console.error("Error fetching trainees:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch trainees: " + error.message,
        })
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
      const { data, error } = await tmsDb
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

  // ✅ NEW: Bulk fetch all data needed for certificates via the new view
  const fetchCertificateGenerationData = async () => {
    if (!scheduleId || !open) return

    setIsPreFetching(true)
    try {
      const { data, error } = await tmsDb
        .from("v_certificate_generation_data")
        .select("*")
        .eq("schedule_id", scheduleId)

      if (error) {
        console.error("❌ Error pre-fetching generation data:", error)
      } else if (data) {
        const newMap = new Map<string, CertificateGenerationData>()
        data.forEach((item: any) => {
          // Keep only the override for the currently selected template type if available
          if (!item.override_template_type || item.override_template_type === selectedTemplateType) {
            newMap.set(item.training_id, item as CertificateGenerationData)
          }
        })
        setGenerationDataMap(newMap)
        console.log("🚀 Pre-fetched layout data for", newMap.size, "participants")

        // Initialize background pre-fetching queue
        preFetchQueueRef.current = Array.from(newMap.keys())
        setPreFetchTotal(newMap.size)
        setPreFetchProgress(0)
      }
    } catch (err) {
      console.error("Unexpected error in pre-fetch:", err)
    } finally {
      setIsPreFetching(false)
    }
  }

  // ✅ NEW: Background Pre-fetching (Silent Cache)
  useEffect(() => {
    if (generationDataMap.size === 0 || isPreFetchingRunningRef.current || !open) return

    const processQueue = async () => {
      if (preFetchQueueRef.current.length === 0 || !open) {
        isPreFetchingRunningRef.current = false
        return
      }

      isPreFetchingRunningRef.current = true
      const traineeId = preFetchQueueRef.current.shift()
      if (!traineeId) {
        isPreFetchingRunningRef.current = false
        return
      }

      // Skip if already has a preview
      const hasPreview = certificatePreviews.some(p => p.trainee.id === traineeId && p.url)
      if (hasPreview) {
        setTimeout(processQueue, 50)
        return
      }

      const genData = generationDataMap.get(traineeId)
      if (!genData) {
        setTimeout(processQueue, 50)
        return
      }

      try {
        const res = await fetch("/api/generate-certificate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainee: {
              id: genData.training_id,
              first_name: genData.first_name,
              last_name: genData.last_name,
              middle_initial: genData.middle_initial,
              picture_2x2_url: genData.picture_2x2_url,
              certificate_number: genData.certificate_number,
              batch_number: genData.batch_number,
              schedule_id: genData.schedule_id,
              course_id: genData.course_id,
            },
            courseName: genData.course_name,
            courseTitle: genData.course_title,
            courseId: genData.course_id,
            templateType: selectedTemplateType,
            precomputed: {
              layout: {
                offsetX: genData.offset_x,
                offsetY: genData.offset_y,
                fieldOverrides: genData.field_overrides
              }
            }
          }),
        })

        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)

          setCertificatePreviews(prev => {
            // Find if there's an existing placeholder
            const existingIndex = prev.findIndex(p => p.trainee.id === traineeId)
            if (existingIndex >= 0) {
              const newPreviews = [...prev]
              newPreviews[existingIndex] = { ...newPreviews[existingIndex], url }
              return newPreviews
            }
            return prev
          })
        }
        setPreFetchProgress(prev => prev + 1)
      } catch (e) {
        console.warn("Silent pre-fetch failed for", traineeId, e)
      }

      // Next one after a short delay to keep CPU low
      setTimeout(processQueue, 1000)
    }

    processQueue()
  }, [generationDataMap, open, selectedTemplateType, certificatePreviews])

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
        const { data, error } = await tmsDb
          .from("trainings")
          .update({ picture_2x2_url: result.url })
          .eq("id", selectedTrainee.id)
          .select()
          .single()

        if (error) {
          console.error("❌ Failed to update picture in database:", error)
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update picture in database: " + error.message,
          })
        } else if (data) {
          console.log("✅ Picture updated successfully:", data)

          setSelectedTrainee((prev: any) => ({
            ...prev,
            picture_2x2_url: result.url,
          }))

          setTrainees((prev) =>
            prev.map((t) => (t.id === selectedTrainee.id ? { ...t, picture_2x2_url: result.url } : t))
          )

          toast({
            title: "Success",
            description: "Picture updated successfully!",
          })
        }
      } else {
        console.error("Upload failed:", result.error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Upload failed: " + result.error,
        })
      }
    } catch (error: any) {
      console.error("Upload error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred during upload: " + error.message,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadExcel = async () => {
    if (!scheduleId) return

    setIsDownloadingDirectory(true)
    toast({
      title: "Downloading Participant Directory",
      description: "Preparing Excel file... This may take up to a minute due to server cold start.",
    })

    try {
      await exportTraineeExcel(scheduleId, scheduleRange)
      toast({
        title: "Success",
        description: "Download complete!",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download directory.",
      })
    } finally {
      setIsDownloadingDirectory(false)
    }
  }


  // ✅ NEW: Open email compose dialog
  const handleOpenEmailCompose = async () => {
    const selectedTrainees = getSelectedTrainees()
    if (selectedTrainees.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one participant to send certificates.",
      })
      return
    }

    await ensureCertificateNumbers()

    // Fetch course title for email
    if (scheduleId) {
      const { data: scheduleData } = await tmsDb
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()

      if (scheduleData) {
        const { data: courseData } = await tmsDb
          .from("courses")
          .select("title, name")
          .eq("id", scheduleData.course_id)
          .single()

        if (courseData) {
          const courseTitle = courseData.title || courseData.name
          const { subject, message } = generateDefaultEmailContent(
            courseData.name,
            courseTitle,
            scheduleRange
          )
          setEmailSubject(subject)
          setEmailMessage(message)
        }
      }
    }

    setEmailComposeOpen(true)
  }

  const handleSendCertificatesWithEmail = async (customSubject: string, customMessage: string, attachments: string[]) => {
    setEmailComposeOpen(false)
    setIsSendingEmails(true)
    setProgress(0)

    startLongOperation(
      "Sending Certificates",
      `Preparing to send certificates with ${attachments.length} attachment(s) each...`
    )

    try {
      const selectedIds = Array.from(selectedTraineeIds)

      const response = await fetch("/api/send-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          templateType: selectedTemplateType,
          attachments,
          selectedTraineeIds: selectedIds,
          customEmailSubject: customSubject,
          customEmailMessage: customMessage,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to send certificates.",
        })
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
                // Removed alertMessage update to avoid toast spam
              } else if (data.type === "complete") {
                setProgress(100)
                toast({
                  title: "Done",
                  description: `Successfully sent ${data.successCount} certificate(s). ${data.failCount > 0 ? `${data.failCount} failed.` : ""}`,
                })
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while sending certificates.",
      })
      setIsSendingEmails(false)
    }
  }

  // ✅ NEW: Load layout override for the currently active preview
  const loadLayoutOverrideForActive = async () => {
    const current = certificatePreviews[activePreviewIndex]
    if (!current) {
      setLayoutOffset({ offsetX: 0, offsetY: 0 })
      setFieldOverrides({})
      return
    }

    try {
      const params = new URLSearchParams({
        trainingId: current.trainee.id,
        templateType: selectedTemplateType,
      })
      const res = await fetch(`/api/certificate-layout-overrides?${params.toString()}`)
      if (!res.ok) {
        setLayoutOffset({ offsetX: 0, offsetY: 0 })
        return
      }
      const data = await res.json()
      const override = data?.override
      setLayoutOffset({
        offsetX: typeof override?.offset_x === "number" ? override.offset_x : 0,
        offsetY: typeof override?.offset_y === "number" ? override.offset_y : 0,
      })
      setFieldOverrides(override?.field_overrides || {})
    } catch {
      setLayoutOffset({ offsetX: 0, offsetY: 0 })
      setFieldOverrides({})
    }
  }

  // ✅ NEW: Save layout offset for the current participant and refresh its preview
  const handleSaveLayoutOffset = async () => {
    const current = certificatePreviews[activePreviewIndex]
    if (!current) return

    setIsSavingLayout(true)
    try {
      await fetch("/api/certificate-layout-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingId: current.trainee.id,
          templateType: selectedTemplateType,
          offsetX: layoutOffset.offsetX,
          offsetY: layoutOffset.offsetY,
          fieldOverrides,
        }),
      })

      // Regenerate this single preview to reflect new layout
      const res = await fetch("/api/generate-certificate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainee: current.trainee,
          courseName,
          courseTitle: courseName,
          scheduleRange,
          courseId: current.trainee.course_id,
          templateType: selectedTemplateType,
          precomputed: {
            layout: {
              offsetX: layoutOffset.offsetX,
              offsetY: layoutOffset.offsetY,
              fieldOverrides
            }
          }
        }),
      })

      // Update local generation data map so future pre-fetches for this trainee are correct
      setGenerationDataMap(prev => {
        const next = new Map(prev)
        const currentData = next.get(current.trainee.id)
        if (currentData) {
          next.set(current.trainee.id, {
            ...currentData,
            offset_x: layoutOffset.offsetX,
            offset_y: layoutOffset.offsetY,
            field_overrides: fieldOverrides
          })
        }
        return next
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)

        setCertificatePreviews(prev =>
          prev.map((item, index) => {
            if (index !== activePreviewIndex) return item
            if (item.url) URL.revokeObjectURL(item.url)
            return { ...item, url, error: undefined }
          })
        )
      }
    } catch (e) {
      console.error("Error saving layout offset:", e)
    } finally {
      setIsSavingLayout(false)
    }
  }

  const hitTestFieldAt = (canvasX: number, canvasY: number) => {
    const current = certificatePreviews[activePreviewIndex]
    const canvas = previewCanvasRef.current
    if (!current?.trainee || !canvas || !templateForViewer) return null
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    // Top-most match wins, so iterate reverse
    const fields = [...templateForViewer.fields].reverse()
    for (const f of fields) {
      const fo = fieldOverrides[f.id] || {}
      let normX = f.x + layoutOffset.offsetX
      let normY = f.y + layoutOffset.offsetY
      if (typeof fo.x === "number") normX = fo.x
      if (typeof fo.y === "number") normY = fo.y

      const x = normX * canvas.width
      const y = normY * canvas.height

      const isPhoto = f.value?.includes("{{trainee_picture}}")
      if (isPhoto) {
        const baseW = typeof f.boxWidth === "number" ? f.boxWidth * canvas.width : (f.fontSize || 0.12) * canvas.height
        const baseH = typeof f.boxHeight === "number" ? f.boxHeight * canvas.height : (f.fontSize || 0.12) * canvas.height
        const w = typeof fo.boxWidth === "number" ? fo.boxWidth * canvas.width : (typeof fo.fontSize === "number" ? fo.fontSize * canvas.height : baseW)
        const h = typeof fo.boxHeight === "number" ? fo.boxHeight * canvas.height : (typeof fo.fontSize === "number" ? fo.fontSize * canvas.height : baseH)
        const boxW = Number.isFinite(w) ? w : 100
        const boxH = Number.isFinite(h) ? h : 100

        if (canvasX >= x && canvasX <= x + boxW && canvasY >= y && canvasY <= y + boxH) {
          // check handles first
          const handleSize = 10
          const sidePad = 6
          const inCorner = canvasX >= x + boxW - handleSize && canvasY >= y + boxH - handleSize
          const rightHit = canvasX >= x + boxW - sidePad && canvasX <= x + boxW + sidePad
          const bottomHit = canvasY >= y + boxH - sidePad && canvasY <= y + boxH + sidePad
          const leftHit = canvasX >= x - sidePad && canvasX <= x + sidePad
          const topHit = canvasY >= y - sidePad && canvasY <= y + sidePad

          const handle = inCorner
            ? ("corner" as const)
            : rightHit
              ? ("right" as const)
              : bottomHit
                ? ("bottom" as const)
                : leftHit
                  ? ("left" as const)
                  : topHit
                    ? ("top" as const)
                    : undefined

          return { id: f.id, anchorX: x, anchorY: y, handle, boxW, boxH }
        }
        continue
      }

      ctx.font = getFontString(f, canvas.height)
      ctx.textAlign = "left"
      const text = getDisplayText(f.value || "", current.trainee)
      const lines = text.split("\n")
      const fontPx = Math.max(1, (typeof fo.fontSize === "number" ? fo.fontSize : f.fontSize) * canvas.height)
      const lh = (f.lineHeight || 1.2) * fontPx
      const maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 10)

      let boxX = x
      if (f.align === "center") boxX = x - maxW / 2
      if (f.align === "right") boxX = x - maxW
      const boxY = y - fontPx
      const boxH = lines.length * lh + 8

      if (canvasX >= boxX - 6 && canvasX <= boxX + maxW + 6 && canvasY >= boxY && canvasY <= boxY + boxH) {
        return { id: f.id, anchorX: x, anchorY: y }
      }
    }
    return null
  }

  const handlePreviewCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    // Check if we hit a field
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const hit = hitTestFieldAt(x, y)
    if (hit) {
      setActiveFieldId(hit.id)
      if ((hit as any).handle) {
        dragStateRef.current = {
          fieldId: hit.id,
          mode: "resize",
          dx: 0,
          dy: 0,
          handle: (hit as any).handle,
          startW: (hit as any).boxW,
          startH: (hit as any).boxH,
          startX: hit.anchorX,
          startY: hit.anchorY,
          startMouseX: x,
          startMouseY: y,
        }
      } else {
        dragStateRef.current = { fieldId: hit.id, mode: "move", dx: x - hit.anchorX, dy: y - hit.anchorY }
      }
    } else {
      // Pan mode
      const container = canvas.parentElement
      if (container) {
        dragStateRef.current = {
          fieldId: null,
          mode: "pan",
          dx: 0,
          dy: 0,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startScrollLeft: container.scrollLeft,
          startScrollTop: container.scrollTop
        }
        canvas.style.cursor = "grabbing"
      }
    }
  }

  const handlePreviewCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current
    const ds = dragStateRef.current
    if (!canvas) return

    if (ds.mode === "pan") {
      const container = canvas.parentElement
      if (container && ds.startMouseX !== undefined && ds.startMouseY !== undefined) {
        const dx = e.clientX - ds.startMouseX
        const dy = e.clientY - ds.startMouseY
        container.scrollLeft = (ds.startScrollLeft ?? 0) - dx
        container.scrollTop = (ds.startScrollTop ?? 0) - dy
      }
      return
    }

    if (!ds.fieldId) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    if (ds.mode === "resize") {
      const dx = x - (ds.startMouseX ?? x)
      const dy = y - (ds.startMouseY ?? y)
      const minPx = 30

      let nextX = ds.startX ?? 0
      let nextY = ds.startY ?? 0
      let nextW = ds.startW ?? 100
      let nextH = ds.startH ?? 100

      if (ds.handle === "corner") {
        const delta = Math.max(dx, dy)
        const s = Math.max(minPx, Math.min((ds.startW ?? 100) + delta, (ds.startH ?? 100) + delta))
        nextW = s
        nextH = s
      } else if (ds.handle === "right") {
        nextW = Math.max(minPx, (ds.startW ?? 100) + dx)
      } else if (ds.handle === "bottom") {
        nextH = Math.max(minPx, (ds.startH ?? 100) + dy)
      } else if (ds.handle === "left") {
        const w = Math.max(minPx, (ds.startW ?? 100) - dx)
        nextX = (ds.startX ?? 0) + dx
        if (w === minPx) nextX = (ds.startX ?? 0) + ((ds.startW ?? 100) - minPx)
        nextW = w
      } else if (ds.handle === "top") {
        const h = Math.max(minPx, (ds.startH ?? 100) - dy)
        nextY = (ds.startY ?? 0) + dy
        if (h === minPx) nextY = (ds.startY ?? 0) + ((ds.startH ?? 100) - minPx)
        nextH = h
      }

      setFieldOverrides(prev => ({
        ...prev,
        [ds.fieldId!]: {
          ...(prev[ds.fieldId!] || {}),
          x: Math.min(1, Math.max(0, nextX / canvas.width)),
          y: Math.min(1, Math.max(0, nextY / canvas.height)),
          boxWidth: Math.min(1, Math.max(0, nextW / canvas.width)),
          boxHeight: Math.min(1, Math.max(0, nextH / canvas.height)),
        },
      }))
      return
    }

    const newAnchorX = x - ds.dx
    const newAnchorY = y - ds.dy
    const nx = newAnchorX / canvas.width
    const ny = newAnchorY / canvas.height

    setFieldOverrides(prev => ({
      ...prev,
      [ds.fieldId!]: {
        ...(prev[ds.fieldId!] || {}),
        x: Math.min(1, Math.max(0, nx)),
        y: Math.min(1, Math.max(0, ny)),
      },
    }))
  }

  const handlePreviewCanvasMouseUp = () => {
    const canvas = previewCanvasRef.current
    if (canvas) {
      canvas.style.cursor = "default"
    }
    dragStateRef.current = { fieldId: null, mode: "move", dx: 0, dy: 0 }
  }

  const handleSaveTrainee = async () => {
    if (!selectedTrainee) return

    console.log("Submitting update for:", selectedTrainee)

    const { data, error } = await tmsDb
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
    toast({
      title: title,
      description: message || "Please wait... This may take up to a minute due to server cold start.",
    })
  }

  // PART 3 OF 3 - JSX Return

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:w-[60vw] sm:w-[90vw] max-h-[90vh] overflow-y-auto pt-10 bg-card">

        <DialogHeader>
          <DialogTitle className="text-lg font-semibold bg-muted/50 border p-2 rounded-md flex justify-between items-center">
            Directory of Participants

            {/* Action Button Group */}
            <TooltipProvider>
              <div className="flex items-center gap-2">

                {/* Excel Download */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadExcel}
                      disabled={isDownloadingDirectory}
                      className="cursor-pointer"
                    >
                      {isDownloadingDirectory ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Excel
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Download participant directory as Excel file
                  </TooltipContent>
                </Tooltip>

                {/* Database Stats */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchDatabaseStats}
                      disabled={isLoadingStats}
                      className="cursor-pointer"
                    >
                      <Database className="mr-2 h-4 w-4" />
                      Stats
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    View master database statistics
                  </TooltipContent>
                </Tooltip>

                {/* Backup */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackupDatabase}
                      className="cursor-pointer"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Backup
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Create a backup of the master database
                  </TooltipContent>
                </Tooltip>

                {/* Reset */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white cursor-pointer"
                      onClick={handleResetDatabase}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Reset the entire database (creates backup first)
                  </TooltipContent>
                </Tooltip>

                {/* Delete All */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAllRecords}
                      className="cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Delete ALL training records (dangerous)
                  </TooltipContent>
                </Tooltip>

              </div>
            </TooltipProvider>

          </DialogTitle>
        </DialogHeader>


        <div className="bg-yellow-400 dark:bg-blue-950 dark:text-white p-4 rounded-md">
          <div className="text-sm font-semibold uppercase mb-1">
            <Badge variant={getStatusBadgeVariant(scheduleStatus)} className="text-xs">
              {scheduleStatus}
            </Badge>
          </div>
          <div className="text-xl font-bold">
            {courseName}
            {batchNumber && (
              <span className="ml-2 text-lg font-normal">
                • Batch #{batchNumber}
              </span>
            )}
          </div>
          <div className="text-sm">{scheduleRange}</div>
        </div>

        <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
          <Label className="font-semibold">Certificate Template Type</Label>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {TEMPLATE_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = selectedTemplateType === option.value
              const isAvailable = availableTemplates.has(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (isAvailable) setSelectedTemplateType(option.value)
                  }}
                  disabled={!isAvailable}
                  className={`
                    inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border
                    ${isSelected ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20" : "bg-background hover:bg-muted text-foreground border-border"}
                    ${!isAvailable && "opacity-50 cursor-not-allowed bg-muted/50 text-muted-foreground border-dashed grayscale"}
                  `}
                  title={!isAvailable ? "Template not added for this course yet" : ""}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border rounded-md text-sm font-semibold px-4 py-2 bg-secondary flex justify-between items-center">
          <span>Attendee Details ({trainees.length} participants)</span>
          {preFetchTotal > 0 && preFetchProgress < preFetchTotal && (
            <div className="flex items-center gap-2 text-[10px] font-normal text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Caching Previews: {preFetchProgress}/{preFetchTotal}</span>
            </div>
          )}
        </div>

        {preFetchTotal > 0 && preFetchProgress < preFetchTotal && (
          <Progress value={(preFetchProgress / preFetchTotal) * 100} className="h-1" />
        )}

        {isSendingEmails && (
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-md p-4 mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Certificates via Email...
              </span>
              <span className="text-sm font-medium text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

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
              <TableHeader className="sticky top-0 bg-card z-10">
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

        <DialogFooter className="justify-between pt-4 gap-2 flex-wrap">
          <div className="w-full md:w-auto text-sm text-muted-foreground mb-2">
            {selectedTraineeIds.size > 0 ? (
              <span className="font-medium text-primary">
                {selectedTraineeIds.size} of {trainees.length} selected
              </span>
            ) : (
              <span>
                No participants selected. Please select participants to view certificates.
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end w-full md:w-auto">
            <Button
              variant="default"
              onClick={handleOpenCertificateViewer}
              disabled={isLoadingPreviews || trainees.length === 0 || selectedTraineeIds.size === 0}
            >
              {isLoadingPreviews ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Previews...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  View Certificates
                </>
              )}
            </Button>
          </div>
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
      {/* ✅ NEW: Certificate Preview Viewer */}
      <Dialog open={isCertificateViewerOpen} onOpenChange={setIsCertificateViewerOpen}>
        <DialogContent className="w-[98vw] max-w-7xl h-[94vh] flex flex-col p-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <span>Certificate Preview</span>
              {certificatePreviews.length > 0 && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {activePreviewIndex + 1} of {certificatePreviews.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 overflow-hidden mt-4 min-h-0">
            {/* Left Panel: Preview Container */}
            <div className="flex-[3] flex flex-col border rounded-lg overflow-hidden bg-background relative shadow-inner min-w-0">
              {/* Top Control Bar for Preview */}
              <div className="border-b bg-muted/30 p-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 px-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    Live Viewer
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))))}
                  >
                    -
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 px-2 text-xs font-medium"
                    onClick={() => setPreviewZoom(1)}
                  >
                    {Math.round(previewZoom * 100)}%
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
                  >
                    +
                  </Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFitToScreen}
                    className="h-7 text-[10px] px-2"
                  >
                    Fit to Screen
                  </Button>
                </div>
              </div>

              {/* Main Preview Work Area */}
              <div className="flex-1 relative flex items-center justify-center bg-muted/10 overflow-hidden group min-h-0">
                {/* Overlay Navigation: Previous */}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={certificatePreviews.length <= 1}
                  className="absolute left-2 z-20 h-10 w-10 rounded-full bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                  onClick={() =>
                    setActivePreviewIndex((prev) =>
                      prev === 0 ? certificatePreviews.length - 1 : prev - 1
                    )
                  }
                >
                  <ChevronLeft className="h-6 w-6 text-primary" />
                </Button>

                {/* Viewport content */}
                <div
                  ref={previewContainerRef}
                  className="w-full h-full overflow-auto flex items-center justify-center p-8 scrollbar-thin"
                >
                  {certificatePreviews.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground animate-in fade-in transition-all">
                      <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                      <span className="text-sm">Preparing Previews...</span>
                    </div>
                  ) : (
                    <div className="relative shadow-2xl transition-transform duration-200">
                      {/* Direct Editor Layer (Canvas) */}
                      {templateForViewer?.imageUrl && templateForViewer.fields?.length > 0 && (
                        <canvas
                          ref={previewCanvasRef}
                          className="cursor-crosshair bg-white"
                          style={{
                            transform: `scale(${previewZoom})`,
                            transformOrigin: "center center",
                            transition: dragStateRef.current.mode === "pan" ? "none" : "transform 0.1s ease-out"
                          }}
                          onMouseDown={handlePreviewCanvasMouseDown}
                          onMouseMove={handlePreviewCanvasMouseMove}
                          onMouseUp={handlePreviewCanvasMouseUp}
                          onMouseLeave={handlePreviewCanvasMouseUp}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Overlay Navigation: Next */}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={certificatePreviews.length <= 1}
                  className="absolute right-2 z-20 h-10 w-10 rounded-full bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-border/50"
                  onClick={() =>
                    setActivePreviewIndex((prev) =>
                      prev === certificatePreviews.length - 1 ? 0 : prev + 1
                    )
                  }
                >
                  <ChevronRight className="h-6 w-6 text-primary" />
                </Button>
              </div>

              {/* Bottom Tip bar */}
              <div className="border-t bg-muted/20 px-4 py-1.5 flex justify-between items-center bg-background/50 shrink-0">
                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                  Editor Mode Active
                </span>
                <span className="text-[10px] text-muted-foreground italic">
                  Drag markers to adjust field positions. Scroll to pan.
                </span>
              </div>
            </div>

            {/* Right Panel: Compact Controls */}
            <div className="w-80 flex flex-col gap-4 overflow-y-auto pr-2 py-1 shrink-0 scrollbar-hide">

              {preFetchTotal > 0 && preFetchProgress < preFetchTotal && (
                <div className="px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-primary">
                    <span className="uppercase tracking-wider">Generating Previews</span>
                    <span>{preFetchProgress} / {preFetchTotal}</span>
                  </div>
                  <Progress value={(preFetchProgress / preFetchTotal) * 100} className="h-1 bg-primary/10" />
                </div>
              )}

              {/* 1. Participant Summary & Actions */}
              <div className="border rounded-lg bg-card p-3 shadow-sm space-y-3">
                <div className="flex items-center gap-3 border-b pb-3">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage src={certificatePreviews[activePreviewIndex]?.trainee.picture_2x2_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {certificatePreviews[activePreviewIndex]?.trainee.first_name?.[0]}
                      {certificatePreviews[activePreviewIndex]?.trainee.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate leading-tight">
                      {certificatePreviews[activePreviewIndex]?.trainee.last_name}, {certificatePreviews[activePreviewIndex]?.trainee.first_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {selectedTemplateType.charAt(0).toUpperCase() + selectedTemplateType.slice(1)} Template
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start gap-2 h-9 shadow-sm"
                    onClick={() => {
                      if (selectedTraineeIds.size === 0) {
                        const current = certificatePreviews[activePreviewIndex]
                        if (!current) return
                        setSelectedTraineeIds(new Set([current.trainee.id]))
                      }
                      handleOpenEmailCompose()
                    }}
                    disabled={isSendingEmails}
                  >
                    {isSendingEmails ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {selectedTraineeIds.size > 1 
                      ? `Send to ${selectedTraineeIds.size} Selected` 
                      : "Send to Email"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 h-9 shadow-sm"
                    onClick={() => {
                      if (selectedTraineeIds.size === 0) {
                        const current = certificatePreviews[activePreviewIndex]
                        if (!current) return
                        setSelectedTraineeIds(new Set([current.trainee.id]))
                      }
                      handleDownloadCertificates()
                    }}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {selectedTraineeIds.size > 1 
                      ? `Download ${selectedTraineeIds.size} Selected` 
                      : "Download PDF"}
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-1 text-[11px] h-8"
                      onClick={() => {
                        const current = certificatePreviews[activePreviewIndex]
                        if (!current) return
                        setSelectedTrainee(current.trainee as any)
                        setIsTraineeDialogOpen(true)
                      }}
                    >
                      <PenSquare className="h-3 w-3" />
                      Edit Info
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-1 text-[11px] h-8"
                      onClick={() => {
                        const current = certificatePreviews[activePreviewIndex]
                        if (!current?.url) return
                        window.open(current.url, "_blank")
                      }}
                      disabled={!certificatePreviews[activePreviewIndex]?.url}
                    >
                      <Download className="h-3 w-3" />
                      PDF View
                    </Button>
                  </div>
                </div>
              </div>

              {/* 2. Layout Fine-Tuning */}
              {certificatePreviews[activePreviewIndex]?.trainee && (
                <div className="border rounded-lg bg-card p-3 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Layout Adjust</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10 font-bold"
                      onClick={handleSaveLayoutOffset}
                      disabled={isSavingLayout}
                    >
                      {isSavingLayout ? "Saving..." : "Save Override"}
                    </Button>
                  </div>

                  {/* Global Offsets */}
                  <div className="space-y-3 py-1">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-medium">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Global X Offset</Label>
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">
                          {(layoutOffset.offsetX * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Slider
                        value={[layoutOffset.offsetX]}
                        onValueChange={([v]) => setLayoutOffset(prev => ({ ...prev, offsetX: v }))}
                        min={-0.05}
                        max={0.05}
                        step={0.002}
                        className="py-2"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-medium">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Global Y Offset</Label>
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">
                          {(layoutOffset.offsetY * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Slider
                        value={[layoutOffset.offsetY]}
                        onValueChange={([v]) => setLayoutOffset(prev => ({ ...prev, offsetY: v }))}
                        min={-0.05}
                        max={0.05}
                        step={0.002}
                        className="py-2"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-border/50 mx-1" />

                  {/* Field Selection & Individual Tuning */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground font-bold">Selected Field</Label>
                      <Select
                        value={activeFieldId ?? ""}
                        onValueChange={(value) => setActiveFieldId(value || null)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="No field selected" />
                        </SelectTrigger>
                        <SelectContent>
                          {templateFields.map((f) => (
                            <SelectItem key={f.id} value={f.id} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {activeFieldId && (
                      <div className="space-y-3 pt-1 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-medium">
                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Field X Position</Label>
                            <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded text-primary">
                              {((fieldOverrides[activeFieldId]?.x ?? 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Slider
                            value={[fieldOverrides[activeFieldId]?.x ?? 0]}
                            onValueChange={([v]) =>
                              setFieldOverrides((prev) => ({
                                ...prev,
                                [activeFieldId]: { ...(prev[activeFieldId] || {}), x: v },
                              }))
                            }
                            min={0}
                            max={1}
                            step={0.002}
                            className="py-2"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-medium">
                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Field Y Position</Label>
                            <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded text-primary">
                              {((fieldOverrides[activeFieldId]?.y ?? 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Slider
                            value={[fieldOverrides[activeFieldId]?.y ?? 0]}
                            onValueChange={([v]) =>
                              setFieldOverrides((prev) => ({
                                ...prev,
                                [activeFieldId]: { ...(prev[activeFieldId] || {}), y: v },
                              }))
                            }
                            min={0}
                            max={1}
                            step={0.002}
                            className="py-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Horizontal strip of participants */}
          {certificatePreviews.length > 0 && (
            <div className="mt-4 border-t pt-3 shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="preview-select-all"
                    checked={selectedTraineeIds.size === certificatePreviews.length && certificatePreviews.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTraineeIds(new Set(certificatePreviews.map(p => p.trainee.id)))
                      } else {
                        setSelectedTraineeIds(new Set())
                      }
                    }}
                  />
                  <Label htmlFor="preview-select-all" className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">
                    Select All for Email
                  </Label>
                </div>
                <div className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">
                  {selectedTraineeIds.size} Selected
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {certificatePreviews.map((item, index) => (
                  <div key={item.trainee.id} className="relative group/card">
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs whitespace-nowrap transition-all pr-8 ${index === activePreviewIndex
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-muted hover:bg-muted/60"
                        }`}
                      onClick={() => setActivePreviewIndex(index)}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={item.trainee.picture_2x2_url} />
                        <AvatarFallback className="text-[10px]">
                          {item.trainee.first_name?.[0]}
                          {item.trainee.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {item.trainee.last_name}, {item.trainee.first_name}
                      </span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30">
                      <Checkbox 
                        checked={selectedTraineeIds.has(item.trainee.id)}
                        onCheckedChange={(checked) => {
                          const newIds = new Set(selectedTraineeIds)
                          if (checked) {
                            newIds.add(item.trainee.id)
                          } else {
                            newIds.delete(item.trainee.id)
                          }
                          setSelectedTraineeIds(newIds)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* ✅ NEW: Email Compose Dialog - Placed at the very end to ensure highest z-index over Certificate Preview */}
      <EmailComposeDialog
        open={emailComposeOpen}
        onOpenChange={setEmailComposeOpen}
        onSend={handleSendCertificatesWithEmail}
        defaultSubject={emailSubject}
        defaultMessage={emailMessage}
        recipientCount={getSelectedTrainees().length}
        availableTemplates={Array.from(availableTemplates)}
        selectedTemplateType={selectedTemplateType}
      />
    </Dialog>

  )
}