"use client"

import * as React from "react"
import {
  Camera,
  Download,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import { tmsDb } from "@/lib/supabase-client"

export type AttendanceSnapshot = {
  id: string
  url: string
  name: string
  created_at: string
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("image", file, file.name)
  const response = await fetch("/api/upload", { method: "POST", body: formData })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed")
  }
  const data = await response.json()
  if (!data.url) throw new Error("Upload did not return a URL")
  return data.url as string
}

type AttendanceSnapshotsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  courseName: string
}

export function AttendanceSnapshotsDialog({
  open,
  onOpenChange,
  scheduleId,
  courseName,
}: AttendanceSnapshotsDialogProps) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [snapshots, setSnapshots] = React.useState<AttendanceSnapshot[]>([])
  const [editing, setEditing] = React.useState<AttendanceSnapshot | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const persist = React.useCallback(
    async (next: AttendanceSnapshot[]) => {
      setSaving(true)
      const { error } = await tmsDb
        .from("schedules")
        .update({ attendance_snapshots: next })
        .eq("id", scheduleId)
      setSaving(false)
      if (error) {
        const msg = error.message || ""
        if (/attendance_snapshots|schema cache|column/i.test(msg)) {
          toast.error("Snapshots column is missing", {
            description: "Run scripts/add-attendance-snapshots.sql in Supabase, then refresh.",
          })
        } else {
          toast.error("Could not save snapshots", { description: msg })
        }
        return false
      }
      setSnapshots(next)
      return true
    },
    [scheduleId]
  )

  React.useEffect(() => {
    if (!open || !scheduleId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data, error } = await tmsDb
        .from("schedules")
        .select("attendance_snapshots")
        .eq("id", scheduleId)
        .single()
      if (cancelled) return
      if (error) {
        if (/attendance_snapshots|schema cache|column/i.test(error.message || "")) {
          toast.error("Snapshots column is missing", {
            description: "Run scripts/add-attendance-snapshots.sql in Supabase, then refresh.",
          })
        }
        setSnapshots([])
      } else {
        const raw = (data as { attendance_snapshots?: AttendanceSnapshot[] | null })?.attendance_snapshots
        setSnapshots(Array.isArray(raw) ? raw : [])
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, scheduleId])

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: AttendanceSnapshot[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        const url = await uploadImageFile(file)
        added.push({
          id: newId(),
          url,
          name: file.name.replace(/\.[^.]+$/, "") || "Snapshot",
          created_at: new Date().toISOString(),
        })
      }
      if (!added.length) {
        toast.error("Please choose image files")
        return
      }
      const ok = await persist([...added, ...snapshots])
      if (ok) toast.success(`Uploaded ${added.length} snapshot${added.length === 1 ? "" : "s"}`)
    } catch (e) {
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const downloadSnapshot = async (item: AttendanceSnapshot) => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(item.url)}`)
      const blob = res.ok ? await res.blob() : await (await fetch(item.url)).blob()
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${item.name || "snapshot"}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(item.url, "_blank", "noopener,noreferrer")
    } finally {
      setBusyId(null)
    }
  }

  const removeSnapshot = async (item: AttendanceSnapshot) => {
    if (!confirm(`Remove “${item.name}”?`)) return
    await persist(snapshots.filter((s) => s.id !== item.id))
  }

  const saveEdited = async (croppedUrl: string) => {
    if (!editing) return
    const next = snapshots.map((s) => (s.id === editing.id ? { ...s, url: croppedUrl } : s))
    const ok = await persist(next)
    if (ok) toast.success("Snapshot updated")
    setEditing(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] px-5 py-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Camera className="h-5 w-5 text-[#FFCC00]" />
              Attendance snapshots
            </DialogTitle>
            <DialogDescription className="text-white/75">
              Upload screenshots for {courseName || "this training"}. Download, crop, or remove them anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {snapshots.length} photo{snapshots.length === 1 ? "" : "s"}
              {saving ? " · Saving…" : ""}
            </p>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void onUpload(e.target.files)}
              />
              <Button
                size="sm"
                className="gap-1.5 bg-[#1A1D66] text-white hover:bg-[#141654] dark:bg-[#FFCC00] dark:text-[#1A1D66] dark:hover:bg-[#e6b800]"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload photos
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading snapshots…
              </div>
            ) : snapshots.length === 0 ? (
              <button
                type="button"
                className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1A1D66]/25 bg-[#1A1D66]/[0.03] px-4 py-14 text-center dark:border-white/15 dark:bg-white/[0.03]"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-8 w-8 text-[#1A1D66]/50 dark:text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No snapshots yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Click to upload attendance screenshots.</p>
              </button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {snapshots.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-[#1A1D66]/15 bg-[#f8f8fc] dark:border-white/10 dark:bg-muted/20"
                  >
                    <a href={item.url} target="_blank" rel="noreferrer" className="block aspect-video bg-black/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    </a>
                    <div className="space-y-2 p-2.5">
                      <p className="truncate text-xs font-semibold" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          disabled={busyId === item.id}
                          onClick={() => void downloadSnapshot(item)}
                        >
                          {busyId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          Download
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => setEditing(item)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[11px] text-destructive hover:text-destructive"
                          onClick={() => void removeSnapshot(item)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        open={Boolean(editing)}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        imageType="free"
        aspect={null}
        existingImageUrl={editing?.url}
        title="Edit snapshot"
        onSave={async (croppedUrl) => {
          await saveEdited(croppedUrl)
        }}
      />
    </>
  )
}
