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
  isValidExamEmail,
  normalizeMiddleInitial,
} from "@/lib/exam"
import {
  missingWorkshopSchema,
  parseWorkshopActivities,
  type WorkshopActivity,
} from "@/lib/workshop"

function GuestWorkshopForm() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("schedule_id") || searchParams.get("scheduleId")

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [courseName, setCourseName] = React.useState("")
  const [activities, setActivities] = React.useState<WorkshopActivity[]>([])
  const [email, setEmail] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [middleInitial, setMiddleInitial] = React.useState("")
  const [answers, setAnswers] = React.useState<Record<string, Record<string, string>>>({})

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!scheduleId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data: schedule, error } = await tmsDb
        .from("schedules")
        .select("id, workshop_activities, courses ( name )")
        .eq("id", scheduleId)
        .single()

      if (cancelled) return
      if (error || !schedule) {
        toast.error(
          error && missingWorkshopSchema(error.message || "")
            ? "Workshop is not set up yet. Ask your trainer to run the workshop SQL script."
            : "Training not found"
        )
        setLoading(false)
        return
      }

      const name = (schedule.courses as { name?: string } | null)?.name || "Training"
      setCourseName(name)
      const parsed = parseWorkshopActivities(schedule.workshop_activities).filter(
        (a) => a.title.trim() || a.questions.some((q) => q.prompt.trim())
      )
      setActivities(parsed)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scheduleId])

  const setAnswer = (activityId: string, questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] || {}), [questionId]: value },
    }))
  }

  const submit = async () => {
    if (!scheduleId) return
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

    const unanswered = activities
      .flatMap((a) => a.questions.filter((q) => q.prompt.trim()).map((q) => ({ a, q })))
      .find(({ a, q }) => !String(answers[a.id]?.[q.id] || "").trim())
    if (unanswered) {
      toast.error("Please answer all workshop prompts")
      return
    }

    const mi = normalizeMiddleInitial(middleInitial)
    const respondentName = composeRespondentName(lastName, firstName, mi)
    const emailNorm = email.trim().toLowerCase()

    setSubmitting(true)
    try {
      let trainingId: string | null = null
      const { data: trainings } = await tmsDb
        .from("trainings")
        .select("id, email")
        .eq("schedule_id", scheduleId)
      const match = (trainings || []).find(
        (t) => String(t.email || "").trim().toLowerCase() === emailNorm
      )
      if (match) trainingId = match.id

      const payload = {
        schedule_id: scheduleId,
        training_id: trainingId,
        respondent_name: respondentName,
        respondent_email: emailNorm,
        answers,
        updated_at: new Date().toISOString(),
      }

      const { data: existing } = await tmsDb
        .from("workshop_responses")
        .select("id")
        .eq("schedule_id", scheduleId)
        .eq("respondent_email", emailNorm)
        .maybeSingle()

      const { error } = existing?.id
        ? await tmsDb.from("workshop_responses").update(payload).eq("id", existing.id)
        : await tmsDb.from("workshop_responses").insert(payload)

      if (error) {
        toast.error("Could not submit answers", { description: error.message })
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (!scheduleId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] p-6 dark:bg-background">
        <p className="text-muted-foreground">Missing workshop link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f5fb] text-[#1A1D66] dark:bg-background dark:text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        Loading workshop…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff7cc_0%,_#f4f5fb_45%,_#e8eaf6_100%)] dark:bg-[radial-gradient(ellipse_at_top,_#2a2610_0%,_#161824_45%,_#12141c_100%)]">
      <header className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] text-white shadow-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFCC00]">Petrosphere TMS</p>
          <h1 className="text-2xl font-bold tracking-tight">Workshop</h1>
          <p className="text-sm text-white/80">{courseName || "Training workshop"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {done ? (
          <div className="rounded-2xl border border-[#FFCC00]/50 bg-white p-8 text-center shadow-md dark:border-[#FFCC00]/30 dark:bg-card">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold text-[#1A1D66] dark:text-foreground">
              Thank you, {firstName.trim()}!
            </h2>
            <p className="mt-2 text-muted-foreground">Your workshop answers were submitted.</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm dark:bg-card">
            <p className="text-muted-foreground">
              No workshop activities have been posted for this training yet.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card">
              <p className="mb-4 text-sm font-semibold text-[#1A1D66] dark:text-foreground">Your details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ws-email">Email *</Label>
                  <Input
                    id="ws-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-last">Last name *</Label>
                  <Input
                    id="ws-last"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-first">First name *</Label>
                  <Input
                    id="ws-first"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-mi">Middle initial (optional)</Label>
                  <Input
                    id="ws-mi"
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

            {activities.map((activity, ai) => (
              <div
                key={activity.id}
                className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card"
              >
                <div className="mb-3 flex items-start gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A1D66] text-xs font-bold text-white dark:bg-[#FFCC00] dark:text-[#1A1D66]">
                    {ai + 1}
                  </span>
                  <div>
                    <h2 className="font-semibold text-[#1A1D66] dark:text-foreground">
                      {activity.title.trim() || `Activity ${ai + 1}`}
                    </h2>
                    {activity.instructions.trim() ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {activity.instructions}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-4">
                  {activity.questions
                    .filter((q) => q.prompt.trim())
                    .map((q, qi) => (
                      <div key={q.id} className="space-y-1.5">
                        <Label>
                          {qi + 1}. {q.prompt}
                        </Label>
                        <Textarea
                          value={answers[activity.id]?.[q.id] || ""}
                          onChange={(e) => setAnswer(activity.id, q.id, e.target.value)}
                          placeholder="Your answer"
                          className="min-h-[96px]"
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}

            <Button
              type="button"
              className="h-12 w-full bg-[#1A1D66] text-base hover:bg-[#141654]"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit workshop answers"
              )}
            </Button>
          </>
        )}
      </main>
    </div>
  )
}

export default function GuestWorkshopPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-base">Loading…</span>
        </div>
      }
    >
      <GuestWorkshopForm />
    </React.Suspense>
  )
}
