// components/email-compose-dialog.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Loader2,
  Save,
  Send,
  Trash2,
  Plus,
  Eye,
  FileText,
  PenLine,
  Mail,
  Bold,
  Italic,
  List,
  RemoveFormatting,
  Award,
  CalendarCheck,
  IdCard,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  message: string
  is_default: boolean
}

interface EmailComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (subject: string, message: string, attachments: string[]) => void
  defaultSubject?: string
  defaultMessage?: string
  recipientCount: number
  availableTemplates: string[]
  selectedTemplateType: string
}

const PLACEHOLDERS = [
  { label: "First Name", token: "{{first_name}}", sample: "Juan" },
  { label: "Last Name", token: "{{last_name}}", sample: "Dela Cruz" },
  { label: "Full Name", token: "{{full_name}}", sample: "Juan Dela Cruz" },
  { label: "Certificate No.", token: "{{certificate_number}}", sample: "PSI-COSH-000001" },
] as const

const ATTACHMENT_OPTIONS = [
  { id: "completion", label: "Certificate of Completion", icon: Award },
  { id: "participation", label: "Certificate of Participation", icon: CalendarCheck },
  { id: "excellence", label: "ID Card", icon: IdCard },
] as const

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Inline markdown: **bold** then *italic*. */
function formatInlineMarkdown(escapedLine: string): string {
  return escapedLine
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
}

