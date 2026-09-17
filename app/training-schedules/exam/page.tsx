"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Calendar, ClipboardList, FileSpreadsheet, Inbox, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ExamPanel } from "@/components/exam-panel"
import { ExamResultsPreview } from "@/components/exam-results-preview"
import { ExamResultSummaryDialog } from "@/components/exam-result-summary-dialog"
import { SubmissionBinPanel } from "@/components/submission-bin-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tmsDb } from "@/lib/supabase-client"
import { missingSubmissionBinSchema } from "@/lib/submission-bin"
import {
  mapDbQuestion,
  pickCanonicalExam,
  type ExamKind,
  type ExamMode,
  type ExamQuestionDraft,
  type ExamRecord,
} from "@/lib/exam"

type SlotState = {
  exam: ExamRecord | null
  questions: ExamQuestionDraft[]
  saving: boolean
}

const emptySlot = (): SlotState => ({
  exam: null,
  questions: [],
  saving: false,
})

function formatDay(value: string) {
  try {
    return format(parseISO(value.slice(0, 10)), "MMMM d, yyyy")
  } catch {
    return value
  }
}

function formatScheduleDateLabel(schedule: {
  schedule_type?: string | null
  schedule_ranges?: { start_date?: string; end_date?: string }[] | null
  schedule_dates?: { date?: string }[] | null
}): string | null {
  const range = schedule.schedule_ranges?.[0]
  if (schedule.schedule_type !== "staggered" && range?.start_date) {
    const start = range.start_date
    const end = range.end_date || range.start_date
    try {
      const s = parseISO(start.slice(0, 10))
      const e = parseISO(end.slice(0, 10))
      if (s.getTime() === e.getTime()) return format(s, "MMMM d, yyyy")
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${format(s, "MMMM d")}–${format(e, "d, yyyy")}`
      }
      return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`
    } catch {
      return start
    }
  }

  if (schedule.schedule_dates?.length) {
    const dates = [...schedule.schedule_dates]
      .map((d) => d.date)
      .filter(Boolean)
      .sort() as string[]
    if (!dates.length) return null
    if (dates.length === 1) return formatDay(dates[0])
    if (dates.length <= 4) {
      return dates.map((d) => format(parseISO(d.slice(0, 10)), "MMM d, yyyy")).join(", ")
    }
    return `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])}`
  }

  return null
}

function kindToCourseLinkField(kind: ExamKind): "pretest_link" | "posttest_link" {
  return kind === "pretest" ? "pretest_link" : "posttest_link"
}

