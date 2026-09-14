"use client"

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tmsDb } from "@/lib/supabase-client"
import { createClient } from "@/lib/supabase-client"
import {
  consumePendingCertCenterShow,
  isMissingCertAndId,
  isPaymentCompleted,
  loadCompletedReminderIds,
  loadCompletedReminders,
  markReminderCompleted,
  savePendingCertOpen,
  type CompletedReminder,
  type PendingCertSchedule,
} from "@/lib/pending-cert-reminders"

const CHIP_POS_STORAGE_KEY = "pending-cert-chip-position-v1"
const CHIP_DRAG_THRESHOLD_PX = 6
const CHIP_EDGE_PAD = 12

type ChipPosition = { left: number; top: number }

function loadChipPosition(): ChipPosition | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CHIP_POS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ChipPosition>
    if (typeof parsed.left !== "number" || typeof parsed.top !== "number") return null
    if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null
    return { left: parsed.left, top: parsed.top }
  } catch {
    return null
  }
}

function saveChipPosition(pos: ChipPosition) {
  try {
    localStorage.setItem(CHIP_POS_STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // ignore quota / private mode
  }
}

function clampChipPosition(pos: ChipPosition, width: number, height: number): ChipPosition {
  const maxLeft = Math.max(CHIP_EDGE_PAD, window.innerWidth - width - CHIP_EDGE_PAD)
  const maxTop = Math.max(CHIP_EDGE_PAD, window.innerHeight - height - CHIP_EDGE_PAD)
  return {
    left: Math.min(maxLeft, Math.max(CHIP_EDGE_PAD, pos.left)),
    top: Math.min(maxTop, Math.max(CHIP_EDGE_PAD, pos.top)),
  }
}

function IconSvg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        d="M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8m7.5 1a3 3 0 1 0 0-6a3 3 0 0 0 0 6M9 12.5c-3.866 0-7 2.015-7 4.5V19h9.27A6.5 6.5 0 0 1 16.5 13c.17 0 .338.007.505.02C15.4 12.68 12.44 12.5 9 12.5m7.5 1.5a5 5 0 1 0 0 10a5 5 0 0 0 0-10"
      />
    </IconSvg>
  )
}

function CertificateIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.25 4A3.25 3.25 0 0 0 2 7.25v7.92a7 7 0 0 1 11.5 7.938V25h13.25A3.25 3.25 0 0 0 30 21.75V7.25A3.25 3.25 0 0 0 26.75 4zM9 10h14a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2m7 8a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1m-3 1.5a5.5 5.5 0 1 1-11 0a5.5 5.5 0 0 1 11 0m-1 5.362A6.97 6.97 0 0 1 7.5 26.5A6.97 6.97 0 0 1 3 24.862V29a1 1 0 0 0 1.528.849l2.972-1.85l2.972 1.85a1 1 0 0 0 1.528-.85z"
      />
    </svg>
  )
}

function IdIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        d="M3 6.75A3.75 3.75 0 0 1 6.75 3h10.5A3.75 3.75 0 0 1 21 6.75v10.5A3.75 3.75 0 0 1 17.25 21H6.75A3.75 3.75 0 0 1 3 17.25zm4.25 2a2.25 2.25 0 1 1 0 4.5a2.25 2.25 0 0 1 0-4.5m5 .5a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5zm0 3.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5z"
      />
    </IconSvg>
  )
}

function PaymentPendingIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        d="M4 5.25A2.25 2.25 0 0 1 6.25 3h11.5A2.25 2.25 0 0 1 20 5.25v2.1A3.5 3.5 0 0 0 17.5 7h-7A3.5 3.5 0 0 0 7 10.5v.25H6.25A2.25 2.25 0 0 1 4 8.5zm3 6.75a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2zm7 1.25a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5"
      />
    </IconSvg>
  )
}

function PaymentDoneIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20m4.03 6.97a.75.75 0 0 0-1.06 0l-4.22 4.22l-1.72-1.72a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.75-4.75a.75.75 0 0 0 0-1.06"
      />
    </IconSvg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        d="M3.4 11.2a1.2 1.2 0 0 1 .15-1.26L12.7 2.3a.9.9 0 0 1 1.5.67v4.55c4.8.42 8.3 3.55 8.3 8.48a.9.9 0 0 1-1.52.66c-1.7-1.62-3.9-2.55-6.78-2.7v4.48a.9.9 0 0 1-1.5.67l-9.15-7.64a1.2 1.2 0 0 1-.15-.27"
      />
    </IconSvg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2.07 5.258C2 5.626 2 6.068 2 6.95V14c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225C20.151 6 18.834 6 16.202 6h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352C12.224 5.224 11.816 4.815 11 4l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903C7.53 2 7.336 2 6.95 2c-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.257M12.25 10a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75"
        clipRule="evenodd"
      />
    </IconSvg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 9c.194 0 .382.03.56.081a1.5 1.5 0 0 0 .322 1.419a1.5 1.5 0 0 0-.382 1c0 .384.144.735.382 1a1.5 1.5 0 0 0-.363.77C7.208 13.742 6.142 14 5 14c-1.175 0-2.27-.272-3.089-.77C1.091 12.73.5 11.965.5 11a2 2 0 0 1 2-2zm7 4a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0-2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0-2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zM5 2.5A2.75 2.75 0 1 1 5 8a2.75 2.75 0 0 1 0-5.5m7.002.997a2.252 2.252 0 1 1 0 4.503a2.252 2.252 0 0 1 0-4.503"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <IconSvg className={className}>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20m4.03 6.97a.75.75 0 0 0-1.06 0l-4.22 4.22l-1.72-1.72a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.75-4.75a.75.75 0 0 0 0-1.06"
      />
    </IconSvg>
  )
}

function statusIcon(label: string) {
  const value = label.toLowerCase()
  if (value.includes("payment completed") || value.includes("partial")) return PaymentDoneIcon
  if (value.includes("pending") || value.includes("payment")) return PaymentPendingIcon
  if (value.includes("cancel") || value.includes("declin")) return PaymentPendingIcon
  return PaymentPendingIcon
}

function statusTone(label: string) {
  const value = label.toLowerCase()
  if (value.includes("payment completed")) return "bg-emerald-600 text-white"
  if (value.includes("partial")) return "bg-sky-600 text-white"
  if (value.includes("pending")) return "bg-amber-500 text-amber-950"
  if (value.includes("cancel") || value.includes("declin")) return "bg-zinc-500 text-white"
  return "bg-slate-600 text-white"
}

function addStatus(counts: Map<string, number>, label: string) {
  const key = label.trim() || "No status"
  counts.set(key, (counts.get(key) || 0) + 1)
}

