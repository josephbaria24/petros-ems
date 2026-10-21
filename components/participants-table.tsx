// components/participants-table.tsx 

"use client"

import { tmsDb } from "@/lib/supabase-client"
import { consumePendingCertOpen } from "@/lib/pending-cert-reminders"
import { isOshCourse } from "@/lib/osh-program"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import QRCode from "qrcode"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table"
import { ArrowUpDown, MoreVertical, Eye, Edit, Trash2, Link2, RefreshCcw, X, QrCode, Download, CalendarClock, FolderArchive, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type PostgrestSingleResponse } from "@supabase/supabase-js"
import { toast } from "sonner"
import ParticipantDirectoryDialog from "@/components/trainee-directory-dialog"
import { EditScheduleDialog } from "@/components/edit-schedule-dialog"
import { TraineeSearchDialog } from "./trainee-search-dialog"
import { ScheduleDetailDialog } from "./schedule-detail-dialog"
import { ScheduleEvaluationsDialog } from "./evaluation-dialog"
import { ClipboardList } from "lucide-react"
import { DownloadPassersDialog } from "@/components/download-passers-dialog"

const SubmissionIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    {...props}
  >
    <path
      fill="currentColor"
      d="M7.5 9c.194 0 .382.03.56.081a1.5 1.5 0 0 0 .322 1.419a1.5 1.5 0 0 0-.382 1c0 .384.144.735.382 1a1.5 1.5 0 0 0-.363.77C7.208 13.742 6.142 14 5 14c-1.175 0-2.27-.272-3.089-.77C1.091 12.73.5 11.965.5 11a2 2 0 0 1 2-2zm7 4a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0-2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0-2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zM5 2.5A2.75 2.75 0 1 1 5 8a2.75 2.75 0 0 1 0-5.5m7.002.997a2.252 2.252 0 1 1 0 4.503a2.252 2.252 0 0 1 0-4.503"
    />
  </svg>
)

const DirectoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.07 5.258C2 5.626 2 6.068 2 6.95V14c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225C20.151 6 18.834 6 16.202 6h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352C12.224 5.224 11.816 4.815 11 4l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903C7.53 2 7.336 2 6.95 2c-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.257M12.25 10a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75"
      clipRule="evenodd"
    />
  </svg>
)

const AttendanceIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    {...props}
  >
    <path
      fill="currentColor"
      d="M6.75 9a3.25 3.25 0 1 0 0-6.5a3.25 3.25 0 0 0 0 6.5M17 6.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0m-8 8c0-1.704.775-3.228 1.993-4.237A2 2 0 0 0 10 10H3.5a2 2 0 0 0-2 2s0 4 5.25 4c.953 0 1.733-.132 2.371-.347A5.5 5.5 0 0 1 9 14.5m10 0a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m-2.146-1.854a.5.5 0 0 0-.708 0L13.5 15.293l-.646-.647a.5.5 0 0 0-.708.708l1 1a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0 0-.708"
    />
  </svg>
)

const ProgramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M7 2h8.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 20 6.828V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m5 1.5V8a1 1 0 0 0 1 1h4.5L12 3.5ZM8.5 11.25a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5zm0 3a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5zm0 3a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5z"
    />
  </svg>
)

const ExamIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.828a2 2 0 0 0-.586-1.414l-4.828-4.828A2 2 0 0 0 12.172 2zm5 1.5V8a1 1 0 0 0 1 1h4.5L12 3.5ZM8.75 12a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5H9.5a.75.75 0 0 1-.75-.75m0 3a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5H9.5a.75.75 0 0 1-.75-.75m0 3a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H9.5a.75.75 0 0 1-.75-.75"
    />
  </svg>
)

type Participant = {
  id: string
  course: string
  branch: string
  schedule: string
  status: string
  type: string
  submissionCount: number
  sortDate?: Date | null
  scheduleMonth?: string
  trainerName?: string
  totalTrainingAmount: number
  totalAmountPaid: number
  sessionDays: number
}

