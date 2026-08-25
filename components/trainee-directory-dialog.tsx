// components\trainee-directory-dialog.tsx
"use client"

import JSZip from "jszip"

import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
import { Download, Mail, Loader2, Award, CalendarCheck, Trophy, MoreVertical, Database, RefreshCw, Trash2, PenSquare, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye, ListOrdered, Crop, Eraser, Minus, Plus, RotateCcw, FileStack, Files } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import { PDFDocument } from "pdf-lib"
import { exportTraineeExcel } from "@/lib/exports/export-excel"
import { exportCertificatesNew } from "@/lib/exports/export-certificate"
import { batchAssignCertificateSerials } from "@/lib/certificate-serial"
import {
  CERTIFICATE_PAGE_SIZES,
  DEFAULT_CERTIFICATE_PAGE_SIZE,
  ID_TEMPLATE_PAGE,
  type CertificatePageSizeKey,
} from "@/lib/certificate-page-sizes"
import {
  CERTIFICATE_FONT_OPTIONS,
  CERTIFICATE_FONT_WEIGHT_OPTIONS,
  canvasFontFamily,
  formatCertificateHolderDisplayName,
  type CertificateFontFamily,
  type CertificateFontWeight,
} from "@/lib/certificate-name"
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
  suffix?: string
  professional_title?: string | null
  picture_2x2_url?: string
  picture_2x2_original?: string | null
  schedule_id: string
  status?: string
  email?: string
  certificate_number?: string
  course_id: string
  batch_number?: number
  custom_data?: Record<string, any>
}

interface CertificateGenerationData {
  training_id: string;
  first_name: string;
  last_name: string;
  middle_initial?: string;
  suffix?: string;
  professional_title?: string | null;
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
  fontFamily: CertificateFontFamily
  color: string
  align: "left" | "center" | "right"
  lineHeight?: number
}

interface Trainee {
  id: string
  first_name: string
  last_name: string
  middle_initial?: string | null
  suffix?: string | null
  professional_title?: string | null
  picture_2x2_url?: string | null
  picture_2x2_original?: string | null
  id_picture_url?: string | null
  schedule_id: string
  status?: string | null
  email?: string | null
  phone_number?: string | null
  gender?: string | null
  age?: number | null
  mailing_street?: string | null
  mailing_city?: string | null
  mailing_province?: string | null
  region?: string | null
  employment_status?: string | null
  is_student?: boolean | null
  school_name?: string | null
  company_name?: string | null
  company_position?: string | null
  company_industry?: string | null
  company_email?: string | null
  company_landline?: string | null
  company_city?: string | null
  company_region?: string | null
  total_workers?: number | null
  certificate_number?: string | null
  training_provider?: string | null
  training_type?: string | null
  training_program?: string | null
  training_status?: string | null
  course_id: string
  batch_number?: number | null
  food_restriction?: string | null
  physical_cert_status?: string | null
  e_id_status?: string | null
  add_pvc_id?: boolean | null
  pvc_fee?: number | null
  payment_method?: string | null
  payment_status?: string | null
  amount_paid?: number | null
  custom_data?: Record<string, any>
}

const TRAINEE_DIRECTORY_SELECT = [
  "id",
  "first_name",
  "last_name",
  "middle_initial",
  "suffix",
  "professional_title",
  "schedule_id",
  "picture_2x2_url",
  "picture_2x2_original",
  "id_picture_url",
  "status",
  "email",
  "phone_number",
  "gender",
  "age",
  "mailing_street",
  "mailing_city",
  "mailing_province",
  "region",
  "employment_status",
  "is_student",
  "school_name",
  "company_name",
  "company_position",
  "company_industry",
  "company_email",
  "company_landline",
  "company_city",
  "company_region",
  "total_workers",
  "certificate_number",
  "training_provider",
  "training_type",
  "training_program",
  "training_status",
  "course_id",
  "batch_number",
  "food_restriction",
  "physical_cert_status",
  "e_id_status",
  "add_pvc_id",
  "pvc_fee",
  "payment_method",
  "payment_status",
  "amount_paid",
  "custom_data",
].join(", ")

type TemplateType = "participation" | "completion" | "excellence"

