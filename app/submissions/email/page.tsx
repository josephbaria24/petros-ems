"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { tmsDb } from "@/lib/supabase-client"
import { buildGuestSubmissionBinUrl } from "@/lib/submission-bin"
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
  History,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Download,
  Copy,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ComposerEmailHistoryItem = {
  at: string
  subject: string
  status: "sent" | "failed"
  error?: string | null
}

type Trainee = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  custom_data?: Record<string, any> | null
}

const MAX_COMPOSER_EMAIL_HISTORY = 20

function getComposerHistory(trainee: Trainee): ComposerEmailHistoryItem[] {
  const history = trainee.custom_data?.__composer_email_history
  return Array.isArray(history) ? history : []
}

function getLatestComposerStatus(trainee: Trainee): {
  status?: "sent" | "failed"
  at?: string
  subject?: string
  error?: string | null
} {
  const data = trainee.custom_data || {}
  if (data.__composer_email_status === "sent" || data.__composer_email_status === "failed") {
    return {
      status: data.__composer_email_status,
      at: data.__composer_email_sent_at,
      subject: data.__composer_email_subject,
      error: data.__composer_email_error ?? null,
    }
  }
  const latest = getComposerHistory(trainee)[0]
  if (!latest) return {}
  return {
    status: latest.status,
    at: latest.at,
    subject: latest.subject,
    error: latest.error ?? null,
  }
}

function formatHistoryTime(iso?: string) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
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

function mimeFromFilename(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
  }
  return map[ext] || "application/octet-stream"
}