/** Empty schedules starting in 1 day, or ongoing with no participants — offer reschedule. */
function shouldOfferReschedule(participant: Participant): boolean {
  if ((participant.submissionCount || 0) > 0) return false
  const status = (participant.status || "").toLowerCase()
  if (status === "cancelled" || status === "finished") return false

  if (status === "ongoing") return true

  if (status === "planned" || status === "confirmed") {
    if (!participant.sortDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(participant.sortDate)
    start.setHours(0, 0, 0, 0)
    const dayMs = 24 * 60 * 60 * 1000
    const daysUntilStart = Math.round((start.getTime() - today.getTime()) / dayMs)
    // Only when there is exactly 1 day left before the training starts
    return daysUntilStart === 1
  }

  return false
}

interface ParticipantsTableProps {
  status: "all" | "planned" | "ongoing" | "confirmed" | "cancelled" | "finished"
  refreshTrigger?: number
}

const COST_CALC_STORAGE_KEY = "participants-table-cost-calculator-v1"
const COST_CALC_DB_KEY = "participants_table_cost_calculator"
type CostCalcSetting = {
  trainerFeePerDay: number
  idCostPerParticipant: number
  certificateCostPerParticipant: number
}

export function ParticipantsTable({ status, refreshTrigger }: ParticipantsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [data, setData] = React.useState<Participant[]>([])
  const [loading, setLoading] = React.useState(true)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [showSwipeHint, setShowSwipeHint] = React.useState(false)
  const tableScrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => {
      const desktop = mq.matches
      setColumnVisibility(
        desktop
          ? {}
          : {
              branch: false,
              schedule: false,
              type: false,
              amounts: false,
              costCalculator: false,
              proceedTag: false,
            }
      )
      if (desktop) setShowSwipeHint(false)
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  React.useEffect(() => {
    const el = tableScrollRef.current
    if (!el || typeof window === "undefined") return

    const updateHint = () => {
      const canScroll = el.scrollWidth > el.clientWidth + 8
      const atStart = el.scrollLeft < 12
      const isMobile = window.matchMedia("(max-width: 767px)").matches
      setShowSwipeHint(isMobile && canScroll && atStart)
    }

    updateHint()
    el.addEventListener("scroll", updateHint, { passive: true })
    window.addEventListener("resize", updateHint)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHint) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener("scroll", updateHint)
      window.removeEventListener("resize", updateHint)
      ro?.disconnect()
    }
  }, [data, columnVisibility, loading])
  const [trainerFeePerDay, setTrainerFeePerDay] = React.useState<number>(0)
  const [idCostPerParticipant, setIdCostPerParticipant] = React.useState<number>(0)
  const [certificateCostPerParticipant, setCertificateCostPerParticipant] = React.useState<number>(0)
  const [dialogTrainerFeePerDay, setDialogTrainerFeePerDay] = React.useState<number>(0)
  const [dialogIdCostPerParticipant, setDialogIdCostPerParticipant] = React.useState<number>(0)
  const [dialogCertificateCostPerParticipant, setDialogCertificateCostPerParticipant] = React.useState<number>(0)
  const [costSettingsBySchedule, setCostSettingsBySchedule] = React.useState<Record<string, CostCalcSetting>>({})
  const [costSettingsLoaded, setCostSettingsLoaded] = React.useState(false)

  const formatCurrency = React.useCallback((value: number) => {
    return Number(value || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }, [])

  const getCostSettingsForSchedule = React.useCallback(
    (scheduleId: string): CostCalcSetting => {
      return (
        costSettingsBySchedule[scheduleId] || {
          trainerFeePerDay,
          idCostPerParticipant,
          certificateCostPerParticipant,
        }
      )
    },
    [costSettingsBySchedule, trainerFeePerDay, idCostPerParticipant, certificateCostPerParticipant]
  )

  const getProceedAssessment = React.useCallback(
    (receivables: number, estimatedCost: number, hasAnyCostSetup: boolean) => {
      const r = Number(receivables || 0)
      const c = Number(estimatedCost || 0)
      const net = r - c
      const netRatio = r > 0 ? net / r : -1

      if (!hasAnyCostSetup && r <= 0) {
        return {
          label: "Undefined",
          className: "bg-slate-100 text-slate-700 border-slate-300",
          netRatio: 0,
        }
      }
      if (!hasAnyCostSetup && r > 0) {
        return {
          label: "Undefined Cost",
          className: "bg-slate-100 text-slate-700 border-slate-300",
          netRatio: 0,
        }
      }

      if (c > r) {
        return {
          label: "Loss if Proceed",
          className: "bg-red-100 text-red-800 border-red-300",
          netRatio,
        }
      }
      if (netRatio >= 0.3) {
        return {
          label: "Safe to Proceed",
          className: "bg-emerald-100 text-emerald-800 border-emerald-300",
          netRatio,
        }
      }
      return {
        label: "Can Proceed",
        className: "bg-amber-100 text-amber-900 border-amber-300",
        netRatio,
      }
    },
    []
  )

  React.useEffect(() => {
    let cancelled = false
    const loadCostSettings = async () => {
      try {
        const { data } = await tmsDb
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", COST_CALC_DB_KEY)
          .maybeSingle()

        const dbSettings = data?.setting_value as
          | {
              trainerFeePerDay?: number
              idCostPerParticipant?: number
              certificateCostPerParticipant?: number
              defaults?: {
                trainerFeePerDay?: number
                idCostPerParticipant?: number
                certificateCostPerParticipant?: number
              }
              bySchedule?: Record<string, CostCalcSetting>
            }
          | undefined

        let loadedFromDb = false
        if (dbSettings && typeof dbSettings === "object") {
          const defaults = dbSettings.defaults || dbSettings
          if (typeof defaults.trainerFeePerDay === "number") setTrainerFeePerDay(defaults.trainerFeePerDay)
          if (typeof defaults.idCostPerParticipant === "number") setIdCostPerParticipant(defaults.idCostPerParticipant)
          if (typeof defaults.certificateCostPerParticipant === "number") setCertificateCostPerParticipant(defaults.certificateCostPerParticipant)
          if (dbSettings.bySchedule && typeof dbSettings.bySchedule === "object") {
            setCostSettingsBySchedule(dbSettings.bySchedule)
          }
          loadedFromDb = true
        }

        if (!loadedFromDb && typeof window !== "undefined") {
          const raw = window.localStorage.getItem(COST_CALC_STORAGE_KEY)
          if (raw) {
            const parsed = JSON.parse(raw) as {
              trainerFeePerDay?: number
              idCostPerParticipant?: number
              certificateCostPerParticipant?: number
              defaults?: {
                trainerFeePerDay?: number
                idCostPerParticipant?: number
                certificateCostPerParticipant?: number
              }
              bySchedule?: Record<string, CostCalcSetting>
            }
            const defaults = parsed.defaults || parsed
            if (typeof defaults.trainerFeePerDay === "number") setTrainerFeePerDay(defaults.trainerFeePerDay)
            if (typeof defaults.idCostPerParticipant === "number") setIdCostPerParticipant(defaults.idCostPerParticipant)
            if (typeof defaults.certificateCostPerParticipant === "number") setCertificateCostPerParticipant(defaults.certificateCostPerParticipant)
            if (parsed.bySchedule && typeof parsed.bySchedule === "object") {
              setCostSettingsBySchedule(parsed.bySchedule)
            }
          }
        }
      } catch (error) {
        console.warn("Failed to load cost calculator settings:", error)
      } finally {
        if (!cancelled) setCostSettingsLoaded(true)
      }
    }

    loadCostSettings()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!costSettingsLoaded) return

    const payload = {
      defaults: {
        trainerFeePerDay,
        idCostPerParticipant,
        certificateCostPerParticipant,
      },
      bySchedule: costSettingsBySchedule,
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COST_CALC_STORAGE_KEY, JSON.stringify(payload))
      }
    } catch (error) {
      console.warn("Failed to save local cost calculator settings:", error)
    }

    const timer = window.setTimeout(async () => {
      const { error } = await tmsDb
        .from("system_settings")
        .upsert(
          [{ setting_key: COST_CALC_DB_KEY, setting_value: payload }],
          { onConflict: "setting_key" }
        )
      if (error) {
        console.warn("Failed to save cost calculator settings to DB:", error)
      }
    }, 400)

    return () => window.clearTimeout(timer)
  }, [
    costSettingsLoaded,
    trainerFeePerDay,
    idCostPerParticipant,
    certificateCostPerParticipant,
    costSettingsBySchedule,
  ])

  // Alert dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [reschedulePromptOpen, setReschedulePromptOpen] = React.useState(false)
  const [selectedParticipant, setSelectedParticipant] = React.useState<Participant | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [exportProgress, setExportProgress] = React.useState<{
    course: string
    percent: number
    label: string
  } | null>(null)
  const [isCancelling, setIsCancelling] = React.useState(false)

  const [directoryOpen, setDirectoryOpen] = React.useState(false)
  const [evaluationsOpen, setEvaluationsOpen] = React.useState(false)
  const [passersDialogOpen, setPassersDialogOpen] = React.useState(false)
  const [costDialogOpen, setCostDialogOpen] = React.useState(false)
  const [costDialogParticipant, setCostDialogParticipant] = React.useState<Participant | null>(null)
  const [directoryScheduleId, setDirectoryScheduleId] = React.useState<string | null>(null)
  const [directoryCourseName, setDirectoryCourseName] = React.useState("")
  const [directoryRange, setDirectoryRange] = React.useState("")
  const [directoryAutoSelectIds, setDirectoryAutoSelectIds] = React.useState<string[]>([])
  const [directoryAutoViewCerts, setDirectoryAutoViewCerts] = React.useState(false)
  const searchParams = useSearchParams()
  const openedDirectoryKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (status !== "finished" && status !== "all") return
    const openDirectory = searchParams.get("openDirectory")
    if (!openDirectory || loading) return
    const consumeKey = `${status}:${openDirectory}`
    if (openedDirectoryKeyRef.current === consumeKey) return

    const row = data.find((item) => item.id === openDirectory)
    if (!row && status !== "finished") return

    const payload = consumePendingCertOpen(openDirectory)
    openedDirectoryKeyRef.current = consumeKey
    setDirectoryScheduleId(openDirectory)
    setDirectoryCourseName(row?.course || "Training")
    setDirectoryRange(row?.schedule || "")
    setDirectoryAutoSelectIds(payload?.traineeIds || [])
    setDirectoryAutoViewCerts(Boolean(payload?.viewCerts))
    setDirectoryOpen(true)
  }, [searchParams, data, loading, status])

  const handleView = (participant: Participant) => {
    setSelectedParticipant(participant)
    setViewDialogOpen(true)
  }

  const handleCopyRegistrationLink = (participant: Participant) => {
    // Build the registration link with schedule_id (matching the registration page parameter)
    const baseUrl = window.location.origin
    const registrationUrl = `${baseUrl}/guest-training-registration?schedule_id=${participant.id}`

    // Copy to clipboard
    navigator.clipboard.writeText(registrationUrl).then(() => {
      toast.success("Registration link copied!", {
        description: "Share this link to allow trainees to register",
      })
    }).catch((err) => {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy link", {
        description: "Please try again",
      })
    })
  }

  const handleDownloadQRCode = async (participant: Participant) => {
    // Build the registration link
    const baseUrl = window.location.origin
    const registrationUrl = `${baseUrl}/guest-training-registration?schedule_id=${participant.id}`

    try {
      // 1. Create a temporary canvas for the QR code
      const qrCanvas = document.createElement("canvas")
      const qrSize = 1024

      await QRCode.toCanvas(qrCanvas, registrationUrl, {
        width: qrSize,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })

      // 2. Create the final canvas with extra space for text
      const finalCanvas = document.createElement("canvas")
      const ctx = finalCanvas.getContext("2d")
      if (!ctx) throw new Error("Could not get canvas context")

      const padding = 60
      const textLineHeight = 50
      const extraHeight = 250 // Space for 3 lines of text + padding

      finalCanvas.width = qrSize
      finalCanvas.height = qrSize + extraHeight

      // 3. Fill background with white
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

      // 4. Draw QR code
      ctx.drawImage(qrCanvas, 0, 0)

      // 5. Draw Text Labels
      ctx.textAlign = "center"
      ctx.fillStyle = "#000000"

      // Course Name
      ctx.font = "bold 44px Arial, sans-serif"
      ctx.fillText(participant.course, qrSize / 2, qrSize + padding)

      // Date Range
      ctx.font = "36px Arial, sans-serif"
      ctx.fillText(participant.schedule, qrSize / 2, qrSize + padding + textLineHeight + 10)

      // Petrosphere Inc.
      ctx.font = "bold 40px Arial, sans-serif"
      ctx.fillStyle = "#1a1f71" // Use the brand navy blue
      ctx.fillText("Petrosphere Inc.", qrSize / 2, qrSize + padding + (textLineHeight * 2) + 30)

      // 6. Trigger Download
      const dataUrl = finalCanvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `QR-Registration-${participant.course.replace(/[^a-z0-9]/gi, "-")}-${participant.id.slice(0, 8)}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("QR Code downloaded!", {
        description: `QR for ${participant.course} with details is ready.`,
      })
    } catch (err) {
      console.error("Failed to generate labeled QR code:", err)
      toast.error("Failed to generate QR code", {
        description: "Please try again",
      })
    }
  }

  function formatScheduleDateRange(start: string, end: string) {
    const s = new Date(start)
    const e = new Date(end)

    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()

    const fullMonth = s.toLocaleString("en-US", { month: "long" })
    const shortMonth = s.toLocaleString("en-US", { month: "short" })
    const endShortMonth = e.toLocaleString("en-US", { month: "short" })

    if (s.toDateString() === e.toDateString()) {
      // Single date
      return `${fullMonth} ${s.getDate()}, ${s.getFullYear()}`
    }

    if (sameMonth) {
      // Example: November 21–25, 2025
      return `${fullMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
    }

    // Example: Nov. 29, 2025 – Dec. 2, 2025
    return `${shortMonth}. ${s.getDate()}, ${s.getFullYear()} – ${endShortMonth}. ${e.getDate()}, ${e.getFullYear()}`
  }

  function getScheduleMonth(date: Date): string {
    return date.toLocaleString("en-US", { month: "long", year: "numeric" })
  }

  const handleEdit = (participant: Participant) => {
    setSelectedParticipant(participant)
    setEditDialogOpen(true)
  }

  const handleReschedulePrompt = (participant: Participant) => {
    setSelectedParticipant(participant)
    setReschedulePromptOpen(true)
  }

  const handleConfirmReschedule = () => {
    setReschedulePromptOpen(false)
    if (selectedParticipant) {
      setEditDialogOpen(true)
    }
  }

  const handleManageEvaluations = (participant: Participant) => {
    setSelectedParticipant(participant)
    setEvaluationsOpen(true)
  }

  const handleDownloadPassers = (participant: Participant) => {
    setSelectedParticipant(participant)
    setPassersDialogOpen(true)
  }

  const handleExportScheduleData = async (participant: Participant) => {
    if (exportProgress) return
    setExportProgress({ course: participant.course, percent: 0, label: "Starting export" })
    try {
      const { exportSchedulePack } = await import("@/lib/exports/export-schedule-pack")
      const notes = await exportSchedulePack({
        scheduleId: participant.id,
        courseName: participant.course,
        scheduleRange: participant.schedule,
        onProgress: (percent, label) => {
          setExportProgress({ course: participant.course, percent, label })
        },
      })
      setExportProgress({ course: participant.course, percent: 100, label: "Download ready" })
      toast.success("Schedule data exported", {
        description: notes.length ? notes.join(" ") : `${participant.course}.zip is downloading.`,
      })
      await new Promise((resolve) => setTimeout(resolve, 700))
    } catch (error) {
      toast.error("Could not export schedule data", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      })
    } finally {
      setExportProgress(null)
    }
  }

  const handleDeleteClick = (participant: Participant) => {
    setSelectedParticipant(participant)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedParticipant) return

    setIsDeleting(true)
    const toastId = toast.loading("Deleting schedule...", {
      description: "Removing all related records...",
    })

    try {
      // Delete related records first (in order of dependencies)
      // 1. Delete trainings
      const { error: trainingsError } = await tmsDb
        .from("trainings")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (trainingsError) {
        toast.error("Failed to delete trainings", {
          id: toastId,
          description: trainingsError.message,
        })
        setIsDeleting(false)
        return
      }

      // 2. Delete schedule_dates
      const { error: datesError } = await tmsDb
        .from("schedule_dates")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (datesError) {
        toast.error("Failed to delete schedule dates", {
          id: toastId,
          description: datesError.message,
        })
        setIsDeleting(false)
        return
      }

      // 3. Delete schedule_ranges
      const { error: rangesError } = await tmsDb
        .from("schedule_ranges")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (rangesError) {
        toast.error("Failed to delete schedule ranges", {
          id: toastId,
          description: rangesError.message,
        })
        setIsDeleting(false)
        return
      }

      // 4. Finally delete the schedule
      const { error: scheduleError } = await tmsDb
        .from("schedules")
        .delete()
        .eq("id", selectedParticipant.id)

      if (scheduleError) {
        toast.error("Failed to delete schedule", {
          id: toastId,
          description: scheduleError.message,
        })
      } else {
        toast.success("Schedule deleted successfully", {
          id: toastId,
          description: `${selectedParticipant.course} schedule has been removed.`,
        })
        // Refresh data
        setData((prevData) => prevData.filter((item) => item.id !== selectedParticipant.id))
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Unexpected error", {
        id: toastId,
        description: "An error occurred while deleting",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setSelectedParticipant(null)
    }
  }

  const fetchTrainings = React.useCallback(async () => {
    setLoading(true)

    let query = tmsDb
      .from("schedules")
      .select(`
        id,
        branch,
        event_type,
        schedule_type,
        status,
        trainer_name,
        day_trainers,
        courses (
          name,
          training_fee,
          online_fee,
          face_to_face_fee,
          elearning_fee
        ),
        schedule_ranges (
          start_date,
          end_date
        ),
        schedule_dates (
          date
        ),
        trainings (
          id,
          training_type,
          amount_paid,
          has_discount,
          discounted_fee,
          add_pvc_id,
          pvc_fee
        )
      `)
      .order("created_at", { ascending: false })

    // Only filter by status if not "all"
    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error }: PostgrestSingleResponse<any[]> = await query

    if (error) {
      console.error("Supabase fetch error:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      setData([])
    } else {
      console.log("Fetched schedules data:", data)
      console.log("COSH schedules:", data?.filter(s => s.courses?.name?.includes("COSH")))
      const now = new Date()
      const mapped: Participant[] = (data ?? [])
        .map((schedule) => {
          const courseName = schedule.courses?.name ?? "Unknown Course"
          const branch = schedule.branch ?? "N/A"
          const firstTraining = schedule.trainings?.[0]
          const type = firstTraining?.training_type ?? schedule.event_type ?? "Public"
          const scheduleStatus = schedule.status ?? "planned"

          let scheduleDisplay = ""
          let sortDate: Date | null = null
          let scheduleMonth: string | undefined = undefined
          let sessionDays = 0

          if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.length) {
            const range = schedule.schedule_ranges[0]
            scheduleDisplay = formatScheduleDateRange(range.start_date, range.end_date)
            sortDate = new Date(range.start_date)
            scheduleMonth = getScheduleMonth(sortDate)
            const start = new Date(range.start_date)
            const end = new Date(range.end_date)
            sessionDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
          } else if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length) {
            scheduleDisplay = schedule.schedule_dates
              .map((d: { date: string }) =>
                formatScheduleDateRange(d.date, d.date)
              )
              .join(", ")
            sortDate = new Date(schedule.schedule_dates[0].date)
            scheduleMonth = getScheduleMonth(sortDate)
            sessionDays = schedule.schedule_dates.length
          }

          const eventType = String(schedule.event_type || "").toLowerCase()
          const baseFee =
            eventType === "online"
              ? Number(schedule.courses?.online_fee ?? 0)
              : eventType === "face-to-face"
                ? Number(schedule.courses?.face_to_face_fee ?? 0)
                : eventType === "elearning"
                  ? Number(schedule.courses?.elearning_fee ?? 0)
                  : Number(schedule.courses?.training_fee ?? 0)

          const totals = (schedule.trainings || []).reduce(
            (acc: { training: number; paid: number }, t: any) => {
              const hasDiscount = Boolean(t?.has_discount)
              const discountedFee =
                hasDiscount && t?.discounted_fee != null
                  ? Number(t.discounted_fee)
                  : null
              const pvcFee = t?.add_pvc_id ? Number(t?.pvc_fee ?? 0) : 0
              const perTraineeTotal = (discountedFee ?? baseFee) + pvcFee
              acc.training += perTraineeTotal
              acc.paid += Number(t?.amount_paid ?? 0)
              return acc
            },
            { training: 0, paid: 0 }
          )

          return {
            id: schedule.id,
            course: courseName,
            branch,
            schedule: scheduleDisplay,
            status: scheduleStatus,
            type,
            submissionCount: schedule.trainings?.length ?? 0,
            sortDate,
            scheduleMonth,
            sessionDays,
            totalTrainingAmount: totals.training,
            totalAmountPaid: totals.paid,
            trainerName: schedule.day_trainers && Object.keys(schedule.day_trainers).length > 0
              ? Array.from(new Set(Object.values(schedule.day_trainers as Record<string, string>).filter(Boolean)))
                .join(", ")
              : schedule.trainer_name || "",
          }
        })
        .sort((a, b) => {
          // Priority 1: Sort by status (ongoing should always be first)
          const statusPriority: Record<string, number> = {
            ongoing: 0,
            confirmed: 1,
            planned: 2,
            cancelled: 3,
            finished: 4
          }

          const aPriority = statusPriority[a.status] ?? 5
          const bPriority = statusPriority[b.status] ?? 5

          // If different status priorities, sort by status
          if (aPriority !== bPriority) {
            return aPriority - bPriority
          }

          // Priority 2: Within same status, sort by date
          if (!a.sortDate && !b.sortDate) return 0
          if (!a.sortDate) return 1
          if (!b.sortDate) return -1

          const now = new Date()
          const aFuture = a.sortDate >= now
          const bFuture = b.sortDate >= now

          // Both future: sort ascending (nearest first)
          if (aFuture && bFuture) return a.sortDate.getTime() - b.sortDate.getTime()
          // Both past: sort descending (most recent first)
          if (!aFuture && !bFuture) return b.sortDate.getTime() - a.sortDate.getTime()
          // One future, one past: future comes first
          return aFuture ? -1 : 1
        })

      setData(mapped)
    }

    setLoading(false)
  }, [status])

  React.useEffect(() => {
    fetchTrainings()
  }, [status, refreshTrigger, fetchTrainings])

  const columns: ColumnDef<Participant>[] = [
    {
      accessorKey: "course",
      header: () => <div className="min-w-[120px] md:w-[260px]">Course</div>,
      cell: ({ row }) => {
        const submissionCount = row.original.submissionCount
        const isCancelled = row.original.status === 'cancelled'
        const actionClass =
          "inline-flex h-7 items-center justify-center gap-0.5 rounded-md px-1.5 text-[10px] text-foreground hover:bg-muted cursor-pointer md:h-6 md:gap-1 md:px-1.5"

        return (
          <div className="min-w-[120px] space-y-1 md:w-[260px] md:space-y-1.5">
            <div
              className={`truncate text-sm font-medium text-card-foreground md:text-base ${isCancelled ? "text-muted-foreground line-through" : ""}`}
              title={String(row.getValue("course"))}
            >
              {row.getValue("course")}
            </div>
            <div className="flex flex-nowrap items-center gap-0.5 md:flex-wrap md:gap-1">
              <Link
                href={`/submissions?scheduleId=${row.original.id}&from=${status}`}
                className={actionClass}
                title="Submission"
                onClick={(e) => e.stopPropagation()}
              >
                <SubmissionIcon className="h-3.5 w-3.5 shrink-0 md:h-3 md:w-3" />
                <span className="hidden md:inline">Submission</span>
                {submissionCount > 0 && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[9px] leading-none md:ml-0.5 md:text-xs">
                    {submissionCount}
                  </Badge>
                )}
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className={`${actionClass} hover:bg-muted`}
                title="Directory"
                onClick={(e) => {
                  e.stopPropagation()
                  setDirectoryScheduleId(row.original.id)
                  setDirectoryCourseName(row.original.course)
                  setDirectoryRange(row.original.schedule)
                  setDirectoryAutoSelectIds([])
                  setDirectoryAutoViewCerts(false)
                  setDirectoryOpen(true)
                }}
              >
                <DirectoryIcon className="h-3.5 w-3.5 shrink-0 md:h-3 md:w-3" />
                <span className="hidden md:inline">Directory</span>
              </Button>

              <Link
                href={`/training-schedules/attendance?scheduleId=${row.original.id}&from=${status}`}
                className={actionClass}
                title="Attendance"
                onClick={(e) => e.stopPropagation()}
              >
                <AttendanceIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Attendance</span>
              </Link>

              <Link
                href={`/training-schedules/exam?scheduleId=${row.original.id}&from=${status}`}
                className={actionClass}
                title="Exam"
                onClick={(e) => e.stopPropagation()}
              >
                <ExamIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Exam</span>
              </Link>

              {isOshCourse(String(row.original.course || "")) ? (
                <Link
                  href={`/training-schedules/program?scheduleId=${row.original.id}&from=${status}`}
                  className={actionClass}
                  title="Program"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ProgramIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">Program</span>
                </Link>
              ) : null}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "trainerName",
      header: "Trainer",
      cell: ({ row }) => {
        const trainerName = row.getValue("trainerName") as string || "—"
        return (
          <div
            className="max-w-[88px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-card-foreground md:max-w-[150px] md:text-sm"
            title={trainerName}
          >
            {trainerName}
          </div>
        )
      },
    },
    {
      accessorKey: "branch",
      header: () => <div className="w-[100px]">Branch</div>,
      cell: ({ row }) => {
        const branch = String(row.getValue("branch") ?? "—")
        return (
          <div className="w-[100px] text-card-foreground truncate text-xs" title={branch}>
            {branch}
          </div>
        )
      },
    },
    {
      accessorKey: "schedule",
      header: "Schedule",
      cell: ({ row }) => {
        const scheduleText = row.getValue("schedule") as string
        return (
          <div
            className="text-card-foreground max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap"
            title={scheduleText}
          >
            {scheduleText}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusValue = row.getValue("status") as string
        const participant = row.original
        const showReschedule = shouldOfferReschedule(participant)

        // Color-coded badges based on status
        const statusStyles = {
          planned: "bg-yellow-100 text-yellow-800 border-yellow-300",
          ongoing: "bg-orange-100 text-orange-800 border-orange-300",
          confirmed: "bg-blue-100 text-blue-800 border-blue-300",
          cancelled: "bg-red-100 text-red-800 border-red-300",
          finished: "bg-gray-100 text-gray-800 border-gray-300"
        }

        const style = statusStyles[statusValue as keyof typeof statusStyles] || "bg-gray-100 text-gray-800 border-gray-300"

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge className={`${style} border px-1.5 py-0 text-[10px] md:px-2.5 md:py-0.5 md:text-xs`}>
              {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
            </Badge>
            {showReschedule && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-900 hover:bg-amber-100 hover:text-amber-950 md:px-2 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReschedulePrompt(participant)
                }}
                title="No participants yet — consider rescheduling"
              >
                <CalendarClock className="h-3 w-3" />
                <span className="hidden sm:inline">Reschedule?</span>
              </Button>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string
        return (
          <Badge variant="outline" className="bg-muted">
            {type}
          </Badge>
        )
      },
    },
    {
      id: "amounts",
      header: "Training / Paid",
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="space-y-1 text-xs">
            <div className="font-medium text-card-foreground">
              {formatCurrency(p.totalTrainingAmount)}
            </div>
            <div className="text-muted-foreground">
              Paid: {formatCurrency(p.totalAmountPaid)}
            </div>
          </div>
        )
      },
    },
    {
      id: "costCalculator",
      header: "Cost Calculator",
      cell: ({ row }) => {
        const p = row.original
        const setting = getCostSettingsForSchedule(p.id)
        const trainerCost = setting.trainerFeePerDay * (p.sessionDays || 0)
        const participantCost = (setting.idCostPerParticipant + setting.certificateCostPerParticipant) * (p.submissionCount || 0)
        const totalCost = trainerCost + participantCost
        return (
          <button
            type="button"
            className="w-full rounded-md border border-border bg-muted/20 px-2 py-1.5 text-left space-y-1 text-xs cursor-pointer transition-colors hover:bg-muted/60 hover:border-primary/40 active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={(e) => {
              e.stopPropagation()
              setCostDialogParticipant(p)
              const selected = getCostSettingsForSchedule(p.id)
              setDialogTrainerFeePerDay(selected.trainerFeePerDay)
              setDialogIdCostPerParticipant(selected.idCostPerParticipant)
              setDialogCertificateCostPerParticipant(selected.certificateCostPerParticipant)
              setCostDialogOpen(true)
            }}
            title="Click to open cost calculator"
          >
            <div className="text-muted-foreground">
              Fee: {formatCurrency(trainerCost)}
            </div>
            <div className="text-muted-foreground">
              IDs/Cert: {formatCurrency(participantCost)}
            </div>
            <div className="font-semibold text-card-foreground border-t border-border/60 pt-1">
              Total: {formatCurrency(totalCost)}
            </div>
          </button>
        )
      },
    },
    {
      id: "proceedTag",
      header: "Proceed Tag",
      cell: ({ row }) => {
        const p = row.original
        const setting = getCostSettingsForSchedule(p.id)
        const trainerCost = setting.trainerFeePerDay * (p.sessionDays || 0)
        const participantCost =
          (setting.idCostPerParticipant + setting.certificateCostPerParticipant) *
          (p.submissionCount || 0)
        const totalCost = trainerCost + participantCost
        const hasAnyCostSetup =
          setting.trainerFeePerDay > 0 ||
          setting.idCostPerParticipant > 0 ||
          setting.certificateCostPerParticipant > 0
        const assessment = getProceedAssessment(p.totalTrainingAmount, totalCost, hasAnyCostSetup)
        const pct = Math.max(0, assessment.netRatio * 100)

        return (
          <div className="space-y-1 text-xs">
            <Badge className={`${assessment.className} border`}>
              {assessment.label}
            </Badge>
            <div className="text-muted-foreground">
              {assessment.label === "Undefined" || assessment.label === "Undefined Cost"
                ? "Net: —"
                : `Net: ${pct.toFixed(1)}%`}
            </div>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const participant = row.original
        const isCancelled = participant.status === 'cancelled'

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(participant); }} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>

              {!isCancelled && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(participant); }} className="cursor-pointer">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyRegistrationLink(participant); }} className="cursor-pointer">
                <Link2 className="mr-2 h-4 w-4" />
                Copy Registration Link
              </DropdownMenuItem>

              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadQRCode(participant); }} className="cursor-pointer">
                <QrCode className="mr-2 h-4 w-4" />
                Download QR Code
              </DropdownMenuItem>

              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleManageEvaluations(participant); }} className="cursor-pointer">
                <ClipboardList className="mr-2 h-4 w-4 text-blue-600" />
                Manage Evaluations
              </DropdownMenuItem>

              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadPassers(participant); }} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4 text-emerald-600" />
                Download Passers
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!!exportProgress}
                onClick={(e) => { e.stopPropagation(); void handleExportScheduleData(participant); }}
                className="cursor-pointer"
              >
                <FolderArchive className="mr-2 h-4 w-4 text-[#1A1D66] dark:text-[#FFCC00]" />
                Export data
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); handleCancelScheduleClick(participant); }}
                className={`cursor-pointer ${isCancelled ? 'text-green-600 focus:text-green-600' : 'text-orange-600 focus:text-orange-600'}`}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {isCancelled ? 'Restore Schedule' : 'Cancel Schedule'}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(participant); }}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase()

      // Search in course, branch, schedule (including month names), status, and type
      const course = String(row.getValue("course")).toLowerCase()
      const branch = String(row.getValue("branch")).toLowerCase()
      const schedule = String(row.getValue("schedule")).toLowerCase()
      const status = String(row.getValue("status")).toLowerCase()
      const type = String(row.getValue("type")).toLowerCase()
      const trainer = String(row.getValue("trainerName")).toLowerCase()

      return course.includes(search) ||
        branch.includes(search) ||
        schedule.includes(search) ||
        status.includes(search) ||
        type.includes(search) ||
        trainer.includes(search)
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
  })

  // Get unique months from data for the filter
  const uniqueMonths = React.useMemo(() => {
    const months = data
      .map(d => d.scheduleMonth)
      .filter((month): month is string => month !== undefined)
    return Array.from(new Set(months)).sort((a, b) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime() // Most recent first
    })
  }, [data])

  if (loading) {
    return <Card className="p-6">Loading {status === "all" ? "all" : status} schedules...</Card>
  }

  const handleCancelScheduleClick = (participant: Participant) => {
    setSelectedParticipant(participant)

    // If restoring, just restore immediately without dialog
    if (participant.status === 'cancelled') {
      handleRestoreSchedule(participant)
    } else {
      // Show dialog for cancel options
      setCancelDialogOpen(true)
    }
  }

  const handleRestoreSchedule = async (participant: Participant) => {
    const toastId = toast.loading("Restoring schedule...", {
      description: "Updating status...",
    })

    try {
      const { error } = await tmsDb
        .from("schedules")
        .update({ status: 'planned' })
        .eq("id", participant.id)

      if (error) {
        toast.error("Failed to restore schedule", {
          id: toastId,
          description: error.message,
        })
        return
      }

      toast.success("Schedule restored successfully", {
        id: toastId,
        description: "Schedule is now active again",
      })

      // Refresh data
      fetchTrainings()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Unexpected error", {
        id: toastId,
        description: "An error occurred while restoring",
      })
    }
  }

  const handleCancelSchedule = async (sendEmail: boolean) => {
    if (!selectedParticipant) return

    setIsCancelling(true)
    const toastId = toast.loading("Cancelling schedule...", {
      description: sendEmail ? "Updating status and sending notifications..." : "Updating status...",
    })

    try {
      const { error } = await tmsDb
        .from("schedules")
        .update({ status: 'cancelled' })
        .eq("id", selectedParticipant.id)

      if (error) {
        toast.error("Failed to cancel schedule", {
          id: toastId,
          description: error.message,
        })
        setIsCancelling(false)
        return
      }

      // Send email notifications if requested
      if (sendEmail) {
        try {
          // Get all trainees for this schedule
          const { data: trainees } = await tmsDb
            .from("trainings")
            .select("email, first_name, last_name")
            .eq("schedule_id", selectedParticipant.id)

          // Send cancellation emails
          if (trainees && trainees.length > 0) {
            await fetch("/api/send-cancellation-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                trainees,
                courseName: selectedParticipant.course,
                scheduleRange: selectedParticipant.schedule,
              }),
            })

            toast.success("Schedule cancelled successfully", {
              id: toastId,
              description: `Notifications sent to ${trainees.length} participant(s)`,
            })
          } else {
            toast.success("Schedule cancelled successfully", {
              id: toastId,
              description: "No participants to notify",
            })
          }
        } catch (emailError) {
          console.error("Failed to send cancellation emails:", emailError)
          toast.success("Schedule cancelled", {
            id: toastId,
            description: "But failed to send email notifications",
          })
        }
      } else {
        toast.success("Schedule cancelled successfully", {
          id: toastId,
          description: "No notifications sent",
        })
      }

      // Refresh data
      fetchTrainings()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Unexpected error", {
        id: toastId,
        description: "An error occurred while cancelling",
      })
    } finally {
      setIsCancelling(false)
      setCancelDialogOpen(false)
      setSelectedParticipant(null)
    }
  }

  return (
    <>
      <Card className="min-w-0 gap-3 overflow-hidden border-0 p-3 shadow-md sm:gap-6">
        {exportProgress ? (
          <div className="mb-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-medium text-foreground">
                Exporting {exportProgress.course}
                <span className="font-normal text-muted-foreground"> · {exportProgress.label}</span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-[#1A1D66] dark:text-[#FFCC00]">
                {exportProgress.percent}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#1A1D66] transition-[width] duration-300 ease-out dark:bg-[#FFCC00]"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="mb-2 flex min-w-0 flex-col gap-1.5 sm:mb-3 sm:gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Input
              placeholder="Search schedules…"
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="h-8 min-w-0 flex-1 border-0 bg-[#1A1D66]/[0.06] text-xs shadow-none focus-visible:ring-[#1A1D66]/30 sm:h-9 sm:max-w-md sm:bg-transparent sm:text-sm sm:shadow-xs dark:bg-[#FFCC00]/10 dark:focus-visible:ring-[#FFCC00]/40"
            />
            <div className="shrink-0">
              <TraineeSearchDialog />
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
            <Select
              value={(table.getColumn("course")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("course")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-sky-500/15 text-xs font-medium text-sky-900 shadow-none focus:ring-sky-500/30 dark:bg-sky-400/15 dark:text-sky-100">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {Array.from(new Set(data.map(d => d.course)))
                  .filter(course => course && course.trim() !== "")
                  .sort()
                  .map((course) => (
                    <SelectItem key={course} value={course}>{course}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("branch")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("branch")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-emerald-500/15 text-xs font-medium text-emerald-900 shadow-none focus:ring-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-100">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {Array.from(new Set(data.map(d => d.branch)))
                  .filter(branch => branch && branch.trim() !== "")
                  .sort()
                  .map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-amber-500/15 text-xs font-medium text-amber-950 shadow-none focus:ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="finished">Finished</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("type")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("type")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-violet-500/15 text-xs font-medium text-violet-900 shadow-none focus:ring-violet-500/30 dark:bg-violet-400/15 dark:text-violet-100">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="In-house">In-house</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-2 rounded-lg border border-[#FFCC00]/35 bg-gradient-to-r from-[#1A1D66]/[0.06] to-[#FFCC00]/10 p-2 sm:mb-3 sm:p-3 dark:from-[#1A1D66]/40 dark:to-[#FFCC00]/10">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#1A1D66] dark:text-[#FFCC00]">
              Default costs
            </span>
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              Used when a training has no custom values
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <label className="min-w-0 space-y-0.5">
              <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Trainer / day
              </span>
              <Input
                type="number"
                min={0}
                value={trainerFeePerDay || ""}
                onChange={(e) => setTrainerFeePerDay(Number(e.target.value || 0))}
                placeholder="0"
                className="h-8 border-0 bg-sky-500/10 px-2 text-xs shadow-none focus-visible:ring-sky-500/30"
              />
            </label>
            <label className="min-w-0 space-y-0.5">
              <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                ID / person
              </span>
              <Input
                type="number"
                min={0}
                value={idCostPerParticipant || ""}
                onChange={(e) => setIdCostPerParticipant(Number(e.target.value || 0))}
                placeholder="0"
                className="h-8 border-0 bg-emerald-500/10 px-2 text-xs shadow-none focus-visible:ring-emerald-500/30"
              />
            </label>
            <label className="min-w-0 space-y-0.5">
              <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Cert / person
              </span>
              <Input
                type="number"
                min={0}
                value={certificateCostPerParticipant || ""}
                onChange={(e) => setCertificateCostPerParticipant(Number(e.target.value || 0))}
                placeholder="0"
                className="h-8 border-0 bg-amber-500/10 px-2 text-xs shadow-none focus-visible:ring-amber-500/30"
              />
            </label>
          </div>
        </div>

        <div className="relative min-w-0">
          <div
            ref={tableScrollRef}
            className="min-w-0 overflow-x-auto rounded-md border border-border"
          >
            <Table className="min-w-[420px] md:min-w-full">
              <TableHeader className="bg-muted font-bold">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="h-9 whitespace-nowrap px-2 text-xs md:h-10 md:px-2 md:text-sm">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => handleView(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-2 py-1.5 align-middle md:py-2 md:align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={table.getVisibleLeafColumns().length || columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {showSwipeHint ? (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-16 items-center justify-end rounded-r-md bg-gradient-to-l from-card via-card/90 to-transparent pr-1.5 md:hidden"
              aria-hidden
            >
              <div className="flex flex-col items-center gap-0.5 rounded-full border border-[#FFCC00]/40 bg-[#1A1D66]/90 px-1.5 py-2 shadow-md dark:bg-[#1A1D66]/95">
                <div className="animate-swipe-hint flex items-center -space-x-1.5 text-[#FFCC00]">
                  <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                  <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
                <span className="animate-swipe-hint-fade text-[9px] font-semibold uppercase tracking-wide text-[#FFCC00]">
                  Swipe
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} event(s) total</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <ScheduleDetailDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        scheduleId={selectedParticipant?.id || null}
      />

      {/* Edit Dialog */}
      <EditScheduleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        scheduleId={selectedParticipant?.id || null}
        onScheduleUpdated={fetchTrainings}
      />

      <AlertDialog open={reschedulePromptOpen} onOpenChange={setReschedulePromptOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reschedule this training?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">
                    {selectedParticipant?.course}
                  </span>
                  {" "}({selectedParticipant?.schedule || "No dates"}) still has{" "}
                  <span className="font-medium text-foreground">no participants</span>.
                </p>
                <p>
                  Would you like to reschedule it to a new date?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReschedule}>
              Yes, reschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Schedule Options Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <button
            onClick={() => setCancelDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            disabled={isCancelling}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Schedule</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You are about to cancel the schedule for{" "}
                  <span className="font-semibold">{selectedParticipant?.course}</span>.
                </p>
                <p className="text-sm text-muted-foreground">
                  Would you like to notify the participants via email?
                </p>
                {selectedParticipant && selectedParticipant.submissionCount > 0 && (
                  <p className="text-sm font-medium text-orange-600">
                    {selectedParticipant.submissionCount} participant(s) registered for this schedule
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-2">
            <Button
              onClick={() => handleCancelSchedule(false)}
              disabled={isCancelling}
              variant="outline"
              className="text-orange-600 border-orange-600 hover:bg-orange-50 flex-1"
            >
              {isCancelling ? "Cancelling..." : "Cancel Without Email"}
            </Button>
            <Button
              onClick={() => handleCancelSchedule(true)}
              disabled={isCancelling}
              className="bg-orange-600 hover:bg-orange-700 flex-1"
            >
              {isCancelling ? "Cancelling..." : "Cancel & Email Participants"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. This will permanently delete the schedule for{" "}
                  <span className="font-semibold">{selectedParticipant?.course}</span> and all related records including:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>All training records ({selectedParticipant?.submissionCount} submission(s))</li>
                  <li>All schedule dates</li>
                  <li>All schedule ranges</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Directory Dialog */}
      <ParticipantDirectoryDialog
        open={directoryOpen}
        onOpenChange={setDirectoryOpen}
        scheduleId={directoryScheduleId}
        courseName={directoryCourseName}
        scheduleRange={directoryRange}
        autoSelectTraineeIds={directoryAutoSelectIds}
        autoViewCertificates={directoryAutoViewCerts}
      />

      {/* Evaluations Dialog */}
      <ScheduleEvaluationsDialog
        open={evaluationsOpen}
        onOpenChange={setEvaluationsOpen}
        scheduleId={selectedParticipant?.id || null}
        courseName={selectedParticipant?.course}
      />

      <DownloadPassersDialog
        open={passersDialogOpen}
        onOpenChange={setPassersDialogOpen}
        scheduleId={selectedParticipant?.id || null}
        courseName={selectedParticipant?.course || ""}
        scheduleLabel={selectedParticipant?.schedule || ""}
      />

      <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cost Calculator</DialogTitle>
          </DialogHeader>

          {costDialogParticipant && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-semibold">{costDialogParticipant.course}</div>
                <div className="text-muted-foreground">{costDialogParticipant.schedule}</div>
                <div className="text-muted-foreground">
                  Participants: {costDialogParticipant.submissionCount} • Session days: {costDialogParticipant.sessionDays}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Trainer fee / day</Label>
                  <Input
                    type="number"
                    min={0}
                    value={dialogTrainerFeePerDay || ""}
                    onChange={(e) => setDialogTrainerFeePerDay(Number(e.target.value || 0))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ID cost / participant</Label>
                  <Input
                    type="number"
                    min={0}
                    value={dialogIdCostPerParticipant || ""}
                    onChange={(e) => setDialogIdCostPerParticipant(Number(e.target.value || 0))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Certificate cost / participant</Label>
                  <Input
                    type="number"
                    min={0}
                    value={dialogCertificateCostPerParticipant || ""}
                    onChange={(e) => setDialogCertificateCostPerParticipant(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              {(() => {
                const trainerCost = dialogTrainerFeePerDay * costDialogParticipant.sessionDays
                const idAndCertCost =
                  (dialogIdCostPerParticipant + dialogCertificateCostPerParticipant) *
                  costDialogParticipant.submissionCount
                const totalCost = trainerCost + idAndCertCost
                return (
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Training Total</span>
                      <span className="font-medium">{formatCurrency(costDialogParticipant.totalTrainingAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Amount Paid</span>
                      <span className="font-medium">{formatCurrency(costDialogParticipant.totalAmountPaid)}</span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Trainer Cost</span>
                      <span>{formatCurrency(trainerCost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">IDs + Certificate Cost</span>
                      <span>{formatCurrency(idAndCertCost)}</span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex items-center justify-between font-semibold">
                      <span>Estimated Total Cost</span>
                      <span>{formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCostDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (!costDialogParticipant) return
                setCostSettingsBySchedule((prev) => ({
                  ...prev,
                  [costDialogParticipant.id]: {
                    trainerFeePerDay: dialogTrainerFeePerDay,
                    idCostPerParticipant: dialogIdCostPerParticipant,
                    certificateCostPerParticipant: dialogCertificateCostPerParticipant,
                  },
                }))
                setCostDialogOpen(false)
              }}
            >
              Apply to This Training
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}