export default function ScheduleExamPage() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("scheduleId")
  const fromTab = searchParams.get("from") || "all"
  const backHref = `/training-schedules?tab=${encodeURIComponent(fromTab)}`

  const [loading, setLoading] = React.useState(true)
  const [courseName, setCourseName] = React.useState("")
  const [courseTitle, setCourseTitle] = React.useState<string | null>(null)
  const [scheduleDateLabel, setScheduleDateLabel] = React.useState<string | null>(null)
  const [courseId, setCourseId] = React.useState<string | null>(null)
  const [slots, setSlots] = React.useState<Record<ExamKind, SlotState>>({
    pretest: emptySlot(),
    posttest: emptySlot(),
  })
  const [tablesMissing, setTablesMissing] = React.useState(false)
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  const [submissionCount, setSubmissionCount] = React.useState(0)

  const load = React.useCallback(async () => {
    if (!scheduleId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setTablesMissing(false)

    const { data: schedule, error: se } = await tmsDb
      .from("schedules")
      .select(
        `
        id,
        course_id,
        schedule_type,
        courses (
          id,
          name,
          title,
          pretest_link,
          posttest_link
        ),
        schedule_ranges ( start_date, end_date ),
        schedule_dates ( date )
      `
      )
      .eq("id", scheduleId)
      .single()

    if (se || !schedule) {
      toast.error("Schedule not found", { description: se?.message })
      setLoading(false)
      return
    }

    const course = (
      Array.isArray(schedule.courses) ? schedule.courses[0] : schedule.courses
    ) as {
      id?: string
      name?: string
      title?: string | null
      pretest_link?: string | null
      posttest_link?: string | null
    } | null

    const resolvedCourseId = course?.id || schedule.course_id || null
    setCourseId(resolvedCourseId)
    setCourseName(course?.name || "Training")
    setCourseTitle(course?.title ?? null)
    setScheduleDateLabel(
      formatScheduleDateLabel({
        schedule_type: schedule.schedule_type,
        schedule_ranges: schedule.schedule_ranges || [],
        schedule_dates: schedule.schedule_dates || [],
      })
    )

    let examQuery = tmsDb
      .from("exams")
      .select("id, schedule_id, course_id, kind, mode, title, external_url, is_published, updated_at")

    if (resolvedCourseId) {
      examQuery = examQuery.eq("course_id", resolvedCourseId)
    } else {
      examQuery = examQuery.eq("schedule_id", scheduleId)
    }

    const { data: exams, error: ee } = await examQuery

    if (ee) {
      const msg = ee.message || ""
      if (/relation|does not exist|schema cache|Could not find/i.test(msg)) {
        setTablesMissing(true)
      } else {
        toast.error("Could not load exams", { description: msg })
      }
    }

    let examRows = (exams || []) as (ExamRecord & { updated_at?: string })[]
    if (resolvedCourseId && examRows.length === 0) {
      const { data: bySchedule } = await tmsDb
        .from("exams")
        .select("id, schedule_id, course_id, kind, mode, title, external_url, is_published, updated_at")
        .eq("schedule_id", scheduleId)
      examRows = (bySchedule || []) as (ExamRecord & { updated_at?: string })[]
    }
    if (resolvedCourseId && examRows.length === 0) {
      const { data: siblings } = await tmsDb.from("schedules").select("id").eq("course_id", resolvedCourseId)
      const siblingIds = (siblings || []).map((s) => s.id).filter(Boolean)
      if (siblingIds.length) {
        const { data: siblingExams } = await tmsDb
          .from("exams")
          .select("id, schedule_id, course_id, kind, mode, title, external_url, is_published, updated_at")
          .in("schedule_id", siblingIds)
        examRows = (siblingExams || []) as (ExamRecord & { updated_at?: string })[]
      }
    }

    const examIds = examRows.map((e) => e.id)
    const questionCountByExamId: Record<string, number> = {}
    const questionsByExamId: Record<string, ExamQuestionDraft[]> = {}
    if (examIds.length) {
      const { data: qs } = await tmsDb
        .from("exam_questions")
        .select("id, exam_id, question_type, question_text, options, answers, points, sort_order")
        .in("exam_id", examIds)
        .order("sort_order", { ascending: true })
      for (const row of qs || []) {
        const mapped = mapDbQuestion(row)
        const list = questionsByExamId[row.exam_id] || []
        list.push(mapped)
        questionsByExamId[row.exam_id] = list
      }
      for (const id of examIds) {
        questionCountByExamId[id] = questionsByExamId[id]?.length || 0
      }
    }

    const next: Record<ExamKind, SlotState> = {
      pretest: emptySlot(),
      posttest: emptySlot(),
    }

    for (const kind of ["pretest", "posttest"] as ExamKind[]) {
      const existing = pickCanonicalExam(examRows, kind, questionCountByExamId)
      const questions = existing ? questionsByExamId[existing.id] || [] : []

      const courseLink =
        kind === "pretest"
          ? course?.pretest_link?.trim() || null
          : course?.posttest_link?.trim() || null

      if (existing) {
        next[kind] = {
          exam: {
            ...existing,
            external_url: existing.external_url || (existing.mode === "external" ? courseLink : null),
          },
          questions,
          saving: false,
        }
      } else {
        next[kind] = {
          exam: {
            id: "",
            schedule_id: scheduleId,
            course_id: resolvedCourseId,
            kind,
            mode: "external",
            title: kind === "pretest" ? "Pre-test" : "Post-test",
            external_url: courseLink,
            is_published: true,
          },
          questions: [],
          saving: false,
        }
      }
    }

    setSlots(next)
    setLoading(false)

    const { count, error: countErr } = await tmsDb
      .from("submission_bin_items")
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", scheduleId)
    if (!countErr) setSubmissionCount(count || 0)
    else if (missingSubmissionBinSchema(countErr.message || "")) setSubmissionCount(0)
  }, [scheduleId])

  React.useEffect(() => {
    void load()
  }, [load])

  const patchSlot = (kind: ExamKind, patch: Partial<SlotState> | ((prev: SlotState) => SlotState)) => {
    setSlots((prev) => ({
      ...prev,
      [kind]: typeof patch === "function" ? patch(prev[kind]) : { ...prev[kind], ...patch },
    }))
  }

  const saveSlot = async (kind: ExamKind) => {
    if (!scheduleId) return
    const slot = slots[kind]
    const mode = slot.exam?.mode || "external"
    const externalUrl = (slot.exam?.external_url || "").trim() || null

    if (mode === "external" && !externalUrl) {
      toast.error("Paste an exam URL, or switch to Create in TMS")
      return
    }
    if (mode === "internal") {
      const invalid = slot.questions.find(
        (q) =>
          !q.question_text.trim() ||
          !q.answers.length ||
          (q.question_type === "multiple_choice" && q.options.every((o) => !o.text.trim()))
      )
      if (invalid) {
        toast.error("Each question needs text and an answer")
        return
      }
      if (!slot.questions.length) {
        toast.error("Add at least one question, or import from Excel")
        return
      }
    }

    patchSlot(kind, { saving: true })
    try {
      const payload = {
        course_id: courseId,
        kind,
        mode,
        title: kind === "pretest" ? "Pre-test" : "Post-test",
        external_url: mode === "external" ? externalUrl : null,
        is_published: true,
        updated_at: new Date().toISOString(),
      }

      let examId = slot.exam?.id || ""
      if (!examId && courseId) {
        const { data: existingRows } = await tmsDb
          .from("exams")
          .select("id")
          .eq("course_id", courseId)
          .eq("kind", kind)
          .limit(5)
        examId = existingRows?.[0]?.id || ""
      }

      if (examId) {
        const { error } = await tmsDb.from("exams").update(payload).eq("id", examId)
        if (error) throw error
      } else {
        const { data, error } = await tmsDb
          .from("exams")
          .insert({ ...payload, schedule_id: scheduleId })
          .select("id")
          .single()
        if (error) {
          const lookup = courseId
            ? tmsDb.from("exams").select("id").eq("course_id", courseId).eq("kind", kind)
            : tmsDb.from("exams").select("id").eq("schedule_id", scheduleId).eq("kind", kind)
          const { data: fallback } = await lookup.limit(1)
          const found = fallback?.[0]?.id
          if (!found) throw error
          examId = found
          const { error: upErr } = await tmsDb.from("exams").update(payload).eq("id", examId)
          if (upErr) throw upErr
        } else {
          examId = data.id
        }
      }

      if (mode === "internal") {
        const { error: delErr } = await tmsDb.from("exam_questions").delete().eq("exam_id", examId)
        if (delErr) throw delErr
        if (slot.questions.length) {
          const rows = slot.questions.map((q, i) => ({
            exam_id: examId,
            question_type: q.question_type,
            question_text: q.question_text.trim(),
            options: q.question_type === "multiple_choice" ? q.options : [],
            answers: q.answers,
            sort_order: i,
            points: q.points || 1,
          }))
          const { data: inserted, error: insErr } = await tmsDb
            .from("exam_questions")
            .insert(rows)
            .select("id, question_type, question_text, options, answers, points, sort_order")
          if (insErr) throw insErr
          patchSlot(kind, {
            questions: (inserted || []).map(mapDbQuestion),
          })
        }
      } else if (courseId) {
        const field = kindToCourseLinkField(kind)
        await tmsDb
          .from("courses")
          .update({ [field]: externalUrl })
          .eq("id", courseId)
      }

      patchSlot(kind, (prev) => ({
        ...prev,
        exam: {
          id: examId,
          schedule_id: prev.exam?.schedule_id || scheduleId,
          course_id: courseId,
          kind,
          mode,
          title: payload.title,
          external_url: payload.external_url,
          is_published: true,
        },
        saving: false,
      }))
      toast.success(
        `${kind === "pretest" ? "Pre-test" : "Post-test"} saved${courseName ? ` for all ${courseName} schedules` : ""}`
      )
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : ""
      if (/relation|does not exist|schema cache|Could not find/i.test(message)) {
        setTablesMissing(true)
        toast.error("Exam tables are missing", {
          description: "Run scripts/create-exam-tables.sql in Supabase, then refresh.",
        })
      } else {
        toast.error("Failed to save exam", { description: message || "Unknown error" })
      }
      patchSlot(kind, { saving: false })
    }
  }

  if (!scheduleId) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Missing schedule. Open Exam from a schedule row.</p>
        <Button asChild variant="outline">
          <Link href="/training-schedules?tab=all">Back to schedules</Link>
        </Button>
      </div>
    )
  }

  const panels: { kind: ExamKind; title: string; description: string }[] = [
    {
      kind: "pretest",
      title: "Pre-test",
      description: "Taken before or at the start of training.",
    },
    {
      kind: "posttest",
      title: "Post-test",
      description: "Taken after training is completed.",
    },
  ]

  const tabTriggerClass =
    "group gap-1.5 px-3 data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#141454] data-[state=active]:shadow-none dark:data-[state=active]:bg-[#FFCC00] dark:data-[state=active]:text-[#141454]"

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 gap-1 px-2 text-muted-foreground" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Schedules
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Exam & submissions</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{courseName || "Training"}</span>
            {courseTitle ? <span>{courseTitle}</span> : null}
            {scheduleDateLabel ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {scheduleDateLabel}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {tablesMissing ? (
        <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Exam tables are not set up yet. Run{" "}
          <code className="rounded bg-amber-200/70 px-1 dark:bg-amber-900">scripts/create-exam-tables.sql</code>{" "}
          in the Supabase SQL editor, then refresh this page.
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          Loading exams…
        </div>
      ) : (
        <Tabs defaultValue="exam" className="gap-4">
          <TabsList className="h-10">
            <TabsTrigger value="exam" className={tabTriggerClass}>
              <ClipboardList className="h-4 w-4" />
              Exam / Test
            </TabsTrigger>
            <TabsTrigger value="submissions" className={tabTriggerClass}>
              <Inbox className="h-4 w-4" />
              Submissions
              <Badge
                variant="secondary"
                className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-semibold group-data-[state=active]:bg-[#141454] group-data-[state=active]:text-white"
              >
                {submissionCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exam" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setSummaryOpen(true)}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export summary
              </Button>
            </div>
            <ExamResultsPreview
              scheduleId={scheduleId}
              pretestExamId={slots.pretest.exam?.id || null}
              posttestExamId={slots.posttest.exam?.id || null}
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {panels.map((p) => {
                const slot = slots[p.kind]
                return (
                  <ExamPanel
                    key={p.kind}
                    kind={p.kind}
                    title={p.title}
                    description={p.description}
                    courseName={courseName}
                    scheduleId={scheduleId}
                    exam={slot.exam}
                    questions={slot.questions}
                    saving={slot.saving}
                    onChangeMode={(mode: ExamMode) =>
                      patchSlot(p.kind, (prev) => ({
                        ...prev,
                        exam: prev.exam
                          ? { ...prev.exam, mode }
                          : {
                              id: "",
                              schedule_id: scheduleId,
                              course_id: courseId,
                              kind: p.kind,
                              mode,
                              title: p.title,
                              external_url: null,
                              is_published: true,
                            },
                      }))
                    }
                    onChangeExternalUrl={(url) =>
                      patchSlot(p.kind, (prev) => ({
                        ...prev,
                        exam: prev.exam
                          ? { ...prev.exam, external_url: url, mode: "external" }
                          : {
                              id: "",
                              schedule_id: scheduleId,
                              course_id: courseId,
                              kind: p.kind,
                              mode: "external",
                              title: p.title,
                              external_url: url,
                              is_published: true,
                            },
                      }))
                    }
                    onChangeQuestions={(questions) => patchSlot(p.kind, { questions })}
                    onSave={() => saveSlot(p.kind)}
                  />
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="submissions">
            <SubmissionBinPanel
              scheduleId={scheduleId}
              courseName={courseName}
              onCountChange={setSubmissionCount}
            />
          </TabsContent>
        </Tabs>
      )}

      <ExamResultSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        scheduleId={scheduleId}
        courseName={courseName}
        pretestExamId={slots.pretest.exam?.id || null}
        posttestExamId={slots.posttest.exam?.id || null}
        pretestQuestionCount={slots.pretest.questions.length}
        posttestQuestionCount={slots.posttest.questions.length}
      />
    </div>
  )
}
