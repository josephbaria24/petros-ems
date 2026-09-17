"use client"

import * as React from "react"
import { ChevronDown, ClipboardList, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { tmsDb } from "@/lib/supabase-client"
import {
  filterExamResponsesForSchedule,
  matchExamResponse,
  type ExamResponseMatch,
} from "@/lib/exam"
import { cn } from "@/lib/utils"

type PreviewRow = {
  traineeId: string
  lastName: string
  firstName: string
  middleInitial: string
  email: string | null
  pre: ExamResponseMatch | null
  post: ExamResponseMatch | null
}

type ExamResultsPreviewProps = {
  scheduleId: string
  pretestExamId: string | null
  posttestExamId: string | null
}

async function loadResponses(examId: string): Promise<ExamResponseMatch[]> {
  const withSchedule = await tmsDb
    .from("exam_responses")
    .select("respondent_name, respondent_email, schedule_id, score, max_score, created_at")
    .eq("exam_id", examId)
    .order("created_at", { ascending: false })
  if (withSchedule.error && /schedule_id|schema cache|column/i.test(withSchedule.error.message || "")) {
    const fallback = await tmsDb
      .from("exam_responses")
      .select("respondent_name, respondent_email, score, max_score, created_at")
      .eq("exam_id", examId)
      .order("created_at", { ascending: false })
    return fallback.data || []
  }
  return withSchedule.data || []
}

function formatScore(row: ExamResponseMatch | null) {
  if (!row || row.score == null) return null
  const max = row.max_score
  const pct = max && max > 0 ? Math.round((Number(row.score) / Number(max)) * 100) : null
  return {
    text: max != null ? `${row.score} / ${max}` : String(row.score),
    pct,
  }
}

function ScoreCell({ row }: { row: ExamResponseMatch | null }) {
  const score = formatScore(row)
  if (!score) {
    return <span className="text-muted-foreground">—</span>
  }
  const passed = score.pct != null && score.pct >= 75
  return (
    <div className="flex flex-col">
      <span className="font-semibold tabular-nums">{score.text}</span>
      {score.pct != null ? (
        <span className={cn("text-[11px]", passed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          {score.pct}%{passed ? " · pass" : ""}
        </span>
      ) : null}
    </div>
  )
}

export function ExamResultsPreview({
  scheduleId,
  pretestExamId,
  posttestExamId,
}: ExamResultsPreviewProps) {
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<PreviewRow[]>([])
  const [unmatched, setUnmatched] = React.useState<{ label: string; score: ExamResponseMatch }[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data: trainings } = await tmsDb
        .from("trainings")
        .select("id, first_name, last_name, middle_initial, email, status")
        .eq("schedule_id", scheduleId)
        .order("last_name", { ascending: true })

      const active = (trainings || []).filter((t) => {
        const s = `${t.status || ""}`.toLowerCase()
        return !s.includes("cancel") && !s.includes("declin")
      })

      const [preRaw, postRaw] = await Promise.all([
        pretestExamId ? loadResponses(pretestExamId) : Promise.resolve([]),
        posttestExamId ? loadResponses(posttestExamId) : Promise.resolve([]),
      ])
      const preResponses = filterExamResponsesForSchedule(preRaw, scheduleId)
      const postResponses = filterExamResponsesForSchedule(postRaw, scheduleId)

      const usedPre = new Set<ExamResponseMatch>()
      const usedPost = new Set<ExamResponseMatch>()
      const nextRows: PreviewRow[] = active.map((t) => {
        const pre = matchExamResponse(preResponses, t)
        const post = matchExamResponse(postResponses, t)
        if (pre) usedPre.add(pre)
        if (post) usedPost.add(post)
        return {
          traineeId: t.id,
          lastName: (t.last_name || "").trim(),
          firstName: (t.first_name || "").trim(),
          middleInitial: (t.middle_initial || "").trim().charAt(0).toUpperCase(),
          email: t.email || null,
          pre,
          post,
        }
      })

      const leftover: { label: string; score: ExamResponseMatch }[] = []
      for (const r of preResponses) {
        if (!usedPre.has(r)) leftover.push({ label: "Pre-test", score: r })
      }
      for (const r of postResponses) {
        if (!usedPost.has(r)) leftover.push({ label: "Post-test", score: r })
      }

      setRows(nextRows)
      setUnmatched(leftover)
    } finally {
      setLoading(false)
    }
  }, [scheduleId, pretestExamId, posttestExamId])

  React.useEffect(() => {
    void load()
  }, [load])

  const preTaken = rows.filter((r) => r.pre).length
  const postTaken = rows.filter((r) => r.post).length
  const bothTaken = rows.filter((r) => r.pre && r.post).length

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 bg-muted/60 px-5 py-3",
          open && "border-b"
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "rotate-0")} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">Results preview</span>
              <Badge variant="secondary">
                {rows.length} trainee{rows.length === 1 ? "" : "s"}
              </Badge>
              {!open ? (
                <span className="text-xs text-muted-foreground">
                  Pre {preTaken}/{rows.length} · Post {postTaken}/{rows.length} · Both {bothTaken}
                </span>
              ) : null}
            </span>
            {open ? (
              <span className="mt-1 block text-sm text-muted-foreground">
                Live scores for this schedule. Use Export summary for the printable Training Examination Result.
              </span>
            ) : null}
          </span>
        </button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={(e) => {
            e.stopPropagation()
            void load()
          }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {open ? (
        <>
      <div className="grid gap-2 border-b border-border px-5 py-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pre-test submitted</p>
          <p className="text-lg font-bold">
            {preTaken}
            <span className="text-sm font-medium text-muted-foreground"> / {rows.length}</span>
          </p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Post-test submitted</p>
          <p className="text-lg font-bold">
            {postTaken}
            <span className="text-sm font-medium text-muted-foreground"> / {rows.length}</span>
          </p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Completed both</p>
          <p className="text-lg font-bold">{bothTaken}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading results…
        </div>
      ) : rows.length === 0 && unmatched.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No trainees on this schedule yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Scores appear here after someone submits the exam link.</p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Pre-test</TableHead>
                <TableHead>Post-test</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const mi = row.middleInitial ? ` ${row.middleInitial}.` : ""
                return (
                  <TableRow key={row.traineeId}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {row.lastName}, {row.firstName}
                      {mi}
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] truncate text-muted-foreground sm:table-cell">
                      {row.email || "—"}
                    </TableCell>
                    <TableCell>
                      <ScoreCell row={row.pre} />
                    </TableCell>
                    <TableCell>
                      <ScoreCell row={row.post} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && unmatched.length > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unmatched submissions ({unmatched.length})
          </p>
          <div className="space-y-1.5">
            {unmatched.slice(0, 8).map((item, i) => {
              const score = formatScore(item.score)
              return (
                <div
                  key={`${item.label}-${item.score.respondent_email}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
                >
                  <span>
                    <span className="font-semibold">{item.label}</span>
                    {" · "}
                    {item.score.respondent_name || "No name"}
                    {item.score.respondent_email ? ` · ${item.score.respondent_email}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums">{score?.text || "—"}</span>
                </div>
              )
            })}
            {unmatched.length > 8 ? (
              <p className="text-xs text-muted-foreground">+{unmatched.length - 8} more</p>
            ) : null}
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </section>
  )
}
