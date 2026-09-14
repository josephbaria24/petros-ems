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
  gradeAnswer,
  mapDbQuestion,
  type ExamQuestionDraft,
  type ExamRecord,
} from "@/lib/exam"
import { cn } from "@/lib/utils"

export default function GuestExamPage() {
  const searchParams = useSearchParams()
  const examId = searchParams.get("exam_id")

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState<{ score: number; max: number } | null>(null)
  const [exam, setExam] = React.useState<ExamRecord | null>(null)
  const [courseName, setCourseName] = React.useState("")
  const [questions, setQuestions] = React.useState<ExamQuestionDraft[]>([])
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
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
    if (!exam || !name.trim()) {
      toast.error("Please enter your name")
      return
    }
    const unanswered = questions.find((q) => !String(answers[q.id || q.clientId] || "").trim())
    if (unanswered) {
      toast.error("Please answer all questions")
      return
    }

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

      const { error } = await tmsDb.from("exam_responses").insert({
        exam_id: exam.id,
        respondent_name: name.trim(),
        respondent_email: email.trim() || null,
        answers: payloadAnswers,
        score,
        max_score: max,
      })
      if (error) throw error
      setDone({ score, max })
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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] p-6">
        <p className="text-muted-foreground">Missing exam link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f5fb] text-[#1A1D66]">
        <Loader2 className="h-8 w-8 animate-spin" />
        Loading exam…
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] p-6">
        <p className="text-muted-foreground">This exam could not be loaded.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff7cc_0%,_#f4f5fb_45%,_#e8eaf6_100%)]">
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
          <div className="rounded-2xl border border-[#FFCC00]/50 bg-white p-8 text-center shadow-md">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-3 text-xl font-bold text-[#1A1D66]">Thank you, {name.trim()}!</h2>
            <p className="mt-2 text-muted-foreground">Your answers were submitted successfully.</p>
            <p className="mt-4 text-3xl font-bold text-[#1A1D66]">
              {done.score}
              <span className="text-lg font-medium text-muted-foreground"> / {done.max}</span>
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="guest-name">Full name *</Label>
                  <Input
                    id="guest-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-email">Email (optional)</Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>

            {questions.map((q, i) => {
              const key = q.id || q.clientId
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A1D66] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <p className="font-medium text-[#1A1D66]">{q.question_text}</p>
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
                                : "border-border hover:border-[#1A1D66]/30"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                                answers[key] === o.key
                                  ? "bg-[#FFCC00] text-[#1A1D66]"
                                  : "bg-[#1A1D66]/10 text-[#1A1D66]"
                              )}
                            >
                              {o.key}
                            </span>
                            <span>{o.text}</span>
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
              className="h-11 w-full gap-2 bg-[#1A1D66] text-base text-white hover:bg-[#141654]"
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