function formatScheduleLabel(schedule: {
  schedule_type?: string | null
  schedule_ranges?: { start_date?: string; end_date?: string }[] | null
  schedule_dates?: { date?: string }[] | null
}) {
  const fmt = (value?: string) => {
    if (!value) return ""
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length) {
    const dates = [...schedule.schedule_dates].map((d) => d.date).filter(Boolean).sort()
    if (!dates.length) return "Finished training"
    if (dates.length === 1) return fmt(dates[0])
    return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`
  }

  const range = schedule.schedule_ranges?.[0]
  if (range?.start_date && range?.end_date) {
    return `${fmt(range.start_date)} – ${fmt(range.end_date)}`
  }
  return "Finished training"
}

export function PendingCertPrompt() {
  const router = useRouter()
  const [items, setItems] = useState<PendingCertSchedule[]>([])
  const [completed, setCompleted] = useState<CompletedReminder[]>([])
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending")
  const [collapsed, setCollapsed] = useState(true)
  const [loading, setLoading] = useState(true)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [chipPos, setChipPos] = useState<ChipPosition | null>(null)
  const [draggingChip, setDraggingChip] = useState(false)
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const chipDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originLeft: number
    originTop: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    setChipPos(loadChipPosition())
  }, [])

  useEffect(() => {
    const keepOnScreen = () => {
      setChipPos((prev) => {
        if (!prev || !chipRef.current) return prev
        const rect = chipRef.current.getBoundingClientRect()
        const next = clampChipPosition(prev, rect.width, rect.height)
        if (next.left === prev.left && next.top === prev.top) return prev
        saveChipPosition(next)
        return next
      })
    }
    window.addEventListener("resize", keepOnScreen)
    return () => window.removeEventListener("resize", keepOnScreen)
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { data: schedules, error } = await tmsDb
          .from("schedules")
          .select(`
            id,
            status,
            schedule_type,
            schedule_ranges (start_date, end_date),
            schedule_dates (date),
            courses (name)
          `)
          .eq("status", "finished")

        if (error || !schedules?.length) {
          if (!cancelled) setItems([])
          return
        }

        const scheduleIds = schedules.map((s) => s.id)
        const { data: trainings, error: trainingError } = await tmsDb
          .from("trainings")
          .select("id, first_name, last_name, payment_status, status, schedule_id, custom_data")
          .in("schedule_id", scheduleIds)

        if (trainingError) {
          if (!cancelled) setItems([])
          return
        }

        const doneIds = new Set(loadCompletedReminderIds())
        const bySchedule = new Map<string, PendingCertSchedule & { statusMap: Map<string, number> }>()
        for (const schedule of schedules) {
          if (doneIds.has(schedule.id)) continue
          const course = Array.isArray(schedule.courses)
            ? schedule.courses[0]
            : schedule.courses
          bySchedule.set(schedule.id, {
            scheduleId: schedule.id,
            courseName: course?.name || "Training",
            scheduleLabel: formatScheduleLabel(schedule),
            totalAttendees: 0,
            statusCounts: [],
            trainees: [],
            statusMap: new Map(),
          })
        }

        for (const trainee of trainings || []) {
          const bucket = bySchedule.get(trainee.schedule_id)
          if (!bucket) continue

          const trainingStatus = (trainee.status || "").trim()
          const paymentStatus = (trainee.payment_status || "").trim()
          const statusLabel = paymentStatus || trainingStatus || "No status"
          addStatus(bucket.statusMap, statusLabel)
          bucket.totalAttendees += 1

          const normalized = `${trainingStatus} ${paymentStatus}`.toLowerCase()
          if (normalized.includes("cancelled") || normalized.includes("declined")) continue
          if (!isPaymentCompleted(trainee.payment_status)) continue
          if (!isMissingCertAndId(trainee.custom_data as Record<string, unknown> | null)) continue

          bucket.trainees.push({
            id: trainee.id,
            name: `${trainee.first_name || ""} ${trainee.last_name || ""}`.trim() || "Participant",
          })
        }

        const pending = Array.from(bySchedule.values())
          .filter((item) => item.trainees.length > 0)
          .map(({ statusMap, ...item }) => ({
            ...item,
            statusCounts: Array.from(statusMap.entries())
              .map(([label, count]) => ({ label, count }))
              .sort((a, b) => b.count - a.count),
          }))
        if (!cancelled) {
          setItems(pending)
          // Center dialog auto-opens at most twice per calendar day.
          if (pending.length > 0 && consumePendingCertCenterShow()) {
            setCollapsed(false)
          } else {
            setCollapsed(true)
          }
        }
      } catch (err) {
        console.error("Failed to load pending certificate reminders:", err)
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setCompleted(loadCompletedReminders())
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const completeSchedule = async (item: PendingCertSchedule) => {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    const completedBy =
      (typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
      user?.email ||
      "Unknown user"

    markReminderCompleted({
      scheduleId: item.scheduleId,
      courseName: item.courseName,
      scheduleLabel: item.scheduleLabel,
      totalAttendees: item.totalAttendees,
      pendingCount: item.trainees.length,
      completedBy,
    })
    setCompleted(loadCompletedReminders())
    setPickedId(null)
    setItems((prev) => prev.filter((row) => row.scheduleId !== item.scheduleId))
    setActiveTab("completed")
  }

  const openDirectory = (item: PendingCertSchedule, viewCerts: boolean) => {
    savePendingCertOpen({
      scheduleId: item.scheduleId,
      traineeIds: item.trainees.map((t) => t.id),
      viewCerts,
    })
    setCollapsed(true)
    setPickedId(null)
    router.push(`/training-schedules?tab=finished&openDirectory=${encodeURIComponent(item.scheduleId)}`)
  }

  const openSubmissions = (item: PendingCertSchedule) => {
    setCollapsed(true)
    setPickedId(null)
    router.push(`/submissions?scheduleId=${encodeURIComponent(item.scheduleId)}&from=finished`)
  }

  if (loading || (items.length === 0 && completed.length === 0)) return null

  const totalPeople = items.reduce((sum, item) => sum + item.trainees.length, 0)

  if (collapsed && items.length > 0) {
    const chipStyle = chipPos
      ? { left: chipPos.left, top: chipPos.top, right: "auto", bottom: "auto" }
      : undefined

    const onChipPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      const el = chipRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const origin = chipPos ?? { left: rect.left, top: rect.top }
      chipDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originLeft: origin.left,
        originTop: origin.top,
        moved: false,
      }
      el.setPointerCapture(e.pointerId)
      setDraggingChip(true)
    }

    const onChipPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
      const drag = chipDragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < CHIP_DRAG_THRESHOLD_PX) return
      drag.moved = true
      const el = chipRef.current
      const width = el?.offsetWidth ?? 188
      const height = el?.offsetHeight ?? 40
      const next = clampChipPosition(
        { left: drag.originLeft + dx, top: drag.originTop + dy },
        width,
        height
      )
      setChipPos(next)
    }

    const endChipPointer = (e: PointerEvent<HTMLButtonElement>) => {
      const drag = chipDragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      chipDragRef.current = null
      setDraggingChip(false)
      try {
        chipRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        // already released
      }
      if (drag.moved) {
        setChipPos((prev) => {
          if (prev) saveChipPosition(prev)
          return prev
        })
        return
      }
      setCollapsed(false)
    }

    return (
      <button
        ref={chipRef}
        type="button"
        style={chipStyle}
        onPointerDown={onChipPointerDown}
        onPointerMove={onChipPointerMove}
        onPointerUp={endChipPointer}
        onPointerCancel={endChipPointer}
        onClick={(e) => {
          // Open is handled on pointer up when not dragged; block default click.
          e.preventDefault()
        }}
        aria-label="Pending certificate reminders. Drag to move, click to open."
        className={`fixed bottom-5 right-5 z-[80] flex max-w-[12rem] touch-none select-none items-center gap-1.5 rounded-full border border-amber-500 bg-amber-400 px-2 py-1 text-left text-amber-950 shadow-md shadow-amber-500/30 ring-1 ring-amber-300/70 hover:bg-amber-300 ${
          draggingChip ? "cursor-grabbing animate-none" : "cursor-grab animate-pulse"
        }`}
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-100">
          <CertificateIcon className="h-3 w-3" />
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-600 px-0.5 text-[8px] font-bold leading-none text-white">
            {totalPeople > 99 ? "99+" : totalPeople}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase leading-none tracking-wide">Action required</span>
          <span className="mt-0.5 block text-[9px] font-medium leading-tight text-amber-950/80">
            {totalPeople} still need cert & ID
          </span>
        </span>
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setCollapsed(true)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-cert-title"
        className="w-full max-w-xl overflow-hidden rounded-xl border-2 border-amber-500 bg-amber-50 shadow-2xl shadow-amber-500/30 ring-4 ring-amber-300/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-amber-300 bg-amber-400 px-5 py-4 text-amber-950">
          <p className="text-xs font-bold uppercase tracking-wide">Action required</p>
          <h2 id="pending-cert-title" className="text-lg font-bold">
            Certificate & ID not sent yet
          </h2>
          <p className="mt-1 text-sm text-amber-950/80">
            Finished training{items.length === 1 ? "" : "s"} with paid attendees who have not received both a certificate and an ID.
          </p>
        </div>

        <div className="flex gap-1 border-b border-amber-300 bg-amber-100 px-4 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-t-md px-3 py-2 text-sm font-semibold ${
              activeTab === "pending"
                ? "bg-amber-400 text-amber-950"
                : "text-amber-900/70 hover:bg-amber-200"
            }`}
          >
            Pending ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`rounded-t-md px-3 py-2 text-sm font-semibold ${
              activeTab === "completed"
                ? "bg-emerald-700 text-white"
                : "text-amber-900/70 hover:bg-amber-200"
            }`}
          >
            Marked as completed ({completed.length})
          </button>
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto bg-amber-50 px-5 py-4">
          {activeTab === "completed" ? (
            completed.length === 0 ? (
              <p className="py-8 text-center text-sm text-amber-900/70">No trainings marked as completed yet.</p>
            ) : (
              completed.map((item) => (
                <div
                  key={item.scheduleId}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-950"
                >
                  <div className="font-semibold">{item.courseName}</div>
                  <div className="text-xs text-emerald-900/70">{item.scheduleLabel}</div>
                  <div className="mt-2 text-xs text-emerald-900/80">
                    {item.totalAttendees} total · {item.pendingCount} were still pending certificate & ID
                  </div>
                  <div className="mt-1 text-xs text-emerald-900/80">
                    Marked by {item.completedBy || "Unknown user"}
                    {item.completedAt
                      ? ` · ${new Date(item.completedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </div>
                </div>
              ))
            )
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-amber-900/70">No pending trainings.</p>
          ) : (
            items.map((item) => {
            const picked = pickedId === item.scheduleId
            return (
            <div
              key={item.scheduleId}
              className="rounded-lg border-2 border-amber-400 bg-amber-100 p-3 text-left text-amber-950"
            >
              <button
                type="button"
                onClick={() => setPickedId(picked ? null : item.scheduleId)}
                className="block w-full text-left"
              >
                <div className="font-semibold">{item.courseName}</div>
                <div className="text-xs text-amber-900/70">{item.scheduleLabel}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
                    <PeopleIcon className="h-3.5 w-3.5" />
                    {item.totalAttendees} total
                  </span>
                  {item.statusCounts.map((status) => {
                    const StatusIcon = statusIcon(status.label)
                    return (
                    <span
                      key={status.label}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(status.label)}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.count} {status.label}
                    </span>
                    )
                  })}
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">
                    <CertificateIcon className="h-3.5 w-3.5" />
                    {item.trainees.length} certificate pending
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    <IdIcon className="h-3.5 w-3.5" />
                    {item.trainees.length} ID pending
                  </span>
                </div>
                <div className="mt-1 text-xs text-amber-900/80">
                  {item.trainees.slice(0, 4).map((t) => t.name).join(", ")}
                  {item.trainees.length > 4 ? ` +${item.trainees.length - 4} more` : ""}
                </div>
                <div className="mt-2 flex justify-center text-amber-900/70">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ease-out ${picked ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${picked ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <div className="grid gap-1.5 border-t border-amber-300 pt-3">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 justify-start bg-amber-950 text-amber-50 hover:bg-amber-900"
                      onClick={() => openDirectory(item, true)}
                    >
                      <SendIcon className="mr-2 h-3.5 w-3.5" />
                      Go to sending certificate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start border-amber-500 bg-white text-amber-950 hover:bg-amber-50"
                      onClick={() => openSubmissions(item)}
                    >
                      <ListIcon className="mr-2 h-3.5 w-3.5" />
                      Go to submissions
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start border-amber-500 bg-white text-amber-950 hover:bg-amber-50"
                      onClick={() => openDirectory(item, false)}
                    >
                      <FolderIcon className="mr-2 h-3.5 w-3.5" />
                      Go to directory
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 justify-start bg-emerald-700 text-white hover:bg-emerald-800"
                      onClick={() => void completeSchedule(item)}
                    >
                      <CheckIcon className="mr-2 h-3.5 w-3.5" />
                      Mark as completed
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            )
          })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-amber-300 bg-amber-100 px-5 py-3">
          <p className="text-xs text-amber-950/80">This reminder stays until certificates and IDs are sent.</p>
          <Button
            type="button"
            size="sm"
            className="bg-amber-950 text-amber-50 hover:bg-amber-900"
            onClick={() => setCollapsed(true)}
          >
            <ChevronDown className="mr-1 h-4 w-4" />
            Collapse
          </Button>
        </div>
      </div>
    </div>
  )
}
