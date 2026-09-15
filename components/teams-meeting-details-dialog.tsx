"use client"

import * as React from "react"
import { Loader2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { tmsDb } from "@/lib/supabase-client"

type TeamsAttendeeDetail = {
  displayName: string
  email: string
  seconds: number
  durationLabel: string
  joinAt: string | null
  leaveAt: string | null
  matchedTrainee: { id: string; name: string } | null
}

type TeamsReportDetail = {
  id: string
  meetingStartDateTime: string | null
  meetingEndDateTime: string | null
  totalParticipantCount: number
  attendees: TeamsAttendeeDetail[]
}

type TeamsDetailsResponse = {
  error?: string
  subject?: string | null
  joinUrl?: string
  reports?: TeamsReportDetail[]
}

type TeamsMeetingDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  meetingUrl: string | null
  onUrlSaved?: (url: string) => void
}

export function TeamsMeetingDetailsDialog({
  open,
  onOpenChange,
  scheduleId,
  meetingUrl,
  onUrlSaved,
}: TeamsMeetingDetailsDialogProps) {
  const [joinUrl, setJoinUrl] = React.useState(meetingUrl || "")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [subject, setSubject] = React.useState<string | null>(null)
  const [reports, setReports] = React.useState<TeamsReportDetail[]>([])

  React.useEffect(() => {
    if (open) setJoinUrl(meetingUrl || "")
  }, [open, meetingUrl])

  const persistJoinUrl = React.useCallback(async () => {
    const url = joinUrl.trim()
    if (!scheduleId || !url) return false
    setSaving(true)
    const { error: saveError } = await tmsDb
      .from("schedules")
      .update({ online_classroom_url: url })
      .eq("id", scheduleId)
    setSaving(false)
    if (saveError) {
      const msg = saveError.message || ""
      if (/online_classroom_url|schema cache|column/i.test(msg)) {
        toast.error("Could not save the meeting link", {
          description: "Run scripts/add-schedule-classroom-url.sql in Supabase, then try Save again.",
        })
      } else {
        toast.error("Could not save the meeting link", { description: msg })
      }
      return false
    }
    onUrlSaved?.(url)
    return true
  }, [joinUrl, onUrlSaved, scheduleId])

  const saveOnly = async () => {
    if (!joinUrl.trim()) {
      toast.info("Paste a Teams join URL first.")
      return
    }
    const ok = await persistJoinUrl()
    if (ok) toast.success("Meeting link saved for this schedule")
  }

  const load = React.useCallback(async () => {
    if (!scheduleId) return
    if (joinUrl.trim()) await persistJoinUrl()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/teams-attendance/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          joinUrl: joinUrl.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as TeamsDetailsResponse
      if (!res.ok) {
        setReports([])
        setSubject(null)
        setError(data.error || res.statusText)
        return
      }
      setSubject(data.subject || null)
      setReports(data.reports || [])
      if (data.joinUrl && !joinUrl.trim()) setJoinUrl(data.joinUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Teams details.")
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [scheduleId, joinUrl, persistJoinUrl])

  React.useEffect(() => {
    if (!open || !scheduleId) return
    if (meetingUrl) void load()
    else {
      setReports([])
      setSubject(null)
      setError(null)
    }
    // Load once when opened with a saved URL; manual Load handles pasted URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scheduleId, meetingUrl])

  const hasReports = reports.length > 0
  const emptyReports = !loading && !error && hasReports && reports.every((r) => r.attendees.length === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Teams meeting details</DialogTitle>
          <DialogDescription>
            Who joined and how long they stayed. Attendance in TMS is not changed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
            placeholder="Paste a Microsoft Teams join URL"
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => void saveOnly()}
            disabled={saving || loading || !joinUrl.trim()}
          >
            {saving && !loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save link
          </Button>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => void load()}
            disabled={loading || (!joinUrl.trim() && !meetingUrl)}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "Loading…" : "Load details"}
          </Button>
        </div>

        {subject ? (
          <p className="shrink-0 truncate text-sm font-medium text-foreground">{subject}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {loading && !hasReports ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading meeting report…</span>
            </div>
          ) : null}

          {!loading && !error && !hasReports && (joinUrl.trim() || meetingUrl) ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No attendance report yet. Teams only creates a report after the meeting ends.
            </p>
          ) : null}

          {!loading && !error && !joinUrl.trim() && !meetingUrl ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Paste the Teams join URL used for this class, then load details.
            </p>
          ) : null}

          {emptyReports ? (
            <p className="text-muted-foreground text-sm">
              A report exists, but Graph returned no attendee records.
            </p>
          ) : null}

          {hasReports ? (
            <div className="space-y-5 pr-1">
              {reports.map((report, index) => (
                <div key={report.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Session {reports.length > 1 ? index + 1 : ""}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {report.meetingStartDateTime || "Start unknown"}
                      {report.meetingEndDateTime ? ` – ${report.meetingEndDateTime}` : ""}
                    </span>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {report.attendees.length || report.totalParticipantCount}
                    </Badge>
                  </div>
                  {report.attendees.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No attendees in this session.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[640px] table-fixed caption-bottom text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="h-10 w-[22%] px-3 text-left font-medium">Name</th>
                            <th className="h-10 w-[22%] px-3 text-left font-medium">Email</th>
                            <th className="h-10 w-[12%] px-3 text-left font-medium">Duration</th>
                            <th className="h-10 w-[16%] px-3 text-left font-medium">Joined</th>
                            <th className="h-10 w-[16%] px-3 text-left font-medium">Left</th>
                            <th className="h-10 w-[12%] px-3 text-left font-medium">In TMS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.attendees.map((a, i) => (
                            <tr
                              key={`${a.email || a.displayName}-${i}`}
                              className="border-b last:border-0"
                            >
                              <td className="truncate px-3 py-2 font-medium" title={a.displayName}>
                                {a.displayName}
                              </td>
                              <td
                                className="text-muted-foreground truncate px-3 py-2 text-xs"
                                title={a.email || undefined}
                              >
                                {a.email || "—"}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{a.durationLabel}</td>
                              <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                                {a.joinAt || "—"}
                              </td>
                              <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                                {a.leaveAt || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {a.matchedTrainee ? (
                                  <Badge
                                    variant="outline"
                                    className="max-w-full truncate border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                                    title={a.matchedTrainee.name}
                                  >
                                    {a.matchedTrainee.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Not on roster</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
