"use client"

import { useEffect, useMemo, useState } from "react"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Download, Search } from "lucide-react"
import {
  exportPassersRoll,
  formatBatchLabelFromSchedule,
  type PasserTrainee,
} from "@/lib/exports/export-passers-roll"

type DownloadPassersDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string | null
  courseName: string
  scheduleLabel: string
}

type ScheduleMeta = {
  schedule_type?: string
  schedule_ranges?: { start_date: string; end_date: string }[]
  schedule_dates?: { date: string }[]
  batch_number?: number | null
  courses?: { name: string } | null
}

export function DownloadPassersDialog({
  open,
  onOpenChange,
  scheduleId,
  courseName,
  scheduleLabel,
}: DownloadPassersDialogProps) {
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [trainees, setTrainees] = useState<PasserTrainee[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [releasedOn, setReleasedOn] = useState("")
  const [scheduleMeta, setScheduleMeta] = useState<ScheduleMeta | null>(null)

  useEffect(() => {
    if (!open || !scheduleId) return

    const load = async () => {
      setLoading(true)
      try {
        const [{ data: scheduleData, error: scheduleError }, { data: traineeData, error: traineeError }] =
          await Promise.all([
            tmsDb
              .from("schedules")
              .select(`
                id,
                schedule_type,
                batch_number,
                schedule_ranges (start_date, end_date),
                schedule_dates (date),
                courses (name)
              `)
              .eq("id", scheduleId)
              .single(),
            tmsDb
              .from("trainings")
              .select("id, first_name, last_name, middle_initial, suffix")
              .eq("schedule_id", scheduleId)
              .order("last_name", { ascending: true }),
          ])

        if (scheduleError) throw scheduleError
        if (traineeError) throw traineeError

        const mapped = (traineeData || []) as PasserTrainee[]
        setTrainees(mapped)
        setSelectedIds(mapped.map((t) => t.id))
        setScheduleMeta(scheduleData as ScheduleMeta)

        const today = new Date().toISOString().slice(0, 10)
        setReleasedOn(today)
      } catch (error) {
        console.error(error)
        toast.error("Failed to load participants for this schedule")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [open, scheduleId])

  const filteredTrainees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return trainees
    return trainees.filter((t) => {
      const full = `${t.first_name} ${t.last_name}`.toLowerCase()
      return full.includes(q)
    })
  }, [trainees, search])

  const selectedCount = selectedIds.length
  const pageCount = Math.max(1, Math.ceil(selectedCount / 20))

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(trainees.map((t) => t.id))
      return
    }
    setSelectedIds([])
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleDownload = async () => {
    if (!scheduleId) return
    if (!releasedOn) {
      toast.error("Please set a release date")
      return
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one participant")
      return
    }

    const selected = trainees.filter((t) => selectedIds.includes(t.id))
    const resolvedCourseName = scheduleMeta?.courses?.name || courseName
    const batchLabel = scheduleMeta
      ? formatBatchLabelFromSchedule(scheduleMeta)
      : `Batch ${scheduleLabel}`

    setDownloading(true)
    setProgress({ current: 0, total: pageCount })

    try {
      await exportPassersRoll(
        selected,
        {
          courseName: resolvedCourseName,
          batchLabel,
          releasedOn: new Date(releasedOn),
        },
        (current, total) => setProgress({ current, total })
      )

      toast.success(
        pageCount > 1
          ? `Downloaded ZIP with ${pageCount} PNG pages`
          : "Downloaded passers roll PNG"
      )
      onOpenChange(false)
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Failed to generate passers roll"
      toast.error(message)
    } finally {
      setDownloading(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download Passers Roll</DialogTitle>
          <DialogDescription>
            Select participants to include. Output is 20 names per page ({pageCount} page
            {pageCount === 1 ? "" : "s"}
            {pageCount > 1 ? ", downloaded as ZIP" : ""}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="released-on">Released on</Label>
            <Input
              id="released-on"
              type="date"
              value={releasedOn}
              onChange={(e) => setReleasedOn(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Participants ({selectedCount} selected)</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.length > 0 && selectedIds.length === trainees.length}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                />
                <span className="text-xs text-muted-foreground">Select all</span>
              </div>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search participants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-64 border rounded-md p-2">
              {loading ? (
                <p className="text-sm text-muted-foreground p-2">Loading participants...</p>
              ) : filteredTrainees.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No participants found</p>
              ) : (
                <div className="space-y-1">
                  {filteredTrainees.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedIds.includes(t.id)}
                        onCheckedChange={() => toggleOne(t.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {t.last_name}, {t.first_name}
                          {t.middle_initial ? ` ${t.middle_initial}.` : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={downloading || loading} className="gap-2">
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating {progress.current}/{progress.total}...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download {pageCount > 1 ? "ZIP" : "PNG"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
