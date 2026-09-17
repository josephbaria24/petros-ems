"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { tmsDb } from "@/lib/supabase-client"
import {
  composeRespondentName,
  isValidExamEmail,
  normalizeMiddleInitial,
} from "@/lib/exam"
import {
  missingSubmissionBinSchema,
  type SubmissionBinKind,
} from "@/lib/submission-bin"

function GuestSubmissionBinForm() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("schedule_id") || searchParams.get("scheduleId")

  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [courseName, setCourseName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [middleInitial, setMiddleInitial] = React.useState("")
  const [kind, setKind] = React.useState<SubmissionBinKind>("reentry_plan")
  const [title, setTitle] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)

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
        .select("id, courses ( name )")
        .eq("id", scheduleId)
        .single()

      if (cancelled) return
      if (error || !schedule) {
        toast.error("Training not found")
        setLoading(false)
        return
      }
      const course = Array.isArray(schedule.courses) ? schedule.courses[0] : schedule.courses
      setCourseName((course as { name?: string } | null)?.name || "Training")
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scheduleId])

  const submit = async () => {
    if (!scheduleId) return
    if (!isValidExamEmail(email)) {
      toast.error("Please enter a valid email")
      return
    }
    if (!lastName.trim() || !firstName.trim()) {
      toast.error("Please enter your first and last name")
      return
    }
    if (!file) {
      toast.error("Please choose a file to upload")
      return
    }
    if (kind === "other" && !title.trim()) {
      toast.error("Please name this submission")
      return
    }

    const mi = normalizeMiddleInitial(middleInitial)
    const respondentName = composeRespondentName(lastName, firstName, mi)
    const emailNorm = email.trim().toLowerCase()

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("material", file)
      const uploadRes = await fetch("/api/upload-material", { method: "POST", body: formData })
      const uploaded = await uploadRes.json()
      if (!uploadRes.ok || !uploaded?.url) {
        throw new Error(uploaded?.error || "Upload failed")
      }

      let trainingId: string | null = null
      const { data: trainings } = await tmsDb
        .from("trainings")
        .select("id, email")
        .eq("schedule_id", scheduleId)
      const match = (trainings || []).find(
        (t) => String(t.email || "").trim().toLowerCase() === emailNorm
      )
      if (match?.id) trainingId = match.id

      const { error } = await tmsDb.from("submission_bin_items").insert({
        schedule_id: scheduleId,
        training_id: trainingId,
        kind,
        title: kind === "other" ? title.trim() : title.trim() || "Re-entry plan",
        respondent_name: respondentName,
        respondent_email: emailNorm,
        file_url: uploaded.url,
        file_name: file.name,
        file_type: uploaded.fileType || file.type || "other",
      })
      if (error) {
        if (missingSubmissionBinSchema(error.message || "")) {
          throw new Error("Submission bin is not set up yet. Ask your trainer to run the SQL script.")
        }
        throw error
      }
      setDone(true)
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : ""
      toast.error("Could not submit file", { description: message || "Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  if (!scheduleId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">
        Missing training link. Ask your trainer for the submission URL.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff7cc_0%,_#f4f5fb_45%,_#e8eaf6_100%)] dark:bg-[radial-gradient(ellipse_at_top,_#2a2610_0%,_#161824_45%,_#12141c_100%)]">
      <header className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] text-white shadow-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFCC00]">Petrosphere TMS</p>
          <h1 className="text-2xl font-bold tracking-tight">Submission bin</h1>
          <p className="text-sm text-white/80">{courseName || "Training"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {done ? (
          <div className="rounded-2xl border border-[#FFCC00]/50 bg-white p-8 text-center shadow-md dark:border-[#FFCC00]/30 dark:bg-card">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold text-[#1A1D66] dark:text-foreground">Received, {firstName.trim()}!</h2>
            <p className="mt-2 text-muted-foreground">Your file was submitted successfully.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card">
              <p className="mb-4 text-sm font-semibold text-[#1A1D66] dark:text-foreground">Your details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bin-email">Email *</Label>
                  <Input
                    id="bin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bin-last-name">Last name *</Label>
                  <Input
                    id="bin-last-name"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bin-first-name">First name *</Label>
                  <Input
                    id="bin-first-name"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bin-mi">Middle initial (optional)</Label>
                  <Input
                    id="bin-mi"
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

            <div className="rounded-2xl border border-[#1A1D66]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card">
              <p className="mb-4 text-sm font-semibold text-[#1A1D66] dark:text-foreground">File to submit</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as SubmissionBinKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reentry_plan">Re-entry plan</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bin-title">{kind === "other" ? "Title *" : "Title (optional)"}</Label>
                  <Input
                    id="bin-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === "other" ? "Document name" : "Re-entry plan"}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bin-file">Upload file *</Label>
                  <Input
                    id="bin-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
                </div>
              </div>
            </div>

            <Button
              className="h-11 w-full gap-2 bg-[#1A1D66] text-base text-white hover:bg-[#141654] dark:bg-[#FFCC00] dark:text-[#1A1D66] dark:hover:bg-[#e6b800]"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit file"}
            </Button>
          </>
        )}
      </main>
    </div>
  )
}

export default function GuestSubmissionBinPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-base">Loading…</span>
        </div>
      }
    >
      <GuestSubmissionBinForm />
    </React.Suspense>
  )
}
