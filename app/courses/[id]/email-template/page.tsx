"use client"

import { useEffect, useRef, useState, use } from "react"
import { useRouter } from "next/navigation"
import { tmsDb } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  ChevronLeft,
  Plus,
  GripVertical,
  Trash2,
  Save,
  Type,
  Eye,
  Copy,
  Edit2,
  Mail,
  FileText,
  CreditCard,
  User,
  Briefcase,
  Upload,
  ExternalLink,
  CheckCircle,
  BookmarkCheck,
  Phone,
  Heading,
  List,
  ListOrdered,
  Palette,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  MousePointer,
  ImageIcon,
  Minus,
  Link as LinkIcon,
  LayoutTemplate,
  Send
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────

type EmailBlockType =
  | 'header'
  | 'success_banner'
  | 'greeting'
  | 'booking_reference'
  | 'training_details'
  | 'attendee_info'
  | 'employment_info'
  | 'payment_summary'
  | 'payment_instructions'
  | 'upload_receipt_link'
  | 'next_steps'
  | 'contact_info'
  | 'footer'
  | 'custom_text'
  | 'custom_button'
  | 'custom_upload_link'
  | 'divider'

interface EmailBlock {
  id: string
  type: EmailBlockType
  enabled: boolean
  label: string
  content?: string
  buttonText?: string
  buttonUrl?: string
  items?: string[]
  description?: string
  uploadPageBlocks?: UploadPageBlock[]
  uploadPageTitle?: string
  uploadPageDescription?: string
}

interface UploadPageBlock {
  id: string
  type: 'file_upload' | 'rich_text' | 'reference_input'
  label: string
  required: boolean
  description?: string
  content?: string
  acceptTypes?: string
  maxSizeMB?: number
}

interface EmailTemplate {
  id: string
  name: string
  config: EmailBlock[]
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_EMAIL_BLOCKS: EmailBlock[] = [
  { id: 'header', type: 'header', enabled: true, label: 'Email Header', content: 'Registration Confirmed!' },
  { id: 'success_banner', type: 'success_banner', enabled: true, label: 'Success Banner', content: 'Your training registration has been successfully submitted!' },
  { id: 'greeting', type: 'greeting', enabled: true, label: 'Greeting Text', content: 'We are pleased to confirm your registration for the training program. Please keep this email for your records.' },
  { id: 'booking_reference', type: 'booking_reference', enabled: true, label: 'Booking Reference', content: 'Please save this reference number for future inquiries' },
  { id: 'training_details', type: 'training_details', enabled: true, label: 'Training Details' },
  { id: 'attendee_info', type: 'attendee_info', enabled: true, label: 'Attendee Information' },
  { id: 'employment_info', type: 'employment_info', enabled: true, label: 'Employment Information' },
  { id: 'payment_summary', type: 'payment_summary', enabled: true, label: 'Payment Summary' },
  { id: 'payment_instructions', type: 'payment_instructions', enabled: true, label: 'Payment Instructions' },
  { id: 'upload_receipt_link', type: 'upload_receipt_link', enabled: true, label: 'Upload Receipt Link', buttonText: 'Upload Receipt Now', description: 'Upload your payment receipt for faster verification' },
  { id: 'next_steps', type: 'next_steps', enabled: true, label: 'Next Steps', items: [
    'Complete your payment using the instructions above',
    'Upload your payment receipt using the link provided',
    'Keep your booking reference for future inquiries',
    'You will receive a confirmation once your payment is verified',
    'Arrive at the venue 15 minutes before the training starts',
  ]},
  { id: 'contact_info', type: 'contact_info', enabled: true, label: 'Contact Information' },
  { id: 'footer', type: 'footer', enabled: true, label: 'Email Footer' },
]

const ADDABLE_BLOCKS: { type: EmailBlockType; label: string; icon: any; description: string }[] = [
  { type: 'custom_text', label: 'Custom Text', icon: Type, description: 'Rich text block with variables' },
  { type: 'custom_button', label: 'Custom Button', icon: MousePointer, description: 'Call-to-action button with link' },
  { type: 'custom_upload_link', label: 'Custom Upload Page', icon: Upload, description: 'Configurable file upload page link' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal separator line' },
]

const BLOCK_ICONS: Record<EmailBlockType, any> = {
  header: Mail,
  success_banner: CheckCircle,
  greeting: Type,
  booking_reference: BookmarkCheck,
  training_details: FileText,
  attendee_info: User,
  employment_info: Briefcase,
  payment_summary: CreditCard,
  payment_instructions: CreditCard,
  upload_receipt_link: Upload,
  next_steps: ListOrdered,
  contact_info: Phone,
  footer: LayoutTemplate,
  custom_text: Type,
  custom_button: MousePointer,
  custom_upload_link: Upload,
  divider: Minus,
}

const BLOCK_COLORS: Record<EmailBlockType, string> = {
  header: "bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900",
  success_banner: "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900",
  greeting: "bg-sky-50/40 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900",
  booking_reference: "bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900",
  training_details: "bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900",
  attendee_info: "bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900",
  employment_info: "bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900",
  payment_summary: "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900",
  payment_instructions: "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900",
  upload_receipt_link: "bg-purple-50/40 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900",
  next_steps: "bg-teal-50/40 border-teal-200 dark:bg-teal-950/20 dark:border-teal-900",
  contact_info: "bg-slate-50/40 border-slate-200 dark:bg-slate-950/20 dark:border-slate-900",
  footer: "bg-slate-50/40 border-slate-200 dark:bg-slate-950/20 dark:border-slate-900",
  custom_text: "bg-violet-50/40 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900",
  custom_button: "bg-rose-50/40 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900",
  custom_upload_link: "bg-cyan-50/40 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-900",
  divider: "bg-gray-50/40 border-gray-200 dark:bg-gray-950/20 dark:border-gray-900",
}

const VARIABLE_TAGS = [
  { tag: '{{trainee_name}}', label: 'Trainee Name' },
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{phone}}', label: 'Phone' },
  { tag: '{{booking_reference}}', label: 'Booking Reference' },
  { tag: '{{course_name}}', label: 'Course Name' },
  { tag: '{{schedule}}', label: 'Schedule' },
  { tag: '{{training_fee}}', label: 'Training Fee' },
  { tag: '{{total_amount}}', label: 'Total Amount' },
  { tag: '{{payment_method}}', label: 'Payment Method' },
  { tag: '{{payment_status}}', label: 'Payment Status' },
]

// ─── Component ────────────────────────────────────────────────────────────

export default function ManageEmailTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("builder")

