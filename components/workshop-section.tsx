"use client"

import * as React from "react"
import {
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Link2,
  Loader2,
  Plus,
  QrCode,
  Save,
  Trash2,
  Users,
} from "lucide-react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { tmsDb } from "@/lib/supabase-client"
import { cn } from "@/lib/utils"
import {
  buildGuestWorkshopUrl,
  countActivityPrompts,
  createBlankActivity,
  createBlankQuestion,
  missingWorkshopSchema,
  parseWorkshopActivities,
  parseWorkshopAnswers,
  type WorkshopActivity,
  type WorkshopResponse,
} from "@/lib/workshop"

type WorkshopSectionProps = {
  scheduleId: string
  courseName: string
}

export function WorkshopSection({ scheduleId, courseName }: WorkshopSectionProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [schemaMissing, setSchemaMissing] = React.useState(false)
  const [activities, setActivities] = React.useState<WorkshopActivity[]>([])
  const [responses, setResponses] = React.useState<WorkshopResponse[]>([])
  const [openActivityId, setOpenActivityId] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [qrBusy, setQrBusy] = React.useState(false)
  const [responsesOpen, setResponsesOpen] = React.useState(false)
  const [expandedResponseId, setExpandedResponseId] = React.useState<string | null>(null)

  const workshopUrl =
    typeof window !== "undefined" ? buildGuestWorkshopUrl(window.location.origin, scheduleId) : ""

  const load = React.useCallback(async () => {
    if (!scheduleId) return
    setLoading(true)
    const { data: schedule, error: se } = await tmsDb
      .from("schedules")
      .select("workshop_activities")
      .eq("id", scheduleId)
      .single()

    if (se && missingWorkshopSchema(se.message || "")) {
      setSchemaMissing(true)
      setActivities([])
      setResponses([])
      setLoading(false)
      return
    }
    if (se) {
      toast.error("Could not load workshop activities", { description: se.message })
      setLoading(false)
      return
    }

    setSchemaMissing(false)
    setActivities(parseWorkshopActivities(schedule?.workshop_activities))

    const { data: rows, error: re } = await tmsDb
      .from("workshop_responses")
      .select("id, schedule_id, training_id, respondent_name, respondent_email, answers, created_at, updated_at")
      .eq("schedule_id", scheduleId)
      .order("created_at", { ascending: false })

    if (re && missingWorkshopSchema(re.message || "")) {
      setResponses([])
    } else if (re) {
      toast.error("Could not load workshop answers", { description: re.message })
    } else {
      setResponses(
        (rows || []).map((r) => ({
          ...r,
          answers: parseWorkshopAnswers(r.answers),
        })) as WorkshopResponse[]
      )
    }
    setLoading(false)
  }, [scheduleId])

  React.useEffect(() => {
    void load()
  }, [load])

  const persist = async () => {
    setSaving(true)
    const { error } = await tmsDb
      .from("schedules")
      .update({ workshop_activities: activities })
      .eq("id", scheduleId)
    setSaving(false)
    if (error) {
      if (missingWorkshopSchema(error.message || "")) {
        setSchemaMissing(true)
        toast.error("Workshop tables are missing", {
          description: "Run scripts/add-workshop-tables.sql in Supabase, then refresh.",
        })
        return
      }
      toast.error("Could not save workshop", { description: error.message })
      return
    }
    toast.success("Workshop activities saved")
  }

  const addActivity = () => {
    const next = createBlankActivity()
    setActivities((prev) => [...prev, next])
    setOpenActivityId(next.id)
  }

  const copyLink = async () => {
    if (!workshopUrl) return
    try {
      await navigator.clipboard.writeText(workshopUrl)
      setCopied(true)
      toast.success("Workshop link copied")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const downloadQr = async () => {
    if (!workshopUrl) return
    setQrBusy(true)
    try {
      const url = await QRCode.toDataURL(workshopUrl, { width: 640, margin: 1 })
      const a = document.createElement("a")
      a.href = url
      a.download = `workshop-qr-${scheduleId.slice(0, 8)}.png`
      a.click()
      toast.success("Workshop QR downloaded")
    } catch {
      toast.error("Could not generate QR")
    } finally {
      setQrBusy(false)
    }
  }

  const promptCount = countActivityPrompts(activities)

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Workshop
            </CardTitle>
            <CardDescription>
              Add activities for {courseName || "this training"}. Trainees open the workshop link and
              fill in their answers.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{activities.length} activities</Badge>
            <Badge variant="outline">{promptCount} prompts</Badge>
            <Badge variant="secondary">{responses.length} submissions</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {schemaMissing ? (
          <p className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            Run <code className="rounded bg-white/70 px-1 dark:bg-black/30">scripts/add-workshop-tables.sql</code>{" "}
            in the Supabase SQL editor, then refresh this page.
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading workshop…
          </div>
        ) : (
          <>
            <div className="flex max-w-3xl flex-col gap-2 rounded-xl border border-[#1A1D66]/15 bg-[#1A1D66]/5 p-3 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1A1D66] dark:text-[#FFCC00]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1D66] dark:text-[#FFCC00]">
                    Trainee workshop link
                  </p>
                  <a
                    href={workshopUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-foreground underline-offset-2 hover:underline"
                  >
                    {workshopUrl}
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void downloadQr()} disabled={qrBusy}>
                  {qrBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <QrCode className="mr-1.5 h-3.5 w-3.5" />}
                  QR
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setResponsesOpen(true)}>
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  Answers
                </Button>
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#1A1D66]/25 px-4 py-8 text-center dark:border-white/15">
                <ClipboardList className="mx-auto h-8 w-8 text-[#1A1D66]/40 dark:text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No workshop activities yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add an activity, write the prompts trainees should answer, then save.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((activity, index) => (
                  <Collapsible
                    key={activity.id}
                    open={openActivityId === activity.id}
                    onOpenChange={(next) => setOpenActivityId(next ? activity.id : null)}
                  >
                    <div className="overflow-hidden rounded-xl border border-[#1A1D66]/15 dark:border-white/10">
                      <div className="flex items-center gap-1 bg-[#f8f8fc] pr-1 dark:bg-muted/20">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                openActivityId === activity.id ? "rotate-0" : "-rotate-90"
                              )}
                            />
                            <span className="rounded-md bg-[#1A1D66] px-2 py-0.5 text-xs font-bold text-white">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {activity.title.trim() || "Untitled activity"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {activity.questions.filter((q) => q.prompt.trim()).length} prompt
                              {activity.questions.filter((q) => q.prompt.trim()).length === 1 ? "" : "s"}
                            </span>
                          </button>
                        </CollapsibleTrigger>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            setActivities((prev) => prev.filter((a) => a.id !== activity.id))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <CollapsibleContent>
                        <div className="space-y-3 border-t px-3 py-3">
                          <div className="space-y-1.5">
                            <Label>Activity title</Label>
                            <Input
                              value={activity.title}
                              placeholder="e.g. Hazard identification workshop"
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((a) =>
                                    a.id === activity.id ? { ...a, title: e.target.value } : a
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Instructions (optional)</Label>
                            <Textarea
                              value={activity.instructions}
                              placeholder="What trainees should do in this activity…"
                              className="min-h-[72px]"
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((a) =>
                                    a.id === activity.id ? { ...a, instructions: e.target.value } : a
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Prompts / questions</Label>
                            {activity.questions.map((q, qi) => (
                              <div key={q.id} className="flex items-start gap-2">
                                <span className="mt-2 w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                                  {qi + 1}.
                                </span>
                                <Textarea
                                  value={q.prompt}
                                  placeholder="Question or worksheet item for trainees to answer"
                                  className="min-h-[56px]"
                                  onChange={(e) =>
                                    setActivities((prev) =>
                                      prev.map((a) =>
                                        a.id === activity.id
                                          ? {
                                              ...a,
                                              questions: a.questions.map((item) =>
                                                item.id === q.id
                                                  ? { ...item, prompt: e.target.value }
                                                  : item
                                              ),
                                            }
                                          : a
                                      )
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="mt-1 h-8 w-8 shrink-0"
                                  disabled={activity.questions.length <= 1}
                                  onClick={() =>
                                    setActivities((prev) =>
                                      prev.map((a) =>
                                        a.id === activity.id
                                          ? {
                                              ...a,
                                              questions: a.questions.filter((item) => item.id !== q.id),
                                            }
                                          : a
                                      )
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                setActivities((prev) =>
                                  prev.map((a) =>
                                    a.id === activity.id
                                      ? { ...a, questions: [...a.questions, createBlankQuestion()] }
                                      : a
                                  )
                                )
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add prompt
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={addActivity}>
                <Plus className="h-3.5 w-3.5" />
                Add activity
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-[#1A1D66] text-white hover:bg-[#141654]"
                disabled={saving || schemaMissing}
                onClick={() => void persist()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save workshop
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={responsesOpen} onOpenChange={setResponsesOpen}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Workshop answers</DialogTitle>
            <DialogDescription>
              {responses.length} submission{responses.length === 1 ? "" : "s"} for this schedule
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {responses.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No answers yet. Share the workshop link with trainees after you save activities.
              </p>
            ) : (
              <div className="space-y-2">
                {responses.map((r) => (
                  <Collapsible
                    key={r.id}
                    open={expandedResponseId === r.id}
                    onOpenChange={(next) => setExpandedResponseId(next ? r.id : null)}
                  >
                    <div className="rounded-xl border">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              expandedResponseId === r.id ? "rotate-0" : "-rotate-90"
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {r.respondent_name || "Unnamed"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{r.respondent_email || "—"}</span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-3 border-t px-3 py-3">
                          {activities.map((activity) => (
                            <div key={activity.id}>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {activity.title.trim() || "Untitled activity"}
                              </p>
                              <div className="mt-1 space-y-2">
                                {activity.questions.map((q, qi) => (
                                  <div key={q.id} className="rounded-lg bg-muted/40 px-2.5 py-2 text-sm">
                                    <p className="text-xs text-muted-foreground">
                                      {qi + 1}. {q.prompt || "Prompt"}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap">
                                      {r.answers[activity.id]?.[q.id]?.trim() || "—"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
