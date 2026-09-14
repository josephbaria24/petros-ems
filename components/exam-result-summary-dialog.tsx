"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { Download, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { tmsDb } from "@/lib/supabase-client"
import { cn } from "@/lib/utils"

export type ExamSummaryRow = {
  traineeId: string
  lastName: string
  firstName: string
  middleInitial: string
  preScore: number | null
  preMax: number | null
  postScore: number | null
  postMax: number | null
}

export type ExamSummaryMeta = {
  documentTitle: string
  revision: string
  dateIssued: string
  training: string
  inclusiveDates: string
  trainingType: string
  venuePlatform: string
  totalItems: string
  passingRate: string
  preparedByName: string
  preparedByRole: string
}

type ExamSummaryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  courseName: string
  pretestExamId: string | null
  posttestExamId: string | null
  pretestQuestionCount: number
  posttestQuestionCount: number
}

function formatInclusiveDates(schedule: {
  schedule_type?: string | null
  schedule_ranges?: { start_date?: string; end_date?: string }[] | null
  schedule_dates?: { date?: string }[] | null
}): string {
  const fmt = (value?: string) => {
    if (!value) return ""
    try {
      return format(parseISO(value.slice(0, 10)), "MMMM d, yyyy")
    } catch {
      return value
    }
  }
  if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.[0]) {
    const r = schedule.schedule_ranges[0]
    const start = fmt(r.start_date)
    const end = fmt(r.end_date)
    if (start && end && start !== end) {
      try {
        const s = parseISO((r.start_date || "").slice(0, 10))
        const e = parseISO((r.end_date || "").slice(0, 10))
        if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
          return `${format(s, "MMMM d")} - ${format(e, "d, yyyy")}`
        }
      } catch {
        /* fall through */
      }
      return `${start} - ${end}`
    }
    return start || end || "—"
  }
  if (schedule.schedule_dates?.length) {
    const dates = [...schedule.schedule_dates]
      .map((d) => d.date)
      .filter(Boolean)
      .sort() as string[]
    if (!dates.length) return "—"
    if (dates.length === 1) return fmt(dates[0])
    return `${fmt(dates[0])} - ${fmt(dates[dates.length - 1])}`
  }
  return "—"
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scorePercent(score: number | null, max: number | null): string {
  if (score == null || max == null || max <= 0) return ""
  return `${((score / max) * 100).toFixed(2)}%`
}

function scoreFraction(score: number | null, max: number | null): string {
  if (score == null || max == null) return ""
  return `${score} / ${max}`
}

function pickBestResponse(
  responses: { respondent_name: string | null; score: number | null; max_score: number | null; created_at?: string }[],
  trainee: { first_name: string; last_name: string }
) {
  const targets = [
    normalizeName(`${trainee.first_name} ${trainee.last_name}`),
    normalizeName(`${trainee.last_name} ${trainee.first_name}`),
    normalizeName(trainee.last_name),
  ].filter(Boolean)

  const ranked = responses
    .map((r) => {
      const n = normalizeName(r.respondent_name || "")
      let rank = 0
      if (targets[0] && n === targets[0]) rank = 3
      else if (targets[1] && n === targets[1]) rank = 3
      else if (targets[0] && (n.includes(targets[0]) || targets[0].includes(n))) rank = 2
      else if (targets[2] && n.includes(targets[2])) rank = 1
      return { r, rank }
    })
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank)

  return ranked[0]?.r || null
}

const DEFAULT_META: ExamSummaryMeta = {
  documentTitle: "Training Examination Result",
  revision: "Rev 1.1",
  dateIssued: "July 1, 2019",
  training: "",
  inclusiveDates: "",
  trainingType: "Online Training",
  venuePlatform: "Zoom Meetings",
  totalItems: "",
  passingRate: "75%",
  preparedByName: "Engr. Paul Christian A. Dela Cruz",
  preparedByRole: "HSSEQ & Training Officer",
}

const ROWS_PER_PAGE = 18

