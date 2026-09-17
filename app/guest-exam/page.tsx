"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { tmsDb } from "@/lib/supabase-client"
import {
  composeRespondentName,
  gradeAnswer,
  mapDbQuestion,
  type ExamQuestionDraft,
  type ExamRecord,
} from "@/lib/exam"
import { cn } from "@/lib/utils"

type TraineeOption = {
  id: string
  first_name: string | null
  last_name: string | null
  middle_initial: string | null
  email: string | null
  status: string | null
}

function isActiveTrainee(t: TraineeOption) {
  const s = `${t.status || ""}`.toLowerCase()
  return !s.includes("cancel") && !s.includes("declin")
}

function traineeLabel(t: TraineeOption) {
  const last = (t.last_name || "").trim()
  const first = (t.first_name || "").trim()
  const mi = (t.middle_initial || "").trim()
  const name = composeRespondentName(last, first, mi)
  return name || "Unnamed participant"
}

export default function GuestExamPage() {
  const searchParams = useSearchParams()
  const examId = searchParams.get("exam_id")
  const scheduleIdParam = searchParams.get("schedule_id") || searchParams.get("scheduleId")

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [exam, setExam] = React.useState<ExamRecord | null>(null)
  const [courseName, setCourseName] = React.useState("")
  const [questions, setQuestions] = React.useState<ExamQuestionDraft[]>([])
  const [trainees, setTrainees] = React.useState<TraineeOption[]>([])
  const [selectedTraineeId, setSelectedTraineeId] = React.useState("")
  const [nameFilter, setNameFilter] = React.useState("")
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [selectConfirmOpen, setSelectConfirmOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const previousTraineeId = React.useRef("")

  const scheduleId = scheduleIdParam || exam?.schedule_id || null
  const selectedTrainee = trainees.find((t) => t.id === selectedTraineeId) || null

  const filteredTrainees = React.useMemo(() => {
    const q = nameFilter.trim().toLowerCase()
    const list = trainees.filter(isActiveTrainee)
    if (!q) return list
    return list.filter((t) => {
      const name = `${t.last_name || ""} ${t.first_name || ""} ${t.email || ""}`.toLowerCase()
      return name.includes(q)
    })
  }, [trainees, nameFilter])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!examId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data: examRow, error } = await tmsDb
        .from("exams")
        .select("id, schedule_id, course_id, kind, mode, title, external_url, is_published")
        .eq("id", examId)
        .single()

      if (cancelled) return
      if (error || !examRow) {
        toast.error("Exam not found")
        setLoading(false)
        return
      }

      if (examRow.mode === "external" && examRow.external_url) {
        window.location.href = examRow.external_url
        return
      }

      setExam(examRow as ExamRecord)

      if (examRow.course_id) {
        const { data: course } = await tmsDb.from("courses").select("name").eq("id", examRow.course_id).single()
        if (!cancelled) setCourseName(course?.name || "")
      }

      const rosterScheduleId = scheduleIdParam || examRow.schedule_id || null
      if (rosterScheduleId) {
        const { data: rows } = await tmsDb
          .from("trainings")
          .select("id, first_name, last_name, middle_initial, email, status")
          .eq("schedule_id", rosterScheduleId)
          .order("last_name", { ascending: true })
        if (!cancelled) setTrainees((rows as TraineeOption[]) || [])
      }

      const { data: qs, error: qe } = await tmsDb
        .from("exam_questions")
        .select("id, question_type, question_text, options, answers, points, sort_order")
        .eq("exam_id", examId)
        .order("sort_order", { ascending: true })

      if (cancelled) return
      if (qe) {
        toast.error("Could not load questions", { description: qe.message })
        setLoading(false)
        return
      }
      setQuestions((qs || []).map(mapDbQuestion))
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [examId, scheduleIdParam])

  const answeredCount = questions.filter((q) => String(answers[q.id || q.clientId] || "").trim()).length

  const requestSubmit = () => {
    if (!selectedTrainee) {
      toast.error("Select your name from the participant list")
      return
    }
    const unanswered = questions.find((q) => !String(answers[q.id || q.clientId] || "").trim())
    if (unanswered) {
      toast.error("Please answer all questions")
      return
    }
    setConfirmOpen(true)
  }

  const submit = async () => {
    if (!exam) return
    if (!selectedTrainee) {
      toast.error("Select your name from the participant list")
      return
    }
    const unanswered = questions.find((q) => !String(answers[q.id || q.clientId] || "").trim())
    if (unanswered) {
      toast.error("Please answer all questions")
      return
    }

    const respondentName = composeRespondentName(
      selectedTrainee.last_name || "",
      selectedTrainee.first_name || "",
      selectedTrainee.middle_initial || ""
    )

    setSubmitting(true)
    try {
      let score = 0
      let max = 0
      const payloadAnswers: Record<string, string> = {}
      for (const q of questions) {
        const key = q.id || q.clientId
        const given = answers[key] || ""
        payloadAnswers[key] = given
        const pts = q.points || 1
        max += pts
        if (gradeAnswer(q, given)) score += pts
      }

      const responsePayload: Record<string, unknown> = {
        exam_id: exam.id,
        respondent_name: respondentName,
        respondent_email: (selectedTrainee.email || "").trim() || null,
        answers: payloadAnswers,
        score,
        max_score: max,
      }
      const responseScheduleId = scheduleId
      if (responseScheduleId) responsePayload.schedule_id = responseScheduleId

      let { error } = await tmsDb.from("exam_responses").insert(responsePayload)
      if (error && responseScheduleId && /schedule_id|schema cache|column/i.test(error.message || "")) {
        delete responsePayload.schedule_id
        const retry = await tmsDb.from("exam_responses").insert(responsePayload)
        error = retry.error
      }
      if (error) throw error
      setConfirmOpen(false)
      setDone(true)
      toast.success("Exam submitted")
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : ""
      toast.error("Could not submit exam", { description: message })
    } finally {
      setSubmitting(false)
    }
  }

  if (!examId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] p-6 dark:bg-background">
        <p className="text-muted-foreground">Missing exam link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f5fb] text-[#1A1D66] dark:bg-background dark:text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        Loading exam…
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] p-6 dark:bg-background">
        <p className="text-muted-foreground">This exam could not be loaded.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff7cc_0%,_#f4f5fb_45%,_#e8eaf6_100%)] dark:bg-[radial-gradient(ellipse_at_top,_#2a2610_0%,_#161824_45%,_#12141c_100%)]">
      <header className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] text-white shadow-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFCC00]">Petrosphere TMS</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {exam.title || (exam.kind === "pretest" ? "Pre-test" : "Post-test")}
          </h1>
          <p className="text-sm text-white/80">{courseName || "Training exam"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {done ? (
          <div className="rounded-2xl border border-[#FFCC00]/50 bg-white p-8 text-center shadow-md dark:border-[#FFCC00]/30 dark:bg-card">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold text-[#1A1D66] dark:text-foreground">
              Thank you, {(selectedTrainee?.first_name || "").trim() || "participant"}!
            </h2>
            <p className="mt-2 text-muted-foreground">Your answers were submitted successfully.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card">
              <p className="mb-4 text-sm font-semibold text-[#1A1D66] dark:text-foreground">Your details</p>
              <div className="space-y-2">
                <Label>Select your name *</Label>
                <Select
                  value={selectedTraineeId}
                  onValueChange={(value) => {
                    previousTraineeId.current = selectedTraineeId
                    setSelectedTraineeId(value)
                    setNameFilter("")
                    setSelectConfirmOpen(true)
                  }}
                >
                  <SelectTrigger className="h-11 w-full border border-input bg-background text-base">
                    <SelectValue placeholder="Select from participants" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <div className="sticky top-0 z-10 border-b bg-popover p-2">
                      <Input
                        value={nameFilter}
                        onChange={(event) => setNameFilter(event.target.value)}
                        placeholder="Search name or email…"
                        className="h-9 border border-input bg-background"
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </div>
                    {filteredTrainees.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {trainees.length === 0
                          ? "No participants found for this training."
                          : "No matching participant."}
                      </p>
                    ) : (
                      filteredTrainees.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-base py-2.5">
                          {t.last_name || ""}, {t.first_name || ""}
                          {t.email ? ` · ${t.email}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Make sure you select <strong>your own name</strong>. Choosing someone else will attach this exam to their record and can mix up scores.
                    </span>
                  </p>
                </div>
                {selectedTrainee ? (
                  <div className="rounded-xl border bg-muted/50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Selected participant</p>
                    <p className="mt-1 text-base font-semibold">{traineeLabel(selectedTrainee)}</p>
                    <p className="text-sm text-muted-foreground">{selectedTrainee.email || "No email on file"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Double-check this is you before answering and submitting.
                    </p>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Choose your name from the registered participants for this schedule.
                </p>
              </div>
            </div>

            {questions.map((q, i) => {
              const key = q.id || q.clientId
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card"
                >
                  <div className="mb-3 flex items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A1D66] text-xs font-bold text-white dark:bg-[#FFCC00] dark:text-[#1A1D66]">
                      {i + 1}
                    </span>
                    <p className="font-medium text-[#1A1D66] dark:text-foreground">{q.question_text}</p>
                  </div>

                  {q.question_type === "multiple_choice" ? (
                    <div className="ml-9 space-y-2">
                      {q.options
                        .filter((o) => o.text.trim())
                        .map((o) => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [key]: o.key }))}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                              answers[key] === o.key
                                ? "border-[#FFCC00] bg-[#FFCC00]/20"
                                : "border-border hover:border-[#1A1D66]/30 dark:hover:border-white/25"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                                answers[key] === o.key
                                  ? "bg-[#FFCC00] text-[#1A1D66]"
                                  : "bg-[#1A1D66]/10 text-[#1A1D66] dark:bg-white/10 dark:text-foreground"
                              )}
                            >
                              {o.key}
                            </span>
                            <span className="text-foreground">{o.text}</span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="ml-9">
                      <Textarea
                        value={answers[key] || ""}
                        placeholder="Type your answer…"
                        className="min-h-[80px]"
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            <Button
              className="h-11 w-full gap-2 bg-[#1A1D66] text-base text-white hover:bg-[#141654] dark:bg-[#FFCC00] dark:text-[#1A1D66] dark:hover:bg-[#e6b800]"
              disabled={submitting || !questions.length}
              onClick={requestSubmit}
            >
              Review and submit
            </Button>
          </>
        )}
      </main>

      <AlertDialog open={selectConfirmOpen} onOpenChange={setSelectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your name</AlertDialogTitle>
            <AlertDialogDescription>
              Select your own name only. Picking someone else can mix up exam scores and create conflicts on their record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedTrainee ? (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You selected</p>
              <p className="mt-1 text-base font-semibold">{traineeLabel(selectedTrainee)}</p>
              <p className="text-muted-foreground">{selectedTrainee.email || "No email on file"}</p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSelectedTraineeId(previousTraineeId.current)
              }}
            >
              Choose a different name
            </AlertDialogCancel>
            <AlertDialogAction className="bg-[#1A1D66] text-white hover:bg-[#141654]">
              This is my name
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your exam submission</AlertDialogTitle>
            <AlertDialogDescription>
              This exam will be saved under the selected participant. Please confirm the name is correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedTrainee ? (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exam</p>
                <p className="font-medium">
                  {exam.title || (exam.kind === "pretest" ? "Pre-test" : "Post-test")}
                  {courseName ? ` · ${courseName}` : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitting as</p>
                <p className="text-base font-semibold">{traineeLabel(selectedTrainee)}</p>
                <p className="text-muted-foreground">{selectedTrainee.email || "No email on file"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Answers</p>
                <p className="font-medium">
                  {answeredCount} of {questions.length} questions answered
                </p>
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              className="bg-[#1A1D66] text-white hover:bg-[#141654]"
              onClick={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Submitting…" : "Yes, submit as this name"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
