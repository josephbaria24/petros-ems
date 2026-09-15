"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import QRCode from "qrcode"
import {
  ArrowLeft,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  Download,
  Link2,
  Loader2,
  QrCode,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { OshProgramForm } from "@/components/osh-program-form"
import { OshProgramPreview } from "@/components/osh-program-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { tmsDb } from "@/lib/supabase-client"
import {
  buildGuestProgramUrl,
  defaultOshProgram,
  detectOshKind,
  emptyOshProgram,
  formatOshScheduleDates,
  missingOshProgramSchema,
  parseOshProgram,
  type OshProgram,
} from "@/lib/osh-program"

function courseOf(schedule: { courses?: unknown }) {
  const course = Array.isArray(schedule.courses) ? schedule.courses[0] : schedule.courses
  return (course as { name?: string; title?: string | null } | null) || null
}

function ProgramPageInner() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("scheduleId") || searchParams.get("schedule_id")
  const fromTab = searchParams.get("from") || "all"
  const backHref = `/training-schedules?tab=${encodeURIComponent(fromTab)}`

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [schemaMissing, setSchemaMissing] = React.useState(false)
  const [courseName, setCourseName] = React.useState("")
  const [courseTitle, setCourseTitle] = React.useState<string | null>(null)
  const [scheduleDateLabel, setScheduleDateLabel] = React.useState("")
  const [program, setProgram] = React.useState<OshProgram>(emptyOshProgram())
  const [guestUrl, setGuestUrl] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [qrDataUrl, setQrDataUrl] = React.useState("")
  const [qrOpen, setQrOpen] = React.useState(false)
  const [qrBusy, setQrBusy] = React.useState(false)

  const seedFromSchedule = React.useCallback(
    (opts: {
      courseName: string
      dates: string
      venue?: string
      eventType?: string
    }) => {
      const kind = detectOshKind(opts.courseName) || "generic"
      return defaultOshProgram(kind, {
        dates: opts.dates,
        venue: opts.venue,
        eventType: opts.eventType,
      })
    },
    []
  )

  const load = React.useCallback(async () => {
    if (!scheduleId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setSchemaMissing(false)

    const fullSelect = `
      id,
      event_type,
      branch,
      schedule_type,
      osh_program,
      courses ( name, title ),
      schedule_ranges ( start_date, end_date ),
      schedule_dates ( date )
    `
    let { data: schedule, error: se } = await tmsDb
      .from("schedules")
      .select(fullSelect)
      .eq("id", scheduleId)
      .single()

    if (se && missingOshProgramSchema(se.message || "")) {
      setSchemaMissing(true)
      const retry = await tmsDb
        .from("schedules")
        .select(
          `
          id,
          event_type,
          branch,
          schedule_type,
          courses ( name, title ),
          schedule_ranges ( start_date, end_date ),
          schedule_dates ( date )
        `
        )
        .eq("id", scheduleId)
        .single()
      schedule = retry.data
      se = retry.error
    }

    if (se || !schedule) {
      toast.error("Schedule not found", { description: se?.message })
      setLoading(false)
      return
    }

    const course = courseOf(schedule)
    const name = course?.name || "Training"
    const dates = formatOshScheduleDates(schedule)
    setCourseName(name)
    setCourseTitle(course?.title || null)
    setScheduleDateLabel(dates)

    const existing = parseOshProgram((schedule as { osh_program?: unknown }).osh_program)
    setProgram(
      existing ||
        seedFromSchedule({
          courseName: name,
          dates,
          venue: schedule.branch || "",
          eventType: schedule.event_type || "",
        })
    )
    setLoading(false)
  }, [scheduleId, seedFromSchedule])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (!scheduleId || typeof window === "undefined") return
    setGuestUrl(buildGuestProgramUrl(window.location.origin, scheduleId))
  }, [scheduleId])

  React.useEffect(() => {
    if (!guestUrl || !program.published) {
      setQrDataUrl("")
      return
    }
    let cancelled = false
    QRCode.toDataURL(guestUrl, {
      width: 280,
      margin: 1,
      color: { dark: "#1A1D66", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [guestUrl, program.published])

  const save = async (next = program) => {
    if (!scheduleId) return
    setSaving(true)
    const { error } = await tmsDb.from("schedules").update({ osh_program: next }).eq("id", scheduleId)
    setSaving(false)
    if (error) {
      if (missingOshProgramSchema(error.message || "")) {
        setSchemaMissing(true)
        toast.error("OSH program column is missing", {
          description: "Run scripts/add-osh-program.sql in Supabase, then refresh.",
        })
        return
      }
      toast.error("Could not save program", { description: error.message })
      return
    }
    setProgram(next)
    toast.success(next.published ? "Program saved and published" : "Program saved")
  }

  const togglePublished = async (published: boolean) => {
    const next = { ...program, published }
    setProgram(next)
    await save(next)
  }

  const copyLink = async () => {
    if (!guestUrl) return
    try {
      await navigator.clipboard.writeText(guestUrl)
      setCopied(true)
      toast.success("Trainer program link copied")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const downloadQr = async () => {
    if (!guestUrl || !scheduleId) return
    setQrBusy(true)
    try {
      const url = await QRCode.toDataURL(guestUrl, { width: 640, margin: 1 })
      const a = document.createElement("a")
      a.href = url
      a.download = `osh-program-qr-${scheduleId.slice(0, 8)}.png`
      a.click()
      toast.success("Program QR downloaded")
    } catch {
      toast.error("Could not generate QR")
    } finally {
      setQrBusy(false)
    }
  }

  const resetTemplate = () => {
    if (!window.confirm("Replace this form with the default COSH / BOSH template for this course? Unsaved edits will be lost.")) {
      return
    }
    const next = seedFromSchedule({
      courseName,
      dates: scheduleDateLabel,
      venue: program.venue,
      eventType: program.delivery.online ? "online" : "face-to-face",
    })
    next.published = program.published
    next.stoName = program.stoName
    setProgram(next)
    toast.message("Template restored — save to keep it")
  }

  if (!scheduleId) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Missing schedule. Open Program from a schedule row.</p>
        <Button asChild variant="outline">
          <Link href="/training-schedules?tab=all">Back to schedules</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="overflow-hidden rounded-2xl border border-[#FFCC00]/40 bg-gradient-to-br from-[#1A1D66] via-[#24286f] to-[#141654] text-white shadow-md print:hidden">
        <div className="h-1.5 bg-[#FFCC00]" />
        <div className="relative space-y-2 p-5 sm:p-6">
          <Button
            variant="ghost"
            size="sm"
            className="relative mb-1 -ml-2 gap-1 text-white/75 hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Schedules
            </Link>
          </Button>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  OSH Program
                </h1>
                <Badge className="gap-1 border-0 bg-[#FFCC00] text-[#1A1D66] hover:bg-[#FFCC00]">
                  <ClipboardList className="h-3 w-3" />
                  DOLE training program
                </Badge>
              </div>
              <p className="max-w-2xl text-sm text-white/80 md:text-base">
                <span className="font-semibold text-[#FFCC00]">{courseName || "Training"}</span>
                {courseTitle ? (
                  <>
                    {" — "}
                    <span className="text-white/90">{courseTitle}</span>
                  </>
                ) : null}
                {scheduleDateLabel ? (
                  <>
                    {" — "}
                    <span className="inline-flex items-center gap-1.5 text-white">
                      <Calendar className="h-3.5 w-3.5 text-[#FFCC00]" />
                      {scheduleDateLabel}
                    </span>
                  </>
                ) : null}
                {" — "}
                editable COSH / BOSH SO1 / BOSH SO2 program. Publish a public link so trainers can fill it without logging in.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                disabled={loading || schemaMissing}
                onClick={resetTemplate}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset template
              </Button>
            </div>
          </div>
        </div>
      </div>

      {schemaMissing ? (
        <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          The OSH program column is not set up yet. Run{" "}
          <code className="rounded bg-amber-200/70 px-1 dark:bg-amber-900">scripts/add-osh-program.sql</code>{" "}
          in the Supabase SQL editor, then refresh this page.
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-[#1A1D66] dark:text-[#FFCC00]" />
          Loading program…
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="publish-program"
                checked={program.published}
                disabled={schemaMissing || saving}
                onCheckedChange={(v) => void togglePublished(v)}
              />
              <Label htmlFor="publish-program" className="cursor-pointer">
                Publish for trainers (no login)
              </Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!program.published}
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy public link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!program.published}
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="h-3.5 w-3.5" />
                Show QR
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#1A1D66] hover:bg-[#141654]"
                disabled={schemaMissing || saving}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save program
              </Button>
            </div>
          </div>

          {program.published && guestUrl ? (
            <div className="flex max-w-3xl flex-col gap-2 rounded-xl border border-[#1A1D66]/15 bg-[#1A1D66]/5 p-3 print:hidden dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1A1D66] dark:text-[#FFCC00]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1D66] dark:text-[#FFCC00]">
                    Trainer program link
                  </p>
                  <a
                    href={guestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-foreground underline-offset-2 hover:underline"
                  >
                    {guestUrl}
                  </a>
                </div>
              </div>
              {qrDataUrl ? (
                <button
                  type="button"
                  className="shrink-0 self-center rounded-md border bg-white p-1"
                  onClick={() => setQrOpen(true)}
                >
                  <img src={qrDataUrl} alt="Program QR" className="h-16 w-16" />
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground print:hidden">
              Turn on publish to generate a public QR and link. Trainers can then open it without a TMS account.
            </p>
          )}

          <OshProgramForm value={program} onChange={setProgram} />
          <OshProgramPreview
            program={program}
            filename={`${(courseName || "osh-program").replace(/[^\w]+/g, "-").toLowerCase()}-program.pdf`}
          />
        </>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Trainer program QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Program QR" className="h-56 w-56 rounded-md border bg-white p-2" />
            ) : (
              <p className="text-sm text-muted-foreground">Publish the program to generate a QR.</p>
            )}
            <p className="text-center text-xs text-muted-foreground break-all">{guestUrl}</p>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!program.published || qrBusy}
              onClick={() => void downloadQr()}
            >
              {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ScheduleProgramPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading…
        </div>
      }
    >
      <ProgramPageInner />
    </React.Suspense>
  )
}
