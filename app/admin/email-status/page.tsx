"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { EmailStatus } from "@/lib/email-tracking"

type EmailRow = {
  messageId: string
  recipient: string
  subject: string
  currentStatus: EmailStatus
  sentAt: string
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  unsubscribedAt: string | null
  complainedAt: string | null
  bounceReason: string | null
  diagnosticCode: string | null
  updatedAt: string
  lastEvent: string | null
  events?: Array<{
    event: EmailStatus
    recipient: string | null
    occurredAt: string
    reason: string | null
    code: string | null
    unmatched: boolean
  }>
}

const STATUS_OPTIONS: Array<EmailStatus | "all"> = [
  "all",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "unsubscribed",
  "complained",
  "unknown",
]

function statusBadgeClass(status: EmailStatus): string {
  switch (status) {
    case "sent":
      return "border-slate-300 bg-slate-100 text-slate-800"
    case "delivered":
      return "border-emerald-300 bg-emerald-100 text-emerald-900"
    case "opened":
      return "border-sky-300 bg-sky-100 text-sky-900"
    case "clicked":
      return "border-indigo-300 bg-indigo-100 text-indigo-900"
    case "bounced":
      return "border-red-300 bg-red-100 text-red-900"
    case "unsubscribed":
      return "border-amber-300 bg-amber-100 text-amber-900"
    case "complained":
      return "border-rose-300 bg-rose-100 text-rose-900"
    default:
      return "border-muted bg-muted text-muted-foreground"
  }
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function AdminEmailStatusPage() {
  const [emails, setEmails] = useState<EmailRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recipient, setRecipient] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [storageHint, setStorageHint] = useState<string | null>(null)
  const [reconciling, setReconciling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("includeHistory", "1")
      params.set("limit", "100")
      if (recipient.trim()) params.set("recipient", recipient.trim())
      if (status !== "all") params.set("status", status)

      const res = await fetch(`/api/email-status?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || `Failed (${res.status})`)
      }
      setEmails(Array.isArray(data.emails) ? data.emails : [])
      setStorageHint(data?.meta?.storage || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [recipient, status])

  useEffect(() => {
    void load()
  }, [load])

  const selected = emails.find((e) => e.messageId === selectedId) || null

  async function reconcileSelected() {
    if (!selected) return
    setReconciling(true)
    try {
      const res = await fetch("/api/email-status/reconcile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selected.messageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Reconcile failed")
      await load()
      alert(`Reconcile: fetched ${data.fetched}, added ${data.added}, skipped ${data.skipped}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reconcile failed")
    } finally {
      setReconciling(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track SendLayer delivery events for SMTP sends. Status updates arrive via webhooks.
          {storageHint === "file" ? (
            <span className="ml-1 text-amber-700 dark:text-amber-400">
              Using local file storage (not durable on serverless).
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Recipient search</label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div className="w-[180px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-16 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading email statuses…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : emails.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
          No tracked emails yet. Send a message through SMTP, then wait for SendLayer webhooks.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr
                    key={email.messageId}
                    className={cn(
                      "cursor-pointer border-b last:border-0 hover:bg-muted/30",
                      selectedId === email.messageId && "bg-muted/50",
                    )}
                    onClick={() => setSelectedId(email.messageId)}
                  >
                    <td className="px-3 py-2 align-top">{email.recipient}</td>
                    <td className="px-3 py-2 align-top">{email.subject}</td>
                    <td className="px-3 py-2 align-top">
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(email.currentStatus)}
                      >
                        {email.currentStatus.charAt(0).toUpperCase() + email.currentStatus.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap text-muted-foreground">
                      {formatWhen(email.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a row to view details and history.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">{selected.subject}</h2>
                  <p className="text-sm text-muted-foreground">{selected.recipient}</p>
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Message ID: </span>
                    <code className="break-all text-xs">{selected.messageId}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current status: </span>
                    <Badge variant="outline" className={statusBadgeClass(selected.currentStatus)}>
                      {selected.currentStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Latest event: </span>
                    {selected.lastEvent || "—"} ({formatWhen(selected.updatedAt)})
                  </div>
                  {selected.bounceReason ? (
                    <div>
                      <span className="text-muted-foreground">Bounce reason: </span>
                      {selected.bounceReason}
                      {selected.diagnosticCode ? ` (${selected.diagnosticCode})` : ""}
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reconciling}
                  onClick={() => void reconcileSelected()}
                >
                  {reconciling ? "Reconciling…" : "Reconcile from SendLayer API"}
                </Button>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Event history</h3>
                  {!selected.events?.length ? (
                    <p className="text-sm text-muted-foreground">No events recorded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.events.map((ev, idx) => (
                        <li
                          key={`${ev.event}-${ev.occurredAt}-${idx}`}
                          className="rounded border px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className={statusBadgeClass(ev.event)}>
                              {ev.event}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatWhen(ev.occurredAt)}
                            </span>
                          </div>
                          {ev.reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">{ev.reason}</p>
                          ) : null}
                          {ev.unmatched ? (
                            <p className="mt-1 text-xs text-amber-700">Unmatched at receive time</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
