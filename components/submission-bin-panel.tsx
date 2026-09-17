"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Inbox,
  Loader2,
  QrCode,
  RefreshCw,
  Trash2,
} from "lucide-react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { tmsDb } from "@/lib/supabase-client"
import {
  buildGuestSubmissionBinUrl,
  missingSubmissionBinSchema,
  submissionBinKindLabel,
  type SubmissionBinItem,
} from "@/lib/submission-bin"

type SubmissionBinPanelProps = {
  scheduleId: string
  courseName: string
  onCountChange?: (count: number) => void
}

type PreviewKind = "image" | "pdf" | "office" | "other"

function fileExt(item: SubmissionBinItem) {
  const name = `${item.file_name || ""} ${item.file_url || ""}`
  return name.split(".").pop()?.toLowerCase().split(/[?#]/)[0] || ""
}

function previewKind(item: SubmissionBinItem): PreviewKind {
  const ext = fileExt(item)
  const type = (item.file_type || "").toLowerCase()
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext) || type === "image") return "image"
  if (ext === "pdf" || type === "pdf") return "pdf"
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office"
  return "other"
}

function previewSrc(item: SubmissionBinItem) {
  const kind = previewKind(item)
  if (kind === "pdf") return `/api/proxy-pdf?url=${encodeURIComponent(item.file_url)}`
  if (kind === "office") {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.file_url)}`
  }
  return item.file_url
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function SubmissionBinPanel({ scheduleId, courseName, onCountChange }: SubmissionBinPanelProps) {
  const [items, setItems] = React.useState<SubmissionBinItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [tablesMissing, setTablesMissing] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [qrBusy, setQrBusy] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [previewItem, setPreviewItem] = React.useState<SubmissionBinItem | null>(null)

  const shareUrl =
    typeof window === "undefined" ? "" : buildGuestSubmissionBinUrl(window.location.origin, scheduleId)

  const load = React.useCallback(async () => {
    setLoading(true)
    setTablesMissing(false)
    const { data, error } = await tmsDb
      .from("submission_bin_items")
      .select(
        "id, schedule_id, training_id, kind, title, respondent_name, respondent_email, file_url, file_name, file_type, created_at"
      )
      .eq("schedule_id", scheduleId)
      .order("created_at", { ascending: false })

    if (error) {
      if (missingSubmissionBinSchema(error.message || "")) {
        setTablesMissing(true)
      } else {
        toast.error("Could not load submissions", { description: error.message })
      }
      setItems([])
      onCountChange?.(0)
      setLoading(false)
      return
    }
    setItems((data || []) as SubmissionBinItem[])
    onCountChange?.((data || []).length)
    setLoading(false)
  }, [scheduleId, onCountChange])

  React.useEffect(() => {
    void load()
  }, [load])

  const copyShare = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success("Public link copied")
    window.setTimeout(() => setCopied(false), 1500)
  }

  const downloadQr = async () => {
    if (!shareUrl) return
    setQrBusy(true)
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, { width: 512, margin: 1 })
      downloadDataUrl(dataUrl, `${courseName || "training"}-submission-bin-qr.png`)
    } catch {
      toast.error("Could not generate QR")
    } finally {
      setQrBusy(false)
    }
  }

  const removeItem = async (item: SubmissionBinItem) => {
    setDeletingId(item.id)
    const { error } = await tmsDb.from("submission_bin_items").delete().eq("id", item.id)
    setDeletingId(null)
    if (error) {
      toast.error("Could not remove file", { description: error.message })
      return
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id))
    onCountChange?.(items.filter((row) => row.id !== item.id).length)
    toast.success("Removed from bin")
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Public drop box for re-entry plans and other trainee files. Share the link — no login required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {items.length} file{items.length === 1 ? "" : "s"}
          </Badge>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {tablesMissing ? (
        <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Submission bin tables are missing. Run{" "}
          <code className="rounded bg-amber-200/70 px-1 dark:bg-amber-900">scripts/add-submission-bin.sql</code>{" "}
          in Supabase, then refresh.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,340px)_1fr]">
          <div className="rounded-xl border bg-muted/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Public submit link
            </p>
            <p className="mt-1 break-all text-sm">{shareUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void copyShare()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={qrBusy} onClick={() => void downloadQr()}>
                {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                QR
              </Button>
            </div>
          </div>

          <div className="min-w-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading submissions…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium">No files yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Trainees submit through the public link. Files show up here.
                </p>
              </div>
            ) : (
              <div className="max-h-[22rem] overflow-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Submitted</th>
                      <th className="px-3 py-2">Trainee</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-t border-border hover:bg-muted/40"
                        onClick={() => setPreviewItem(item)}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {format(parseISO(item.created_at), "MMM d, h:mm a")}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.respondent_name || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.respondent_email || ""}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{submissionBinKindLabel(item.kind)}</Badge>
                          {item.title ? (
                            <p className="mt-0.5 max-w-[160px] truncate text-[11px] text-muted-foreground">{item.title}</p>
                          ) : null}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2">{item.file_name || "File"}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="View"
                              onClick={() => setPreviewItem(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deletingId === item.id}
                              onClick={() => void removeItem(item)}
                              title="Remove"
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null)
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[min(1100px,96vw)] max-w-none flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewItem?.file_name || previewItem?.title || "Submission"}
            </DialogTitle>
            <DialogDescription>
              {previewItem
                ? `${previewItem.respondent_name || "Trainee"}${
                    previewItem.respondent_email ? ` · ${previewItem.respondent_email}` : ""
                  }`
                : "Preview"}
            </DialogDescription>
          </DialogHeader>
          {previewItem ? (
            <>
              <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
                {previewKind(previewItem) === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewItem.file_url}
                    alt={previewItem.file_name || "Submission"}
                    className="mx-auto max-h-[72vh] w-full object-contain"
                  />
                ) : previewKind(previewItem) === "pdf" || previewKind(previewItem) === "office" ? (
                  <iframe
                    title={previewItem.file_name || "Submission preview"}
                    src={previewSrc(previewItem)}
                    className="h-[72vh] w-full bg-white"
                  />
                ) : (
                  <div className="flex h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      This file type can’t be previewed here. Open it in a new tab instead.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="gap-1.5" asChild>
                  <a href={previewItem.file_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open original
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