  const [emailType, setEmailType] = useState<string>('default')
  const [config, setConfig] = useState<EmailBlock[]>([...DEFAULT_EMAIL_BLOCKS])

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templateName, setTemplateName] = useState("")
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  const richTextEditorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const richTextDrafts = useRef<Record<string, string>>({})
  const richTextSelections = useRef<Record<string, Range | null>>({})

  useEffect(() => {
    fetchCourseDetails()
    fetchTemplates()
  }, [id])

  const fetchCourseDetails = async () => {
    try {
      const { data, error } = await tmsDb
        .from("courses")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error
      if (data) {
        setCourse(data)
        setEmailType(data.email_template_type || 'default')
        if (data.email_template_config && data.email_template_config.length > 0) {
          setConfig(data.email_template_config)
        }
      }
    } catch (err) {
      console.error("Error fetching course:", err)
      toast.error("Failed to load course details")
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/email-builder-templates")
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setTemplates(data)
    } catch (err) {
      console.error("Error fetching templates:", err)
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    setIsSavingTemplate(true)
    try {
      const response = await fetch("/api/email-builder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, config })
      })
      if (!response.ok) throw new Error("Failed to save template")
      toast.success("Template saved successfully")
      setTemplateName("")
      setIsSaveDialogOpen(false)
      fetchTemplates()
    } catch (err) {
      toast.error("Failed to save template")
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleRenameTemplate = async () => {
    if (!editingTemplate || !templateName.trim()) return
    try {
      const response = await fetch("/api/email-builder-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTemplate.id, name: templateName })
      })
      if (!response.ok) throw new Error("Failed to rename template")
      toast.success("Template renamed")
      setEditingTemplate(null)
      setTemplateName("")
      fetchTemplates()
    } catch (err) {
      toast.error("Failed to rename template")
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      const response = await fetch(`/api/email-builder-templates?id=${templateId}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete")
      toast.success("Template deleted")
      fetchTemplates()
    } catch (err) {
      toast.error("Failed to delete template")
    }
  }

  const loadTemplate = (template: EmailTemplate) => {
    if (config.some(b => b.type === 'custom_text' || b.type === 'custom_button' || b.type === 'custom_upload_link') &&
      !confirm("Loading a template will overwrite your current configuration. Proceed?")) return
    setConfig(template.config)
    setEmailType("custom")
    toast.success(`Loaded template: ${template.name}`)
  }

  const selectedTemplateId =
    emailType === "custom"
      ? templates.find(
          (template) =>
            JSON.stringify(template.config || []) === JSON.stringify(config || [])
        )?.id || null
      : null

  // ─── Block CRUD ──────────────────────────────────────────────────────

  const addBlock = (type: EmailBlockType) => {
    const newBlock: EmailBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      enabled: true,
      label: ADDABLE_BLOCKS.find(b => b.type === type)?.label || 'New Block',
      content: type === 'custom_text' ? '' : undefined,
      buttonText: type === 'custom_button' ? 'Click Here' : type === 'custom_upload_link' ? 'Upload Files' : undefined,
      buttonUrl: type === 'custom_button' ? 'https://' : undefined,
      uploadPageTitle: type === 'custom_upload_link' ? 'Upload Files' : undefined,
      uploadPageDescription: type === 'custom_upload_link' ? 'Please upload the required files below' : undefined,
      uploadPageBlocks: type === 'custom_upload_link' ? [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'file_upload',
          label: 'Upload File',
          required: true,
          description: '',
          acceptTypes: '*/*',
          maxSizeMB: 10
        }
      ] : undefined,
    }
    setConfig([...config, newBlock])
  }

  const removeBlock = (blockId: string) => {
    setConfig(config.filter(b => b.id !== blockId))
  }

  const updateBlock = (blockId: string, updates: Partial<EmailBlock>) => {
    setConfig(config.map(b => b.id === blockId ? { ...b, ...updates } : b))
  }

  const toggleBlock = (blockId: string) => {
    setConfig(config.map(b => b.id === blockId ? { ...b, enabled: !b.enabled } : b))
  }

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newConfig = [...config]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex >= 0 && targetIndex < newConfig.length) {
      const [moved] = newConfig.splice(index, 1)
      newConfig.splice(targetIndex, 0, moved)
      setConfig(newConfig)
    }
  }

  // ─── Next Steps CRUD ────────────────────────────────────────────────

  const addNextStep = (blockId: string) => {
    setConfig(config.map(b => {
      if (b.id === blockId) {
        return { ...b, items: [...(b.items || []), 'New step'] }
      }
      return b
    }))
  }

  const updateNextStep = (blockId: string, index: number, value: string) => {
    setConfig(config.map(b => {
      if (b.id === blockId) {
        const items = [...(b.items || [])]
        items[index] = value
        return { ...b, items }
      }
      return b
    }))
  }

  const removeNextStep = (blockId: string, index: number) => {
    setConfig(config.map(b => {
      if (b.id === blockId) {
        const items = [...(b.items || [])]
        items.splice(index, 1)
        return { ...b, items }
      }
      return b
    }))
  }

  // ─── Upload Page Block CRUD ──────────────────────────────────────────

  const addUploadPageBlock = (emailBlockId: string, type: UploadPageBlock['type']) => {
    setConfig(config.map(b => {
      if (b.id === emailBlockId) {
        const newUploadBlock: UploadPageBlock = {
          id: Math.random().toString(36).substr(2, 9),
          type,
          label: type === 'file_upload' ? 'Upload File' : type === 'rich_text' ? 'Instructions' : 'Reference Number',
          required: type !== 'rich_text',
          description: '',
          content: '',
          acceptTypes: type === 'file_upload' ? '*/*' : undefined,
          maxSizeMB: type === 'file_upload' ? 10 : undefined,
        }
        return { ...b, uploadPageBlocks: [...(b.uploadPageBlocks || []), newUploadBlock] }
      }
      return b
    }))
  }

  const updateUploadPageBlock = (emailBlockId: string, uploadBlockId: string, updates: Partial<UploadPageBlock>) => {
    setConfig(config.map(b => {
      if (b.id === emailBlockId) {
        return {
          ...b,
          uploadPageBlocks: (b.uploadPageBlocks || []).map(ub =>
            ub.id === uploadBlockId ? { ...ub, ...updates } : ub
          )
        }
      }
      return b
    }))
  }

  const removeUploadPageBlock = (emailBlockId: string, uploadBlockId: string) => {
    setConfig(config.map(b => {
      if (b.id === emailBlockId) {
        return { ...b, uploadPageBlocks: (b.uploadPageBlocks || []).filter(ub => ub.id !== uploadBlockId) }
      }
      return b
    }))
  }

  // ─── Rich Text Helpers ──────────────────────────────────────────────

  const captureSelection = (blockId: string) => {
    const editor = richTextEditorRefs.current[blockId]
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) {
      richTextSelections.current[blockId] = range.cloneRange()
    }
  }

  const restoreSelection = (blockId: string) => {
    const savedRange = richTextSelections.current[blockId]
    if (!savedRange) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(savedRange)
  }

  const applyCommand = (blockId: string, command: string, value?: string) => {
    const editor = richTextEditorRefs.current[blockId]
    if (!editor) return
    editor.focus()
    restoreSelection(blockId)
    if (command === "foreColor") {
      document.execCommand("styleWithCSS", false, "true")
    }
    document.execCommand(command, false, value)
    const html = editor.innerHTML
    richTextDrafts.current[blockId] = html
    updateBlock(blockId, { content: html })
  }

  // ─── Save ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await tmsDb
        .from("courses")
        .update({
          email_template_type: emailType,
          email_template_config: config
        })
        .eq("id", id)

      if (error) throw error
      toast.success("Email template updated successfully")
    } catch (err) {
      console.error("Error saving config:", err)
      toast.error("Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  // ─── Email Preview HTML Generator ──────────────────────────────────

  const generatePreviewHtml = () => {
    const enabledBlocks = config.filter(b => b.enabled)
    let html = `<div style="max-width:600px;margin:0 auto;background:#fff;font-family:Arial,sans-serif;">`

    for (const block of enabledBlocks) {
      switch (block.type) {
        case 'header':
          html += `<div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:2rem;text-align:center;">
            <img src="https://petrosphere.com.ph/trans-logo-dark.png" alt="Petrosphere" style="max-width:200px;height:auto;margin-bottom:1rem;">
            <h1 style="color:#fff;margin:0;font-size:1.5rem;">${block.content || 'Registration Confirmed!'}</h1>
            <p style="color:#cbd5e1;margin:0.5rem 0 0 0;">Thank you for registering with us</p>
          </div>`
          break
        case 'success_banner':
          html += `<div style="padding:0 2rem;"><div style="background:#ecfdf5;border-left:4px solid #10b981;padding:1rem;margin:1.5rem 0;border-radius:0.5rem;">
            <p style="margin:0;color:#065f46;font-weight:600;">${block.content || 'Your training registration has been successfully submitted!'}</p>
          </div></div>`
          break
        case 'greeting':
          html += `<div style="padding:0 2rem;">
            <p style="color:#374151;line-height:1.6;">Dear <strong>{{trainee_name}}</strong>,</p>
            <p style="color:#374151;line-height:1.6;">${block.content || 'We are pleased to confirm your registration.'}</p>
          </div>`
          break
        case 'booking_reference':
          html += `<div style="padding:0 2rem;"><div style="background:#fef3c7;border:2px dashed #f59e0b;padding:1rem;margin:1.5rem 0;text-align:center;border-radius:0.5rem;">
            <p style="margin:0 0 0.5rem 0;color:#92400e;font-size:0.875rem;font-weight:600;">BOOKING REFERENCE</p>
            <p style="margin:0;color:#b45309;font-size:1.75rem;font-weight:bold;letter-spacing:0.05em;">{{booking_reference}}</p>
            <p style="margin:0.5rem 0 0 0;color:#92400e;font-size:0.75rem;">${block.content || 'Please save this reference number for future inquiries'}</p>
          </div></div>`
          break
        case 'training_details':
          html += `<div style="padding:0 2rem;"><div style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1.5rem;margin-bottom:1.5rem;">
            <h2 style="color:#1e3a8a;margin:0 0 1rem 0;font-size:1.125rem;border-bottom:2px solid #3b82f6;padding-bottom:0.5rem;">Training Details</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;width:35%;">Course:</td><td style="padding:0.5rem 0;color:#111827;">{{course_name}}</td></tr>
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;">Schedule:</td><td style="padding:0.5rem 0;color:#111827;">{{schedule}}</td></tr>
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;">Booking Date:</td><td style="padding:0.5rem 0;color:#111827;">${new Date().toLocaleDateString()}</td></tr>
            </table>
          </div></div>`
          break
        case 'attendee_info':
          html += `<div style="padding:0 2rem;"><div style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1.5rem;margin-bottom:1.5rem;">
            <h2 style="color:#1e3a8a;margin:0 0 1rem 0;font-size:1.125rem;border-bottom:2px solid #3b82f6;padding-bottom:0.5rem;">Attendee Information</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;width:35%;">Name:</td><td style="padding:0.5rem 0;color:#111827;">{{trainee_name}}</td></tr>
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;">Email:</td><td style="padding:0.5rem 0;color:#111827;">{{email}}</td></tr>
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;">Phone:</td><td style="padding:0.5rem 0;color:#111827;">{{phone}}</td></tr>
            </table>
          </div></div>`
          break
        case 'employment_info':
          html += `<div style="padding:0 2rem;"><div style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1.5rem;margin-bottom:1.5rem;">
            <h2 style="color:#1e3a8a;margin:0 0 1rem 0;font-size:1.125rem;border-bottom:2px solid #3b82f6;padding-bottom:0.5rem;">Employment Information</h2>
            <p style="color:#6b7280;font-size:0.875rem;">Company, position, and industry details will be shown here.</p>
          </div></div>`
          break
        case 'payment_summary':
          html += `<div style="padding:0 2rem;"><div style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1.5rem;margin-bottom:1.5rem;">
            <h2 style="color:#1e3a8a;margin:0 0 1rem 0;font-size:1.125rem;border-bottom:2px solid #3b82f6;padding-bottom:0.5rem;">Payment Summary</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;width:50%;">Training Fee:</td><td style="padding:0.5rem 0;color:#111827;text-align:right;">{{training_fee}}</td></tr>
              <tr style="border-top:2px solid #e5e7eb;"><td style="padding:0.75rem 0;color:#111827;font-weight:700;font-size:1.125rem;">Total Amount:</td><td style="padding:0.75rem 0;color:#111827;font-weight:700;font-size:1.125rem;text-align:right;">{{total_amount}}</td></tr>
              <tr><td style="padding:0.5rem 0;color:#6b7280;font-weight:600;">Payment Method:</td><td style="padding:0.5rem 0;color:#111827;text-align:right;">{{payment_method}}</td></tr>
            </table>
          </div></div>`
          break
        case 'payment_instructions':
          html += `<div style="padding:0 2rem;"><div style="background:#f9fafb;padding:1rem;border-radius:0.5rem;margin-bottom:1.5rem;">
            <p style="font-weight:600;color:#111827;margin-bottom:0.5rem;">Payment Instructions</p>
            <p style="color:#6b7280;font-size:0.875rem;">BPI / GCash / Counter payment instructions will be dynamically shown based on the trainee's selected payment method.</p>
          </div></div>`
          break
        case 'upload_receipt_link':
          html += `<div style="padding:0 2rem;"><div style="padding:1rem;background:#dbeafe;border-radius:0.5rem;border:2px solid #3b82f6;margin-bottom:1.5rem;">
            <p style="font-weight:600;color:#1e3a8a;margin-bottom:0.5rem;">📤 ${block.description || 'Upload your payment receipt'}</p>
            <a href="#" style="display:inline-block;margin-top:0.5rem;padding:0.75rem 1.5rem;background:#3b82f6;color:white;text-decoration:none;border-radius:0.5rem;font-weight:600;">
              ${block.buttonText || 'Upload Receipt Now'}
            </a>
          </div></div>`
          break
        case 'next_steps':
          html += `<div style="padding:0 2rem;"><div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:1rem;margin-bottom:1.5rem;border-radius:0.5rem;">
            <h3 style="color:#1e3a8a;margin:0 0 0.75rem 0;font-size:1rem;">📋 Next Steps:</h3>
            <ol style="margin:0;padding-left:1.25rem;color:#374151;line-height:1.6;">
              ${(block.items || []).map(item => `<li>${item}</li>`).join('')}
            </ol>
          </div></div>`
          break
        case 'contact_info':
          html += `<div style="padding:0 2rem;"><div style="background:#f9fafb;padding:1rem;border-radius:0.5rem;margin-bottom:1.5rem;">
            <h3 style="color:#111827;margin:0 0 0.75rem 0;font-size:1rem;">📞 Need Help?</h3>
            <p style="margin:0.25rem 0;color:#4b5563;font-size:0.875rem;"><strong>Phone:</strong> Globe/TM 0917-708-7994</p>
            <p style="margin:0.25rem 0;color:#4b5563;font-size:0.875rem;"><strong>Email:</strong> training@petrosphere.com.ph</p>
          </div></div>`
          break
        case 'footer':
          html += `<div style="background:#f9fafb;padding:1.5rem;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#6b7280;font-size:0.875rem;">This is an automated message. Please do not reply to this email.</p>
            <p style="margin:0.5rem 0 0 0;color:#6b7280;font-size:0.75rem;">© ${new Date().getFullYear()} Petrosphere Inc. All rights reserved.</p>
          </div>`
          break
        case 'custom_text':
          html += `<div style="padding:0 2rem;"><div style="margin-bottom:1.5rem;">${block.content || '<p style="color:#6b7280;">Custom text content...</p>'}</div></div>`
          break
        case 'custom_button':
          html += `<div style="padding:0 2rem;text-align:center;margin-bottom:1.5rem;">
            <a href="${block.buttonUrl || '#'}" style="display:inline-block;padding:0.75rem 2rem;background:#3b82f6;color:white;text-decoration:none;border-radius:0.5rem;font-weight:600;">
              ${block.buttonText || 'Click Here'}
            </a>
          </div>`
          break
        case 'custom_upload_link':
          html += `<div style="padding:0 2rem;"><div style="padding:1rem;background:#ecfeff;border-radius:0.5rem;border:2px solid #06b6d4;margin-bottom:1.5rem;">
            <p style="font-weight:600;color:#155e75;margin-bottom:0.5rem;">📎 ${block.uploadPageTitle || 'Upload Files'}</p>
            <p style="color:#0e7490;font-size:0.875rem;margin-bottom:0.75rem;">${block.uploadPageDescription || 'Please upload the required files'}</p>
            <a href="#" style="display:inline-block;padding:0.75rem 1.5rem;background:#0891b2;color:white;text-decoration:none;border-radius:0.5rem;font-weight:600;">
              ${block.buttonText || 'Upload Files'}
            </a>
          </div></div>`
          break
        case 'divider':
          html += `<div style="padding:1rem 2rem;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></div>`
          break
      }
    }

    html += `</div>`
    return html
  }

  // ─── Render ──────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>

  const isBuiltInBlock = (type: EmailBlockType) =>
    ['header', 'success_banner', 'greeting', 'booking_reference', 'training_details',
     'attendee_info', 'employment_info', 'payment_summary', 'payment_instructions',
     'upload_receipt_link', 'next_steps', 'contact_info', 'footer'].includes(type)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manage Email Template</h1>
            <p className="text-muted-foreground">{course?.name}: {course?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Type & Templates */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Email Type</CardTitle>
            <CardDescription className="text-xs">Choose default or build a custom email</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={emailType} onValueChange={setEmailType} className="space-y-3">
              {[
                { value: 'default', label: 'Default Email', desc: 'Standard booking summary email with all sections' },
                { value: 'custom', label: 'Custom Email', desc: 'Build your own email from blocks' },
              ].map((t) => (
                <div
                  key={t.value}
                  className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer hover:bg-muted/50 ${
                    emailType === t.value ? "border-primary/60 bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value={t.value} id={`email-${t.value}`} />
                  <Label htmlFor={`email-${t.value}`} className="flex-1 cursor-pointer">
                    <span className="font-semibold block text-sm">{t.label}</span>
                    <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                  </Label>
                  {emailType === t.value && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </RadioGroup>

            <div className="mt-5 pt-4 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Saved Templates
              </p>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No templates saved yet.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => loadTemplate(t)}
                      >
                        <p className="text-sm font-medium leading-tight">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">{t.config.length} blocks</p>
                      </button>
                      <div className="flex items-center gap-1">
                        {selectedTemplateId === t.id && emailType === "custom" ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground">
                            Selected
                          </span>
                        ) : (
                          <Button variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => loadTemplate(t)}>
                            Use
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTemplate(t); setTemplateName(t.name) }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTemplate(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {emailType === 'custom' && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Variable Tags
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">Click to copy. Use in custom text blocks.</p>
                <div className="flex flex-wrap gap-1">
                  {VARIABLE_TAGS.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/40 transition-colors font-mono"
                      onClick={() => {
                        navigator.clipboard.writeText(v.tag)
                        toast.success(`Copied ${v.tag}`)
                      }}
                      title={v.label}
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Center - Builder or Default */}
        {emailType === 'custom' ? (
          <div className="lg:col-span-3 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="builder" className="gap-2">
                    <LayoutTemplate className="h-4 w-4" />
                    Builder
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2" disabled={config.length === 0}>
                        <Copy className="h-4 w-4" />
                        Save as Template
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="lg:w-[50vw] w-[90vw]">
                      <DialogHeader>
                        <DialogTitle>Save as Template</DialogTitle>
                        <DialogDescription>Save this email structure for future use across other courses.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Template Name</Label>
                          <Input placeholder="e.g. Standard Confirmation Email" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                        </div>
                        <Button className="w-full" onClick={handleSaveTemplate} disabled={isSavingTemplate || !templateName}>
                          {isSavingTemplate ? "Saving..." : "Save Template"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Template Rename Dialog */}
              <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rename Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                    <Button className="w-full" onClick={handleRenameTemplate}>Update Name</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <TabsContent value="builder" className="space-y-4 mt-4">
                {/* Add Custom Blocks */}
                <div className="flex flex-wrap gap-2">
                  {ADDABLE_BLOCKS.map((item) => (
                    <Button
                      key={item.type}
                      variant="outline"
                      size="sm"
                      className="h-9 flex items-center justify-start gap-2 px-3 text-[11px] font-semibold hover:bg-primary/5 hover:border-primary/50 transition-all shadow-sm"
                      onClick={() => addBlock(item.type)}
                    >
                      <item.icon className="h-3.5 w-3.5 text-primary" />
                      {item.label}
                      <Plus className="h-3 w-3 ml-auto opacity-30" />
                    </Button>
                  ))}
                </div>

                {/* Block List */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Email Structure</h3>
                  {config.length === 0 && (
                    <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
                      Your email is empty. Toggle sections or add custom blocks above.
                    </div>
                  )}

                  {config.map((block, index) => {
                    const Icon = BLOCK_ICONS[block.type] || Type
                    const colorClass = BLOCK_COLORS[block.type] || "bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800"
                    const isBuiltIn = isBuiltInBlock(block.type)

                    if (block.type === 'divider') {
                      return (
                        <div key={block.id} className="relative flex items-center justify-center py-2 group">
                          <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-gray-600"></div>
                          </div>
                          <div className="relative flex items-center gap-2 bg-muted px-4 py-1 rounded-full border shadow-sm">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Divider</span>
                            <div className="flex gap-1 ml-2 border-l pl-2">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                                <ChevronLeft className="h-3 w-3 rotate-90" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(index, 'down')} disabled={index === config.length - 1}>
                                <ChevronLeft className="h-3 w-3 -rotate-90" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeBlock(block.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <Card key={block.id} className={`relative shadow-sm transition-all duration-200 hover:shadow-md ${colorClass} ${!block.enabled ? 'opacity-50' : ''}`}>
                        <CardContent className="p-2 flex items-start gap-3">
                          {/* Reorder Controls */}
                          <div className="flex flex-col gap-0 items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors pr-1 pt-1">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                              <ChevronLeft className="h-3 w-3 rotate-90" />
                            </Button>
                            <GripVertical className="h-3 w-3" />
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(index, 'down')} disabled={index === config.length - 1}>
                              <ChevronLeft className="h-3 w-3 -rotate-90" />
                            </Button>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              {/* Type Indicator */}
                              <div className="flex items-center gap-1.5 min-w-[130px]">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground truncate opacity-70">
                                  {block.type.replace(/_/g, ' ')}
                                </span>
                              </div>

                              {/* Label */}
                              <div className="flex-1 flex items-center gap-3">
                                {!isBuiltIn ? (
                                  <Input
                                    className="h-7 text-xs bg-background border-border hover:border-muted-foreground/30 focus:bg-background transition-all py-1 px-2"
                                    value={block.label}
                                    onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                                    placeholder="Block label..."
                                  />
                                ) : (
                                  <span className="text-xs font-medium">{block.label}</span>
                                )}

                                {/* Enable/Disable Toggle */}
                                <div className="flex items-center gap-2 px-2 border-l border-border whitespace-nowrap">
                                  <Checkbox
                                    id={`en-${block.id}`}
                                    checked={block.enabled}
                                    className="h-3.5 w-3.5"
                                    onCheckedChange={() => toggleBlock(block.id)}
                                  />
                                  <Label htmlFor={`en-${block.id}`} className="text-[10px] font-medium cursor-pointer select-none text-muted-foreground">
                                    {block.enabled ? 'Enabled' : 'Disabled'}
                                  </Label>
                                </div>
                              </div>

                              {/* Delete (custom blocks only) */}
                              {!isBuiltIn && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={() => removeBlock(block.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>

                            {/* Block-specific config */}
                            {block.enabled && (
                              <div className="mt-2">
                                {/* Header config */}
                                {block.type === 'header' && (
                                  <div className="pl-[140px] pb-1">
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.content || ''}
                                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                      placeholder="Email heading text..."
                                    />
                                  </div>
                                )}

                                {/* Success banner config */}
                                {block.type === 'success_banner' && (
                                  <div className="pl-[140px] pb-1">
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.content || ''}
                                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                      placeholder="Success message text..."
                                    />
                                  </div>
                                )}

                                {/* Greeting config */}
                                {block.type === 'greeting' && (
                                  <div className="pl-[140px] pb-1">
                                    <Textarea
                                      className="text-xs bg-background border-border min-h-[60px]"
                                      value={block.content || ''}
                                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                      placeholder="Greeting text... Use {{trainee_name}} for the name."
                                    />
                                  </div>
                                )}

                                {/* Booking reference config */}
                                {block.type === 'booking_reference' && (
                                  <div className="pl-[140px] pb-1">
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.content || ''}
                                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                      placeholder="Sub-text under reference number..."
                                    />
                                  </div>
                                )}

                                {/* Upload receipt link config */}
                                {block.type === 'upload_receipt_link' && (
                                  <div className="pl-[140px] pb-1 space-y-1">
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.buttonText || ''}
                                      onChange={(e) => updateBlock(block.id, { buttonText: e.target.value })}
                                      placeholder="Button text..."
                                    />
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.description || ''}
                                      onChange={(e) => updateBlock(block.id, { description: e.target.value })}
                                      placeholder="Description text above button..."
                                    />
                                  </div>
                                )}

                                {/* Next steps config */}
                                {block.type === 'next_steps' && (
                                  <div className="pl-[140px] pb-1 space-y-1">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Steps</p>
                                    {(block.items || []).map((item, i) => (
                                      <div key={i} className="flex gap-1 items-center">
                                        <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}.</span>
                                        <Input
                                          className="h-6 text-[10px] bg-background border-border flex-1 py-0 px-2"
                                          value={item}
                                          onChange={(e) => updateNextStep(block.id, i, e.target.value)}
                                        />
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive" onClick={() => removeNextStep(block.id, i)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1 hover:bg-primary/5 text-primary" onClick={() => addNextStep(block.id)}>
                                      <Plus className="h-3 w-3" /> Add Step
                                    </Button>
                                  </div>
                                )}

                                {/* Custom text config */}
                                {block.type === 'custom_text' && (
                                  <div className="pl-[140px] pb-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1 mb-1">
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyCommand(block.id, "bold")} title="Bold">
                                        <Bold className="h-3 w-3" />
                                      </Button>
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyCommand(block.id, "italic")} title="Italic">
                                        <Italic className="h-3 w-3" />
                                      </Button>
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyCommand(block.id, "insertUnorderedList")} title="Bullet List">
                                        <List className="h-3 w-3" />
                                      </Button>
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyCommand(block.id, "insertOrderedList")} title="Numbered List">
                                        <ListOrdered className="h-3 w-3" />
                                      </Button>
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyCommand(block.id, "formatBlock", "h2")} title="Heading">
                                        <Heading className="h-3 w-3" />
                                      </Button>
                                      <select
                                        className="h-6 text-[10px] rounded-md border border-border bg-background px-2 text-foreground"
                                        onChange={(e) => applyCommand(block.id, "fontSize", e.target.value)}
                                        defaultValue=""
                                      >
                                        <option value="" disabled>Size</option>
                                        <option value="2">Small</option>
                                        <option value="3">Normal</option>
                                        <option value="4">Large</option>
                                        <option value="5">X-Large</option>
                                      </select>
                                      <label className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-border bg-background text-[10px] text-muted-foreground">
                                        <Palette className="h-3 w-3" />
                                        <input
                                          type="color"
                                          className="h-4 w-4 border-0 bg-transparent p-0 cursor-pointer"
                                          defaultValue="#111827"
                                          onMouseDown={() => captureSelection(block.id)}
                                          onChange={(e) => applyCommand(block.id, "foreColor", e.target.value)}
                                        />
                                      </label>
                                    </div>
                                    <div
                                      ref={(el) => {
                                        richTextEditorRefs.current[block.id] = el
                                        if (el) {
                                          const current = richTextDrafts.current[block.id] ?? block.content ?? ""
                                          if (el.innerHTML !== current) {
                                            el.innerHTML = current
                                          }
                                        }
                                      }}
                                      contentEditable
                                      suppressContentEditableWarning
                                      className="min-h-[80px] rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                      onInput={(e) => {
                                        const html = (e.currentTarget as HTMLDivElement).innerHTML
                                        richTextDrafts.current[block.id] = html
                                      }}
                                      onBlur={(e) => {
                                        const html = (e.currentTarget as HTMLDivElement).innerHTML
                                        richTextDrafts.current[block.id] = html
                                        updateBlock(block.id, { content: html })
                                      }}
                                      onMouseUp={() => captureSelection(block.id)}
                                      onKeyUp={() => captureSelection(block.id)}
                                    />
                                    <p className="text-[9px] text-muted-foreground">Use variable tags like {"{{trainee_name}}"} for dynamic content.</p>
                                  </div>
                                )}

                                {/* Custom button config */}
                                {block.type === 'custom_button' && (
                                  <div className="pl-[140px] pb-1 space-y-1">
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.buttonText || ''}
                                      onChange={(e) => updateBlock(block.id, { buttonText: e.target.value })}
                                      placeholder="Button text..."
                                    />
                                    <Input
                                      className="h-7 text-xs bg-background border-border"
                                      value={block.buttonUrl || ''}
                                      onChange={(e) => updateBlock(block.id, { buttonUrl: e.target.value })}
                                      placeholder="Button URL (https://...)..."
                                    />
                                  </div>
                                )}

                                {/* Custom upload page config */}
                                {block.type === 'custom_upload_link' && (
                                  <div className="pl-[140px] pb-1 space-y-2">
                                    <div className="space-y-1">
                                      <Input
                                        className="h-7 text-xs bg-background border-border"
                                        value={block.uploadPageTitle || ''}
                                        onChange={(e) => updateBlock(block.id, { uploadPageTitle: e.target.value })}
                                        placeholder="Upload page title..."
                                      />
                                      <Input
                                        className="h-7 text-xs bg-background border-border"
                                        value={block.uploadPageDescription || ''}
                                        onChange={(e) => updateBlock(block.id, { uploadPageDescription: e.target.value })}
                                        placeholder="Upload page description..."
                                      />
                                      <Input
                                        className="h-7 text-xs bg-background border-border"
                                        value={block.buttonText || ''}
                                        onChange={(e) => updateBlock(block.id, { buttonText: e.target.value })}
                                        placeholder="Email button text..."
                                      />
                                    </div>

                                    <div className="border-t pt-2 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Upload Page Blocks</p>
                                        <div className="flex gap-1">
                                          <Button variant="outline" size="sm" className="h-5 px-2 text-[8px] gap-1"
                                            onClick={() => addUploadPageBlock(block.id, 'file_upload')}>
                                            <Upload className="h-2.5 w-2.5" /> File Upload
                                          </Button>
                                          <Button variant="outline" size="sm" className="h-5 px-2 text-[8px] gap-1"
                                            onClick={() => addUploadPageBlock(block.id, 'rich_text')}>
                                            <Type className="h-2.5 w-2.5" /> Instructions
                                          </Button>
                                        </div>
                                      </div>

                                      {(block.uploadPageBlocks || []).map((ub, ubIdx) => (
                                        <div key={ub.id} className="flex items-start gap-2 p-2 rounded border border-border bg-background/50">
                                          <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[8px] font-bold uppercase text-muted-foreground px-1 py-0.5 rounded bg-muted">
                                                {ub.type === 'file_upload' ? 'FILE' : 'TEXT'}
                                              </span>
                                              <Input
                                                className="h-5 text-[10px] bg-transparent border-border flex-1 py-0 px-1"
                                                value={ub.label}
                                                onChange={(e) => updateUploadPageBlock(block.id, ub.id, { label: e.target.value })}
                                                placeholder="Label..."
                                              />
                                              {ub.type === 'file_upload' && (
                                                <div className="flex items-center gap-1">
                                                  <Checkbox
                                                    id={`ubreq-${ub.id}`}
                                                    checked={ub.required}
                                                    className="h-3 w-3"
                                                    onCheckedChange={(checked) => updateUploadPageBlock(block.id, ub.id, { required: !!checked })}
                                                  />
                                                  <Label htmlFor={`ubreq-${ub.id}`} className="text-[8px] text-muted-foreground">Req</Label>
                                                </div>
                                              )}
                                            </div>
                                            {ub.type === 'file_upload' && (
                                              <div className="flex gap-1">
                                                <Input
                                                  className="h-5 text-[9px] bg-transparent border-border flex-1 py-0 px-1"
                                                  value={ub.acceptTypes || ''}
                                                  onChange={(e) => updateUploadPageBlock(block.id, ub.id, { acceptTypes: e.target.value })}
                                                  placeholder="Accept types (e.g. image/*, .pdf)"
                                                />
                                                <Input
                                                  className="h-5 text-[9px] bg-transparent border-border w-16 py-0 px-1"
                                                  type="number"
                                                  value={ub.maxSizeMB || ''}
                                                  onChange={(e) => updateUploadPageBlock(block.id, ub.id, { maxSizeMB: parseInt(e.target.value) || 10 })}
                                                  placeholder="MB"
                                                />
                                              </div>
                                            )}
                                            {ub.type === 'rich_text' && (
                                              <Textarea
                                                className="text-[9px] bg-transparent border-border min-h-[40px] py-1 px-1"
                                                value={ub.content || ''}
                                                onChange={(e) => updateUploadPageBlock(block.id, ub.id, { content: e.target.value })}
                                                placeholder="Instructions text..."
                                              />
                                            )}
                                          </div>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive" onClick={() => removeUploadPageBlock(block.id, ub.id)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}

                                      {(!block.uploadPageBlocks || block.uploadPageBlocks.length === 0) && (
                                        <p className="text-[10px] text-muted-foreground italic">No blocks added. Add file upload blocks to define what the upload page collects.</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Email Preview
                    </CardTitle>
                    <CardDescription className="text-xs">
                      This is how the email will look. Variable tags show as placeholders.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden bg-[#f3f4f6]">
                      <div
                        className="mx-auto"
                        dangerouslySetInnerHTML={{ __html: generatePreviewHtml() }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <Card className="lg:col-span-3 bg-muted/30">
            <CardContent className="p-12 text-center space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Using Default Email Template</h3>
              <p className="text-muted-foreground max-w-lg mx-auto">
                This course will use the standard booking summary email with all sections
                (training details, attendee info, payment, upload receipt link, etc.).
                Switch to "Custom Email" to customize what gets included.
              </p>
              <div className="mt-6 border rounded-lg overflow-hidden bg-[#f3f4f6] max-w-2xl mx-auto">
                <div
                  dangerouslySetInnerHTML={{ __html: generatePreviewHtml() }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
