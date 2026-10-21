"use client"

import * as React from "react"
import { Spinner } from "@/components/ui/spinner"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import QRCode from "qrcode"
import { ArrowLeft, Calendar, Check, ClipboardList, Copy, Download, Link2, QrCode, RotateCcw } from "lucide-react"
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
import { oshSheetDownloadName } from "@/lib/osh-sheet-pdf"

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
      <div className="page-shell space-y-3">
        <p className="text-sm text-muted-foreground">Missing schedule. Open Program from a schedule row.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/training-schedules?tab=all">Back to schedules</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="page-shell mx-auto w-full min-w-0 max-w-6xl space-y-3 overflow-x-hidden sm:space-y-4 md:space-y-6">
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-[#FFCC00]/40 bg-gradient-to-br from-[#1A1D66] via-[#24286f] to-[#141654] text-white shadow-md print:hidden sm:rounded-xl lg:rounded-2xl">
        <div className="h-0.5 bg-[#FFCC00] sm:h-1" />
        <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-4 lg:flex-row lg:items-start lg:justify-between lg:gap-4 lg:p-5">
          <div className="w-full min-w-0 max-w-full flex-1 space-y-1.5 sm:space-y-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-1.5 text-white/75 hover:bg-white/10 hover:text-white sm:h-8 sm:px-2"
                asChild
              >
                <Link href={backHref}>
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Schedules</span>
                </Link>
              </Button>
              <div className="mx-0.5 h-4 w-px shrink-0 bg-white/20 sm:hidden" aria-hidden />
              <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-white sm:text-xl lg:text-2xl">
                OSH Program
              </h1>
              <Badge className="h-5 shrink-0 gap-0.5 border-0 bg-[#FFCC00] px-1.5 text-[10px] text-[#1A1D66] hover:bg-[#FFCC00] sm:h-6 sm:text-xs">
                <ClipboardList className="h-3 w-3" />
                <span className="sm:hidden">DOLE</span>
                <span className="hidden sm:inline">DOLE training program</span>
              </Badge>
            </div>

            <p className="truncate text-[11px] font-medium text-[#FFCC00] sm:text-xs lg:text-sm">
              {courseName || "Training"}
              {courseTitle ? (
                <span className="hidden text-white/80 sm:inline">
                  {" — "}
                  {courseTitle}
                </span>
              ) : null}
            </p>

            {scheduleDateLabel ? (
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/85 sm:text-xs">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-[#FFCC00]" />
                <span className="min-w-0 truncate">{scheduleDateLabel}</span>
              </p>
            ) : null}

            <p className="hidden text-xs text-white/75 sm:block md:text-sm">
              Editable COSH / BOSH SO1 / BOSH SO2 program. Publish a public link so trainers can fill it without logging in.
            </p>
          </div>

          <div className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-full gap-1.5 border-white/30 bg-white/10 px-2 text-[11px] text-white hover:bg-white/20 sm:h-9 sm:w-auto sm:text-xs"
              disabled={loading || schemaMissing}
              onClick={resetTemplate}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset template</span>
            </Button>
          </div>
        </div>
      </div>

      {schemaMissing ? (
        <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm dark:bg-amber-950/30 dark:text-amber-100">
          The OSH program column is not set up yet. Run{" "}
          <code className="rounded bg-amber-200/70 px-1 dark:bg-amber-900">scripts/add-osh-program.sql</code>{" "}
          in the Supabase SQL editor, then refresh this page.
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground sm:py-24">
          <Spinner size={28} className="dark:text-[#FFCC00]" />
          <p className="text-sm">Loading program…</p>
        </div>
      ) : (
        <>
          <div className="flex w-full min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-2.5 print:hidden sm:gap-3 sm:rounded-xl sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <Switch
                id="publish-program"
                checked={program.published}
                disabled={schemaMissing || saving}
                onCheckedChange={(v) => void togglePublished(v)}
              />
              <Label htmlFor="publish-program" className="cursor-pointer text-xs leading-snug sm:text-sm">
                <span className="sm:hidden">Publish for trainers</span>
                <span className="hidden sm:inline">Publish for trainers (no login)</span>
              </Label>
            </div>
            <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-0 gap-1 px-1.5 text-[11px] sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
                disabled={!program.published}
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">
                  <span className="sm:hidden">{copied ? "Copied" : "Copy"}</span>
                  <span className="hidden sm:inline">{copied ? "Copied" : "Copy public link"}</span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-0 gap-1 px-1.5 text-[11px] sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
                disabled={!program.published}
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  <span className="sm:hidden">QR</span>
                  <span className="hidden sm:inline">Show QR</span>
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-0 gap-1 bg-[#1A1D66] px-1.5 text-[11px] hover:bg-[#141654] sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
                disabled={schemaMissing || saving}
                onClick={() => void save()}
              >
                {saving ? <Spinner size={14} /> : null}
                <span className="truncate">
                  <span className="sm:hidden">Save</span>
                  <span className="hidden sm:inline">Save program</span>
                </span>
              </Button>
            </div>
          </div>

          {program.published && guestUrl ? (
            <div className="flex w-full min-w-0 max-w-3xl flex-col gap-2 overflow-hidden rounded-lg border border-[#1A1D66]/15 bg-[#1A1D66]/5 p-2.5 print:hidden dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:rounded-xl sm:p-3">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1A1D66] sm:h-4 sm:w-4 dark:text-[#FFCC00]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1A1D66] sm:text-xs dark:text-[#FFCC00]">
                    Trainer program link
                  </p>
                  <a
                    href={guestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-foreground underline-offset-2 hover:underline sm:text-sm"
                  >
                    <span className="sm:hidden">Open trainer link</span>
                    <span className="hidden sm:inline">{guestUrl}</span>
                  </a>
                </div>
              </div>
              {qrDataUrl ? (
                <button
                  type="button"
                  className="hidden shrink-0 self-center rounded-md border bg-white p-1 sm:block"
                  onClick={() => setQrOpen(true)}
                >
                  <img src={qrDataUrl} alt="Program QR" className="h-14 w-14 lg:h-16 lg:w-16" />
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground print:hidden sm:text-sm">
              Turn on publish to generate a public QR and link. Trainers can then open it without a TMS account.
            </p>
          )}

          <OshProgramForm value={program} onChange={setProgram} downloadName={oshSheetDownloadName(courseName)} />
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
              <img src={qrDataUrl} alt="Program QR" className="h-48 w-48 rounded-md border bg-white p-2 sm:h-56 sm:w-56" />
            ) : (
              <p className="text-sm text-muted-foreground">Publish the program to generate a QR.</p>
            )}
            <p className="break-all text-center text-xs text-muted-foreground">{guestUrl}</p>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!program.published || qrBusy}
              onClick={() => void downloadQr()}
            >
              {qrBusy ? <Spinner size={14} /> : <Download className="h-3.5 w-3.5" />}
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
          <Spinner size={24} />
          Loading…
        </div>
      }
    >
      <ProgramPageInner />
    </React.Suspense>
  )
}