function plainTextToHtml(text: string): string {
  const lines = text.split("\n")
  const blocks: string[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(
      `<ul style="margin:0 0 12px 20px;padding:0;line-height:1.6;color:#1f2937;">${listItems.join("")}</ul>`,
    )
    listItems = []
  }

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (bulletMatch) {
      const content = formatInlineMarkdown(escapeHtml(bulletMatch[1]))
      listItems.push(`<li style="margin:0 0 4px 0;color:#1f2937;">${content || "&nbsp;"}</li>`)
      continue
    }

    flushList()

    if (!line.trim()) {
      blocks.push('<p style="margin:0;padding:0;min-height:1em;color:#1f2937;">&nbsp;</p>')
      continue
    }

    const leadingMatch = line.match(/^(\s+)/)
    let processed = line
    if (leadingMatch) {
      const spaces = leadingMatch[1]
        .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
        .replace(/ /g, "&nbsp;")
      processed = spaces + escapeHtml(line.trimStart())
    } else {
      processed = escapeHtml(line)
    }

    blocks.push(
      `<p style="margin:0;padding:0;line-height:1.6;color:#1f2937;">${formatInlineMarkdown(processed)}</p>`,
    )
  }
  flushList()

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1f2937 !important; margin: 0; padding: 0; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; padding: 16px; }
        .header { background: #00044a; padding: 28px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 18px; color: #ffffff !important; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
        .content { background: #ffffff; padding: 28px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; color: #1f2937 !important; }
        .content p, .content li, .content strong, .content em { color: #1f2937 !important; }
        .content p { margin: 0; padding: 0; line-height: 1.6; }
        .footer { text-align: center; margin-top: 16px; color: #6b7280 !important; font-size: 12px; }
        .footer p { color: #6b7280 !important; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1 style="color:#ffffff;margin:0;font-size:18px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Petrosphere Incorporated</h1></div>
        <div class="content" style="color:#1f2937;background:#ffffff;padding:28px 24px;">
          ${blocks.join("\n")}
        </div>
        <div class="footer">
          <p style="color:#6b7280;">&copy; ${new Date().getFullYear()} Petrosphere Incorporated. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function htmlToPlainText(html: string): string {
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  const contentDiv = tempDiv.querySelector(".content")
  const root = contentDiv || tempDiv

  // Prefer structured extraction so lists survive round-trips reasonably
  const parts: string[] = []
  root.querySelectorAll("p, li").forEach((el) => {
    const tag = el.tagName.toLowerCase()
    let text = el.textContent || ""
    // Reconstruct simple bold/italic from nested tags if present
    if (el.querySelector("strong, b, em, i")) {
      text = ""
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || ""
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const child = node as HTMLElement
          const inner = child.textContent || ""
          const name = child.tagName.toLowerCase()
          if (name === "strong" || name === "b") text += `**${inner}**`
          else if (name === "em" || name === "i") text += `*${inner}*`
          else text += inner
        }
      })
    }
    if (tag === "li") parts.push(`- ${text.trim()}`)
    else parts.push(text)
  })

  if (parts.length > 0) return parts.join("\n").trim()
  return (root.textContent || "").trim()
}

function samplePreviewHtml(message: string): string {
  let personalized = message
  for (const p of PLACEHOLDERS) {
    personalized = personalized.split(p.token).join(p.sample)
  }
  return plainTextToHtml(personalized)
}

export default function EmailComposeDialog({
  open,
  onOpenChange,
  onSend,
  defaultSubject = "",
  defaultMessage = "",
  recipientCount,
  availableTemplates,
  selectedTemplateType,
}: EmailComposeDialogProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("custom")
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([selectedTemplateType])
  const [mobileTab, setMobileTab] = useState<"compose" | "preview">("compose")
  const messageRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setIsLoading(false)
      fetchTemplates()
      setSubject(defaultSubject)
      setMessage(htmlToPlainText(defaultMessage))
      setSelectedAttachments([selectedTemplateType])
      setSelectedTemplateId("custom")
      setShowSaveForm(false)
      setMobileTab("compose")
    }
  }, [open, defaultSubject, defaultMessage, selectedTemplateType])

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/email-templates")
      const result = await response.json()
      if (result.success) {
        setTemplates(result.data || [])
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (templateId === "custom") {
      setSubject(defaultSubject)
      setMessage(htmlToPlainText(defaultMessage))
      return
    }

    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setMessage(htmlToPlainText(template.message))
    }
  }

  const insertAtCursor = useCallback((text: string) => {
    const el = messageRef.current
    if (!el) {
      setMessage((prev) => prev + text)
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + text + el.value.slice(end)
    setMessage(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }, [])

  const wrapSelection = useCallback((before: string, after: string = before) => {
    const el = messageRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const selected = el.value.slice(start, end) || "text"
    const next = el.value.slice(0, start) + before + selected + after + el.value.slice(end)
    setMessage(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }, [])

  const toggleBulletList = useCallback(() => {
    const el = messageRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const value = el.value

    // Expand to full lines
    let lineStart = value.lastIndexOf("\n", start - 1) + 1
    let lineEnd = value.indexOf("\n", end)
    if (lineEnd === -1) lineEnd = value.length

    const block = value.slice(lineStart, lineEnd)
    const lines = block.split("\n")
    const allBulleted = lines.every((l) => !l.trim() || /^\s*[-*]\s+/.test(l))
    const nextLines = lines.map((l) => {
      if (!l.trim()) return l
      if (allBulleted) return l.replace(/^\s*[-*]\s+/, "")
      return `- ${l.replace(/^\s*[-*]\s+/, "")}`
    })
    const replacement = nextLines.join("\n")
    const next = value.slice(0, lineStart) + replacement + value.slice(lineEnd)
    setMessage(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(lineStart, lineStart + replacement.length)
    })
  }, [])

  const clearFormatting = useCallback(() => {
    const el = messageRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    if (start === end) return
    const selected = el.value.slice(start, end)
    const cleaned = selected
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "")
    const next = el.value.slice(0, start) + cleaned + el.value.slice(end)
    setMessage(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, start + cleaned.length)
    })
  }, [])

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name")
      return
    }

    setIsSaving(true)
    try {
      const htmlMessage = plainTextToHtml(message)
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          subject,
          message: htmlMessage,
          is_default: saveAsDefault,
        }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success("Template saved")
        setTemplateName("")
        setSaveAsDefault(false)
        setShowSaveForm(false)
        fetchTemplates()
      } else {
        toast.error(result.error || "Failed to save template")
      }
    } catch (error) {
      console.error("Error saving template:", error)
      toast.error("An error occurred while saving the template")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Delete this email template?")) return

    try {
      const response = await fetch(`/api/email-templates?id=${templateId}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (result.success) {
        toast.success("Template deleted")
        setSelectedTemplateId("custom")
        setSubject(defaultSubject)
        setMessage(htmlToPlainText(defaultMessage))
        fetchTemplates()
      } else {
        toast.error(result.error || "Failed to delete template")
      }
    } catch (error) {
      console.error("Error deleting template:", error)
      toast.error("An error occurred while deleting the template")
    }
  }

  const handleSendNow = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please enter both subject and message")
      return
    }
    if (selectedAttachments.length === 0) {
      toast.error("Please select at least one attachment")
      return
    }
    setIsLoading(true)
    onSend(subject, plainTextToHtml(message), selectedAttachments)
  }

  const previewHtml = samplePreviewHtml(message)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,1100px)] max-w-5xl flex-col gap-0 overflow-hidden p-0 text-zinc-900 dark:text-white [&_[data-slot=dialog-close]]:text-zinc-700 dark:[&_[data-slot=dialog-close]]:text-white">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Compose Certificate Email
            </DialogTitle>
            <Badge variant="secondary" className="gap-1 font-normal text-zinc-800 dark:text-white">
              <Users className="h-3 w-3" />
              {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
            </Badge>
          </div>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Choose a template, edit your message, then send with certificate attachments.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile compose / preview toggle */}
        <div className="flex shrink-0 gap-1 border-b bg-muted/30 p-2 lg:hidden">
          <Button
            type="button"
            size="sm"
            variant={mobileTab === "compose" ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setMobileTab("compose")}
          >
            <PenLine className="mr-1.5 h-3.5 w-3.5" />
            Compose
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mobileTab === "preview" ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setMobileTab("preview")}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Preview
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Compose column */}
          <div
            className={cn(
              "min-h-0 space-y-4 overflow-y-auto px-5 py-4",
              mobileTab !== "compose" && "hidden lg:block",
            )}
          >
            {/* Template cards */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Email template
                </Label>
                {selectedTemplateId !== "custom" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTemplate(selectedTemplateId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  type="button"
                  onClick={() => handleTemplateSelect("custom")}
                  className={cn(
                    "flex min-w-[132px] shrink-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                    selectedTemplateId === "custom"
                      ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <PenLine className="h-4 w-4 text-zinc-900 dark:text-white" />
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">Compose new</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Start from draft</span>
                </button>

                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template.id)}
                    className={cn(
                      "relative flex min-w-[148px] shrink-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                      selectedTemplateId === template.id
                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                        : "border-border bg-card hover:bg-muted/50",
                    )}
                  >
                    {template.is_default && (
                      <Badge className="absolute right-2 top-2 h-5 px-1.5 text-[9px]" variant="secondary">
                        Default
                      </Badge>
                    )}
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      {template.is_default ? (
                        <Mail className="h-4 w-4 text-zinc-900 dark:text-white" />
                      ) : (
                        <FileText className="h-4 w-4 text-zinc-900 dark:text-white" />
                      )}
                    </span>
                    <span className="line-clamp-2 pr-1 text-xs font-semibold text-zinc-900 dark:text-white">
                      {template.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Saved template</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Subject */}
            <section className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Subject
              </Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
                className="h-10 border border-border bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
              />
            </section>

            {/* Message + toolbar */}
            <section className="space-y-1.5">
              <Label htmlFor="email-message" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Message
              </Label>
              <div className="overflow-hidden rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-700 dark:text-white"
                          onClick={() => wrapSelection("**")}
                        >
                          <Bold className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bold</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-700 dark:text-white"
                          onClick={() => wrapSelection("*")}
                        >
                          <Italic className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Italic</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-700 dark:text-white"
                          onClick={toggleBulletList}
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bullet list</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-700 dark:text-white"
                          onClick={clearFormatting}
                        >
                          <RemoveFormatting className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Clear formatting</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  ref={messageRef}
                  id="email-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Dear {{full_name}},\n\nCongratulations on completing your training.\n\nYour certificate is attached.\n\nThank you,\nPetrosphere Incorporated`}
                  rows={11}
                  className="min-h-[220px] resize-y rounded-none border-0 bg-transparent text-sm text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 dark:text-white dark:placeholder:text-zinc-500"
                />
              </div>

              {/* Placeholder chips */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Insert placeholders — replaced automatically per recipient
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <TooltipProvider delayDuration={200}>
                    {PLACEHOLDERS.map((p) => (
                      <Tooltip key={p.token}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => insertAtCursor(p.token)}
                            className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-zinc-800 transition-colors hover:border-blue-500 hover:bg-blue-500/10 dark:text-white"
                          >
                            {p.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="font-mono text-xs">{p.token}</span>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
            </section>

            {/* Attachments */}
            <section className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Attachments
              </Label>
              <div className="grid gap-2 sm:grid-cols-1">
                {ATTACHMENT_OPTIONS.map((tmpl) => {
                  const isAvailable = availableTemplates.includes(tmpl.id)
                  const checked = selectedAttachments.includes(tmpl.id)
                  const Icon = tmpl.icon
                  return (
                    <label
                      key={tmpl.id}
                      htmlFor={`attach-${tmpl.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                        !isAvailable && "cursor-not-allowed opacity-50",
                        isAvailable && "cursor-pointer hover:bg-muted/40",
                        checked && isAvailable && "border-blue-500/40 bg-blue-500/10",
                      )}
                    >
                      <Checkbox
                        id={`attach-${tmpl.id}`}
                        checked={checked}
                        disabled={!isAvailable}
                        onCheckedChange={(value) => {
                          if (value) {
                            setSelectedAttachments((prev) => [...prev, tmpl.id])
                          } else {
                            setSelectedAttachments((prev) => prev.filter((a) => a !== tmpl.id))
                          }
                        }}
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-zinc-900 dark:text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-zinc-900 dark:text-white">{tmpl.label}</span>
                        {!isAvailable && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">No template uploaded</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>

            {/* Save template */}
            {!showSaveForm ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSaveForm(true)}
                className="w-full justify-start gap-2 border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-white dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Save as template
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-zinc-900 dark:text-white">Save as template</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-700 dark:text-white"
                    onClick={() => {
                      setShowSaveForm(false)
                      setTemplateName("")
                      setSaveAsDefault(false)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Standard Certificate Email"
                  className="border border-border bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="save-as-default"
                    checked={saveAsDefault}
                    onCheckedChange={(checked) => setSaveAsDefault(checked as boolean)}
                  />
                  <Label htmlFor="save-as-default" className="cursor-pointer text-sm font-normal text-zinc-800 dark:text-white">
                    Set as default template
                  </Label>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !templateName.trim()}
                  className="w-full"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save template
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Preview column */}
          <div
            className={cn(
              "min-h-0 overflow-y-auto border-t bg-muted/20 px-5 py-4 lg:border-l lg:border-t-0",
              mobileTab !== "preview" && "hidden lg:block",
            )}
          >
            <div className="sticky top-0 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Live preview
                </Label>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-white text-zinc-900 shadow-sm dark:border-zinc-700">
                <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="truncate text-[11px] text-zinc-500">
                    Subject:{" "}
                    <span className="font-medium text-zinc-900">
                      {subject || "(no subject)"}
                    </span>
                  </p>
                </div>
                <div
                  className="email-preview-pane max-h-[min(52vh,480px)] overflow-y-auto bg-[#f3f4f6] p-3"
                  style={{ color: "#1f2937" }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Preview uses sample names. Sent emails will use each recipient’s real details.
                Selected PDFs are attached automatically.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-white dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSendNow}
            disabled={isLoading}
            className="gap-2 bg-blue-600 text-white hover:bg-blue-500 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