function isImageFilename(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

function isPdfFilename(name: string) {
  return /\.pdf$/i.test(name)
}

function attachmentDataUrl(att: LocalAttachment) {
  return `data:${mimeFromFilename(att.filename)};base64,${att.content}`
}

function downloadAttachment(att: LocalAttachment) {
  const a = document.createElement("a")
  a.href = attachmentDataUrl(att)
  a.download = att.filename
  a.click()
}

function filenameForMaterial(material: CourseMaterial) {
  const fromUrl = material.file_url.split("?")[0].split("/").pop() || ""
  if (fromUrl.includes(".")) return decodeURIComponent(fromUrl)
  const ext = material.file_type && !["other", "image"].includes(material.file_type) ? `.${material.file_type}` : ""
  return `${material.title || "material"}${ext}`
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
  const materialReplaceInputRef = useRef<HTMLInputElement | null>(null)
  const editingAnchorRef = useRef<HTMLAnchorElement | null>(null)
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
  const [previewAttachment, setPreviewAttachment] = useState<LocalAttachment | null>(null)
  const [linkEditor, setLinkEditor] = useState<{ href: string; text: string } | null>(null)
  const [templates, setTemplates] = useState<EmailComposerTemplate[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [updatingTemplate, setUpdatingTemplate] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateName, setEditingTemplateName] = useState("")
  const [participantSearch, setParticipantSearch] = useState("")
  const [templateSearch, setTemplateSearch] = useState("")
  const [courseMaterials, setCourseMaterials] = useState<CourseMaterial[]>([])
  const [materialSearch, setMaterialSearch] = useState("")
  const [materialAttachingId, setMaterialAttachingId] = useState<string | null>(null)
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [uploadMaterialTitle, setUploadMaterialTitle] = useState("")
  const [pendingMaterialFile, setPendingMaterialFile] = useState<File | null>(null)
  const [uploadingMaterial, setUploadingMaterial] = useState(false)
  const [replacingMaterialId, setReplacingMaterialId] = useState<string | null>(null)
  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null)
  const [renamingMaterialId, setRenamingMaterialId] = useState<string | null>(null)
  const [renamingMaterialTitle, setRenamingMaterialTitle] = useState("")
  const [viewingMaterial, setViewingMaterial] = useState<CourseMaterial | null>(null)
  const [downloadingMaterial, setDownloadingMaterial] = useState(false)
  const [selectedTextColor, setSelectedTextColor] = useState("#000000")
  const [selectedTextSize, setSelectedTextSize] = useState("16")

  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const submissionLink = useMemo(() => {
    if (!scheduleId || !origin) return ""
    return buildGuestSubmissionBinUrl(origin, scheduleId)
  }, [scheduleId, origin])

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

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) => t.name.toLowerCase().includes(q))
  }, [templates, templateSearch])

  const sendHistoryFeed = useMemo(() => {
    const rows: Array<{
      traineeId: string
      name: string
      email: string | null
      at: string
      subject: string
      status: "sent" | "failed"
      error?: string | null
    }> = []

    for (const trainee of trainees) {
      const history = getComposerHistory(trainee)
      for (const item of history) {
        rows.push({
          traineeId: trainee.id,
          name: `${trainee.first_name} ${trainee.last_name}`.trim(),
          email: trainee.email,
          at: item.at,
          subject: item.subject,
          status: item.status,
          error: item.error,
        })
      }
    }

    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50)
  }, [trainees])

  const historySummary = useMemo(() => {
    const latestByTrainee = trainees
      .map((t) => getLatestComposerStatus(t))
      .filter((s) => s.status)
    return {
      sent: latestByTrainee.filter((s) => s.status === "sent").length,
      failed: latestByTrainee.filter((s) => s.status === "failed").length,
    }
  }, [trainees])

  const sendHistoryEntries = useMemo(() => {
    const rows: Array<{
      traineeId: string
      name: string
      email: string | null
      at: string
      subject: string
      status: "sent" | "failed"
      error?: string | null
    }> = []

    for (const trainee of trainees) {
      const history = getComposerHistory(trainee)
      for (const item of history) {
        rows.push({
          traineeId: trainee.id,
          name: `${trainee.first_name} ${trainee.last_name}`.trim(),
          email: trainee.email,
          at: item.at,
          subject: item.subject,
          status: item.status,
          error: item.error,
        })
      }
    }

    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50)
  }, [trainees])

  const historyCounts = useMemo(() => {
    const sent = sendHistoryEntries.filter((e) => e.status === "sent").length
    const failed = sendHistoryEntries.filter((e) => e.status === "failed").length
    return { sent, failed, total: sendHistoryEntries.length }
  }, [sendHistoryEntries])

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
          .select("id, first_name, last_name, email, custom_data")
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

  const loadCourseMaterials = useCallback(async () => {
    try {
      const response = await fetch("/api/course-materials?all=1")
      const json = await response.json()
      if (response.ok && Array.isArray(json.data)) {
        setCourseMaterials(json.data)
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    void loadCourseMaterials()
  }, [loadCourseMaterials])

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

  const onEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement | null)?.closest("a")
    if (!anchor || !editorRef.current?.contains(anchor)) return
    event.preventDefault()
    event.stopPropagation()
    const href = anchor.getAttribute("href") || ""
    if (event.metaKey || event.ctrlKey) {
      if (href) window.open(href, "_blank", "noopener,noreferrer")
      return
    }
    editingAnchorRef.current = anchor
    setLinkEditor({ href, text: (anchor.textContent || "").trim() })
  }

  const saveEditedLink = () => {
    const anchor = editingAnchorRef.current
    if (!anchor || !linkEditor) return
    const href = linkEditor.href.trim()
    const text = linkEditor.text.trim()
    if (href) anchor.setAttribute("href", href)
    if (text) anchor.textContent = text
    if (editorRef.current) setEditorHtml(editorRef.current.innerHTML)
    editingAnchorRef.current = null
    setLinkEditor(null)
    toast.success("Link updated")
  }

  const insertToken = (token: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand("insertText", false, token)
    setEditorHtml(editorRef.current.innerHTML)
  }

  const insertSubmissionLink = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(
      "insertHTML",
      false,
      `
      <p style="margin:16px 0 8px 0;">Please submit your re-entry plan or other files using this schedule's drop box:</p>
      <p style="margin:0 0 16px 0;">
        <a
          href="{{submission_link}}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display:inline-block;
            background:#1A1D66;
            color:#FFCC00;
            text-decoration:none;
            padding:10px 18px;
            border-radius:8px;
            font-weight:600;
            font-size:14px;
            line-height:1.2;
          "
        >
          Open submission link
        </a>
      </p>
      <p style="margin:0 0 16px 0;font-size:13px;">
        Or copy this link: <a href="{{submission_link}}" target="_blank" rel="noopener noreferrer">{{submission_link}}</a>
      </p>
      `
    )
    setEditorHtml(editorRef.current.innerHTML)
    toast.success("Submission link added to the email")
  }

  const copySubmissionLink = async () => {
    if (!submissionLink) {
      toast.error("This email has no training schedule, so a submission link can't be created")
      return
    }
    try {
      await navigator.clipboard.writeText(submissionLink)
      toast.success("Submission link copied")
    } catch {
      toast.error("Could not copy the submission link")
    }
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

  const uploadMaterialFile = async (file: File) => {
    const formData = new FormData()
    formData.append("material", file)
    const uploadRes = await fetch("/api/upload-material", { method: "POST", body: formData })
    const json = await uploadRes.json().catch(() => ({}))
    if (!uploadRes.ok) throw new Error(json.error || "Upload failed")
    return json as { url: string; fileType?: string }
  }

  const createCourseMaterial = async () => {
    if (!courseId) {
      toast.error("This schedule has no course, so materials can't be uploaded")
      return
    }
    if (!pendingMaterialFile) {
      toast.error("Please choose a file")
      return
    }
    const title = uploadMaterialTitle.trim() || pendingMaterialFile.name.replace(/\.[^.]+$/, "")
    setUploadingMaterial(true)
    try {
      const uploaded = await uploadMaterialFile(pendingMaterialFile)
      const createRes = await fetch("/api/course-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          title,
          file_url: uploaded.url,
          file_type: uploaded.fileType || "other",
        }),
      })
      const json = await createRes.json().catch(() => ({}))
      if (!createRes.ok) throw new Error(json.error || "Failed to save material")
      toast.success(`Uploaded: ${title}`)
      setMaterialDialogOpen(false)
      setUploadMaterialTitle("")
      setPendingMaterialFile(null)
      await loadCourseMaterials()
    } catch (error: any) {
      toast.error(error.message || "Failed to upload material")
    } finally {
      setUploadingMaterial(false)
    }
  }

  const replaceCourseMaterial = async (material: CourseMaterial, file: File) => {
    setReplacingMaterialId(material.id)
    try {
      const uploaded = await uploadMaterialFile(file)
      const res = await fetch("/api/course-materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: material.id,
          file_url: uploaded.url,
          file_type: uploaded.fileType || material.file_type,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to replace file")
      toast.success(`Replaced: ${material.title}`)
      await loadCourseMaterials()
    } catch (error: any) {
      toast.error(error.message || "Failed to replace material")
    } finally {
      setReplacingMaterialId(null)
      if (materialReplaceInputRef.current) materialReplaceInputRef.current.value = ""
    }
  }

  const renameCourseMaterial = async (material: CourseMaterial) => {
    const title = renamingMaterialTitle.trim()
    if (!title) {
      toast.error("Name is required")
      return
    }
    setBusyMaterialId(material.id)
    try {
      const res = await fetch("/api/course-materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: material.id, title }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to rename")
      setCourseMaterials((prev) => prev.map((item) => (item.id === material.id ? { ...item, title } : item)))
      setRenamingMaterialId(null)
      toast.success("Name updated")
    } catch (error: any) {
      toast.error(error.message || "Failed to rename material")
    } finally {
      setBusyMaterialId(null)
    }
  }

  const removeCourseMaterial = async (material: CourseMaterial) => {
    if (!confirm(`Remove “${material.title}”?`)) return
    setBusyMaterialId(material.id)
    try {
      const res = await fetch(`/api/course-materials?id=${material.id}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to remove")
      setCourseMaterials((prev) => prev.filter((item) => item.id !== material.id))
      toast.success("Material removed")
    } catch (error: any) {
      toast.error(error.message || "Failed to remove material")
    } finally {
      setBusyMaterialId(null)
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
      submission_link: submissionLink || "#",
    })
  }, [headerHtml, editorHtml, footerHtml, courseName, scheduleDateText, roomLink, submissionLink])

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
      const sentAt = new Date().toISOString()
      const nextTrainees = [...trainees]

      for (const participant of selectedParticipants) {
        const personalizedHtml = applyTemplateVariables(baseHtml, {
          trainee_name: `${participant.first_name} ${participant.last_name}`,
          first_name: participant.first_name || "",
          last_name: participant.last_name || "",
          email: participant.email || "",
          course_name: courseName || "Course",
          schedule: scheduleDateText || "Schedule TBD",
          room_link: roomLink || "",
          submission_link: submissionLink || "",
        })

        let status: "sent" | "failed" = "failed"
        let errorMessage: string | null = null

        try {
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

          if (response.ok) {
            status = "sent"
            success += 1
          } else {
            failed += 1
            try {
              const json = await response.json()
              errorMessage = json?.error || json?.message || `HTTP ${response.status}`
            } catch {
              errorMessage = `HTTP ${response.status}`
            }
          }
        } catch (err: any) {
          failed += 1
          errorMessage = err?.message || "Network error"
        }

        const historyItem: ComposerEmailHistoryItem = {
          at: sentAt,
          subject,
          status,
          error: errorMessage,
        }

        const existing = nextTrainees.find((t) => t.id === participant.id)
        const prevData = existing?.custom_data || participant.custom_data || {}
        const prevHistory = Array.isArray(prevData.__composer_email_history)
          ? prevData.__composer_email_history
          : []
        const nextHistory = [historyItem, ...prevHistory].slice(0, MAX_COMPOSER_EMAIL_HISTORY)
        const nextCustomData = {
          ...prevData,
          __composer_email_status: status,
          __composer_email_sent_at: sentAt,
          __composer_email_subject: subject,
          __composer_email_error: errorMessage,
          __composer_email_history: nextHistory,
        }

        const { error: persistError } = await tmsDb
          .from("trainings")
          .update({ custom_data: nextCustomData })
          .eq("id", participant.id)

        if (persistError) {
          console.error("Failed to persist composer email status:", persistError)
        }

        const idx = nextTrainees.findIndex((t) => t.id === participant.id)
        if (idx >= 0) {
          nextTrainees[idx] = { ...nextTrainees[idx], custom_data: nextCustomData }
        }
      }

      setTrainees(nextTrainees)

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
    { label: "Submission Link", token: "{{submission_link}}", tooltip: "Insert this schedule's shared drop-box link (same for all trainees here)" },
  ]

  const sectionLabel = "text-xs font-semibold uppercase tracking-wide"

  return (
    <div className="p-4 md:p-6 space-y-4 bg-muted dark:bg-background min-h-screen max-w-[1700px] mx-auto text-foreground">
      <style jsx global>{`
        .email-editor [style*="color: #000"],
        .email-editor [style*="color:#000"],
        .email-editor [style*="color: #000000"],
        .email-editor [style*="color:#000000"],
        .email-editor [style*="color: black"],
        .email-editor [style*="color:black"],
        .email-editor [style*="color: rgb(0, 0, 0)"],
        .email-editor [style*="color:rgb(0, 0, 0)"],
        .email-editor [style*="color: #141454"],
        .email-editor [style*="color:#141454"],
        .email-editor [style*="color: #1b1b63"],
        .email-editor [style*="color:#1b1b63"],
        .email-editor [style*="color: rgb(20, 20, 84)"],
        .email-editor [style*="color:rgb(20, 20, 84)"],
        .dark .email-preview-content [style*="color: #000"],
        .dark .email-preview-content [style*="color:#000"],
        .dark .email-preview-content [style*="color: #000000"],
        .dark .email-preview-content [style*="color:#000000"],
        .dark .email-preview-content [style*="color: black"],
        .dark .email-preview-content [style*="color:black"],
        .dark .email-preview-content [style*="color: rgb(0, 0, 0)"],
        .dark .email-preview-content [style*="color:rgb(0, 0, 0)"],
        .dark .email-preview-content [style*="color: #141454"],
        .dark .email-preview-content [style*="color:#141454"],
        .dark .email-preview-content [style*="color: #1b1b63"],
        .dark .email-preview-content [style*="color:#1b1b63"],
        .dark .email-preview-content [style*="color: rgb(20, 20, 84)"],
        .dark .email-preview-content [style*="color:rgb(20, 20, 84)"] {
          color: #ffffff !important;
        }
        .email-editor {
          color: #ffffff;
        }
        .dark .email-preview-content {
          color: #ffffff;
        }
        .email-editor a {
          cursor: pointer;
          color: #93c5fd !important;
        }
        .email-editor a[style*="background"] {
          color: #ffffff !important;
        }
        .dark .email-preview-content a {
          color: #93c5fd !important;
        }
        .dark .email-preview-content a[style*="background"] {
          color: #ffffff !important;
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
        <Card className="xl:col-span-3 py-2 gap-0 overflow-hidden rounded-xl border-0 bg-secondary shadow-sm text-secondary-foreground dark:bg-[#1b1d26] dark:text-white xl:h-[calc(100vh-165px)]">
          <CardHeader className="-m-px rounded-t-xl bg-primary py-3 text-center dark:bg-[#141454]">
            <CardTitle className="flex items-center justify-center gap-2 text-white">
              <Users className="h-5 w-5 text-white" />
              Participants
            </CardTitle>
            <CardDescription className="text-center text-white/80">Select recipients for this email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto h-full p-5">
            <div className="rounded-lg bg-muted p-2 dark:bg-[#161824]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-[#daae02]">Templates</p>
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
              <div className="relative mb-2">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <ScrollArea className="h-64 pr-2">
                <div className="space-y-1">
                  {filteredTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {templates.length === 0 ? "No templates yet" : "No matching templates."}
                    </p>
                  ) : (
                    filteredTemplates.map((template) => (
                      <div key={template.id} className="rounded bg-background p-1.5 dark:bg-[#0c0d14]">
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
            <div className="space-y-3 rounded-lg bg-muted p-3 dark:bg-[#161824]">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.length > 0 && selectedIds.length === trainees.filter((t) => !!t.email).length}
                onCheckedChange={(v) => onSelectAll(Boolean(v))}
              />
              <span className="text-sm font-medium text-primary dark:text-white">Select all with email</span>
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selectedParticipants.length} selected</Badge>
              {historySummary.sent > 0 && (
                <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30" variant="outline">
                  {historySummary.sent} last sent OK
                </Badge>
              )}
              {historySummary.failed > 0 && (
                <Badge className="bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30" variant="outline">
                  {historySummary.failed} last failed
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[280px] xl:h-[calc(100vh-520px)] pr-2">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading participants...</p>
                ) : filteredParticipants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participants found</p>
                ) : (
                  filteredParticipants.map((t) => {
                    const latest = getLatestComposerStatus(t)
                    return (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-start gap-2 rounded bg-background p-2 hover:bg-accent dark:bg-[#0c0d14] dark:hover:bg-[#2e3040]"
                      >
                        <Checkbox
                          checked={selectedIds.includes(t.id)}
                          disabled={!t.email}
                          onCheckedChange={() => onToggleParticipant(t.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {t.first_name} {t.last_name}
                            </p>
                            {latest.status === "sent" && (
                              <Badge className="h-5 shrink-0 gap-0.5 px-1.5 text-[9px] bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30" variant="outline">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Sent
                              </Badge>
                            )}
                            {latest.status === "failed" && (
                              <Badge className="h-5 shrink-0 gap-0.5 px-1.5 text-[9px] bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30" variant="outline">
                                <XCircle className="h-2.5 w-2.5" />
                                Failed
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{t.email || "No email address"}</p>
                          {latest.at && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              Last: {formatHistoryTime(latest.at)}
                              {latest.subject ? ` · ${latest.subject}` : ""}
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5 py-2 gap-0 overflow-hidden rounded-xl border-0 bg-blue-950 shadow-sm text-slate-900 dark:bg-[#061428] dark:text-slate-100 xl:h-[calc(100vh-165px)]">
          <CardHeader className="-m-px rounded-t-xl bg-blue-900 py-3 text-center dark:bg-[#0a1f3d]">
            <CardTitle className="flex items-center justify-center gap-2 text-blue-50">
              <PenSquare className="h-5 w-5 text-blue-200" />
              Email Editor
            </CardTitle>
              <CardDescription className="text-center text-blue-200">Build your message, add room link, submission link and attachments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto h-full p-5">
            <div className="space-y-2 rounded-lg bg-amber-300 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <Label className={`${sectionLabel} text-amber-950 dark:text-amber-200`}>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-amber-100 text-slate-900 dark:bg-zinc-950 dark:text-slate-100" />
            </div>

            <div className="space-y-2 rounded-lg bg-cyan-300 p-3 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100">
              <Label className={`${sectionLabel} text-cyan-950 dark:text-cyan-200`}>Room Link</Label>
              <Input
                placeholder="https://zoom.us/..."
                value={roomLink}
                onChange={(e) => setRoomLink(e.target.value)}
                className="bg-cyan-100 text-slate-900 dark:bg-zinc-950 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2 rounded-lg bg-emerald-300 p-3 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
              <Label className={`${sectionLabel} text-emerald-950 dark:text-emerald-200`}>Submission Link</Label>
              <div className="rounded-md bg-emerald-100 px-3 py-2 text-sm dark:bg-zinc-950">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  This training
                </p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {courseName || "Current schedule"}
                  {scheduleDateText ? ` • ${scheduleDateText}` : ""}
                </p>
                <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
                  One shared drop box for everyone on this schedule — not a separate link per trainee.
                </p>
              </div>
              <Input
                readOnly
                value={submissionLink}
                placeholder="Opens when this email is tied to a training schedule"
                className="bg-emerald-100 text-slate-900 dark:bg-zinc-950 dark:text-slate-100"
              />
              <p className="text-xs text-emerald-950/80 dark:text-emerald-200/80">
                Keep <span className="font-semibold">{"{{submission_link}}"}</span> in the template. Preview and Send fill it with this schedule’s URL, so you don’t pick the wrong class’s box.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-slate-900 dark:text-slate-100"
                  disabled={!submissionLink}
                  onClick={() => void copySubmissionLink()}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-slate-900 dark:text-slate-100"
                  disabled={!submissionLink}
                  onClick={() => window.open(submissionLink, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-slate-900 dark:text-slate-100"
                  disabled={!submissionLink}
                  onClick={insertSubmissionLink}
                >
                  <MousePointer className="h-3.5 w-3.5" />
                  Insert in email
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-stone-300 p-3 text-stone-950 dark:bg-stone-950 dark:text-stone-100">
              <Label className={`${sectionLabel} text-stone-900 dark:text-stone-200`}>Header HTML (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="<div>...</div>"
                value={headerHtml}
                onChange={(e) => setHeaderHtml(e.target.value)}
                className="bg-stone-100 text-slate-900 dark:bg-zinc-950 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2 rounded-lg bg-blue-900 p-3 text-blue-50 dark:bg-[#0a1f3d]">
              <Label className={`${sectionLabel} text-blue-100`}>Typography Tools</Label>
              <div className="flex flex-wrap gap-2 rounded-md bg-blue-950 p-2 text-slate-900 dark:bg-[#061428] dark:text-slate-100">
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
                    <div className="flex items-center gap-1 rounded px-2 bg-background text-slate-900 dark:text-slate-100">
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
                    <div className="flex items-center gap-1 rounded px-2 bg-background text-slate-900 dark:text-slate-100">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">Size</span>
                      <select
                        value={selectedTextSize}
                        onChange={(e) => applyTextSize(e.target.value)}
                        className="h-6 text-xs bg-transparent outline-none text-slate-900 dark:text-slate-100"
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
                      <Button size="sm" variant="secondary" className="text-slate-900 dark:text-slate-100" onClick={() => insertToken(item.token)}>{item.label}</Button>
                    </TooltipTrigger>
                    <TooltipContent>{item.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-blue-900 p-3 text-blue-50 dark:bg-[#0a1f3d]">
              <Label className={`${sectionLabel} text-blue-100`}>Email Body</Label>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setEditorHtml(editorRef.current?.innerHTML || "")}
                onClick={onEditorClick}
                onAuxClick={onEditorClick}
                className="email-editor min-h-[260px] rounded-md p-3 bg-blue-950 text-blue-50 outline-none focus:ring-2 focus:ring-blue-700 dark:bg-[#061428] dark:focus:ring-blue-800"
              />
            </div>

            <div className="space-y-2 rounded-lg bg-stone-300 p-3 text-stone-950 dark:bg-stone-950 dark:text-stone-100">
              <Label className={`${sectionLabel} text-stone-900 dark:text-stone-200`}>Footer HTML (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="<div>...</div>"
                value={footerHtml}
                onChange={(e) => setFooterHtml(e.target.value)}
                className="bg-stone-100 text-slate-900 dark:bg-zinc-950 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2 rounded-lg bg-[#f7edd0] p-3 text-[#141454] dark:bg-[#161824] dark:text-white">
              <Label className={`${sectionLabel} text-[#141454] dark:text-[#daae02]`}>Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => onPickAttachments(e.target.files)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="gap-2 text-slate-900 dark:text-slate-100" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Add Attachments
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add attachment from your device</TooltipContent>
              </Tooltip>
              <div className="space-y-2 rounded-md bg-[#fff8e1] p-2 text-[#141454] dark:bg-[#0c0d14] dark:text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[#141454]/70 dark:text-[#d7d8e0]">
                    Course materials · shared across all trainings
                  </p>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 text-slate-900 dark:text-slate-100"
                    disabled={!courseId}
                    onClick={() => {
                      setUploadMaterialTitle("")
                      setPendingMaterialFile(null)
                      setMaterialDialogOpen(true)
                    }}
                    title="Upload a course material"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <input
                  ref={materialReplaceInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    const material = courseMaterials.find((item) => item.id === replacingMaterialId)
                    if (file && material) void replaceCourseMaterial(material, file)
                  }}
                />
                <Input
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  placeholder="Search materials..."
                />
                <ScrollArea className="h-44 pr-2">
                  <div className="space-y-1">
                    {filteredMaterials.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {courseId
                          ? "No uploaded materials yet. Click + to add one — it will be available on every training."
                          : "No uploaded materials yet. Open a schedule that has a course to upload one."}
                      </p>
                    ) : (
                      filteredMaterials.map((material) => {
                        const busy =
                          busyMaterialId === material.id ||
                          replacingMaterialId === material.id ||
                          materialAttachingId === material.id
                        const renaming = renamingMaterialId === material.id
                        return (
                          <div key={material.id} className="flex items-center justify-between gap-2 rounded bg-white p-2 text-xs text-[#141454] dark:bg-[#1b1d26] dark:text-white">
                            <div className="min-w-0 flex-1">
                              {renaming ? (
                                <Input
                                  value={renamingMaterialTitle}
                                  onChange={(e) => setRenamingMaterialTitle(e.target.value)}
                                  className="h-7 text-xs"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void renameCourseMaterial(material)
                                    if (e.key === "Escape") setRenamingMaterialId(null)
                                  }}
                                />
                              ) : (
                                <>
                                  <p className="font-medium truncate text-[#141454] dark:text-white">{material.title}</p>
                                  <p className="uppercase text-[#7c7d91] dark:text-[#c4c6d4]">{material.file_type}</p>
                                </>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                              {renaming ? (
                                <Button
                                  size="sm"
                                  className="h-7 px-2"
                                  disabled={busy}
                                  onClick={() => void renameCourseMaterial(material)}
                                >
                                  Save
                                </Button>
                              ) : (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-slate-700 dark:text-slate-100"
                                        disabled={busy}
                                        onClick={() => setViewingMaterial(material)}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-slate-700 dark:text-slate-100"
                                        disabled={busy}
                                        onClick={() => {
                                          setRenamingMaterialId(material.id)
                                          setRenamingMaterialTitle(material.title)
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Rename</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-slate-700 dark:text-slate-100"
                                        disabled={busy}
                                        onClick={() => {
                                          setReplacingMaterialId(material.id)
                                          materialReplaceInputRef.current?.click()
                                        }}
                                      >
                                        {replacingMaterialId === material.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Replace file</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        disabled={busy}
                                        onClick={() => void removeCourseMaterial(material)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove</TooltipContent>
                                  </Tooltip>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-slate-900 dark:text-slate-100"
                                    onClick={() => attachCourseMaterial(material)}
                                    disabled={busy}
                                  >
                                    {materialAttachingId === material.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Attach"
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att) => {
                    const image = isImageFilename(att.filename)
                    return (
                      <div
                        key={att.filename}
                        className="flex items-center justify-between gap-2 text-sm rounded bg-white p-2 text-[#141454] dark:bg-[#1b1d26] dark:text-white"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => setPreviewAttachment(att)}
                          title={`View ${att.filename}`}
                        >
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={attachmentDataUrl(att)}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </span>
                          )}
                          <span className="truncate">{att.filename}</span>
                        </button>
                        <div className="flex shrink-0 items-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-slate-800 dark:text-slate-100"
                            onClick={() => setPreviewAttachment(att)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-800 dark:text-slate-100" onClick={() => removeAttachment(att.filename)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4 py-2 gap-0 overflow-hidden rounded-xl border-0 bg-muted shadow-sm text-card-foreground dark:bg-[#161824] xl:h-[calc(100vh-165px)]">
          <CardHeader className="-m-px rounded-t-xl bg-primary py-3 text-center dark:bg-[#141454]">
            <CardTitle className="flex items-center justify-center gap-2 text-white">
              <Monitor className="h-5 w-5 text-white" />
              Preview
            </CardTitle>
            <CardDescription className="text-center text-white/80">Live preview of your email content</CardDescription>
          </CardHeader>
          <CardContent className="overflow-y-auto h-full p-2">
            <div className="min-h-[420px] overflow-y-auto rounded-md bg-background p-4 xl:h-full xl:min-h-0 dark:bg-[#0c0d14]">
              <p className="text-xs text-muted-foreground mb-3">Subject: {subject || "(no subject)"}</p>
              <div
                className="email-preview-content prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              {attachments.length > 0 && (
                <div className="mt-4 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Attachments ({attachments.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {attachments.map((att) => (
                      <button
                        key={`preview-${att.filename}`}
                        type="button"
                        className="overflow-hidden rounded-md bg-muted text-left hover:bg-accent dark:bg-[#1b1d26]"
                        onClick={() => setPreviewAttachment(att)}
                      >
                        {isImageFilename(att.filename) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={attachmentDataUrl(att)}
                            alt={att.filename}
                            className="h-24 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center bg-muted">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <p className="truncate px-2 py-1.5 text-[11px]">{att.filename}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-0 bg-[#f7edd0] shadow-sm text-card-foreground dark:bg-[#161824]">
        <CardHeader className="bg-[#daae02] py-3 dark:bg-[#141454]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-[#141454] dark:text-[#daae02]">
                <History className="h-4 w-4 text-[#141454] dark:text-[#daae02]" />
                Send History
              </CardTitle>
              <CardDescription className="text-[#141454]/80 dark:text-[#d7d8e0]">
                Recent composer emails for this schedule — succeeds and failures are saved per participant.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30" variant="outline">
                {sendHistoryFeed.filter((r) => r.status === "sent").length} succeeded
              </Badge>
              <Badge className="bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30" variant="outline">
                {sendHistoryFeed.filter((r) => r.status === "failed").length} failed
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sendHistoryFeed.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No send history yet. After you send emails, results appear here.
            </p>
          ) : (
            <ScrollArea className="h-[260px]">
              <div className="divide-y divide-border">
                {sendHistoryFeed.map((row, index) => (
                  <div
                    key={`${row.traineeId}-${row.at}-${index}`}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <div className="mt-0.5 shrink-0">
                      {row.status === "sent" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {row.name}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            row.status === "sent"
                              ? "h-5 text-[10px] bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30"
                              : "h-5 text-[10px] bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30"
                          }
                        >
                          {row.status === "sent" ? "Succeeded" : "Failed"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.email || "No email"} · {row.subject || "(no subject)"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatHistoryTime(row.at)}
                        {row.status === "failed" && row.error ? ` · ${row.error}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null)
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-3 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{previewAttachment?.filename || "Attachment"}</DialogTitle>
            <DialogDescription>Preview this file before sending.</DialogDescription>
          </DialogHeader>
          {previewAttachment ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
                {isImageFilename(previewAttachment.filename) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachmentDataUrl(previewAttachment)}
                    alt={previewAttachment.filename}
                    className="mx-auto max-h-[70vh] w-full object-contain"
                  />
                ) : isPdfFilename(previewAttachment.filename) ? (
                  <iframe
                    title={previewAttachment.filename}
                    src={attachmentDataUrl(previewAttachment)}
                    className="h-[70vh] w-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      This file type can’t be previewed in the browser. Download it to open.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => downloadAttachment(previewAttachment)}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(linkEditor)}
        onOpenChange={(open) => {
          if (!open) {
            setLinkEditor(null)
            editingAnchorRef.current = null
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link</DialogTitle>
            <DialogDescription>This is the URL behind the selected button or text.</DialogDescription>
          </DialogHeader>
          {linkEditor ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-link-text">Text</Label>
                <Input
                  id="email-link-text"
                  value={linkEditor.text}
                  onChange={(e) => setLinkEditor((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-link-href">URL</Label>
                <Input
                  id="email-link-href"
                  value={linkEditor.href}
                  onChange={(e) => setLinkEditor((prev) => (prev ? { ...prev, href: e.target.value } : prev))}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(linkEditor.href)
                      toast.success("Link copied")
                    } catch {
                      toast.error("Could not copy the link")
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    if (linkEditor.href) window.open(linkEditor.href, "_blank", "noopener,noreferrer")
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
                <Button type="button" onClick={saveEditedLink}>
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={materialDialogOpen}
        onOpenChange={(open) => {
          if (uploadingMaterial) return
          setMaterialDialogOpen(open)
          if (!open) {
            setUploadMaterialTitle("")
            setPendingMaterialFile(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload course material</DialogTitle>
            <DialogDescription>
              Name the file, then choose what to upload. It will be available in the email composer for all trainings, not only this schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="material-title">Name</Label>
              <Input
                id="material-title"
                placeholder="Re-entry Plan Template"
                value={uploadMaterialTitle}
                onChange={(e) => setUploadMaterialTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-file">File</Label>
              <Input
                id="material-file"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setPendingMaterialFile(file)
                  if (file && !uploadMaterialTitle.trim()) {
                    setUploadMaterialTitle(file.name.replace(/\.[^.]+$/, ""))
                  }
                }}
              />
              {pendingMaterialFile ? (
                <p className="text-xs text-muted-foreground">{pendingMaterialFile.name}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={uploadingMaterial}
              onClick={() => setMaterialDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={uploadingMaterial || !pendingMaterialFile} onClick={() => void createCourseMaterial()}>
              {uploadingMaterial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingMaterial)}
        onOpenChange={(open) => {
          if (!open) setViewingMaterial(null)
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-3 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{viewingMaterial?.title || "Material"}</DialogTitle>
            <DialogDescription>Preview this course material.</DialogDescription>
          </DialogHeader>
          {viewingMaterial ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
                {isImageFilename(viewingMaterial.title) || viewingMaterial.file_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewingMaterial.file_url}
                    alt={viewingMaterial.title}
                    className="mx-auto max-h-[70vh] w-full object-contain"
                  />
                ) : viewingMaterial.file_type === "pdf" || isPdfFilename(viewingMaterial.title) || viewingMaterial.file_url.toLowerCase().includes(".pdf") ? (
                  <iframe
                    title={viewingMaterial.title}
                    src={viewingMaterial.file_url}
                    className="h-[70vh] w-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      This file type can’t be previewed here. Open or download it instead.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={downloadingMaterial}
                  onClick={async () => {
                    setDownloadingMaterial(true)
                    try {
                      const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(viewingMaterial.file_url)}`)
                      const blob = res.ok ? await res.blob() : await (await fetch(viewingMaterial.file_url)).blob()
                      const a = document.createElement("a")
                      a.href = URL.createObjectURL(blob)
                      a.download = filenameForMaterial(viewingMaterial)
                      a.click()
                      URL.revokeObjectURL(a.href)
                    } catch {
                      window.open(viewingMaterial.file_url, "_blank", "noopener,noreferrer")
                    } finally {
                      setDownloadingMaterial(false)
                    }
                  }}
                >
                  {downloadingMaterial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => window.open(viewingMaterial.file_url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
