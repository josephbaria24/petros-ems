"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GripVertical,
  Link2,
  Loader2,
  Plus,
  QrCode,
  Save,
  Trash2,
  Upload,
  ChevronDown,
} from "lucide-react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  answersToCell,
  buildGuestExamUrl,
  createBlankQuestion,
  downloadExamExcelTemplate,
  EXAM_TYPE_LABELS,
  exportQuestionsToExcel,
  parseExamExcelFile,
  type ExamKind,
  type ExamMode,
  type ExamQuestionDraft,
  type ExamQuestionType,
  type ExamRecord,
} from "@/lib/exam"

type ExamPanelProps = {
  kind: ExamKind
  title: string
  description: string
  courseName: string
  scheduleId: string
  exam: ExamRecord | null
  questions: ExamQuestionDraft[]
  saving: boolean
  onChangeMode: (mode: ExamMode) => void
  onChangeExternalUrl: (url: string) => void
  onChangeQuestions: (questions: ExamQuestionDraft[]) => void
  onSave: () => Promise<void>
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function ExamPanel({
  kind,
  title,
  description,
  courseName,
  scheduleId,
  exam,
  questions,
  saving,
  onChangeMode,
  onChangeExternalUrl,
  onChangeQuestions,
  onSave,
}: ExamPanelProps) {
  const mode: ExamMode = exam?.mode || "external"
  const externalUrl = exam?.external_url || ""
  const [copied, setCopied] = React.useState(false)
  const [qrBusy, setQrBusy] = React.useState(false)
  const [importPreview, setImportPreview] = React.useState<{
    fileName: string
    questions: ExamQuestionDraft[]
    errors: string[]
  } | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [expandedQuestionId, setExpandedQuestionId] = React.useState<string | null>(null)
  const [questionsOpen, setQuestionsOpen] = React.useState(false)

  const takeUrl =
    exam?.id && typeof window !== "undefined"
      ? buildGuestExamUrl(window.location.origin, exam.id, scheduleId)
      : ""

  const shareUrl = mode === "internal" ? takeUrl : externalUrl.trim()

  const copyShare = async () => {
    if (!shareUrl) {
      toast.error(mode === "internal" ? "Save the exam first to get a share link" : "Enter an exam link first")
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied")
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const downloadQr = async () => {
    if (!shareUrl) {
      toast.error(mode === "internal" ? "Save the exam first to get a share link" : "Enter an exam link first")
      return
    }
    setQrBusy(true)
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        width: 512,
        margin: 2,
        color: { dark: "#1A1D66", light: "#ffffff" },
      })
      const safe = courseName.replace(/[^\w\-]+/g, "-").slice(0, 40)
      downloadDataUrl(dataUrl, `${safe}-${kind}-qr.png`)
      toast.success("QR downloaded")
    } catch {
      toast.error("Could not generate QR")
    } finally {
      setQrBusy(false)
    }
  }

  const updateQuestion = (clientId: string, patch: Partial<ExamQuestionDraft>) => {
    onChangeQuestions(
      questions.map((q) => {
        if (q.clientId !== clientId) return q
        const next = { ...q, ...patch }
        if (patch.question_type && patch.question_type !== q.question_type) {
          if (patch.question_type === "multiple_choice") {
            next.options = createBlankQuestion("multiple_choice").options
            next.answers = ["A"]
          } else {
            next.options = []
            next.answers = q.answers.filter((a) => !/^[A-D]$/i.test(a))
          }
        }
        return next
      })
    )
  }

  const removeQuestion = (clientId: string) => {
    onChangeQuestions(questions.filter((q) => q.clientId !== clientId))
  }

  const moveQuestion = (clientId: string, dir: -1 | 1) => {
    const idx = questions.findIndex((q) => q.clientId === clientId)
    if (idx < 0) return
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= questions.length) return
    const next = [...questions]
    const [item] = next.splice(idx, 1)
    next.splice(nextIdx, 0, item)
    onChangeQuestions(next)
  }

  const onImportExcel = async (file: File | null) => {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const { questions: imported, errors } = parseExamExcelFile(buf)
      if (!imported.length) {
        toast.error("No valid questions found in the file", {
          description: errors.slice(0, 3).join(" · ") || undefined,
        })
        return
      }
      setImportPreview({ fileName: file.name, questions: imported, errors })
    } catch (e) {
      console.error(e)
      toast.error("Failed to read Excel file")
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const confirmImport = () => {
    if (!importPreview?.questions.length) return
    onChangeQuestions([...questions, ...importPreview.questions])
    onChangeMode("internal")
    setQuestionsOpen(true)
    toast.success(
      `Imported ${importPreview.questions.length} question${importPreview.questions.length === 1 ? "" : "s"}`
    )
    setImportPreview(null)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#1A1D66]/15 bg-white shadow-md dark:border-white/10 dark:bg-card">
      <div className="border-b border-[#FFCC00]/50 bg-gradient-to-r from-[#1A1D66] to-[#2a2f7a] px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              <Badge className="border-0 bg-[#FFCC00] text-[#1A1D66] hover:bg-[#FFCC00]">
                {questions.length} Q
              </Badge>
            </div>
            <p className="mt-1 text-sm text-white/75">{description}</p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-[#FFCC00] text-[#1A1D66] hover:bg-[#e6b800]"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-[#1A1D66] dark:text-[#FFCC00]">
            How will trainees take this exam?
          </Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChangeMode("internal")}
              className={cn(
                "rounded-xl border-2 px-4 py-3 text-left transition-colors",
                mode === "internal"
                  ? "border-[#FFCC00] bg-[#FFCC00]/15 shadow-sm"
                  : "border-border hover:border-[#1A1D66]/30 hover:bg-muted/40"
              )}
            >
              <div className="text-sm font-bold text-[#1A1D66] dark:text-foreground">Create in TMS</div>
              <p className="mt-1 text-xs text-muted-foreground">
                One {title.toLowerCase()} for every {courseName || "this training"} schedule. Trainees enter email, last name, and first name on the exam link.
              </p>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("external")}
              className={cn(
                "rounded-xl border-2 px-4 py-3 text-left transition-colors",
                mode === "external"
                  ? "border-[#FFCC00] bg-[#FFCC00]/15 shadow-sm"
                  : "border-border hover:border-[#1A1D66]/30 hover:bg-muted/40"
              )}
            >
              <div className="text-sm font-bold text-[#1A1D66] dark:text-foreground">External link</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Paste a Google Form, Microsoft Form, or any other exam URL.
              </p>
            </button>
          </div>
          {courseName ? (
            <p className="mt-2 rounded-lg border border-[#1A1D66]/10 bg-[#1A1D66]/5 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/5">
              Saving this exam updates <span className="font-semibold text-foreground">{courseName}</span> for every
              schedule of this training — not only this batch.
            </p>
          ) : null}
        </div>

        {mode === "external" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`exam-url-${kind}`}>Exam URL</Label>
              <Input
                id={`exam-url-${kind}`}
                value={externalUrl}
                placeholder="https://forms.office.com/... or https://docs.google.com/forms/..."
                onChange={(e) => onChangeExternalUrl(e.target.value)}
              />
            </div>
            {externalUrl.trim() ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#1A1D66]/15 bg-[#1A1D66]/5 p-3 dark:border-white/10 dark:bg-white/5">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1A1D66] dark:text-[#FFCC00]" />
                <a
                  href={externalUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 break-all text-sm underline-offset-2 hover:underline"
                >
                  {externalUrl.trim()}
                </a>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-[#1A1D66] text-white hover:bg-[#141654]"
                disabled={!externalUrl.trim()}
                asChild={Boolean(externalUrl.trim())}
              >
                {externalUrl.trim() ? (
                  <a href={externalUrl.trim()} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                ) : (
                  <span>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </span>
                )}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void copyShare()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={qrBusy}
                onClick={() => void downloadQr()}
              >
                {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                QR
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#1A1D66]/25 dark:border-white/20"
                onClick={() => {
                  const next = createBlankQuestion("multiple_choice")
                  onChangeQuestions([...questions, next])
                  setQuestionsOpen(true)
                  setExpandedQuestionId(next.clientId)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add question
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => downloadExamExcelTemplate()}
              >
                <Download className="h-3.5 w-3.5" />
                Download template
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void onImportExcel(e.target.files?.[0] || null)}
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Import Excel
              </Button>
              {questions.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    exportQuestionsToExcel(
                      questions,
                      `${courseName.replace(/[^\w\-]+/g, "-").slice(0, 40)}-${kind}-questions.xlsx`
                    )
                  }
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Export
                </Button>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#1A1D66]/15 bg-[#f8f8fc] p-4 dark:border-white/10 dark:bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1D66] dark:text-[#FFCC00]">
                Trainee details on the exam form
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trainees must fill these in before answering. Middle initial is optional.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Email *</Label>
                  <Input disabled placeholder="trainee@email.com" className="bg-white dark:bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last name *</Label>
                  <Input disabled placeholder="Last name" className="bg-white dark:bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">First name *</Label>
                  <Input disabled placeholder="First name" className="bg-white dark:bg-background" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Middle initial (optional)</Label>
                  <Input disabled placeholder="M" className="max-w-[5rem] bg-white dark:bg-background" />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Excel columns: <span className="font-medium text-foreground">Type, Question, A, B, C, D, Answer</span>
              . Use <code className="rounded bg-muted px-1">multiple_choice</code>,{" "}
              <code className="rounded bg-muted px-1">identification</code>, or{" "}
              <code className="rounded bg-muted px-1">solving</code>. Separate alternate answers with{" "}
              <code className="rounded bg-muted px-1">|</code>.
            </p>

            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#1A1D66]/25 bg-[#1A1D66]/[0.03] px-4 py-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
                <FileSpreadsheet className="mx-auto h-8 w-8 text-[#1A1D66]/50 dark:text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-[#1A1D66] dark:text-foreground">No questions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add questions manually or import the Excel template.
                </p>
              </div>
            ) : (
              <Collapsible open={questionsOpen} onOpenChange={setQuestionsOpen}>
                <div className="overflow-hidden rounded-xl border border-[#1A1D66]/15 dark:border-white/10">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 bg-[#f8f8fc] px-3 py-2.5 text-left hover:bg-[#1A1D66]/5 dark:bg-muted/20 dark:hover:bg-white/5"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          questionsOpen ? "rotate-0" : "-rotate-90"
                        )}
                      />
                      <span className="text-sm font-semibold text-[#1A1D66] dark:text-foreground">
                        Questions ({questions.length})
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {questionsOpen
                          ? "Click to hide"
                          : questions[0]?.question_text?.trim() || "Click to expand the list"}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-3 border-t border-[#1A1D66]/10 p-3 dark:border-white/10">
                      {questions.map((q, index) => (
                        <QuestionEditor
                          key={q.clientId}
                          index={index}
                          question={q}
                          open={expandedQuestionId === q.clientId}
                          onOpenChange={(next) => setExpandedQuestionId(next ? q.clientId : null)}
                          onChange={(patch) => updateQuestion(q.clientId, patch)}
                          onRemove={() => removeQuestion(q.clientId)}
                          onMoveUp={() => moveQuestion(q.clientId, -1)}
                          onMoveDown={() => moveQuestion(q.clientId, 1)}
                          canMoveUp={index > 0}
                          canMoveDown={index < questions.length - 1}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            <div className="rounded-xl border border-[#FFCC00]/40 bg-[#FFCC00]/10 p-3 dark:border-[#FFCC00]/30 dark:bg-[#FFCC00]/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1A1D66] dark:text-[#FFCC00]">Trainee exam link</p>
              <p className="mt-1 break-all text-sm text-[#1A1D66]/90 dark:text-foreground">
                {takeUrl || "Save this exam to generate a shareable /guest-exam link."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-[#1A1D66] text-white hover:bg-[#141654]"
                  disabled={!takeUrl}
                  asChild={Boolean(takeUrl)}
                >
                  {takeUrl ? (
                    <a href={takeUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Preview
                    </a>
                  ) : (
                    <span>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Preview
                    </span>
                  )}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void copyShare()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={qrBusy}
                  onClick={() => void downloadQr()}
                >
                  {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                  QR
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Schedule: {scheduleId.slice(0, 8)}…</p>
          </div>
        )}
      </div>

      <Dialog open={Boolean(importPreview)} onOpenChange={(open) => !open && setImportPreview(null)}>
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-[#FFCC00]/40 bg-gradient-to-r from-[#1A1D66] to-[#24286f] px-5 py-4 text-white">
            <DialogTitle className="text-white">Preview imported questions</DialogTitle>
            <DialogDescription className="text-white/75">
              {importPreview?.fileName || "Excel file"} — review these questions, then confirm to add them
              {questions.length > 0 ? ` after the ${questions.length} already in this exam` : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background px-5 py-4">
            {importPreview?.errors.length ? (
              <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {importPreview.errors.length} row{importPreview.errors.length === 1 ? "" : "s"} skipped
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {importPreview.errors.slice(0, 8).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                  {importPreview.errors.length > 8 ? (
                    <li>+{importPreview.errors.length - 8} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {importPreview?.questions.length || 0} question
              {(importPreview?.questions.length || 0) === 1 ? "" : "s"} ready to import
            </p>

            <div className="space-y-2">
              {(importPreview?.questions || []).map((q, index) => (
                <ImportQuestionPreview key={q.clientId} index={index} question={q} />
              ))}
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setImportPreview(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#1A1D66] text-white hover:bg-[#141654] dark:bg-[#FFCC00] dark:text-[#1A1D66] dark:hover:bg-[#e6b800]"
              onClick={confirmImport}
            >
              Confirm import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function ImportQuestionPreview({
  index,
  question,
}: {
  index: number
  question: ExamQuestionDraft
}) {
  const correct = question.answers[0]?.toUpperCase()
  return (
    <div className="rounded-xl border border-[#1A1D66]/15 bg-[#f8f8fc] p-3 dark:border-white/10 dark:bg-muted/20">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#1A1D66] px-2 py-0.5 text-xs font-bold text-white">Q{index + 1}</span>
        <Badge variant="outline" className="text-[10px]">
          {EXAM_TYPE_LABELS[question.question_type]}
        </Badge>
      </div>
      <p className="text-sm font-medium text-[#1A1D66] dark:text-foreground">{question.question_text}</p>
      {question.question_type === "multiple_choice" ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {question.options.map((opt) => {
            const isCorrect = opt.key === correct
            return (
              <div
                key={opt.key}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2 py-1.5 text-xs",
                  isCorrect
                    ? "border-[#FFCC00] bg-[#FFCC00]/15 font-semibold"
                    : "border-border bg-white dark:bg-background"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isCorrect
                      ? "bg-[#FFCC00] text-[#1A1D66]"
                      : "bg-[#1A1D66]/10 text-[#1A1D66] dark:bg-white/10 dark:text-foreground"
                  )}
                >
                  {opt.key}
                </span>
                <span className="min-w-0 pt-0.5">{opt.text || "—"}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Accepted: <span className="font-medium text-foreground">{answersToCell(question.answers) || "—"}</span>
        </p>
      )}
    </div>
  )
}

function QuestionEditor({
  index,
  question,
  open,
  onOpenChange,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  index: number
  question: ExamQuestionDraft
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<ExamQuestionDraft>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const preview =
    question.question_text.trim() ||
    (question.question_type === "multiple_choice"
      ? question.options.find((o) => o.text.trim())?.text || "Untitled question"
      : "Untitled question")
  const correctKey =
    question.question_type === "multiple_choice" ? question.answers[0]?.toUpperCase() : null

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="rounded-xl border border-[#1A1D66]/15 bg-[#f8f8fc] dark:border-white/10 dark:bg-muted/20">
        <div className="flex items-start gap-1 p-2 sm:items-center sm:p-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open ? "rotate-0" : "-rotate-90"
                )}
              />
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1A1D66] px-2 py-1 text-xs font-bold text-white">
                <GripVertical className="h-3 w-3 opacity-70" />
                Q{index + 1}
              </span>
              <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
                {EXAM_TYPE_LABELS[question.question_type]}
              </Badge>
              {correctKey ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFCC00] text-[10px] font-bold text-[#1A1D66]">
                  {correctKey}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm text-[#1A1D66] dark:text-foreground">
                {preview}
              </span>
            </button>
          </CollapsibleTrigger>
          <div className="flex shrink-0 gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canMoveUp} onClick={onMoveUp}>
              ↑
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              ↓
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="space-y-3 border-t border-[#1A1D66]/10 px-4 pb-4 pt-3 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={question.question_type}
                onValueChange={(v) => onChange({ question_type: v as ExamQuestionType })}
              >
                <SelectTrigger className="h-8 w-[180px] bg-white dark:bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXAM_TYPE_LABELS) as ExamQuestionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {EXAM_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Question</Label>
              <Textarea
                value={question.question_text}
                placeholder="Enter the question…"
                className="min-h-[72px] bg-white dark:bg-background"
                onChange={(e) => onChange({ question_text: e.target.value })}
              />
            </div>

            {question.question_type === "multiple_choice" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((opt) => (
                  <div key={opt.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      title={`Mark ${opt.key} as correct`}
                      onClick={() => onChange({ answers: [opt.key] })}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        question.answers[0] === opt.key
                          ? "bg-[#FFCC00] text-[#1A1D66] ring-2 ring-[#1A1D66] dark:ring-[#FFCC00]"
                          : "bg-[#1A1D66]/10 text-[#1A1D66] dark:bg-white/10 dark:text-foreground"
                      )}
                    >
                      {opt.key}
                    </button>
                    <Input
                      value={opt.text}
                      placeholder={`Choice ${opt.key}`}
                      className="bg-white dark:bg-background"
                      onChange={(e) =>
                        onChange({
                          options: question.options.map((o) =>
                            o.key === opt.key ? { ...o, text: e.target.value } : o
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Click A–D to set the correct answer (highlighted in gold).
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Accepted answers (separate with | )</Label>
                <Input
                  value={answersToCell(question.answers)}
                  placeholder={
                    question.question_type === "identification"
                      ? "Jose Rizal | Dr. Jose Rizal"
                      : "3 | three | Three"
                  }
                  className="bg-white dark:bg-background"
                  onChange={(e) =>
                    onChange({
                      answers: e.target.value
                        .split("|")
                        .map((p) => p.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