export function ExamResultSummaryDialog({
  open,
  onOpenChange,
  scheduleId,
  courseName,
  pretestExamId,
  posttestExamId,
  pretestQuestionCount,
  posttestQuestionCount,
}: ExamSummaryDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [disclaimerOpen, setDisclaimerOpen] = React.useState(false)
  const [meta, setMeta] = React.useState<ExamSummaryMeta>(DEFAULT_META)
  const [draftMeta, setDraftMeta] = React.useState<ExamSummaryMeta>(DEFAULT_META)
  const [rows, setRows] = React.useState<ExamSummaryRow[]>([])
  const [draftRows, setDraftRows] = React.useState<ExamSummaryRow[]>([])
  const [resultsDirty, setResultsDirty] = React.useState(false)
  const previewRef = React.useRef<HTMLDivElement>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data: schedule, error: se } = await tmsDb
        .from("schedules")
        .select(
          `
          id,
          event_type,
          branch,
          schedule_type,
          schedule_ranges ( start_date, end_date ),
          schedule_dates ( date )
        `
        )
        .eq("id", scheduleId)
        .single()

      if (se || !schedule) {
        toast.error("Could not load schedule for summary")
        return
      }

      const { data: trainings, error: te } = await tmsDb
        .from("trainings")
        .select("id, first_name, last_name, middle_initial, training_type, status")
        .eq("schedule_id", scheduleId)
        .order("last_name", { ascending: true })

      if (te) {
        toast.error("Could not load participants", { description: te.message })
        return
      }

      const active = (trainings || []).filter((t) => {
        const s = `${t.status || ""}`.toLowerCase()
        return !s.includes("cancel") && !s.includes("declin")
      })

      let preResponses: {
        respondent_name: string | null
        score: number | null
        max_score: number | null
      }[] = []
      let postResponses: typeof preResponses = []

      if (pretestExamId) {
        const { data } = await tmsDb
          .from("exam_responses")
          .select("respondent_name, score, max_score, created_at")
          .eq("exam_id", pretestExamId)
        preResponses = data || []
      }
      if (posttestExamId) {
        const { data } = await tmsDb
          .from("exam_responses")
          .select("respondent_name, score, max_score, created_at")
          .eq("exam_id", posttestExamId)
        postResponses = data || []
      }

      const defaultMaxPre = pretestQuestionCount || null
      const defaultMaxPost = posttestQuestionCount || null
      const totalItems =
        Math.max(pretestQuestionCount || 0, posttestQuestionCount || 0) || ""

      const event = String(schedule.event_type || "").toLowerCase()
      const isOnline = event.includes("online") || event.includes("virtual") || event.includes("zoom")
      const firstType = active[0]?.training_type || ""

      const nextMeta: ExamSummaryMeta = {
        ...DEFAULT_META,
        training: courseName || "Training",
        inclusiveDates: formatInclusiveDates(schedule),
        trainingType: firstType
          ? `${firstType}`.replace(/_/g, " ")
          : isOnline
            ? "Online Training"
            : "Face-to-Face Training",
        venuePlatform: isOnline ? "Zoom Meetings" : schedule.branch || "—",
        totalItems: totalItems ? String(totalItems) : "",
      }

      const nextRows: ExamSummaryRow[] = active.map((t) => {
        const pre = pickBestResponse(preResponses, t)
        const post = pickBestResponse(postResponses, t)
        return {
          traineeId: t.id,
          lastName: (t.last_name || "").trim(),
          firstName: (t.first_name || "").trim(),
          middleInitial: (t.middle_initial || "").trim().charAt(0).toUpperCase(),
          preScore: pre?.score ?? null,
          preMax: pre?.max_score ?? defaultMaxPre,
          postScore: post?.score ?? null,
          postMax: post?.max_score ?? defaultMaxPost,
        }
      })

      setMeta(nextMeta)
      setDraftMeta(nextMeta)
      setRows(nextRows)
      setDraftRows(nextRows)
      setResultsDirty(false)
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }, [
    scheduleId,
    courseName,
    pretestExamId,
    posttestExamId,
    pretestQuestionCount,
    posttestQuestionCount,
  ])

  React.useEffect(() => {
    if (open) void load()
  }, [open, load])

  const displayMeta = editing ? draftMeta : meta
  const displayRows = editing ? draftRows : rows
  const pages = Math.max(1, Math.ceil(displayRows.length / ROWS_PER_PAGE) || 1)

  const updateDraftRow = (traineeId: string, patch: Partial<ExamSummaryRow>) => {
    setDraftRows((prev) =>
      prev.map((r) => (r.traineeId === traineeId ? { ...r, ...patch } : r))
    )
    setResultsDirty(true)
  }

  const beginEdit = () => {
    setDraftMeta(meta)
    setDraftRows(rows)
    setResultsDirty(false)
    setEditing(true)
  }

  const requestFinishEdit = () => {
    if (resultsDirty) {
      setDisclaimerOpen(true)
      return
    }
    setMeta(draftMeta)
    setRows(draftRows)
    setEditing(false)
  }

  const confirmApplyEdits = () => {
    setMeta(draftMeta)
    setRows(draftRows)
    setResultsDirty(false)
    setEditing(false)
    setDisclaimerOpen(false)
    toast.success("Summary updates applied")
  }

  const cancelEdit = () => {
    setDraftMeta(meta)
    setDraftRows(rows)
    setResultsDirty(false)
    setEditing(false)
    setDisclaimerOpen(false)
  }

  const exportPdf = async () => {
    if (!previewRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      const pagesEls = previewRef.current.querySelectorAll<HTMLElement>("[data-exam-summary-page]")
      if (!pagesEls.length) {
        toast.error("Nothing to export")
        return
      }
      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pagesEls.length; i++) {
        const canvas = await html2canvas(pagesEls[i], {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
        })
        const img = canvas.toDataURL("image/png")
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
        const w = canvas.width * ratio
        const h = canvas.height * ratio
        const x = (pageWidth - w) / 2
        const y = 6
        if (i > 0) pdf.addPage()
        pdf.addImage(img, "PNG", x, y, w, h)
      }

      const safe = (courseName || "exam-result").replace(/[^\w\-]+/g, "-").slice(0, 40)
      pdf.save(`${safe}-examination-result.pdf`)
      toast.success("Summary exported")
    } catch (e) {
      console.error(e)
      toast.error("Failed to export PDF")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[min(1100px,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] px-5 py-4 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-white">Export summary — preview</DialogTitle>
                <DialogDescription className="text-white/75">
                  Review the Training Examination Result layout. Use edit to change header fields or scores before
                  exporting.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {editing ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      onClick={cancelEdit}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#FFCC00] text-[#1A1D66] hover:bg-[#e6b800]"
                      onClick={requestFinishEdit}
                    >
                      Apply edits
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    onClick={beginEdit}
                    disabled={loading}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  className="bg-[#FFCC00] text-[#1A1D66] hover:bg-[#e6b800]"
                  disabled={loading || exporting || editing}
                  onClick={() => void exportPdf()}
                >
                  {exporting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-200/80 p-4 dark:bg-zinc-900">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#1A1D66]">
                <Loader2 className="h-8 w-8 animate-spin" />
                Building summary preview…
              </div>
            ) : (
              <div ref={previewRef} className="mx-auto space-y-6">
                {Array.from({ length: pages }).map((_, pageIndex) => {
                  const pageRows = displayRows.slice(
                    pageIndex * ROWS_PER_PAGE,
                    pageIndex * ROWS_PER_PAGE + ROWS_PER_PAGE
                  )
                  return (
                    <SummaryPage
                      key={pageIndex}
                      meta={displayMeta}
                      rows={pageRows}
                      startIndex={pageIndex * ROWS_PER_PAGE}
                      pageLabel={`${pageIndex + 1}-${pages}`}
                      editing={editing}
                      onMetaChange={(patch) => setDraftMeta((m) => ({ ...m, ...patch }))}
                      onRowChange={updateDraftRow}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm exam result changes</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">
                You are about to change examination scores or participant details on this summary. These edits
                affect the exported Training Examination Result document.
              </span>
              <span className="block font-medium text-amber-800 dark:text-amber-200">
                Disclaimer: Manual score changes are for reporting purposes. Ensure values match official
                examination records. Unauthorized or inaccurate alterations may misrepresent trainee
                performance.
              </span>
              <span className="block">Do you want to apply these changes to the preview?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#1A1D66] hover:bg-[#141654]"
              onClick={confirmApplyEdits}
            >
              I understand — apply changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SummaryPage({
  meta,
  rows,
  startIndex,
  pageLabel,
  editing,
  onMetaChange,
  onRowChange,
}: {
  meta: ExamSummaryMeta
  rows: ExamSummaryRow[]
  startIndex: number
  pageLabel: string
  editing: boolean
  onMetaChange: (patch: Partial<ExamSummaryMeta>) => void
  onRowChange: (traineeId: string, patch: Partial<ExamSummaryRow>) => void
}) {
  return (
    <div
      data-exam-summary-page
      className="mx-auto w-[900px] bg-white p-8 text-black shadow-lg"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Title bar */}
      <div className="grid grid-cols-[1fr_140px] border-2 border-black">
        <div className="flex items-center justify-center border-r-2 border-black px-3 py-3">
          {editing ? (
            <Input
              value={meta.documentTitle}
              className="h-9 border-dashed text-center text-lg font-bold"
              onChange={(e) => onMetaChange({ documentTitle: e.target.value })}
            />
          ) : (
            <h2 className="text-center text-xl font-bold tracking-wide">{meta.documentTitle}</h2>
          )}
        </div>
        <div className="flex flex-col justify-center px-2 py-2 text-[11px] leading-tight">
          {editing ? (
            <>
              <Input
                value={meta.revision}
                className="mb-1 h-7 border-dashed text-[11px]"
                onChange={(e) => onMetaChange({ revision: e.target.value })}
              />
              <Input
                value={meta.dateIssued}
                className="h-7 border-dashed text-[11px]"
                onChange={(e) => onMetaChange({ dateIssued: e.target.value })}
              />
            </>
          ) : (
            <>
              <div>{meta.revision}</div>
              <div>Date Issued: {meta.dateIssued}</div>
            </>
          )}
        </div>
      </div>

      {/* Meta block */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-[13px]">
        <MetaLine
          label="Training:"
          editing={editing}
          value={meta.training}
          onChange={(v) => onMetaChange({ training: v })}
        />
        <MetaLine
          label="Total number of items:"
          editing={editing}
          value={meta.totalItems}
          onChange={(v) => onMetaChange({ totalItems: v })}
        />
        <MetaLine
          label="Inclusive Dates:"
          editing={editing}
          value={meta.inclusiveDates}
          onChange={(v) => onMetaChange({ inclusiveDates: v })}
        />
        <MetaLine
          label="Passing Rate:"
          editing={editing}
          value={meta.passingRate}
          onChange={(v) => onMetaChange({ passingRate: v })}
        />
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 font-semibold">Training Type:</span>
          {editing ? (
            <Input
              value={meta.trainingType}
              className="h-7 border-dashed"
              onChange={(e) => onMetaChange({ trainingType: e.target.value })}
            />
          ) : (
            <span className="underline decoration-1 underline-offset-2">{meta.trainingType}</span>
          )}
        </div>
        <div className="flex items-end justify-end text-[12px]">
          <span>
            Page: <span className="font-semibold">{pageLabel}</span>
          </span>
        </div>
        <MetaLine
          label="Venue/Platform:"
          editing={editing}
          value={meta.venuePlatform}
          onChange={(v) => onMetaChange({ venuePlatform: v })}
          className="col-span-2"
        />
      </div>

      {/* Results table */}
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#c5d4e8]">
            {["NO", "LAST NAME", "FIRST NAME", "M.I", "PRE-TEST", "%", "POST-TEST", "%"].map((h) => (
              <th
                key={h}
                className="border border-black px-1.5 py-2 text-center text-[11px] font-bold uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="border border-black px-3 py-8 text-center text-zinc-500">
                No participants found for this schedule.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const zebra = i % 2 === 1
              return (
                <tr key={row.traineeId} className={cn(zebra && "bg-[#eef2f7]")}>
                  <td className="border border-black px-1.5 py-1.5 text-center">{startIndex + i + 1}</td>
                  <td className="border border-black px-1.5 py-1.5">
                    {editing ? (
                      <Input
                        value={row.lastName}
                        className="h-7 border-dashed uppercase"
                        onChange={(e) => onRowChange(row.traineeId, { lastName: e.target.value })}
                      />
                    ) : (
                      <span className="uppercase">{row.lastName}</span>
                    )}
                  </td>
                  <td className="border border-black px-1.5 py-1.5">
                    {editing ? (
                      <Input
                        value={row.firstName}
                        className="h-7 border-dashed"
                        onChange={(e) => onRowChange(row.traineeId, { firstName: e.target.value })}
                      />
                    ) : (
                      row.firstName
                    )}
                  </td>
                  <td className="border border-black px-1.5 py-1.5 text-center">
                    {editing ? (
                      <Input
                        value={row.middleInitial}
                        maxLength={2}
                        className="mx-auto h-7 w-12 border-dashed text-center uppercase"
                        onChange={(e) =>
                          onRowChange(row.traineeId, {
                            middleInitial: e.target.value.slice(0, 2).toUpperCase(),
                          })
                        }
                      />
                    ) : (
                      row.middleInitial
                    )}
                  </td>
                  <ScoreCells
                    editing={editing}
                    score={row.preScore}
                    max={row.preMax}
                    onScore={(v) => onRowChange(row.traineeId, { preScore: v })}
                    onMax={(v) => onRowChange(row.traineeId, { preMax: v })}
                  />
                  <ScoreCells
                    editing={editing}
                    score={row.postScore}
                    max={row.postMax}
                    onScore={(v) => onRowChange(row.traineeId, { postScore: v })}
                    onMax={(v) => onRowChange(row.traineeId, { postMax: v })}
                  />
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-10 max-w-sm text-[13px]">
        <div className="font-semibold">Prepared by:</div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <div>
              <Label className="text-[11px] text-zinc-500">Name</Label>
              <Input
                value={meta.preparedByName}
                className="border-dashed"
                onChange={(e) => onMetaChange({ preparedByName: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px] text-zinc-500">Role</Label>
              <Input
                value={meta.preparedByRole}
                className="border-dashed"
                onChange={(e) => onMetaChange({ preparedByRole: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1 inline-block min-w-[220px] border-b border-black pb-0.5 font-medium">
              {meta.preparedByName}
            </div>
            <div className="mt-1 text-[12px]">{meta.preparedByRole}</div>
          </>
        )}
      </div>
    </div>
  )
}

function MetaLine({
  label,
  value,
  editing,
  onChange,
  className,
}: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="shrink-0 font-semibold">{label}</span>
      {editing ? (
        <Input value={value} className="h-7 border-dashed" onChange={(e) => onChange(e.target.value)} />
      ) : (
        <span>{value || "—"}</span>
      )}
    </div>
  )
}

function ScoreCells({
  editing,
  score,
  max,
  onScore,
  onMax,
}: {
  editing: boolean
  score: number | null
  max: number | null
  onScore: (v: number | null) => void
  onMax: (v: number | null) => void
}) {
  const parseNum = (raw: string): number | null => {
    const t = raw.trim()
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  if (editing) {
    return (
      <>
        <td className="border border-black px-1 py-1">
          <div className="flex items-center justify-center gap-1">
            <Input
              value={score ?? ""}
              className="h-7 w-12 border-dashed px-1 text-center"
              onChange={(e) => onScore(parseNum(e.target.value))}
            />
            <span>/</span>
            <Input
              value={max ?? ""}
              className="h-7 w-12 border-dashed px-1 text-center"
              onChange={(e) => onMax(parseNum(e.target.value))}
            />
          </div>
        </td>
        <td className="border border-black px-1.5 py-1.5 text-center">{scorePercent(score, max)}</td>
      </>
    )
  }

  return (
    <>
      <td className="border border-black px-1.5 py-1.5 text-center">{scoreFraction(score, max)}</td>
      <td className="border border-black px-1.5 py-1.5 text-center">{scorePercent(score, max)}</td>
    </>
  )
}
