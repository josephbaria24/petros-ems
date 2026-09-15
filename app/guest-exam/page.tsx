"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { tmsDb } from "@/lib/supabase-client"
import {
  composeRespondentName,
  gradeAnswer,
  isValidExamEmail,
  mapDbQuestion,
  normalizeMiddleInitial,
  type ExamQuestionDraft,
  type ExamRecord,
} from "@/lib/exam"
import { cn } from "@/lib/utils"

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
  const [email, setEmail] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [middleInitial, setMiddleInitial] = React.useState("")
  const [answers, setAnswers] = React.useState<Record<string, string>>({})

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
  }, [examId])

  const submit = async () => {
    if (!exam) return
    if (!isValidExamEmail(email)) {
      toast.error("Please enter a valid email")
      return
    }
    if (!lastName.trim()) {
      toast.error("Please enter your last name")
      return
    }
    if (!firstName.trim()) {
      toast.error("Please enter your first name")
      return
    }
    const unanswered = questions.find((q) => !String(answers[q.id || q.clientId] || "").trim())
    if (unanswered) {
      toast.error("Please answer all questions")
      return
    }

    const mi = normalizeMiddleInitial(middleInitial)
    const respondentName = composeRespondentName(lastName, firstName, mi)

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
        respondent_email: email.trim(),
        answers: payloadAnswers,
        score,
        max_score: max,
      }
      const responseScheduleId = scheduleIdParam || exam.schedule_id || null
      if (responseScheduleId) responsePayload.schedule_id = responseScheduleId

      let { error } = await tmsDb.from("exam_responses").insert(responsePayload)
      if (error && responseScheduleId && /schedule_id|schema cache|column/i.test(error.message || "")) {
        delete responsePayload.schedule_id
        const retry = await tmsDb.from("exam_responses").insert(responsePayload)
        error = retry.error
      }
      if (error) throw error
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
            <h2 className="mt-3 text-xl font-bold text-[#1A1D66] dark:text-foreground">Thank you, {firstName.trim()}!</h2>
            <p className="mt-2 text-muted-foreground">Your answers were submitted successfully.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card">
              <p className="mb-4 text-sm font-semibold text-[#1A1D66] dark:text-foreground">Your details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="guest-email">Email *</Label>
                  <Input
                    id="guest-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-last-name">Last name *</Label>
                  <Input
                    id="guest-last-name"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-first-name">First name *</Label>
                  <Input
                    id="guest-first-name"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-mi">Middle initial (optional)</Label>
                  <Input
                    id="guest-mi"
                    autoComplete="additional-name"
                    maxLength={2}
                    value={middleInitial}
                    onChange={(e) => setMiddleInitial(normalizeMiddleInitial(e.target.value))}
                    placeholder="M"
                    className="max-w-[5rem] uppercase"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Use the same name and email as in your training registration.
              </p>
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
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit exam
            </Button>
          </>
        )}
      </main>
    </div>
  )
}
