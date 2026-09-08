// components/participants-table.tsx 

"use client"

import { tmsDb } from "@/lib/supabase-client"
import { consumePendingCertOpen } from "@/lib/pending-cert-reminders"
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
} from "@tanstack/react-table"
import { ArrowUpDown, MoreVertical, Eye, Edit, Trash2, Link2, RefreshCcw, X, QrCode, Download, CalendarClock } from "lucide-react"
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
  const [data, setData] = React.useState<Participant[]>([])
  const [loading, setLoading] = React.useState(true)
  const [globalFilter, setGlobalFilter] = React.useState("")
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
      header: () => <div className="w-[220px]">Course</div>,
      cell: ({ row }) => {
        const submissionCount = row.original.submissionCount
        const isCancelled = row.original.status === 'cancelled'

        return (
          <div className="w-[220px] space-y-1.5">
            <div
              className={`font-medium text-card-foreground truncate ${isCancelled ? 'line-through text-muted-foreground' : ''}`}
              title={String(row.getValue("course"))}
            >
              {row.getValue("course")}
            </div>
            <div className="flex flex-wrap gap-1">
              <Link
                href={`/submissions?scheduleId=${row.original.id}&from=${status}`}
                className="flex items-center gap-1 text-[10px] hover:bg-muted rounded-md px-1.5 py-1 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <SubmissionIcon className="h-3 w-3" />
                Submission
                {submissionCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                    {submissionCount}
                  </Badge>
                )}
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px] hover:bg-muted cursor-pointer"
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
                <DirectoryIcon className="h-3 w-3" />
                Directory
              </Button>

              <Link
                href={`/training-schedules/attendance?scheduleId=${row.original.id}&from=${status}`}
                className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-foreground hover:bg-muted cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <AttendanceIcon className="h-3.5 w-3.5" />
                Attendance
              </Link>
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
            className="text-card-foreground max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap"
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
          <div className="flex flex-col items-start gap-1.5">
            <Badge className={`${style} border`}>
              {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
            </Badge>
            {showReschedule && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px] border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReschedulePrompt(participant)
                }}
                title="No participants yet — consider rescheduling"
              >
                <CalendarClock className="h-3 w-3" />
                Reschedule?
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
      <Card className="p-3 border-0 shadow-md bg- ">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-2">
            <Input
              placeholder="Search courses, branches, schedules, status, or types..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-md"
            />
            <TraineeSearchDialog />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={(table.getColumn("course")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("course")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by course" />
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by branch" />
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by type" />
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

        <div className="mb-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Default Cost Inputs (for trainings without custom values)
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Input
              type="number"
              min={0}
              value={trainerFeePerDay || ""}
              onChange={(e) => setTrainerFeePerDay(Number(e.target.value || 0))}
              placeholder="Trainer fee / day"
            />
            <Input
              type="number"
              min={0}
              value={idCostPerParticipant || ""}
              onChange={(e) => setIdCostPerParticipant(Number(e.target.value || 0))}
              placeholder="ID cost / participant"
            />
            <Input
              type="number"
              min={0}
              value={certificateCostPerParticipant || ""}
              onChange={(e) => setCertificateCostPerParticipant(Number(e.target.value || 0))}
              placeholder="Certificate cost / participant"
            />
          </div>
        </div>

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader className="font-bold bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleView(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} event(s) total</div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
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