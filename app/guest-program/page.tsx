"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { OshProgramForm } from "@/components/osh-program-form"
import { OshProgramPreview } from "@/components/osh-program-preview"
import { Button } from "@/components/ui/button"
import { emptyOshProgram, parseOshProgram, type OshProgram } from "@/lib/osh-program"

function GuestProgramForm() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("schedule_id") || searchParams.get("scheduleId")

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState<string | null>(null)
  const [courseName, setCourseName] = React.useState("")
  const [program, setProgram] = React.useState<OshProgram>(emptyOshProgram())

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!scheduleId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setUnavailable(null)
      try {
        const res = await fetch(`/api/osh-program?schedule_id=${encodeURIComponent(scheduleId)}`)
        const payload = (await res.json().catch(() => ({}))) as {
          program?: unknown
          courseName?: string
          error?: string
          message?: string
        }
        if (cancelled) return
        if (res.status === 503) {
          setUnavailable(payload.message || "This form is not set up yet.")
          setLoading(false)
          return
        }
        if (res.status === 403) {
          setUnavailable("This OSH program has not been published yet. Ask the training coordinator to publish it from the schedule.")
          setLoading(false)
          return
        }
        if (!res.ok) {
          setUnavailable(payload.message || "Training not found.")
          setLoading(false)
          return
        }
        const parsed = parseOshProgram(payload.program)
        if (!parsed) {
          setUnavailable("Program data is incomplete.")
          setLoading(false)
          return
        }
        setCourseName(payload.courseName || "Training")
        setProgram(parsed)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setUnavailable("Could not load the program.")
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scheduleId])

  const save = async () => {
    if (!scheduleId) return
    setSaving(true)
    try {
      const res = await fetch("/api/osh-program", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: scheduleId, program }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        program?: unknown
        error?: string
        message?: string
      }
      if (!res.ok) {
        toast.error(payload.message || payload.error || "Could not save")
        return
      }
      const parsed = parseOshProgram(payload.program)
      if (parsed) setProgram(parsed)
      toast.success("Program saved")
    } catch {
      toast.error("Could not save program")
    } finally {
      setSaving(false)
    }
  }

  if (!scheduleId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] p-6 dark:bg-background">
        <p className="text-muted-foreground">Missing program link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f5fb] text-[#1A1D66] dark:bg-background dark:text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        Loading program…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff7cc_0%,_#f4f5fb_45%,_#e8eaf6_100%)] dark:bg-[radial-gradient(ellipse_at_top,_#2a2610_0%,_#161824_45%,_#12141c_100%)]">
      <header className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] text-white shadow-md print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFCC00]">Petrosphere TMS</p>
          <h1 className="text-2xl font-bold tracking-tight">Mandatory OSH Training Program</h1>
          <p className="text-sm text-white/80">{courseName || "Training program"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        {unavailable ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-md dark:bg-card">
            <p className="text-muted-foreground">{unavailable}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button
                type="button"
                className="bg-[#1A1D66] hover:bg-[#141654]"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save program
              </Button>
            </div>
            <OshProgramForm value={program} onChange={setProgram} />
            <OshProgramPreview
              program={program}
              filename={`${(courseName || "osh-program").replace(/[^\w]+/g, "-").toLowerCase()}-program.pdf`}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default function GuestProgramPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-base">Loading…</span>
        </div>
      }
    >
      <GuestProgramForm />
    </React.Suspense>
  )
}
