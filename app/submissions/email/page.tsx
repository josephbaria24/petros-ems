"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  ImageIcon,
  Minus,
  Upload,
  Send,
  Loader2,
  Type,
  Users,
  PenSquare,
  Monitor,
  Search,
  Palette,
  MousePointer,
} from "lucide-react"

type Trainee = {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

type LocalAttachment = {
  filename: string
  content: string
}

type CourseMaterial = {
  id: string
  title: string
  file_type: string
  file_url: string
  is_active: boolean
}

type EmailComposerTemplate = {
  id: string
  name: string
  config: {
    subject: string
    roomLink: string
    headerHtml: string
    editorHtml: string
    footerHtml: string
    attachments?: LocalAttachment[]
  }
}

const DEFAULT_EDITOR_HTML = `
<h2 style="margin:0 0 12px 0;color:#141454;">Training Update</h2>
<p>Hello <strong>{{trainee_name}}</strong>,</p>
<p>This is an update for your <strong>{{course_name}}</strong> training schedule.</p>
<p><strong>Online Room Link:</strong> <a href="{{room_link}}" target="_blank" rel="noopener noreferrer">{{room_link}}</a></p>
<p>Thank you,<br/>Petrosphere Training Team</p>
`.trim()

function buildDefaultHeaderHtml(origin: string) {
  const headerFile = "Signage (1).png"
  const encodedHeaderFile = encodeURIComponent(headerFile)
  return `
<div style="margin:0 0 16px 0;">
  <img
    src="${origin}/${encodedHeaderFile}"
    alt="Petrosphere Header"
    style="display:block;width:100%;max-width:100%;height:auto;border:0;"
  />
</div>
  `.trim()
}

function applyTemplateVariables(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{{${key}}}`, value)
  }, template)
}

export default function SubmissionsEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("scheduleId")
  const fromTab = searchParams.get("from") || "all"

  const editorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const defaultHeaderInitializedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [courseName, setCourseName] = useState("")
  const [courseId, setCourseId] = useState("")
  const [scheduleDateText, setScheduleDateText] = useState("")
  const [trainees, setTrainees] = useState<Trainee[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [subject, setSubject] = useState("Training Update")
  const [roomLink, setRoomLink] = useState("")
  const [editorHtml, setEditorHtml] = useState(DEFAULT_EDITOR_HTML)
  const [headerHtml, setHeaderHtml] = useState("")
  const [footerHtml, setFooterHtml] = useState("")
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [templates, setTemplates] = useState<EmailComposerTemplate[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [updatingTemplate, setUpdatingTemplate] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateName, setEditingTemplateName] = useState("")
  const [participantSearch, setParticipantSearch] = useState("")
  const [courseMaterials, setCourseMaterials] = useState<CourseMaterial[]>([])
  const [materialSearch, setMaterialSearch] = useState("")
  const [materialAttachingId, setMaterialAttachingId] = useState<string | null>(null)
  const [selectedTextColor, setSelectedTextColor] = useState("#000000")
  const [selectedTextSize, setSelectedTextSize] = useState("16")

  const selectedParticipants = useMemo(
    () => trainees.filter((t) => selectedIds.includes(t.id) && t.email),
    [trainees, selectedIds]
  )

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase()
    if (!q) return trainees
    return trainees.filter((t) => {
      const fullName = `${t.first_name} ${t.last_name}`.toLowerCase()
      const email = (t.email || "").toLowerCase()
      return fullName.includes(q) || email.includes(q)
    })
  }, [trainees, participantSearch])

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== editorHtml) {
      editorRef.current.innerHTML = editorHtml
    }
  }, [editorHtml])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (defaultHeaderInitializedRef.current) return
    defaultHeaderInitializedRef.current = true
    if (!headerHtml.trim()) {
      setHeaderHtml(buildDefaultHeaderHtml(window.location.origin))
    }
  }, [headerHtml])

  useEffect(() => {
    const loadData = async () => {
      if (!scheduleId) {
        toast.error("Missing scheduleId")
        setLoading(false)
        return
      }

      try {
        const { data: scheduleData, error: scheduleError } = await tmsDb
          .from("schedules")
          .select(`
            id,
            course_id,
            schedule_type,
            schedule_dates(date),
            schedule_ranges(start_date, end_date),
            courses(name)
          `)
          .eq("id", scheduleId)
          .single()

        if (scheduleError) throw scheduleError

        const scheduleName = (scheduleData as any)?.courses?.name || "Training"
        setCourseId(scheduleData?.course_id || "")
        setCourseName(scheduleName)
        setSubject(`${scheduleName} - Important Update`)

        if (scheduleData?.schedule_type === "regular" && (scheduleData as any)?.schedule_ranges?.length > 0) {
          const range = (scheduleData as any).schedule_ranges[0]
          setScheduleDateText(
            `${new Date(range.start_date).toLocaleDateString()} - ${new Date(range.end_date).toLocaleDateString()}`
          )
        } else if (scheduleData?.schedule_type === "staggered" && (scheduleData as any)?.schedule_dates?.length > 0) {
          setScheduleDateText(
            (scheduleData as any).schedule_dates
              .map((d: any) => new Date(d.date).toLocaleDateString())
              .join(", ")
          )
        }

        const { data: traineeData, error: traineeError } = await tmsDb
          .from("trainings")
          .select("id, first_name, last_name, email")
          .eq("schedule_id", scheduleId)
          .order("first_name", { ascending: true })

        if (traineeError) throw traineeError

        const mapped = (traineeData || []) as Trainee[]
        setTrainees(mapped)
        setSelectedIds(mapped.filter((t) => !!t.email).map((t) => t.id))
      } catch (error) {
        console.error(error)
        toast.error("Failed to load schedule participants")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [scheduleId])

  useEffect(() => {
    const loadCourseMaterials = async () => {
      if (!courseId) return
      try {
        const response = await fetch(`/api/course-materials?courseId=${courseId}`)
        const json = await response.json()
        if (response.ok && Array.isArray(json.data)) {
          setCourseMaterials(json.data.filter((m: CourseMaterial) => m.is_active))
        }
      } catch (error) {
        console.error(error)
      }
    }
    loadCourseMaterials()
  }, [courseId])

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch("/api/email-builder-templates")
        const data = await response.json()
        if (!Array.isArray(data)) return
        const parsed = data.filter((t: any) => t?.config?.editorHtml).map((t: any) => ({
          id: t.id,
          name: t.name,
          config: t.config,
        }))
        setTemplates(parsed)
      } catch (error) {
        console.error(error)
      }
    }
    loadTemplates()
  }, [])

  const formatCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (editorRef.current) setEditorHtml(editorRef.current.innerHTML)
  }

  const insertImage = () => {
    const url = window.prompt("Enter image URL")
    if (!url) return
    formatCommand("insertImage", url)
  }

  const insertLink = () => {
    const url = window.prompt("Enter link URL")
    if (!url) return
    formatCommand("createLink", url)
  }

  const insertDivider = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand("insertHTML", false, "<hr style='margin:16px 0;border:none;border-top:1px solid #d1d5db;'/>")
    setEditorHtml(editorRef.current.innerHTML)
  }

  const insertButtonLink = () => {
    if (!editorRef.current) return
    const buttonText = window.prompt("Button text", "Click Here")
    if (!buttonText?.trim()) return
    const buttonUrl = window.prompt("Button link URL", "https://")
    if (!buttonUrl?.trim()) return

    editorRef.current.focus()
    document.execCommand(
      "insertHTML",
      false,
      `
      <div style="margin:16px 0;">
        <a
          href="${buttonUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display:inline-block;
            background:#1d4ed8;
            color:#ffffff;
            text-decoration:none;
            padding:10px 18px;
            border-radius:8px;
            font-weight:600;
            font-size:14px;
            line-height:1.2;
          "
        >
          ${buttonText}
        </a>
      </div>
      `
    )
    setEditorHtml(editorRef.current.innerHTML)
  }

  const insertToken = (token: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand("insertText", false, token)
    setEditorHtml(editorRef.current.innerHTML)
  }

  const applyTextColor = (color: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand("styleWithCSS", false, "true")
    document.execCommand("foreColor", false, color)
    setSelectedTextColor(color)
    setEditorHtml(editorRef.current.innerHTML)
  }

  const applyTextSize = (sizePx: string) => {
    if (!editorRef.current) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    const span = document.createElement("span")
    span.style.fontSize = `${sizePx}px`
    span.appendChild(range.extractContents())
    range.insertNode(span)

    setSelectedTextSize(sizePx)
    setEditorHtml(editorRef.current.innerHTML)
  }

  const onSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(trainees.filter((t) => !!t.email).map((t) => t.id))
      return
    }
    setSelectedIds([])
  }

  const onToggleParticipant = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onPickAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const next: LocalAttachment[] = []
    for (const file of Array.from(files)) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || "")
          const encoded = result.includes(",") ? result.split(",")[1] : result
          resolve(encoded)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      next.push({ filename: file.name, content: base64 })
    }
    setAttachments((prev) => [...prev, ...next])
  }

  const removeAttachment = (filename: string) => {
    setAttachments((prev) => prev.filter((a) => a.filename !== filename))
  }

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    if (!q) return courseMaterials
    return courseMaterials.filter((m) => {
      return m.title.toLowerCase().includes(q) || m.file_type.toLowerCase().includes(q)
    })
  }, [courseMaterials, materialSearch])

  const attachCourseMaterial = async (material: CourseMaterial) => {
    setMaterialAttachingId(material.id)
    try {
      const response = await fetch("/api/material-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: material.id }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to attach material")

      setAttachments((prev) => {
        const exists = prev.some((a) => a.filename === json.filename)
        if (exists) return prev
        return [...prev, { filename: json.filename, content: json.content }]
      })
      toast.success(`Attached: ${json.filename}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to attach course material")
    } finally {
      setMaterialAttachingId(null)
    }
  }

  const previewHtml = useMemo(() => {
    const base = `${headerHtml || ""}${editorHtml}${footerHtml || ""}`
    return applyTemplateVariables(base, {
      trainee_name: "Juan Dela Cruz",
      first_name: "Juan",
      last_name: "Dela Cruz",
      email: "juan@example.com",
      course_name: courseName || "Course",
      schedule: scheduleDateText || "Schedule TBD",
      room_link: roomLink || "#",
    })
  }, [headerHtml, editorHtml, footerHtml, courseName, scheduleDateText, roomLink])

  const handleSendEmails = async () => {
    if (!subject.trim()) {
      toast.error("Please enter an email subject")
      return
    }
    if (!editorHtml.trim()) {
      toast.error("Email body is required")
      return
    }
    if (selectedParticipants.length === 0) {
      toast.error("Select at least one participant with an email address")
      return
    }

    setSending(true)
    try {
      const baseHtml = `${headerHtml || ""}${editorHtml}${footerHtml || ""}`
      let success = 0
      let failed = 0

      for (const participant of selectedParticipants) {
        const personalizedHtml = applyTemplateVariables(baseHtml, {
          trainee_name: `${participant.first_name} ${participant.last_name}`,
          first_name: participant.first_name || "",
          last_name: participant.last_name || "",
          email: participant.email || "",
          course_name: courseName || "Course",
          schedule: scheduleDateText || "Schedule TBD",
          room_link: roomLink || "",
        })

        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: participant.email,
            subject,
            message: personalizedHtml,
            attachments,
          }),
        })

        if (response.ok) success += 1
        else failed += 1
      }

      if (success > 0) toast.success(`Email sent to ${success} participant(s)`)
      if (failed > 0) toast.error(`${failed} email(s) failed to send`)
    } catch (error) {
      console.error(error)
      toast.error("Failed to send emails")
    } finally {
      setSending(false)
    }
  }

  const buildTemplateConfig = () => ({
    subject,
    roomLink,
    headerHtml,
    editorHtml,
    footerHtml,
    attachments,
  })

  const handleSaveTemplate = async () => {
    const name = window.prompt("Template name")
    if (!name?.trim()) return
    setSavingTemplate(true)
    try {
      const response = await fetch("/api/email-builder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          config: buildTemplateConfig(),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to save template")
      setTemplates((prev) => [{ id: json.id, name: json.name, config: json.config }, ...prev])
      toast.success("Template saved")
    } catch (error: any) {
      toast.error(error.message || "Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleUseTemplate = (template: EmailComposerTemplate) => {
    setSubject(template.config.subject || "")
    setRoomLink(template.config.roomLink || "")
    setHeaderHtml(template.config.headerHtml || "")
    setEditorHtml(template.config.editorHtml || DEFAULT_EDITOR_HTML)
    setFooterHtml(template.config.footerHtml || "")
    setAttachments(template.config.attachments || [])
    setEditingTemplateId(null)
    setEditingTemplateName("")
    toast.success(`Loaded template: ${template.name}`)
  }

  const handleStartEditTemplate = (template: EmailComposerTemplate) => {
    setSubject(template.config.subject || "")
    setRoomLink(template.config.roomLink || "")
    setHeaderHtml(template.config.headerHtml || "")
    setEditorHtml(template.config.editorHtml || DEFAULT_EDITOR_HTML)
    setFooterHtml(template.config.footerHtml || "")
    setAttachments(template.config.attachments || [])
    setEditingTemplateId(template.id)
    setEditingTemplateName(template.name)
    toast.success(`Editing template: ${template.name}`)
  }

  const handleUpdateTemplateFromEditor = async () => {
    if (!editingTemplateId) return
    if (!editingTemplateName.trim()) {
      toast.error("Template name is required")
      return
    }
    setUpdatingTemplate(true)
    try {
      const response = await fetch("/api/email-builder-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplateId,
          name: editingTemplateName.trim(),
          config: buildTemplateConfig(),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Failed to update template")
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplateId ? { id: json.id, name: json.name, config: json.config } : t))
      )
      toast.success("Template content updated")
    } catch (error: any) {
      toast.error(error.message || "Failed to update template")
    } finally {
      setUpdatingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (template: EmailComposerTemplate) => {
    const confirmed = window.confirm(`Delete template "${template.name}"?`)
    if (!confirmed) return
    try {
      const response = await fetch(`/api/email-builder-templates?id=${template.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete template")
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
      toast.success("Template deleted")
    } catch (error: any) {
      toast.error(error.message || "Failed to delete template")
    }
  }

  const tokenButtons = [
    { label: "Name", token: "{{trainee_name}}", tooltip: "Insert trainee name variable" },
    { label: "Course", token: "{{course_name}}", tooltip: "Insert course name variable" },
    { label: "Schedule", token: "{{schedule}}", tooltip: "Insert schedule variable" },
    { label: "Room Link", token: "{{room_link}}", tooltip: "Insert room link variable" },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4 bg-background from-sky-50/60 via-white to-indigo-50/60 dark:bg-none dark:bg-background min-h-screen max-w-[1700px] mx-auto text-slate-900 dark:text-slate-100">
      <style jsx global>{`
        .dark .email-editor [style*="color: #000"],
        .dark .email-editor [style*="color:#000"],
        .dark .email-editor [style*="color: #000000"],
        .dark .email-editor [style*="color:#000000"],
        .dark .email-editor [style*="color: black"],
        .dark .email-editor [style*="color:black"],
        .dark .email-editor [style*="color: rgb(0, 0, 0)"],
        .dark .email-editor [style*="color:rgb(0, 0, 0)"],
        .dark .email-preview-content [style*="color: #000"],
        .dark .email-preview-content [style*="color:#000"],
        .dark .email-preview-content [style*="color: #000000"],
        .dark .email-preview-content [style*="color:#000000"],
        .dark .email-preview-content [style*="color: black"],
        .dark .email-preview-content [style*="color:black"],
        .dark .email-preview-content [style*="color: rgb(0, 0, 0)"],
        .dark .email-preview-content [style*="color:rgb(0, 0, 0)"] {
          color: #f8fafc !important;
        }
      `}</style>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href={`/submissions?scheduleId=${scheduleId}&from=${encodeURIComponent(fromTab)}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Submissions
            </Button>
          </Link>
          <h1 className="text-2xl font-bold mt-2">Send Email to Participants</h1>
          <p className="text-sm text-muted-foreground">
            {courseName} {scheduleDateText ? `• ${scheduleDateText}` : ""}
          </p>
        </div>
        <Button onClick={handleSendEmails} disabled={sending || loading} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Email
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <Card className="xl:col-span-3 py-2 gap-0 rounded-xl border border-border shadow-sm bg-card text-card-foreground xl:h-[calc(100vh-165px)] overflow-hidden">
          <CardHeader className="-m-px bg-card border-b border-border rounded-t-xl text-center py-3">
            <CardTitle className="flex items-center justify-center gap-2 text-foreground">
              <Users className="h-5 w-5" />
              Participants
            </CardTitle>
            <CardDescription className="text-center">Select recipients for this email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto h-full p-5">
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/25 p-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Templates</p>
                <Button size="sm" variant="secondary" onClick={handleSaveTemplate} disabled={savingTemplate || updatingTemplate} className="h-7">
                  {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Current"}
                </Button>
              </div>
              {editingTemplateId && (
                <div className="space-y-2 mb-2">
                  <Input
                    value={editingTemplateName}
                    onChange={(e) => setEditingTemplateName(e.target.value)}
                    placeholder="Template name"
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-[10px]"
                      onClick={handleUpdateTemplateFromEditor}
                      disabled={updatingTemplate}
                    >
                      {updatingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Update Template"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => {
                        setEditingTemplateId(null)
                        setEditingTemplateName("")
                      }}
                    >
                      Cancel Edit
                    </Button>
                  </div>
                </div>
              )}
              <ScrollArea className="h-32 pr-2">
                <div className="space-y-1">
                  {templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No templates yet</p>
                  ) : (
                    templates.map((template) => (
                      <div key={template.id} className="rounded border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 p-1.5">
                        <p className="text-xs font-medium truncate">{template.name}</p>
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleUseTemplate(template)}>Use</Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleStartEditTemplate(template)}>Edit</Button>
                          <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={() => handleDeleteTemplate(template)}>Delete</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.length > 0 && selectedIds.length === trainees.filter((t) => !!t.email).length}
                onCheckedChange={(v) => onSelectAll(Boolean(v))}
              />
              <span className="text-sm">Select all with email</span>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Search participants..."
                className="pl-8"
              />
            </div>
            <Badge variant="outline">{selectedParticipants.length} selected</Badge>
            <ScrollArea className="h-[360px] xl:h-[calc(100vh-430px)] pr-2">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading participants...</p>
                ) : filteredParticipants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participants found</p>
                ) : (
                  filteredParticipants.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedIds.includes(t.id)}
                        disabled={!t.email}
                        onCheckedChange={() => onToggleParticipant(t.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.first_name} {t.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{t.email || "No email address"}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5 py-2 gap-0 rounded-xl border border-border shadow-sm bg-card text-card-foreground xl:h-[calc(100vh-165px)] overflow-hidden">
          <CardHeader className="-m-px bg-card border-b border-border rounded-t-xl text-center py-3">
            <CardTitle className="flex items-center justify-center gap-2 text-foreground">
              <PenSquare className="h-5 w-5" />
              Email Editor
            </CardTitle>
            <CardDescription className="text-center">Build your message, add room link and attachments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto h-full p-5">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Room Link</Label>
              <Input
                placeholder="https://zoom.us/..."
                value={roomLink}
                onChange={(e) => setRoomLink(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Header HTML (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="<div>...</div>"
                value={headerHtml}
                onChange={(e) => setHeaderHtml(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Typography Tools</Label>
              <div className="flex flex-wrap gap-2 p-2 rounded-md border bg-violet-50/60 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/60">
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => formatCommand("bold")}><Bold className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => formatCommand("italic")}><Italic className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => formatCommand("underline")}><Underline className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => formatCommand("insertUnorderedList")}><List className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Bullet List</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => formatCommand("insertOrderedList")}><ListOrdered className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Numbered List</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => formatCommand("formatBlock", "h2")}><Type className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Heading (H2)</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={insertLink}><LinkIcon className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Insert Link</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={insertButtonLink}><MousePointer className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Insert Button with Link</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={insertImage}><ImageIcon className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Insert Image by URL</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={insertDivider}><Minus className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Insert Divider</TooltipContent></Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 rounded border px-2 bg-background">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="color"
                        value={selectedTextColor}
                        onChange={(e) => applyTextColor(e.target.value)}
                        className="h-6 w-8 p-0 border-0 bg-transparent cursor-pointer"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Text Color</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 rounded border px-2 bg-background">
                      <span className="text-[11px] text-muted-foreground">Size</span>
                      <select
                        value={selectedTextSize}
                        onChange={(e) => applyTextSize(e.target.value)}
                        className="h-6 text-xs bg-transparent outline-none"
                      >
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="24">24</option>
                        <option value="28">28</option>
                        <option value="32">32</option>
                      </select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Text Size</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {tokenButtons.map((item) => (
                  <Tooltip key={item.token}>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="secondary" onClick={() => insertToken(item.token)}>{item.label}</Button>
                    </TooltipTrigger>
                    <TooltipContent>{item.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Body</Label>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setEditorHtml(editorRef.current?.innerHTML || "")}
                className="email-editor min-h-[260px] rounded-md border p-3 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 border-violet-200 dark:border-violet-900/60"
              />
            </div>

            <div className="space-y-2">
              <Label>Footer HTML (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="<div>...</div>"
                value={footerHtml}
                onChange={(e) => setFooterHtml(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => onPickAttachments(e.target.files)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Add Attachments
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add attachment from your device</TooltipContent>
              </Tooltip>
              <div className="rounded-md border border-border p-2 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Attach from uploaded course materials</p>
                <Input
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  placeholder="Search materials..."
                />
                <ScrollArea className="h-36 pr-2">
                  <div className="space-y-1">
                    {filteredMaterials.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No uploaded materials found for this course.</p>
                    ) : (
                      filteredMaterials.map((material) => (
                        <div key={material.id} className="flex items-center justify-between gap-2 border rounded p-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{material.title}</p>
                            <p className="text-muted-foreground uppercase">{material.file_type}</p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                onClick={() => attachCourseMaterial(material)}
                                disabled={materialAttachingId === material.id}
                              >
                                {materialAttachingId === material.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Attach"
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Attach this material to email</TooltipContent>
                          </Tooltip>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <div key={att.filename} className="flex items-center justify-between text-sm border border-slate-200 dark:border-slate-700 rounded p-2">
                      <span className="truncate">{att.filename}</span>
                      <Button size="sm" variant="ghost" onClick={() => removeAttachment(att.filename)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4 py-2 gap-0 rounded-xl border border-border shadow-sm bg-card text-card-foreground xl:h-[calc(100vh-165px)] overflow-hidden">
          <CardHeader className="-m-px bg-card border-b border-border rounded-t-xl text-center py-3">
            <CardTitle className="flex items-center justify-center gap-2 text-foreground">
              <Monitor className="h-5 w-5" />
              Preview
            </CardTitle>
            <CardDescription className="text-center">Live preview of your email content</CardDescription>
          </CardHeader>
          <CardContent className="overflow-y-auto h-full p-2">
            <div className="rounded-md border border-border bg-background p-4 min-h-[420px] xl:min-h-0 xl:h-full overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-3">Subject: {subject || "(no subject)"}</p>
              <div
                className="email-preview-content prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
