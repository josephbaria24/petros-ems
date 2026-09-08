"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Award, Check, ChevronDown, ChevronUp, FolderOpen, IdCard, MailWarning, Send, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tmsDb } from "@/lib/supabase-client"
import { createClient } from "@/lib/supabase-client"
import {
  isMissingCertAndId,
  isPaymentCompleted,
  loadCompletedReminderIds,
  loadCompletedReminders,
  markReminderCompleted,
  savePendingCertOpen,
  type CompletedReminder,
  type PendingCertSchedule,
} from "@/lib/pending-cert-reminders"

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
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pickedId, setPickedId] = useState<string | null>(null)

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
        if (!cancelled) setItems(pending)
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
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-5 right-5 z-[80] flex max-w-[16.5rem] items-center gap-2 rounded-full border-2 border-amber-500 bg-amber-400 px-3 py-2 text-left text-amber-950 shadow-lg shadow-amber-500/40 ring-2 ring-amber-300/70 hover:bg-amber-300 animate-pulse"
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-100">
          <Award className="h-3.5 w-3.5" />
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
            {totalPeople > 99 ? "99+" : totalPeople}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide">Action required</span>
          <span className="block text-[11px] font-medium leading-tight text-amber-950/80">
            {totalPeople} paid attendee{totalPeople === 1 ? "" : "s"} still need certificate & ID
          </span>
        </span>
        <ChevronUp className="h-4 w-4 shrink-0" />
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
                    <Users className="h-3.5 w-3.5" />
                    {item.totalAttendees} total
                  </span>
                  {item.statusCounts.map((status) => (
                    <span
                      key={status.label}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(status.label)}`}
                    >
                      {status.count} {status.label}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">
                    <MailWarning className="h-3.5 w-3.5" />
                    {item.trainees.length} certificate pending
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    <IdCard className="h-3.5 w-3.5" />
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
                      <Send className="mr-2 h-3.5 w-3.5" />
                      Go to sending certificate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start border-amber-500 bg-white text-amber-950 hover:bg-amber-50"
                      onClick={() => openSubmissions(item)}
                    >
                      <MailWarning className="mr-2 h-3.5 w-3.5" />
                      Go to submissions
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 justify-start border-amber-500 bg-white text-amber-950 hover:bg-amber-50"
                      onClick={() => openDirectory(item, false)}
                    >
                      <FolderOpen className="mr-2 h-3.5 w-3.5" />
                      Go to directory
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 justify-start bg-emerald-700 text-white hover:bg-emerald-800"
                      onClick={() => void completeSchedule(item)}
                    >
                      <Check className="mr-2 h-3.5 w-3.5" />
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