function getScheduleStatusPillClass(status: string) {
  const normalized = status?.toLowerCase().trim()
  switch (normalized) {
    case "finished":
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
    case "confirmed":
    case "ongoing":
      return "border-primary/25 bg-primary/10 text-primary dark:text-primary-foreground/90"
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    case "planned":
      return "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200"
    default:
      return "border-border/60 bg-muted/50 text-muted-foreground"
  }
}

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
  layoutOverride?: any,
  pageSize?: CertificatePageSizeKey
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
        layoutOverride,
        ...(templateType !== "excellence" && pageSize ? { pageSize } : {}),
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
  const [showPhotoCropDialog, setShowPhotoCropDialog] = useState(false)
  const [cropExistingPhoto, setCropExistingPhoto] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [bgRemoveProgress, setBgRemoveProgress] = useState("")
  const [bgJobExpanded, setBgJobExpanded] = useState(true)
  const [bgJobItems, setBgJobItems] = useState<Array<{
    id: string
    name: string
    status: "queued" | "running" | "done" | "skipped" | "error"
    detail: string
  }>>([])
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType>("completion")
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadPackageOpen, setDownloadPackageOpen] = useState(false)
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sentCertificateIds, setSentCertificateIds] = useState<Set<string>>(new Set())
  const [failedCertificateIds, setFailedCertificateIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isDownloadingDirectory, setIsDownloadingDirectory] = useState(false)
  const [isRefreshingSerials, setIsRefreshingSerials] = useState(false)

  const [scheduleDateText, setScheduleDateText] = useState<string>("");
  const [batchNumber, setBatchNumber] = useState<number | null>(null); // ADD THIS LINE

  // ✅ NEW: Checkbox selection state
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [attendeeSearch, setAttendeeSearch] = useState("")

  useEffect(() => {
    if (!isRemovingBg) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = "Background removal is still running. Do not close or refresh this tab."
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isRemovingBg])

  // ✅ NEW: Email compose dialog state
  const [emailComposeOpen, setEmailComposeOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")

  // ✅ NEW: Performance & Caching State - Move this higher to ensure it's available
  const [generationDataMap, setGenerationDataMap] = useState<Map<string, CertificateGenerationData>>(new Map())
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
  const [backTemplateForViewer, setBackTemplateForViewer] = useState<{ imageUrl: string; fields: TemplateField[] } | null>(null)
  const [idCardSide, setIdCardSide] = useState<"front" | "back">("front")
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [isSavingLayout, setIsSavingLayout] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [certificatePageSize, setCertificatePageSize] = useState<CertificatePageSizeKey>(
    DEFAULT_CERTIFICATE_PAGE_SIZE
  )
  const [inlineFieldEdit, setInlineFieldEdit] = useState<{
    fieldId: string
    kind: "name" | "certificate_number" | "email" | "batch_number"
    overlayStyle: { left: number; top: number; minWidth: number }
    draft: {
      professional_title: string
      first_name: string
      middle_initial: string
      last_name: string
      suffix: string
      certificate_number: string
      email: string
      batch_number: string
    }
  } | null>(null)
  const [isSavingInlineEdit, setIsSavingInlineEdit] = useState(false)

  const nameFieldIds = useMemo(() => {
    const fields = templateForViewer?.fields || []
    return fields
      .filter((field) => (field.value || "").includes("{{trainee_name}}"))
      .map((field) => field.id)
  }, [templateForViewer])

  const selectedNameFontFamily = useMemo<CertificateFontFamily>(() => {
    const firstNameFieldId = nameFieldIds[0]
    if (firstNameFieldId && typeof fieldOverrides[firstNameFieldId]?.fontFamily === "string") {
      return fieldOverrides[firstNameFieldId].fontFamily as CertificateFontFamily
    }
    const templateField = templateForViewer?.fields?.find((field) => nameFieldIds.includes(field.id))
    return (templateField?.fontFamily as CertificateFontFamily) || "Helvetica"
  }, [fieldOverrides, nameFieldIds, templateForViewer])

  const selectedNameFontWeight = useMemo<CertificateFontWeight>(() => {
    const firstNameFieldId = nameFieldIds[0]
    if (firstNameFieldId && typeof fieldOverrides[firstNameFieldId]?.fontWeight === "string") {
      return fieldOverrides[firstNameFieldId].fontWeight as CertificateFontWeight
    }
    const templateField = templateForViewer?.fields?.find((field) => nameFieldIds.includes(field.id))
    return (templateField?.fontWeight as CertificateFontWeight) || "normal"
  }, [fieldOverrides, nameFieldIds, templateForViewer])

  const applyNameFontStyle = (
    patch: Partial<{ fontFamily: CertificateFontFamily; fontWeight: CertificateFontWeight }>
  ) => {
    if (nameFieldIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No name field",
        description: "This template has no trainee name field to style.",
      })
      return
    }

    setFieldOverrides((prev) => {
      const next = { ...prev }
      nameFieldIds.forEach((id) => {
        next[id] = { ...(next[id] || {}), ...patch }
      })
      return next
    })
  }

  // Load Google fonts used by certificate canvas preview
  useEffect(() => {
    if (!isCertificateViewerOpen) return
    if (typeof document === "undefined") return
    if (document.getElementById("certificate-google-fonts")) return

    const link = document.createElement("link")
    link.id = "certificate-google-fonts"
    link.rel = "stylesheet"
    link.href =
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Poppins:wght@400;700;900&display=swap"
    document.head.appendChild(link)
  }, [isCertificateViewerOpen])

  // ✅ NEW: Performance & Caching State
  const [certificateCache, setCertificateCache] = useState<Map<string, string>>(new Map())
  const [isPreFetching, setIsPreFetching] = useState(false)
  const preFetchQueueRef = useRef<[string, TemplateType][]>([])
  const isPreFetchingRunningRef = useRef(false)
  const [preFetchProgress, setPreFetchProgress] = useState(0)
  const [preFetchTotal, setPreFetchTotal] = useState(0)

  const isIdTemplateSelected = selectedTemplateType === "excellence"
  const canvasSize = useMemo(() => {
    if (isIdTemplateSelected) {
      return { w: ID_TEMPLATE_PAGE.width, h: ID_TEMPLATE_PAGE.height }
    }
    const spec = CERTIFICATE_PAGE_SIZES[certificatePageSize]
    return { w: spec.width, h: spec.height }
  }, [isIdTemplateSelected, certificatePageSize])

  const getCertificateCacheKey = useCallback(
    (traineeId: string, templateType: TemplateType) =>
      templateType === "excellence"
        ? `${traineeId}-${templateType}-id`
        : `${traineeId}-${templateType}-${certificatePageSize}`,
    [certificatePageSize]
  )

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

    const canvasW = canvasSize.w
    const canvasH = canvasSize.h

    const containerW = Math.max(previewContainerRef.current.clientWidth, 400)
    const containerH = Math.max(previewContainerRef.current.clientHeight, 400)

    const scaleW = (containerW - 40) / canvasW
    const scaleH = (containerH - 40) / canvasH
    const fitScale = Math.min(scaleW, scaleH, 1.0)

    setPreviewZoom(Number(fitScale.toFixed(2)))
  }, [canvasSize.w, canvasSize.h])

  // Close inline editor when switching participants or closing viewer
  useEffect(() => {
    setInlineFieldEdit(null)
  }, [activePreviewIndex, isCertificateViewerOpen, selectedTemplateType, idCardSide])


  // Auto-fit on open, template change, or page size change
  useEffect(() => {
    if (isCertificateViewerOpen) {
      const timer = setTimeout(handleFitToScreen, 100)
      return () => clearTimeout(timer)
    }
  }, [
    isCertificateViewerOpen,
    isIdTemplateSelected,
    certificatePageSize,
    canvasSize.w,
    canvasSize.h,
    handleFitToScreen,
  ])

  const getFontString = (
    field: TemplateField,
    canvasH: number,
    overrideFamily?: string,
    overrideWeight?: string
  ) => {
    const px = Math.max(1, (field.fontSize || 0.02) * canvasH)
    const italic = field.fontStyle === "italic" ? "italic " : ""
    const weightValue = overrideWeight || field.fontWeight
    const weight =
      weightValue === "extrabold"
        ? "900 "
        : weightValue === "bold"
          ? "bold "
          : ""
    const family = canvasFontFamily(overrideFamily || field.fontFamily || "Helvetica")
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

    const fullName = formatCertificateHolderDisplayName(trainee)
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

  const previewTrainee = certificatePreviews[activePreviewIndex]?.trainee
  const previewRedrawKey = [
    previewTrainee?.id ?? "",
    previewTrainee?.picture_2x2_url ?? "",
    previewTrainee?.first_name ?? "",
    previewTrainee?.last_name ?? "",
    previewTrainee?.middle_initial ?? "",
    previewTrainee?.suffix ?? "",
    previewTrainee?.professional_title ?? "",
    previewTrainee?.certificate_number ?? "",
  ].join("|")

  // Draw draggable preview (client-side) so you can drag instead of sliders
  useEffect(() => {
    if (!isCertificateViewerOpen) return
    const current = certificatePreviews[activePreviewIndex]
    if (!current?.trainee) return

    // Determine which template to render based on side toggle
    const isShowingBack = isIdTemplateSelected && idCardSide === "back"
    const activeTemplate = isShowingBack ? backTemplateForViewer : templateForViewer
    if (!activeTemplate?.imageUrl || !activeTemplate.fields?.length) return
    const canvas = previewCanvasRef.current
    if (!canvas) return

    canvas.width = canvasSize.w
    canvas.height = canvasSize.h
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let cancelled = false

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

    const photoUrl = current.trainee.picture_2x2_url || ""
    // Same-origin proxy avoids CORS and ensures a fresh fetch after BG removal / crop
    const photoSrc = photoUrl
      ? `/api/image-proxy?url=${encodeURIComponent(photoUrl)}&t=${encodeURIComponent(photoUrl)}`
      : ""

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      if (cancelled) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const traineePhoto = new Image()
      const hasPhoto = !!photoSrc

      const fields = activeTemplate.fields
      const drawFields = (photoEl?: HTMLImageElement) => {
        if (cancelled) return
        const photoToDraw = photoEl || traineePhoto
        fields.forEach((f) => {
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
          if (hasPhoto && (photoToDraw.complete && (photoToDraw.naturalWidth || photoToDraw.width))) {
            ctx.save()
            ctx.beginPath()
            ctx.rect(x, y, w, h)
            ctx.clip()
            drawImageCover(photoToDraw, x, y, w, h)
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

        ctx.font = getFontString(
          f,
          canvas.height,
          typeof fo.fontFamily === "string" ? fo.fontFamily : undefined,
          typeof fo.fontWeight === "string" ? fo.fontWeight : undefined
        )
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
          ctx.font = getFontString(
            { ...f, fontSize: (typeof fo.fontSize === "number" ? fo.fontSize : f.fontSize) },
            canvas.height,
            typeof fo.fontFamily === "string" ? fo.fontFamily : undefined,
            typeof fo.fontWeight === "string" ? fo.fontWeight : undefined
          )
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
      }

      if (hasPhoto) {
        traineePhoto.onload = () => {
          if (cancelled) return
          // redraw background and fields once photo is loaded
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          drawFields(traineePhoto)
        }
        traineePhoto.onerror = () => {
          if (cancelled) return
          // Direct URL fallback if proxy fails
          try {
            const retry = new Image()
            retry.crossOrigin = "anonymous"
            retry.onload = () => {
              if (cancelled) return
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              drawFields(retry)
            }
            retry.onerror = () => {
              if (cancelled) return
              drawFields()
            }
            retry.src = photoUrl
          } catch {
            drawFields()
          }
        }
        traineePhoto.src = photoSrc
      }

      drawFields()
    }
    img.src = activeTemplate.imageUrl

    return () => {
      cancelled = true
    }
  }, [
    isCertificateViewerOpen,
    activePreviewIndex,
    previewRedrawKey,
    templateForViewer,
    backTemplateForViewer,
    idCardSide,
    isIdTemplateSelected,
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

  const filteredTrainees = useMemo(() => {
    const keyword = attendeeSearch.trim().toLowerCase()
    if (!keyword) return trainees

    return trainees.filter((trainee) => {
      const haystack = [
        trainee.first_name,
        trainee.last_name,
        trainee.middle_initial,
        trainee.email,
        trainee.status,
        trainee.certificate_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [trainees, attendeeSearch])

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

  const handleRefreshSerialNumbers = async () => {
    if (!scheduleId) return

    const hasExisting = trainees.some((t) => !!t.certificate_number)

    // If participants already have numbers, confirm overwrite
    if (hasExisting) {
      const confirmed = window.confirm(
        "Some participants already have certificate numbers.\n\n" +
        "This will RE-ASSIGN new sequential numbers to ALL participants " +
        "in this batch using the current course serial counter.\n\n" +
        "Continue?"
      )
      if (!confirmed) return
    }

    setIsRefreshingSerials(true)
    try {
      const res = await fetch("/api/assign-certificate-serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          force: true,
          reassign: hasExisting,
        }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to assign serial numbers",
        })
        return
      }

      if (result.assigned === 0) {
        toast({
          title: "Up to date",
          description: "All participants already have certificate numbers.",
        })
      } else {
        const verb = result.reassigned ? "Reassigned" : "Assigned"
        toast({
          title: "Serial Numbers Updated",
          description: `${verb} ${result.assigned} certificate number(s). Range: ${result.range?.from}–${result.range?.to}`,
        })
      }

      await fetchTrainees()
    } catch (err) {
      console.error("Error refreshing serial numbers:", err)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sync serial numbers. Please try again.",
      })
    } finally {
      setIsRefreshingSerials(false)
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

  // Invalidate cached PDFs when page size changes (certificates only)
  useEffect(() => {
    if (isIdTemplateSelected) return
    setCertificateCache((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url))
      return new Map()
    })
    setCertificatePreviews((prev) => {
      if (prev.length === 0) return prev
      prev.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url)
      })
      return prev.map((p) => ({ ...p, url: null }))
    })
  }, [certificatePageSize, isIdTemplateSelected])

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
            ...(selectedTemplateType !== "excellence"
              ? { pageSize: certificatePageSize }
              : {}),
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
    certificatePageSize,
  ])

  const requestDownloadCertificates = (traineeIdsOverride?: Set<string>) => {
    if (!scheduleId) return
    const ids = traineeIdsOverride ?? selectedTraineeIds
    const selectedTrainees = trainees.filter((t) => ids.has(t.id))
    if (selectedTrainees.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one participant to download certificates.",
      })
      return
    }
    if (selectedTrainees.length >= 2) {
      setDownloadPackageOpen(true)
      return
    }
    void handleDownloadCertificates("separate", ids)
  }

  const handleDownloadCertificates = async (
    packageMode: "combined" | "separate" = "separate",
    traineeIdsOverride?: Set<string>,
  ) => {
    if (!scheduleId) return;

    const ids = traineeIdsOverride ?? selectedTraineeIds
    const selectedTrainees = trainees.filter((t) => ids.has(t.id))
    if (selectedTrainees.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one participant to download certificates.",
      });
      return;
    }

    setDownloadPackageOpen(false)
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

      // Use existing certificate number from DB, or fallback to sequential generation
      let fallbackIndex = 0;
      const updatedTrainees = sortedTrainees.map((trainee) => {
        if (trainee.certificate_number) return trainee;

        const serial = serialBase + fallbackIndex + 1;
        const padded = serial.toString().padStart(serialPad, "0");
        const certificate_number = `PSI-${courseData.name}-${padded}`;
        fallbackIndex++;
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

      const isIDTemplate = selectedTemplateType === "excellence";
      const isMulti = updatedTrainees.length >= 2;
      const useCombinedPdf = isMulti && packageMode === "combined";
      const useZip = isMulti && packageMode === "separate";

      let successCount = 0;
      let failCount = 0;

      const fetchPdfBlob = async (trainee: DownloadTrainee) => {
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
            givenThisDate: new Date().toLocaleDateString(),
            layoutOverride: isCertificateViewerOpen ? {
              offsetX: layoutOffset.offsetX,
              offsetY: layoutOffset.offsetY,
              fieldOverrides,
            } : undefined,
            side: isIDTemplate ? "front" : "both",
            ...(selectedTemplateType !== "excellence"
              ? { pageSize: certificatePageSize }
              : {}),
          }),
        });
        if (!res.ok) return null;
        return res.blob();
      };

      if (useCombinedPdf) {
        const merged = await PDFDocument.create();
        const dateStr = new Date().toISOString().split("T")[0];

        for (let i = 0; i < updatedTrainees.length; i++) {
          const trainee = updatedTrainees[i];
          try {
            const blob = await fetchPdfBlob(trainee);
            if (!blob) {
              failCount++;
              continue;
            }
            const src = await PDFDocument.load(await blob.arrayBuffer());
            const pages = await merged.copyPages(src, src.getPageIndices());
            pages.forEach((page) => merged.addPage(page));
            successCount++;
            setProgress(Math.floor(((i + 1) / updatedTrainees.length) * 100));
          } catch (error) {
            failCount++;
            console.error(`Failed to merge for ${trainee.first_name} ${trainee.last_name}:`, error);
          }
        }

        if (successCount > 0) {
          const bytes = await merged.save();
          const pdfBlob = new Blob([bytes], { type: "application/pdf" });
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = isIDTemplate
            ? `${courseData.name}_IDs_${dateStr}.pdf`
            : `${courseData.name}_Certificates_${dateStr}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else if (useZip) {
        // ===== ZIP MODE (separate PDFs) =====
        const zip = new JSZip();
        const dateStr = new Date().toISOString().split('T')[0];

        for (let i = 0; i < updatedTrainees.length; i++) {
          const trainee = updatedTrainees[i];

          try {
            const blob = await fetchPdfBlob(trainee);
            if (!blob) {
              failCount++;
              console.error(`Failed to generate for ${trainee.first_name} ${trainee.last_name}`);
              continue;
            }

            const fileName = isIDTemplate
              ? `ID_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf`
              : `Certificate_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf`;
            
            zip.file(fileName, blob);
            successCount++;

            setProgress(Math.floor(((i + 1) / updatedTrainees.length) * 100));
          } catch (error: any) {
            failCount++;
            console.error(`Failed to download for ${trainee.first_name} ${trainee.last_name}:`, error);
          }
        }

        // Generate and download zip
        if (successCount > 0) {
          const zipBlob = await zip.generateAsync({ type: "blob" });
          const zipUrl = URL.createObjectURL(zipBlob);
          const a = document.createElement("a");
          a.href = zipUrl;
          const zipName = isIDTemplate
            ? `${courseData.name}_IDs_${dateStr}.zip`
            : `${courseData.name}_Certificates_${dateStr}.zip`;
          a.download = zipName;
          a.click();
          URL.revokeObjectURL(zipUrl);
        }
      } else {
        // ===== SINGLE DOWNLOAD MODE (1 participant) =====
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
              } : undefined,
              selectedTemplateType !== "excellence" ? certificatePageSize : undefined
            );
            successCount++;

            setProgress(Math.floor(((i + 1) / updatedTrainees.length) * 100));
          } catch (error: any) {
            failCount++;
            console.error(`Failed to download for ${trainee.first_name} ${trainee.last_name}:`, error);
          }
        }
      }

      const packageLabel = useCombinedPdf
        ? " as one PDF"
        : useZip
          ? " as ZIP"
          : "";

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${successCount} ${isIDTemplate ? "ID(s)" : "certificate(s)"}${packageLabel}.` +
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
  const handleOpenCertificateViewer = () => {
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
    
    // We do a quick fetch of course/template data to setup the viewer, then open immediately
    const openViewer = async () => {
      try {
        // Start background caching only when opening viewer, and only for selected trainees.
        fetchCertificateGenerationData(selectedTrainees.map((t) => t.id))

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

        const serialBase = Number(courseData.serial_number ?? 1)
        const serialPad = Number(courseData.serial_number_pad ?? 5)

        // Load template fields for current type
        const { data: templateData } = await tmsDb
          .from("certificate_templates")
          .select("fields, image_url, back_image_url, back_fields")
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

          // Load back template data for ID cards
          if (selectedTemplateType === "excellence" && (templateData as any).back_image_url) {
            setBackTemplateForViewer({
              imageUrl: (templateData as any).back_image_url as string,
              fields: ((templateData as any).back_fields as TemplateField[]) || [],
            })
          } else {
            setBackTemplateForViewer(null)
          }
        }
        // Reset to front side when opening viewer
        setIdCardSide("front")

        // Prepare the previews list instantly, pulling from cache where available
        const sortedTrainees = [...selectedTrainees].sort((a, b) => {
          const aName = `${a.last_name} ${a.first_name}`.toLowerCase()
          const bName = `${b.last_name} ${b.first_name}`.toLowerCase()
          return aName.localeCompare(bName)
        })

        let fallbackIndex = 0;
        const updatedTrainees: DownloadTrainee[] = sortedTrainees.map((trainee) => {
          if (trainee.certificate_number) return trainee;

          const serial = serialBase + fallbackIndex + 1
          const padded = serial.toString().padStart(serialPad, "0")
          const certificate_number = `PSI-${courseData.name}-${padded}`
          fallbackIndex++
          return { ...trainee, certificate_number }
        })

        const previews = updatedTrainees.map(trainee => ({
          trainee,
          url: certificateCache.get(getCertificateCacheKey(trainee.id, selectedTemplateType)) || null
        }))

        setCertificatePreviews(previews)
        setActivePreviewIndex(0)
        setIsCertificateViewerOpen(true)
      } catch (err: any) {
        console.error("❌ Error opening viewer:", err)
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || "Failed to open viewer"
        })
      } finally {
        setIsLoadingPreviews(false)
      }
    }

    openViewer()
  }

  // ✅ NEW: Sync background cache to active previews
  useEffect(() => {
    if (!isCertificateViewerOpen || certificatePreviews.length === 0) return

    setCertificatePreviews(prev => {
      let changed = false
      const next = prev.map(p => {
        const cacheKey = getCertificateCacheKey(p.trainee.id, selectedTemplateType)
        const cachedUrl = certificateCache.get(cacheKey)
        if (cachedUrl && p.url !== cachedUrl) {
          changed = true
          return { ...p, url: cachedUrl }
        }
        return p
      })
      return changed ? next : prev
    })
  }, [certificateCache, isCertificateViewerOpen, selectedTemplateType, getCertificateCacheKey])

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
        .select(TRAINEE_DIRECTORY_SELECT)
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

        // Restore persisted certificate email send statuses after refresh/reopen.
        const sentIds = new Set<string>()
        const failedIds = new Set<string>()
        ;(data || []).forEach((trainee: Trainee) => {
          const status = trainee.custom_data?.__certificate_email_status
          if (status === "sent") sentIds.add(trainee.id)
          if (status === "failed") failedIds.add(trainee.id)
        })
        setSentCertificateIds(sentIds)
        setFailedCertificateIds(failedIds)
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
  const fetchCertificateGenerationData = async (targetTraineeIds?: string[]) => {
    if (!scheduleId || !open) return

    setIsPreFetching(true)
    try {
      let query = tmsDb
        .from("v_certificate_generation_data")
        .select("*")
        .eq("schedule_id", scheduleId)
      if (targetTraineeIds && targetTraineeIds.length > 0) {
        query = query.in("training_id", targetTraineeIds)
      }
      const { data, error } = await query

      if (error) {
        console.error("❌ Error pre-fetching generation data:", error)
      } else if (data) {
        const newMap = new Map<string, CertificateGenerationData>()
        data.forEach((item: any) => {
          // Keep only the override for the currently selected template type if available
          if (!item.override_template_type || item.override_template_type === selectedTemplateType) {
            const fromTrainings = trainees.find((t) => t.id === item.training_id)
            newMap.set(item.training_id, {
              ...(item as CertificateGenerationData),
              professional_title: fromTrainings?.professional_title || null,
            })
          }
        })
        setGenerationDataMap(newMap)
        console.log("🚀 Pre-fetched layout data for", newMap.size, "participants")

        // Initialize background pre-fetching queue only for active template.
        const traineeIds = Array.from(newMap.keys())
        const fullQueue: [string, TemplateType][] = []
        
        traineeIds.forEach(id => {
          fullQueue.push([id, selectedTemplateType])
        })

        preFetchQueueRef.current = fullQueue
        setPreFetchTotal(fullQueue.length)
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
      const nextTask = preFetchQueueRef.current.shift()
      if (!nextTask) {
        isPreFetchingRunningRef.current = false
        return
      }

      const [traineeId, templateType] = nextTask
      const cacheKey = getCertificateCacheKey(traineeId, templateType)

      // Skip if already has a preview in cache
      if (certificateCache.has(cacheKey)) {
        isPreFetchingRunningRef.current = false
        setTimeout(processQueue, 50)
        return
      }

      const genData = generationDataMap.get(traineeId)
      if (!genData) {
        isPreFetchingRunningRef.current = false
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
              suffix: genData.suffix,
              professional_title: trainees.find((t) => t.id === traineeId)?.professional_title || null,
              picture_2x2_url: genData.picture_2x2_url,
              certificate_number: genData.certificate_number,
              batch_number: genData.batch_number,
              schedule_id: genData.schedule_id,
              course_id: genData.course_id,
            },
            courseName: genData.course_name,
            courseTitle: genData.course_title,
            courseId: genData.course_id,
            templateType: templateType,
            precomputed: {
              layout: {
                offsetX: genData.offset_x,
                offsetY: genData.offset_y,
                fieldOverrides: genData.field_overrides
              }
            },
            ...(templateType !== "excellence" ? { pageSize: certificatePageSize } : {}),
          }),
        })

        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)

          setCertificateCache(prev => {
            const newCache = new Map(prev)
            newCache.set(cacheKey, url)
            return newCache
          })
        }
        setPreFetchProgress(prev => prev + 1)
      } catch (e) {
        console.warn("Silent pre-fetch failed for", traineeId, templateType, e)
      }

      isPreFetchingRunningRef.current = false
      // Next one after a short delay to keep CPU low
      setTimeout(processQueue, 200)
    }

    processQueue()
  }, [generationDataMap, open, certificateCache, certificatePageSize, getCertificateCacheKey])

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

  const applyUpdatedPhotoUrl = (
    traineeId: string,
    photoUrl: string,
    extras?: { picture_2x2_original?: string | null },
  ) => {
    const patch = {
      picture_2x2_url: photoUrl,
      ...(extras?.picture_2x2_original !== undefined
        ? { picture_2x2_original: extras.picture_2x2_original }
        : {}),
    }
    setSelectedTrainee((prev: any) =>
      prev?.id === traineeId ? { ...prev, ...patch } : prev
    )
    setTrainees((prev) =>
      prev.map((t) => (t.id === traineeId ? { ...t, ...patch } : t))
    )
    setCertificatePreviews((prev) =>
      prev.map((item) =>
        item.trainee.id === traineeId
          ? { ...item, trainee: { ...item.trainee, ...patch }, url: null }
          : item
      )
    )
    setGenerationDataMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(traineeId)
      if (existing) {
        next.set(traineeId, { ...existing, picture_2x2_url: photoUrl })
      }
      return next
    })
    setCertificateCache((prev) => {
      const next = new Map(prev)
      for (const key of Array.from(next.keys())) {
        if (key.startsWith(`${traineeId}:`)) next.delete(key)
      }
      return next
    })
  }

  const handleSaveCroppedPhoto = async (croppedImageUrl: string) => {
    if (!selectedTrainee) return

    setIsUploading(true)
    try {
      const { error } = await tmsDb
        .from("trainings")
        .update({ picture_2x2_url: croppedImageUrl })
        .eq("id", selectedTrainee.id)

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update picture: " + error.message,
        })
        return
      }

      applyUpdatedPhotoUrl(selectedTrainee.id, croppedImageUrl)

      toast({
        title: "Success",
        description: "Picture updated successfully!",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to save cropped picture",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const removeBackgroundForTrainee = async (
    trainee: Trainee,
    onProgress: (message: string) => void,
  ) => {
    if (!trainee.id || !trainee.picture_2x2_url) {
      throw new Error("No 2x2 photo to process")
    }

    onProgress("Loading AI model (first time may take a minute)…")
    const { removeBackground } = await import("@imgly/background-removal")

    const photoRes = await fetch(
      `/api/image-proxy?url=${encodeURIComponent(trainee.picture_2x2_url)}`,
    )
    if (!photoRes.ok) {
      throw new Error("Could not load the 2×2 photo for processing")
    }
    const rawSource = await photoRes.blob()

    onProgress("Preparing photo…")
    const { compressPngBlob } = await import("@/lib/compress-image-blob")
    const source = await compressPngBlob(rawSource, 1280)

    onProgress("Removing background…")
    const publicPath = `${window.location.origin}/bg-removal-data/`
    const rawResultBlob = await removeBackground(source, {
      publicPath,
      model: "isnet_fp16",
      output: {
        format: "image/png",
      },
      progress: (key, current, total) => {
        if (total > 0) {
          onProgress(`Downloading model: ${key} (${Math.round((current / total) * 100)}%)`)
        }
      },
    })

    onProgress("Optimizing photo for upload…")
    const resultBlob = await compressPngBlob(rawResultBlob, 1024)

    onProgress("Uploading…")
    const formData = new FormData()
    formData.append("image", resultBlob, `2x2_nobg_${Date.now()}.png`)
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
    if (!uploadRes.ok) {
      if (uploadRes.status === 413) {
        throw new Error("Processed photo is still too large for the server.")
      }
      throw new Error("Failed to upload processed photo")
    }
    const uploadData = await uploadRes.json()
    const photoUrl = uploadData.url as string
    if (!photoUrl) throw new Error("Upload did not return a URL")

    const originalBackup = trainee.picture_2x2_original || trainee.picture_2x2_url
    const updatePayload: Record<string, string> = { picture_2x2_url: photoUrl }
    if (!trainee.picture_2x2_original && trainee.picture_2x2_url) {
      updatePayload.picture_2x2_original = trainee.picture_2x2_url
    }

    const { error } = await tmsDb
      .from("trainings")
      .update(updatePayload)
      .eq("id", trainee.id)

    if (error) throw new Error(error.message)

    applyUpdatedPhotoUrl(trainee.id, photoUrl, {
      picture_2x2_original: originalBackup || null,
    })

    return photoUrl
  }

  const runBackgroundRemovalJob = async (targets: Trainee[]) => {
    if (isRemovingBg) return
    if (targets.length === 0) {
      toast({
        variant: "destructive",
        title: "No photos",
        description: "Selected participants have no 2x2 photos to process.",
      })
      return
    }

    setIsRemovingBg(true)
    setBgJobExpanded(true)
    setBgJobItems(
      targets.map((trainee) => ({
        id: trainee.id,
        name: `${trainee.first_name} ${trainee.last_name}`,
        status: "queued" as const,
        detail: "Waiting…",
      })),
    )

    let successCount = 0
    let failCount = 0
    let skipCount = 0

    try {
      for (const trainee of targets) {
        if (!trainee.picture_2x2_url) {
          skipCount += 1
          setBgJobItems((prev) =>
            prev.map((item) =>
              item.id === trainee.id
                ? { ...item, status: "skipped", detail: "No photo" }
                : item,
            ),
          )
          continue
        }

        setBgJobItems((prev) =>
          prev.map((item) =>
            item.id === trainee.id
              ? { ...item, status: "running", detail: "Starting…" }
              : item,
          ),
        )
        setBgRemoveProgress(`Processing ${trainee.first_name} ${trainee.last_name}…`)

        try {
          await removeBackgroundForTrainee(trainee, (message) => {
            setBgRemoveProgress(message)
            setBgJobItems((prev) =>
              prev.map((item) =>
                item.id === trainee.id ? { ...item, detail: message } : item,
              ),
            )
          })
          successCount += 1
          setBgJobItems((prev) =>
            prev.map((item) =>
              item.id === trainee.id
                ? { ...item, status: "done", detail: "Background removed" }
                : item,
            ),
          )
        } catch (error: unknown) {
          failCount += 1
          const message = error instanceof Error ? error.message : "Failed"
          setBgJobItems((prev) =>
            prev.map((item) =>
              item.id === trainee.id ? { ...item, status: "error", detail: message } : item,
            ),
          )
        }
      }

      toast({
        title: "Background removal finished",
        description: `${successCount} updated${failCount ? `, ${failCount} failed` : ""}${
          skipCount ? `, ${skipCount} skipped` : ""
        }.`,
        variant: failCount && !successCount ? "destructive" : "default",
      })
    } finally {
      setIsRemovingBg(false)
      setBgRemoveProgress("")
    }
  }

  const handleRemovePhotoBackground = async () => {
    const current = certificatePreviews[activePreviewIndex]
    const trainee = current?.trainee
    if (!trainee?.id || !trainee.picture_2x2_url) {
      toast({
        variant: "destructive",
        title: "No photo",
        description: "This participant has no 2x2 photo to process.",
      })
      return
    }
    setSelectedTrainee(trainee as Trainee)
    await runBackgroundRemovalJob([trainee as Trainee])
  }

  const handleBatchRemoveBackground = async () => {
    const selected = getSelectedTrainees()
    if (selected.length === 0) {
      toast({
        title: "No selection",
        description: "Select at least one participant first.",
      })
      return
    }
    await runBackgroundRemovalJob(selected)
  }

  const handleRevertOriginalPhoto = async () => {
    const current = certificatePreviews[activePreviewIndex]
    const trainee = current?.trainee
    const originalUrl = trainee?.picture_2x2_original
    if (!trainee?.id || !originalUrl) {
      toast({
        variant: "destructive",
        title: "No original photo",
        description: "No backup of the original 2×2 photo was found for this participant.",
      })
      return
    }
    if (originalUrl === trainee.picture_2x2_url) {
      toast({
        title: "Already original",
        description: "The current photo is already the original.",
      })
      return
    }

    setIsUploading(true)
    try {
      const { error } = await tmsDb
        .from("trainings")
        .update({ picture_2x2_url: originalUrl })
        .eq("id", trainee.id)

      if (error) {
        throw new Error(error.message)
      }

      applyUpdatedPhotoUrl(trainee.id, originalUrl)

      toast({
        title: "Original photo restored",
        description: "2×2 photo reverted. Certificate preview will refresh.",
      })
    } catch (error: any) {
      console.error("Revert original photo failed:", error)
      toast({
        variant: "destructive",
        title: "Revert failed",
        description: error?.message || "Could not restore the original photo.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const nudgeLayout = (axis: "offsetX" | "offsetY", delta: number) => {
    setLayoutOffset((prev) => ({
      ...prev,
      [axis]: Math.max(-0.08, Math.min(0.08, Number((prev[axis] + delta).toFixed(4)))),
    }))
  }

  const nudgeField = (axis: "x" | "y", delta: number) => {
    if (!activeFieldId) return
    setFieldOverrides((prev) => {
      const current = prev[activeFieldId] || {}
      const base =
        typeof current[axis] === "number"
          ? current[axis]
          : templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.[axis] || 0
      return {
        ...prev,
        [activeFieldId]: {
          ...current,
          [axis]: Math.max(0, Math.min(1, Number((base + delta).toFixed(4)))),
        },
      }
    })
  }

  const activeTemplateField = useMemo(
    () => templateForViewer?.fields?.find((f) => f.id === activeFieldId) || null,
    [templateForViewer, activeFieldId]
  )

  const activeFieldIsPhoto = !!(
    activeTemplateField?.value &&
    activeTemplateField.value.includes("{{trainee_picture}}")
  )

  const getActivePhotoSizeNorm = () => {
    if (!activeTemplateField) return 0.12
    const fo = (activeFieldId && fieldOverrides[activeFieldId]) || {}
    if (typeof fo.boxWidth === "number") return fo.boxWidth
    if (typeof fo.boxHeight === "number") return fo.boxHeight
    if (typeof activeTemplateField.boxWidth === "number") return activeTemplateField.boxWidth
    if (typeof activeTemplateField.boxHeight === "number") return activeTemplateField.boxHeight
    if (typeof activeTemplateField.fontSize === "number") return activeTemplateField.fontSize
    return 0.12
  }

  const setActivePhotoSize = (size: number) => {
    if (!activeFieldId || !activeFieldIsPhoto) return
    const next = Math.max(0.04, Math.min(0.55, Number(size.toFixed(4))))
    const base = activeTemplateField
    const baseW =
      typeof base?.boxWidth === "number"
        ? base.boxWidth
        : typeof base?.fontSize === "number"
          ? base.fontSize
          : 0.12
    const baseH =
      typeof base?.boxHeight === "number"
        ? base.boxHeight
        : typeof base?.fontSize === "number"
          ? base.fontSize
          : 0.12
    // Keep original aspect ratio while scaling by the larger side
    const scale = next / Math.max(baseW, baseH, 0.0001)
    setFieldOverrides((prev) => ({
      ...prev,
      [activeFieldId]: {
        ...(prev[activeFieldId] || {}),
        boxWidth: Math.max(0.04, Math.min(0.55, Number((baseW * scale).toFixed(4)))),
        boxHeight: Math.max(0.04, Math.min(0.55, Number((baseH * scale).toFixed(4)))),
      },
    }))
  }

  const nudgePhotoSize = (delta: number) => {
    setActivePhotoSize(getActivePhotoSizeNorm() + delta)
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

  const getFriendlyEmailError = (rawError: string) => {
    const text = (rawError || "").toLowerCase()

    if (text.includes("suppressed")) {
      return "This recipient is blocked by the email provider (suppressed). Please remove it from the provider suppression list and try again."
    }
    if (text.includes("invalid smtp sender email")) {
      return "Email sender is not configured correctly. Please contact your admin to check the sender email settings."
    }
    if (text.includes("message failed: 500 5.0.0") || text.includes("command\":\"data\"") || text.includes(" command: 'data'")) {
      return "The email provider rejected this recipient/message. Please verify the recipient email or provider block/suppression list."
    }
    if (text.includes("no pdfs could be generated")) {
      return "Certificate file could not be generated for this participant. Please check the participant details and template."
    }

    return "Some emails could not be sent. Please try again or contact support if the issue continues."
  }

  const handleSendCertificatesWithEmail = async (customSubject: string, customMessage: string, attachments: string[]) => {
    setEmailComposeOpen(false)
    setIsSendingEmails(true)
    setProgress(0)
    setSentCertificateIds(new Set())
    setFailedCertificateIds(new Set())

    startLongOperation(
      "Sending Certificates",
      `Preparing to send certificates with ${attachments.length} attachment(s) each...`
    )

    try {
      const selectedIds = Array.from(selectedTraineeIds)
      let lastFriendlyError = ""

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
          ...(selectedTemplateType !== "excellence"
            ? { pageSize: certificatePageSize }
            : {}),
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        toast({
          variant: "destructive",
          title: "Unable to send certificates",
          description: getFriendlyEmailError(result.error || ""),
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
                if (typeof data.lastSentId === "string") {
                  setSentCertificateIds((prev) => {
                    const next = new Set(prev)
                    next.add(data.lastSentId)
                    return next
                  })
                }
                if (typeof data.lastErrorId === "string") {
                  setFailedCertificateIds((prev) => {
                    const next = new Set(prev)
                    next.add(data.lastErrorId)
                    return next
                  })
                }
                if (typeof data.lastError === "string" && data.lastError.trim()) {
                  lastFriendlyError = getFriendlyEmailError(data.lastError)
                }
                // Removed alertMessage update to avoid toast spam
              } else if (data.type === "complete") {
                setProgress(100)
                if (Array.isArray(data.sentTraineeIds)) {
                  setSentCertificateIds(new Set(data.sentTraineeIds))
                }
                if (Array.isArray(data.failedTraineeIds)) {
                  setFailedCertificateIds(new Set(data.failedTraineeIds))
                }
                if (data.failCount > 0) {
                  toast({
                    variant: "destructive",
                    title: `Sent with ${data.failCount} failed recipient(s)`,
                    description: `${data.successCount} sent successfully. ${lastFriendlyError || "Please check recipient email/provider restrictions."}`,
                  })
                } else {
                  toast({
                    title: "Certificates sent successfully",
                    description: `Successfully sent ${data.successCount} certificate(s).`,
                  })
                }
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
        title: "Unable to send certificates",
        description: "Network or server issue while sending emails. Please try again.",
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
          },
          ...(selectedTemplateType !== "excellence"
            ? { pageSize: certificatePageSize }
            : {}),
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
    const isShowingBack = isIdTemplateSelected && idCardSide === "back"
    const activeTemplate = isShowingBack ? backTemplateForViewer : templateForViewer
    if (!current?.trainee || !canvas || !activeTemplate) return null
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    // Top-most match wins, so iterate reverse
    const fields = [...activeTemplate.fields].reverse()
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

      ctx.font = getFontString(
        f,
        canvas.height,
        typeof fo.fontFamily === "string" ? fo.fontFamily : undefined,
        typeof fo.fontWeight === "string" ? fo.fontWeight : undefined
      )
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

  const resolveEditableFieldKind = (
    value: string | undefined
  ): "name" | "certificate_number" | "email" | "batch_number" | null => {
    if (!value) return null
    if (value.includes("{{trainee_name}}")) return "name"
    if (value.includes("{{certificate_number}}")) return "certificate_number"
    if (value.includes("{{email}}")) return "email"
    if (value.includes("{{batch_number}}")) return "batch_number"
    return null
  }

  const applySavedTraineeToLocalState = (saved: Trainee) => {
    setTrainees((prev) => prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)))
    setCertificatePreviews((prev) =>
      prev.map((item) =>
        item.trainee.id === saved.id
          ? {
              ...item,
              trainee: {
                ...item.trainee,
                first_name: saved.first_name,
                last_name: saved.last_name,
                middle_initial: saved.middle_initial || undefined,
                suffix: saved.suffix || undefined,
                professional_title: saved.professional_title,
                email: saved.email || undefined,
                certificate_number: saved.certificate_number || undefined,
                picture_2x2_url: saved.picture_2x2_url || undefined,
                batch_number: saved.batch_number || undefined,
                custom_data: saved.custom_data,
              },
              url: null,
            }
          : item
      )
    )
    setGenerationDataMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(saved.id)
      if (existing) {
        next.set(saved.id, {
          ...existing,
          first_name: saved.first_name,
          last_name: saved.last_name,
          middle_initial: saved.middle_initial || undefined,
          suffix: saved.suffix || undefined,
          professional_title: saved.professional_title,
          certificate_number: saved.certificate_number || existing.certificate_number,
          picture_2x2_url: saved.picture_2x2_url || undefined,
          batch_number: saved.batch_number || undefined,
        })
      }
      return next
    })
    setCertificateCache((prev) => {
      const next = new Map(prev)
      for (const key of Array.from(next.keys())) {
        if (key.startsWith(`${saved.id}:`)) next.delete(key)
      }
      return next
    })
    setSelectedTrainee((prev) => (prev?.id === saved.id ? { ...prev, ...saved } : prev))
  }

  const handlePreviewCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragStateRef.current = { fieldId: null, mode: "move", dx: 0, dy: 0 }

    const canvas = previewCanvasRef.current
    const current = certificatePreviews[activePreviewIndex]
    const isShowingBack = isIdTemplateSelected && idCardSide === "back"
    const activeTemplate = isShowingBack ? backTemplateForViewer : templateForViewer
    if (!canvas || !current?.trainee || !activeTemplate) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const hit = hitTestFieldAt(x, y)
    if (!hit) {
      setInlineFieldEdit(null)
      return
    }

    const field = activeTemplate.fields.find((f) => f.id === hit.id)
    if (!field) return

    const kind = resolveEditableFieldKind(field.value)
    if (!kind) {
      toast({
        title: "Not editable here",
        description: "Double-click name, certificate number, email, or batch fields to edit trainee info.",
      })
      setActiveFieldId(hit.id)
      return
    }

    setActiveFieldId(hit.id)
    const trainee = current.trainee
    const wrapper = canvas.parentElement?.getBoundingClientRect()
    const left = e.clientX - (wrapper?.left ?? rect.left) + 8
    const top = e.clientY - (wrapper?.top ?? rect.top) + 8

    setInlineFieldEdit({
      fieldId: hit.id,
      kind,
      overlayStyle: {
        left: Math.max(8, Math.min(left, (wrapper?.width ?? rect.width) - 320)),
        top: Math.max(8, Math.min(top, (wrapper?.height ?? rect.height) - 160)),
        minWidth: kind === "name" ? 300 : 220,
      },
      draft: {
        professional_title: trainee.professional_title || "",
        first_name: trainee.first_name || "",
        middle_initial: trainee.middle_initial || "",
        last_name: trainee.last_name || "",
        suffix: trainee.suffix || "",
        certificate_number: trainee.certificate_number || "",
        email: trainee.email || "",
        batch_number: trainee.batch_number != null ? String(trainee.batch_number) : "",
      },
    })
  }

  const handleSaveInlineFieldEdit = async () => {
    if (!inlineFieldEdit) return
    const current = certificatePreviews[activePreviewIndex]
    if (!current?.trainee?.id) return

    setIsSavingInlineEdit(true)
    const draft = inlineFieldEdit.draft
    const updates: Record<string, unknown> =
      inlineFieldEdit.kind === "name"
        ? {
            professional_title: draft.professional_title.trim() || null,
            first_name: draft.first_name.trim(),
            middle_initial: draft.middle_initial.trim() || null,
            last_name: draft.last_name.trim(),
            suffix: draft.suffix.trim() || null,
          }
        : inlineFieldEdit.kind === "certificate_number"
          ? { certificate_number: draft.certificate_number.trim() || null }
          : inlineFieldEdit.kind === "email"
            ? { email: draft.email.trim() || null }
            : {
                batch_number: draft.batch_number.trim() === "" ? null : Number(draft.batch_number),
              }

    if (inlineFieldEdit.kind === "name" && (!draft.first_name.trim() || !draft.last_name.trim())) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "First name and last name are required.",
      })
      setIsSavingInlineEdit(false)
      return
    }

    const { data, error } = await tmsDb
      .from("trainings")
      .update(updates)
      .eq("id", current.trainee.id)
      .select(TRAINEE_DIRECTORY_SELECT)
      .single()

    setIsSavingInlineEdit(false)

    if (error || !data) {
      console.error("❌ Inline trainee edit failed:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save trainee info. Please try again.",
      })
      return
    }

    applySavedTraineeToLocalState(data as Trainee)
    setInlineFieldEdit(null)
    toast({
      title: "Saved",
      description: "Trainee info updated.",
    })
  }

  const handleSaveTrainee = async () => {
    if (!selectedTrainee) return

    console.log("Submitting update for:", selectedTrainee)

    const updates: Record<string, unknown> = {
      professional_title: selectedTrainee.professional_title || null,
      first_name: selectedTrainee.first_name,
      last_name: selectedTrainee.last_name,
      middle_initial: selectedTrainee.middle_initial || null,
      suffix: selectedTrainee.suffix || null,
      email: selectedTrainee.email || null,
      phone_number: selectedTrainee.phone_number || null,
      gender: selectedTrainee.gender || null,
      age: selectedTrainee.age == null ? null : Number(selectedTrainee.age),
      mailing_street: selectedTrainee.mailing_street || null,
      mailing_city: selectedTrainee.mailing_city || null,
      mailing_province: selectedTrainee.mailing_province || null,
      region: selectedTrainee.region || null,
      employment_status: selectedTrainee.employment_status || null,
      is_student: !!selectedTrainee.is_student,
      school_name: selectedTrainee.school_name || null,
      company_name: selectedTrainee.company_name || null,
      company_position: selectedTrainee.company_position || null,
      company_industry: selectedTrainee.company_industry || null,
      company_email: selectedTrainee.company_email || null,
      company_landline: selectedTrainee.company_landline || null,
      company_city: selectedTrainee.company_city || null,
      company_region: selectedTrainee.company_region || null,
      total_workers: selectedTrainee.total_workers == null ? null : Number(selectedTrainee.total_workers),
      certificate_number: selectedTrainee.certificate_number || null,
      training_provider: selectedTrainee.training_provider || null,
      training_type: selectedTrainee.training_type || null,
      training_program: selectedTrainee.training_program || null,
      training_status: selectedTrainee.training_status || null,
      batch_number: selectedTrainee.batch_number == null ? null : Number(selectedTrainee.batch_number),
      food_restriction: selectedTrainee.food_restriction || null,
      status: selectedTrainee.status || null,
      physical_cert_status: selectedTrainee.physical_cert_status || null,
      e_id_status: selectedTrainee.e_id_status || null,
      add_pvc_id: !!selectedTrainee.add_pvc_id,
      pvc_fee: selectedTrainee.pvc_fee == null ? null : Number(selectedTrainee.pvc_fee),
      payment_method: selectedTrainee.payment_method || null,
      payment_status: selectedTrainee.payment_status || null,
      amount_paid: selectedTrainee.amount_paid == null ? null : Number(selectedTrainee.amount_paid),
    }

    const { data, error } = await tmsDb
      .from("trainings")
      .update(updates)
      .eq("id", selectedTrainee.id)
      .select(TRAINEE_DIRECTORY_SELECT)
      .single()

    if (error) {
      console.error("❌ Supabase update error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes. Please try again.",
      })
    } else if (data) {
      applySavedTraineeToLocalState(data as Trainee)
      setIsTraineeDialogOpen(false)
      toast({
        title: "Saved",
        description: "Participant details updated successfully.",
      })
    }
  }

  const openEditTraineeDialog = async (trainee: Trainee | { id: string }) => {
    setSelectedTrainee(trainee as Trainee)
    setIsTraineeDialogOpen(true)

    const { data, error } = await tmsDb
      .from("trainings")
      .select(TRAINEE_DIRECTORY_SELECT)
      .eq("id", trainee.id)
      .single()

    if (!error && data) {
      setSelectedTrainee(data as Trainee)
    }
  }

  const patchSelectedTrainee = <K extends keyof Trainee>(key: K, value: Trainee[K]) => {
    setSelectedTrainee((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const startLongOperation = (title: string, message: string = "") => {
    toast({
      title: title,
      description: message || "Please wait... This may take up to a minute due to server cold start.",
    })
  }

  // PART 3 OF 3 - JSX Return

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isRemovingBg) {
          toast({
            title: "Keep this tab open",
            description: "Background removal is still running. Do not close or refresh this page.",
          })
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="lg:w-[60vw] sm:w-[90vw] max-h-[90vh] overflow-y-auto pt-10 bg-card">

        <DialogHeader>
          <DialogTitle className="text-lg font-semibold bg-muted/50 border p-2 rounded-md flex justify-between items-center">
            Directory of Participants

            {/* Action Button Group */}
            <TooltipProvider>
              <div className="flex items-center gap-2">

                {/* Refresh Serial Numbers */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshSerialNumbers}
                      disabled={isRefreshingSerials}
                      className="cursor-pointer"
                    >
                      {isRefreshingSerials ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <ListOrdered className="mr-2 h-4 w-4" />
                          Refresh Serial No.
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Assign certificate serial numbers to participants without one (alphabetical order, uses course sequence)
                  </TooltipContent>
                </Tooltip>

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


        {preFetchTotal > 0 && preFetchProgress < preFetchTotal && (
          <div className="space-y-1 mb-4">
            <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              <span>Background Certificate Caching</span>
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {preFetchProgress} / {preFetchTotal}
              </span>
            </div>
            <Progress value={(preFetchProgress / preFetchTotal) * 100} className="h-1.5 bg-muted" />
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border/75 bg-card shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-muted/5 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/15 p-2.5 text-emerald-700 shadow-none dark:text-emerald-300">
                <CalendarCheck className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-base font-semibold tracking-tight text-foreground">
                  {courseName}
                </p>
                {scheduleRange ? (
                  <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
                    {scheduleRange}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {batchNumber != null && (
                <span className="inline-flex h-8 items-center rounded-xl border border-border/60 bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-none">
                  Batch #{batchNumber}
                </span>
              )}
              <span
                className={`inline-flex h-8 items-center rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-wide shadow-none ${getScheduleStatusPillClass(scheduleStatus)}`}
              >
                {scheduleStatus || "planned"}
              </span>
            </div>
          </div>
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

        <div className="border rounded-md text-sm font-semibold px-4 py-2 bg-secondary flex justify-between items-center gap-3">
          <span>Attendee Details ({filteredTrainees.length}/{trainees.length} participants)</span>
          <Input
            value={attendeeSearch}
            onChange={(e) => setAttendeeSearch(e.target.value)}
            placeholder="Search name, email, status, certificate #..."
            className="w-full max-w-sm bg-background"
          />
        </div>

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
                  <TableHead className="text-sm font-medium">Email Send</TableHead>
                  <TableHead className="text-sm font-medium">ID Picture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrainees.map((trainee) => (
                  <TableRow key={trainee.id} className="hover:bg-muted">
                    <TableCell>
                      <Checkbox
                        checked={selectedTraineeIds.has(trainee.id)}
                        onCheckedChange={(checked) => handleSelectTrainee(trainee.id, checked as boolean)}
                        aria-label={`Select ${trainee.first_name} ${trainee.last_name}`}
                      />
                    </TableCell>
                    <TableCell className="dark:text-white capitalize cursor-pointer" onClick={() => openEditTraineeDialog(trainee)}>
                      {trainee.last_name}
                    </TableCell>
                    <TableCell className="dark:text-white capitalize cursor-pointer" onClick={() => openEditTraineeDialog(trainee)}>
                      {trainee.first_name}
                    </TableCell>
                    <TableCell className="dark:text-white capitalize cursor-pointer" onClick={() => openEditTraineeDialog(trainee)}>
                      {trainee.middle_initial ?? "-"}
                    </TableCell>
                    <TableCell onClick={() => openEditTraineeDialog(trainee)}>
                      <Badge variant={getStatusBadgeVariant(trainee.status || "pending")}>
                        {trainee.status ?? "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => openEditTraineeDialog(trainee)}>
                      {sentCertificateIds.has(trainee.id) ? (
                        <Badge className="h-5 rounded-full bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-600">
                          Sent
                        </Badge>
                      ) : failedCertificateIds.has(trainee.id) ? (
                        <Badge variant="destructive" className="h-5 rounded-full px-2 text-[10px]">
                          Failed
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not sent</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => openEditTraineeDialog(trainee)}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={trainee.picture_2x2_url || undefined} alt="ID Picture" />
                        <AvatarFallback>{trainee.first_name?.[0]}{trainee.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTrainees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No attendee matches your search.
                    </TableCell>
                  </TableRow>
                )}
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
              variant="outline"
              onClick={() => void handleBatchRemoveBackground()}
              disabled={isRemovingBg || selectedTraineeIds.size === 0}
              className="border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
            >
              {isRemovingBg ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eraser className="mr-2 h-4 w-4" />
              )}
              Remove BG
              {selectedTraineeIds.size > 0 ? ` (${selectedTraineeIds.size})` : ""}
            </Button>
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
      </DialogContent>

      <Dialog open={isTraineeDialogOpen} onOpenChange={setIsTraineeDialogOpen}>
        <DialogContent className="lg:w-[56vw] sm:w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Participant Details</DialogTitle>
            </DialogHeader>
            {selectedTrainee && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Current Picture</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={selectedTrainee.picture_2x2_url || undefined} alt="Current Picture" />
                      <AvatarFallback>{selectedTrainee.first_name?.[0]}{selectedTrainee.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploading}
                        onClick={() => {
                          setCropExistingPhoto(false)
                          setShowPhotoCropDialog(true)
                        }}
                      >
                        <Crop className="h-4 w-4 mr-2" />
                        Upload & Crop
                      </Button>
                      {selectedTrainee.picture_2x2_url && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => {
                            setCropExistingPhoto(true)
                            setShowPhotoCropDialog(true)
                          }}
                        >
                          <Crop className="h-4 w-4 mr-2" />
                          Recrop Current
                        </Button>
                      )}
                      {isUploading && <p className="text-sm text-muted-foreground">Saving...</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold border-b pb-1">Personal</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>
                        Professional Title{" "}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input
                        placeholder="e.g. RN, MD, Engr."
                        value={selectedTrainee.professional_title || ""}
                        onChange={(e) => patchSelectedTrainee("professional_title", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Appears at the end of the name on the certificate (e.g. Juan Dela Cruz, RN).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input
                        value={selectedTrainee.first_name}
                        onChange={(e) => patchSelectedTrainee("first_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={selectedTrainee.last_name}
                        onChange={(e) => patchSelectedTrainee("last_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Middle Initial</Label>
                      <Input
                        value={selectedTrainee.middle_initial || ""}
                        onChange={(e) => patchSelectedTrainee("middle_initial", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Suffix</Label>
                      <Input
                        placeholder="e.g. Jr., Sr., III"
                        value={selectedTrainee.suffix || ""}
                        onChange={(e) => patchSelectedTrainee("suffix", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select
                        value={selectedTrainee.gender || undefined}
                        onValueChange={(value) => patchSelectedTrainee("gender", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Age</Label>
                      <Input
                        type="number"
                        value={selectedTrainee.age ?? ""}
                        onChange={(e) =>
                          patchSelectedTrainee(
                            "age",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold border-b pb-1">Contact</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="participant@email.com"
                        value={selectedTrainee.email || ""}
                        onChange={(e) => patchSelectedTrainee("email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input
                        value={selectedTrainee.phone_number || ""}
                        onChange={(e) => patchSelectedTrainee("phone_number", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold border-b pb-1">Mailing Address</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Street</Label>
                      <Input
                        value={selectedTrainee.mailing_street || ""}
                        onChange={(e) => patchSelectedTrainee("mailing_street", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={selectedTrainee.mailing_city || ""}
                        onChange={(e) => patchSelectedTrainee("mailing_city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Province</Label>
                      <Input
                        value={selectedTrainee.mailing_province || ""}
                        onChange={(e) => patchSelectedTrainee("mailing_province", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Input
                        value={selectedTrainee.region || ""}
                        onChange={(e) => patchSelectedTrainee("region", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold border-b pb-1">Employment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Employment Status</Label>
                      <Select
                        value={selectedTrainee.employment_status || undefined}
                        onValueChange={(value) => patchSelectedTrainee("employment_status", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employed">Employed</SelectItem>
                          <SelectItem value="Unemployed">Unemployed</SelectItem>
                          <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Food Restriction / Allergies</Label>
                      <Input
                        value={selectedTrainee.food_restriction || ""}
                        onChange={(e) => patchSelectedTrainee("food_restriction", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="edit_is_student"
                      checked={!!selectedTrainee.is_student}
                      onCheckedChange={(checked) => patchSelectedTrainee("is_student", !!checked)}
                    />
                    <Label htmlFor="edit_is_student" className="cursor-pointer">Student</Label>
                  </div>
                  {selectedTrainee.is_student && (
                    <div className="space-y-2">
                      <Label>School / University</Label>
                      <Input
                        value={selectedTrainee.school_name || ""}
                        onChange={(e) => patchSelectedTrainee("school_name", e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={selectedTrainee.company_name || ""}
                        onChange={(e) => patchSelectedTrainee("company_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Input
                        value={selectedTrainee.company_position || ""}
                        onChange={(e) => patchSelectedTrainee("company_position", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Industry</Label>
                      <Input
                        value={selectedTrainee.company_industry || ""}
                        onChange={(e) => patchSelectedTrainee("company_industry", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company Email</Label>
                      <Input
                        type="email"
                        value={selectedTrainee.company_email || ""}
                        onChange={(e) => patchSelectedTrainee("company_email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company Landline</Label>
                      <Input
                        value={selectedTrainee.company_landline || ""}
                        onChange={(e) => patchSelectedTrainee("company_landline", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company City</Label>
                      <Input
                        value={selectedTrainee.company_city || ""}
                        onChange={(e) => patchSelectedTrainee("company_city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company Region</Label>
                      <Input
                        value={selectedTrainee.company_region || ""}
                        onChange={(e) => patchSelectedTrainee("company_region", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Workers</Label>
                      <Input
                        type="number"
                        value={selectedTrainee.total_workers ?? ""}
                        onChange={(e) =>
                          patchSelectedTrainee(
                            "total_workers",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold border-b pb-1">Training & Certificate</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Certificate Number</Label>
                      <Input
                        placeholder="e.g. PSI-COURSE-000001"
                        value={selectedTrainee.certificate_number || ""}
                        onChange={(e) => patchSelectedTrainee("certificate_number", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Editing this will change the serial number on the participant&apos;s certificate.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Batch Number</Label>
                      <Input
                        type="number"
                        value={selectedTrainee.batch_number ?? ""}
                        onChange={(e) =>
                          patchSelectedTrainee(
                            "batch_number",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Training Status</Label>
                      <Select
                        value={selectedTrainee.training_status || undefined}
                        onValueChange={(value) => patchSelectedTrainee("training_status", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="First Timer">First Timer</SelectItem>
                          <SelectItem value="Renewal">Renewal</SelectItem>
                          <SelectItem value="Remedial">Remedial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Training Provider</Label>
                      <Input
                        value={selectedTrainee.training_provider || ""}
                        onChange={(e) => patchSelectedTrainee("training_provider", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Training Type</Label>
                      <Input
                        value={selectedTrainee.training_type || ""}
                        onChange={(e) => patchSelectedTrainee("training_type", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Training Program</Label>
                      <Input
                        value={selectedTrainee.training_program || ""}
                        onChange={(e) => patchSelectedTrainee("training_program", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Registration Status</Label>
                      <Input
                        value={selectedTrainee.status || ""}
                        onChange={(e) => patchSelectedTrainee("status", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Physical Cert Status</Label>
                      <Input
                        value={selectedTrainee.physical_cert_status || ""}
                        onChange={(e) => patchSelectedTrainee("physical_cert_status", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-ID Status</Label>
                      <Input
                        value={selectedTrainee.e_id_status || ""}
                        onChange={(e) => patchSelectedTrainee("e_id_status", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 flex items-end gap-2 pb-1">
                      <Checkbox
                        id="edit_add_pvc_id"
                        checked={!!selectedTrainee.add_pvc_id}
                        onCheckedChange={(checked) => patchSelectedTrainee("add_pvc_id", !!checked)}
                      />
                      <Label htmlFor="edit_add_pvc_id" className="cursor-pointer">Add PVC ID</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>PVC Fee</Label>
                      <Input
                        type="number"
                        value={selectedTrainee.pvc_fee ?? ""}
                        onChange={(e) =>
                          patchSelectedTrainee(
                            "pvc_fee",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold border-b pb-1">Payment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Input
                        value={selectedTrainee.payment_method || ""}
                        onChange={(e) => patchSelectedTrainee("payment_method", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Status</Label>
                      <Input
                        value={selectedTrainee.payment_status || ""}
                        onChange={(e) => patchSelectedTrainee("payment_status", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount Paid</Label>
                      <Input
                        type="number"
                        value={selectedTrainee.amount_paid ?? ""}
                        onChange={(e) =>
                          patchSelectedTrainee(
                            "amount_paid",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="pt-4 gap-2 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setIsTraineeDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button className="w-full sm:w-auto" onClick={handleSaveTrainee}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

          {preFetchTotal > 0 && preFetchProgress < preFetchTotal && (
            <div className="px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg space-y-1 mt-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-primary uppercase tracking-wider">
                <span>Background Generation Status</span>
                <span>{preFetchProgress} / {preFetchTotal}</span>
              </div>
              <Progress value={(preFetchProgress / preFetchTotal) * 100} className="h-1 bg-primary/10" />
            </div>
          )}

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

                  {/* Front/Back toggle for ID templates */}
                  {isIdTemplateSelected && (
                    <>
                      <div className="w-px h-4 bg-border mx-1" />
                      <div className="flex items-center bg-muted rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => setIdCardSide("front")}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                            idCardSide === "front"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdCardSide("back")}
                          disabled={!backTemplateForViewer}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                            idCardSide === "back"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          } ${!backTemplateForViewer ? "opacity-30 cursor-not-allowed" : ""}`}
                        >
                          Back
                        </button>
                      </div>
                    </>
                  )}
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
                {/* PDF Loading Overlay */}
                {!certificatePreviews[activePreviewIndex]?.url && (
                  <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="relative mb-4">
                      <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Generating Certificate...</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mt-2">
                       This certificate is being rendered in the background. It will appear automatically in a few seconds.
                    </p>
                  </div>
                )}

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
                    <div
                      className="relative shadow-2xl transition-[width,height] duration-200"
                      style={{
                        width: canvasSize.w * previewZoom,
                        height: canvasSize.h * previewZoom,
                      }}
                    >
                      {/* Direct Editor Layer (Canvas) */}
                      {(() => {
                        const isShowingBack = isIdTemplateSelected && idCardSide === "back"
                        const activeTempl = isShowingBack ? backTemplateForViewer : templateForViewer
                        return activeTempl?.imageUrl && activeTempl.fields?.length > 0
                      })() && (
                        <canvas
                          ref={previewCanvasRef}
                          className="cursor-crosshair bg-white block"
                          style={{
                            width: canvasSize.w * previewZoom,
                            height: canvasSize.h * previewZoom,
                          }}
                          onMouseDown={handlePreviewCanvasMouseDown}
                          onMouseMove={handlePreviewCanvasMouseMove}
                          onMouseUp={handlePreviewCanvasMouseUp}
                          onMouseLeave={handlePreviewCanvasMouseUp}
                          onDoubleClick={handlePreviewCanvasDoubleClick}
                        />
                      )}
                      {inlineFieldEdit && (
                        <div
                          className="absolute z-40 rounded-lg border bg-background p-3 shadow-xl"
                          style={{
                            left: inlineFieldEdit.overlayStyle.left,
                            top: inlineFieldEdit.overlayStyle.top,
                            minWidth: inlineFieldEdit.overlayStyle.minWidth,
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {inlineFieldEdit.kind === "name"
                              ? "Edit Trainee Name"
                              : inlineFieldEdit.kind === "certificate_number"
                                ? "Edit Certificate Number"
                                : inlineFieldEdit.kind === "email"
                                  ? "Edit Email"
                                  : "Edit Batch Number"}
                          </div>

                          {inlineFieldEdit.kind === "name" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1 col-span-2">
                                <Label className="text-[10px]">Professional Title (optional)</Label>
                                <Input
                                  className="h-8 text-xs"
                                  autoFocus
                                  placeholder="e.g. RN, MD"
                                  value={inlineFieldEdit.draft.professional_title}
                                  onChange={(e) =>
                                    setInlineFieldEdit((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: { ...prev.draft, professional_title: e.target.value },
                                          }
                                        : prev
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveInlineFieldEdit()
                                    if (e.key === "Escape") setInlineFieldEdit(null)
                                  }}
                                />
                                <p className="text-[9px] text-muted-foreground">
                                  Added at the end of the name on the certificate.
                                </p>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Suffix</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={inlineFieldEdit.draft.suffix}
                                  onChange={(e) =>
                                    setInlineFieldEdit((prev) =>
                                      prev
                                        ? { ...prev, draft: { ...prev.draft, suffix: e.target.value } }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">First Name</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={inlineFieldEdit.draft.first_name}
                                  onChange={(e) =>
                                    setInlineFieldEdit((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: { ...prev.draft, first_name: e.target.value },
                                          }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">M.I.</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={inlineFieldEdit.draft.middle_initial}
                                  onChange={(e) =>
                                    setInlineFieldEdit((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: { ...prev.draft, middle_initial: e.target.value },
                                          }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1 col-span-2">
                                <Label className="text-[10px]">Last Name</Label>
                                <Input
                                  className="h-8 text-xs"
                                  value={inlineFieldEdit.draft.last_name}
                                  onChange={(e) =>
                                    setInlineFieldEdit((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            draft: { ...prev.draft, last_name: e.target.value },
                                          }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <Input
                              className="h-8 text-xs"
                              autoFocus
                              type={inlineFieldEdit.kind === "email" ? "email" : "text"}
                              value={
                                inlineFieldEdit.kind === "certificate_number"
                                  ? inlineFieldEdit.draft.certificate_number
                                  : inlineFieldEdit.kind === "email"
                                    ? inlineFieldEdit.draft.email
                                    : inlineFieldEdit.draft.batch_number
                              }
                              onChange={(e) =>
                                setInlineFieldEdit((prev) => {
                                  if (!prev) return prev
                                  const key =
                                    prev.kind === "certificate_number"
                                      ? "certificate_number"
                                      : prev.kind === "email"
                                        ? "email"
                                        : "batch_number"
                                  return {
                                    ...prev,
                                    draft: { ...prev.draft, [key]: e.target.value },
                                  }
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveInlineFieldEdit()
                                if (e.key === "Escape") setInlineFieldEdit(null)
                              }}
                            />
                          )}

                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setInlineFieldEdit(null)}
                              disabled={isSavingInlineEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={handleSaveInlineFieldEdit}
                              disabled={isSavingInlineEdit}
                            >
                              {isSavingInlineEdit ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  Saving
                                </>
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </div>
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
                  Drag to move fields. Double-click text to edit trainee info.
                </span>
              </div>
            </div>

            {/* Right Panel: Compact Controls */}
            <div className="w-80 flex flex-col gap-4 overflow-y-auto pr-2 py-1 shrink-0 scrollbar-hide">

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
                      {formatCertificateHolderDisplayName(
                        certificatePreviews[activePreviewIndex]?.trainee || {}
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {selectedTemplateType.charAt(0).toUpperCase() + selectedTemplateType.slice(1)} Template
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {sentCertificateIds.has(certificatePreviews[activePreviewIndex]?.trainee.id || "") && (
                        <Badge className="h-5 rounded-full bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-600">
                          Sent
                        </Badge>
                      )}
                      {failedCertificateIds.has(certificatePreviews[activePreviewIndex]?.trainee.id || "") && (
                        <Badge variant="destructive" className="h-5 rounded-full px-2 text-[10px]">
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {!isIdTemplateSelected && (
                  <div className="space-y-1.5 border-t pt-3">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                      PDF Page Size
                    </Label>
                    <Select
                      value={certificatePageSize}
                      onValueChange={(value) =>
                        setCertificatePageSize(value as CertificatePageSizeKey)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(CERTIFICATE_PAGE_SIZES) as [CertificatePageSizeKey, { label: string }][]).map(
                          ([key, spec]) => (
                            <SelectItem key={key} value={key}>
                              {spec.label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-muted-foreground leading-snug">
                      Applies to PDF view, download, and email attachments. Field positions scale with the selected paper size.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 border-t pt-3">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                    Name Font Family
                  </Label>
                  <Select
                    value={selectedNameFontFamily}
                    onValueChange={(value) =>
                      applyNameFontStyle({ fontFamily: value as CertificateFontFamily })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CERTIFICATE_FONT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold pt-1">
                    Name Font Weight
                  </Label>
                  <Select
                    value={selectedNameFontWeight}
                    onValueChange={(value) =>
                      applyNameFontStyle({ fontWeight: value as CertificateFontWeight })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CERTIFICATE_FONT_WEIGHT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[9px] text-muted-foreground leading-snug">
                    Applies to the certificate name field. Professional title is always shown at the end of the name when set. Use Save Override to keep font settings for this trainee.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start gap-2 h-9 shadow-sm dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
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
                      let ids = selectedTraineeIds
                      if (ids.size === 0) {
                        const current = certificatePreviews[activePreviewIndex]
                        if (!current) return
                        ids = new Set([current.trainee.id])
                        setSelectedTraineeIds(ids)
                      }
                      requestDownloadCertificates(ids)
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
                        openEditTraineeDialog(current.trainee)
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
                        if (!current) return
                        setSelectedTrainee(current.trainee as any)
                        setCropExistingPhoto(!!current.trainee.picture_2x2_url)
                        setShowPhotoCropDialog(true)
                      }}
                    >
                      <Crop className="h-3 w-3" />
                      Crop Photo
                    </Button>
                  </div>
                  <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start gap-1 text-[11px] h-8 border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                          onClick={handleRemovePhotoBackground}
                          disabled={
                            isRemovingBg ||
                            isUploading ||
                            !certificatePreviews[activePreviewIndex]?.trainee.picture_2x2_url
                          }
                        >
                          {isRemovingBg ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eraser className="h-3 w-3" />
                          )}
                          {isRemovingBg ? "Removing…" : "Remove Photo BG"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start gap-1 text-[11px] h-8"
                          onClick={handleRevertOriginalPhoto}
                          disabled={
                            isRemovingBg ||
                            isUploading ||
                            !certificatePreviews[activePreviewIndex]?.trainee.picture_2x2_original ||
                            certificatePreviews[activePreviewIndex]?.trainee.picture_2x2_original ===
                              certificatePreviews[activePreviewIndex]?.trainee.picture_2x2_url
                          }
                        >
                          {isUploading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Revert Original
                        </Button>
                      </div>
                      {bgRemoveProgress && (
                        <p className="text-[9px] text-muted-foreground leading-snug px-0.5">
                          {bgRemoveProgress}
                        </p>
                      )}
                      {!bgRemoveProgress && (
                        <p className="text-[9px] text-muted-foreground leading-snug px-0.5">
                          Free in-browser AI for the 2×2 photo. First run downloads a model. Revert restores the backup taken before BG removal.
                        </p>
                      )}
                    </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-1 text-[11px] h-8"
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
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Move All (X / Y)</Label>
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary text-[10px]">
                          {(layoutOffset.offsetX * 100).toFixed(1)}% / {(layoutOffset.offsetY * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeLayout("offsetX", -0.005)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeLayout("offsetY", -0.005)}>
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeLayout("offsetY", 0.005)}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeLayout("offsetX", 0.005)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[10px]"
                          onClick={() => setLayoutOffset({ offsetX: 0, offsetY: 0 })}
                        >
                          Reset
                        </Button>
                      </div>
                      <Slider
                        value={[layoutOffset.offsetX]}
                        onValueChange={([v]) => setLayoutOffset(prev => ({ ...prev, offsetX: v }))}
                        min={-0.05}
                        max={0.05}
                        step={0.002}
                        className="py-1"
                      />
                      <Slider
                        value={[layoutOffset.offsetY]}
                        onValueChange={([v]) => setLayoutOffset(prev => ({ ...prev, offsetY: v }))}
                        min={-0.05}
                        max={0.05}
                        step={0.002}
                        className="py-1"
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
                        {activeFieldIsPhoto ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-medium">
                              <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                                Photo Size
                              </Label>
                              <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded text-primary text-[10px]">
                                {(getActivePhotoSizeNorm() * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-2 py-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => nudgePhotoSize(-0.01)}
                                title="Decrease size"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => nudgePhotoSize(0.01)}
                                title="Increase size"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[10px]"
                                onClick={() => {
                                  if (!activeFieldId) return
                                  setFieldOverrides((prev) => {
                                    const next = { ...prev }
                                    const current = { ...(next[activeFieldId] || {}) }
                                    delete current.boxWidth
                                    delete current.boxHeight
                                    next[activeFieldId] = current
                                    return next
                                  })
                                }}
                              >
                                Reset
                              </Button>
                            </div>
                            <Slider
                              value={[getActivePhotoSizeNorm()]}
                              onValueChange={([v]) => setActivePhotoSize(v)}
                              min={0.04}
                              max={0.45}
                              step={0.005}
                              className="py-1"
                            />
                            <p className="text-[9px] text-muted-foreground leading-snug">
                              Use − / + or the slider to resize the ID photo. Click Save Override to keep it.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase text-muted-foreground font-bold">Field Font Family</Label>
                              <Select
                                value={
                                  (fieldOverrides[activeFieldId]?.fontFamily as string) ||
                                  templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.fontFamily ||
                                  "Helvetica"
                                }
                                onValueChange={(value) =>
                                  setFieldOverrides((prev) => ({
                                    ...prev,
                                    [activeFieldId]: {
                                      ...(prev[activeFieldId] || {}),
                                      fontFamily: value as CertificateFontFamily,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CERTIFICATE_FONT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] uppercase text-muted-foreground font-bold">Field Font Weight</Label>
                              <Select
                                value={
                                  (fieldOverrides[activeFieldId]?.fontWeight as string) ||
                                  templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.fontWeight ||
                                  "normal"
                                }
                                onValueChange={(value) =>
                                  setFieldOverrides((prev) => ({
                                    ...prev,
                                    [activeFieldId]: {
                                      ...(prev[activeFieldId] || {}),
                                      fontWeight: value as CertificateFontWeight,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CERTIFICATE_FONT_WEIGHT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-medium">
                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Field Position</Label>
                            <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded text-primary text-[10px]">
                              {((fieldOverrides[activeFieldId]?.x ??
                                templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.x ??
                                0) * 100).toFixed(1)}%
                              {" / "}
                              {((fieldOverrides[activeFieldId]?.y ??
                                templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.y ??
                                0) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-2 py-1">
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeField("x", -0.005)}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex flex-col gap-1">
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeField("y", -0.005)}>
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeField("y", 0.005)}>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeField("x", 0.005)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <Slider
                            value={[
                              fieldOverrides[activeFieldId]?.x ??
                                templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.x ??
                                0,
                            ]}
                            onValueChange={([v]) =>
                              setFieldOverrides((prev) => ({
                                ...prev,
                                [activeFieldId]: { ...(prev[activeFieldId] || {}), x: v },
                              }))
                            }
                            min={0}
                            max={1}
                            step={0.002}
                            className="py-1"
                          />
                          <Slider
                            value={[
                              fieldOverrides[activeFieldId]?.y ??
                                templateForViewer?.fields?.find((f) => f.id === activeFieldId)?.y ??
                                0,
                            ]}
                            onValueChange={([v]) =>
                              setFieldOverrides((prev) => ({
                                ...prev,
                                [activeFieldId]: { ...(prev[activeFieldId] || {}), y: v },
                              }))
                            }
                            min={0}
                            max={1}
                            step={0.002}
                            className="py-1"
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
                      {sentCertificateIds.has(item.trainee.id) && (
                        <Badge className="h-5 rounded-full bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-600">
                          Sent
                        </Badge>
                      )}
                      {failedCertificateIds.has(item.trainee.id) && (
                        <Badge variant="destructive" className="h-5 rounded-full px-2 text-[10px]">
                          Failed
                        </Badge>
                      )}
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

      <ImageCropDialog
        open={showPhotoCropDialog}
        onOpenChange={setShowPhotoCropDialog}
        imageType="2x2"
        existingImageUrl={
          cropExistingPhoto ? selectedTrainee?.picture_2x2_url || undefined : undefined
        }
        onSave={handleSaveCroppedPhoto}
        title={cropExistingPhoto ? "Crop Participant Photo" : "Upload & Crop Participant Photo"}
      />

      <AlertDialog open={downloadPackageOpen} onOpenChange={setDownloadPackageOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Download packaging</AlertDialogTitle>
            <AlertDialogDescription>
              You selected {selectedTraineeIds.size}{" "}
              {selectedTemplateType === "excellence" ? "ID(s)" : "certificate(s)"}. Choose how to
              package the files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              className="h-auto justify-start gap-3 px-4 py-3"
              onClick={() => void handleDownloadCertificates("combined")}
              disabled={isGenerating}
            >
              <FileStack className="h-5 w-5 shrink-0" />
              <span className="text-left">
                <span className="block font-medium">One combined PDF</span>
                <span className="block text-xs font-normal opacity-90">
                  All pages in a single file
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              onClick={() => void handleDownloadCertificates("separate")}
              disabled={isGenerating}
            >
              <Files className="h-5 w-5 shrink-0" />
              <span className="text-left">
                <span className="block font-medium">Separate PDFs (ZIP)</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  One file per person, packed in a ZIP
                </span>
              </span>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
    {typeof document !== "undefined" && bgJobItems.length > 0
      ? createPortal(
          <div className="pointer-events-auto fixed bottom-4 right-4 z-[9999] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-background shadow-2xl">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
              onClick={() => setBgJobExpanded((openPanel) => !openPanel)}
            >
              {isRemovingBg ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />
              ) : (
                <Eraser className="h-4 w-4 shrink-0 text-violet-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {isRemovingBg ? "Removing backgrounds…" : "Background removal"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {bgJobItems.filter((item) => item.status === "done").length}/{bgJobItems.length} done
                  {bgRemoveProgress ? ` · ${bgRemoveProgress}` : ""}
                </p>
              </div>
              {bgJobExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            <Progress
              value={
                bgJobItems.length
                  ? Math.round(
                      (bgJobItems.filter((item) =>
                        item.status === "done" || item.status === "skipped" || item.status === "error",
                      ).length /
                        bgJobItems.length) *
                        100,
                    )
                  : 0
              }
              className="h-1 rounded-none"
            />
            {bgJobExpanded ? (
              <div className="space-y-2 border-t px-3 py-2">
                <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Do not close or refresh this tab until this finishes.
                </p>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                  {bgJobItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span
                        className={
                          item.status === "done"
                            ? "mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                            : item.status === "error"
                              ? "mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500"
                              : item.status === "running"
                                ? "mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-500"
                                : "mt-0.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40"
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.name}</span>
                        <span className="block truncate text-muted-foreground">{item.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {!isRemovingBg ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => setBgJobItems([])}
                  >
                    Dismiss
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                Keep this tab open
              </p>
            )}
          </div>,
          document.body,
        )
      : null}
    </>
  )
}