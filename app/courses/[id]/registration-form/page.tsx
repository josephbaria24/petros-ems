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
import { CustomFormRenderer } from "@/components/custom-form-renderer"
import {
  ChevronLeft,
  Plus,
  GripVertical,
  Trash2,
  Save,
  Layout,
  User,
  Briefcase,
  Upload,
  CreditCard,
  Type,
  CheckSquare,
  CircleDot,
  FileText,
  Eye,
  Settings,
  Copy,
  Edit2,
  Download,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Palette
} from "lucide-react"

type FormComponentType =
  | 'personal_info'
  | 'employment_info'
  | 'id_upload'
  | 'payment_section'
  | 'course_information'
  | 'course_price'
  | 'custom_input'
  | 'custom_select'
  | 'custom_radio'
  | 'custom_file_upload'
  | 'downloadable_file'
  | 'rich_text'
  | 'page_break'

interface FormComponent {
  id: string
  type: FormComponentType
  label: string
  required: boolean
  options?: string[] // For select and radio
  placeholder?: string
  fields?: string[]
  methods?: string[]
  description?: string
  linkUrl?: string
  fileUrl?: string
  fileName?: string
  content?: string
}

interface Template {
  id: string
  name: string
  config: FormComponent[]
  created_at: string
}

const AVAILABLE_COMPONENTS: { type: FormComponentType; label: string; icon: any; description: string }[] = [
  { type: 'personal_info', label: 'Personal Info Block', icon: User, description: 'Collects name, email, phone, and address' },
  { type: 'employment_info', label: 'Employment Block', icon: Briefcase, description: 'Collects company, position, and industry' },
  { type: 'id_upload', label: 'ID Picture Upload', icon: Upload, description: 'Upload area for ID and 2x2 photo' },
  { type: 'course_information', label: 'Course Information Block', icon: CreditCard, description: 'Show selected course details (name, date, prices, etc.)' },
  { type: 'payment_section', label: 'Payment Section', icon: CreditCard, description: 'Displays course fees and payment methods' },
  { type: 'custom_input', label: 'Custom Text Input', icon: Type, description: 'A single text input field' },
  { type: 'custom_select', label: 'Custom Select', icon: Layout, description: 'A dropdown selection field' },
  { type: 'custom_radio', label: 'Custom Radio', icon: CircleDot, description: 'Radio button selection' },
  { type: 'custom_file_upload', label: 'Registrant File Upload', icon: Upload, description: 'Allow registrants to upload any file type' },
  { type: 'downloadable_file', label: 'Downloadable File', icon: Download, description: 'Upload a file registrants can download' },
  { type: 'rich_text', label: 'Instruction Text', icon: FileText, description: 'Formatted instruction block with rich text' },
  { type: 'page_break', label: 'Page Break', icon: FileText, description: 'Splits the form into multiple pages' },
]

export default function ManageRegistrationForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formType, setFormType] = useState<string>('default')
  const [config, setConfig] = useState<FormComponent[]>([])

  // Template states
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateName, setTemplateName] = useState("")
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  /** Editing a global saved template in the builder (not the same as course form only). */
  const [libraryTemplateBeingEdited, setLibraryTemplateBeingEdited] = useState<Template | null>(null)
  const [libraryTemplateDisplayName, setLibraryTemplateDisplayName] = useState("")
  const [builderSnapshotBeforeLibraryEdit, setBuilderSnapshotBeforeLibraryEdit] = useState<{
    formType: string
    config: FormComponent[]
  } | null>(null)
  const [isSavingLibraryTemplate, setIsSavingLibraryTemplate] = useState(false)
  /** Shown only after user explicitly applies a template, or once synced from saved course — not when saving a new template that happens to match. */
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const hasSyncedAppliedFromCourse = useRef(false)
  const downloadableFileInputRef = useRef<HTMLInputElement | null>(null)
  const currentDownloadableComponentId = useRef<string | null>(null)
  const [uploadingDownloadableId, setUploadingDownloadableId] = useState<string | null>(null)
  const [richTextDrafts, setRichTextDrafts] = useState<Record<string, string>>({})
  const richTextEditorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const richTextSelections = useRef<Record<string, Range | null>>({})
  const [floatingToolbar, setFloatingToolbar] = useState<{
    compId: string | null
    top: number
    left: number
    visible: boolean
  }>({ compId: null, top: 0, left: 0, visible: false })

  useEffect(() => {
    hasSyncedAppliedFromCourse.current = false
    setAppliedTemplateId(null)
    setLibraryTemplateBeingEdited(null)
    setBuilderSnapshotBeforeLibraryEdit(null)
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
        setFormType(data.registration_form_type || 'default')
        setConfig(data.registration_config || [])
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
      const response = await fetch("/api/registration-templates")
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
      const response = await fetch("/api/registration-templates", {
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

  const cloneComponents = (c: FormComponent[]) =>
    JSON.parse(JSON.stringify(c || [])) as FormComponent[]

  const openLibraryTemplateForEditing = (t: Template) => {
    if (libraryTemplateBeingEdited?.id === t.id) {
      setFormType("custom")
      return
    }
    if (
      formType === "custom" &&
      config.length > 0 &&
      JSON.stringify(config) !== JSON.stringify(t.config || [])
    ) {
      if (
        !confirm(
          "Replace the current builder with this template? Unsaved builder changes will be lost."
        )
      )
        return
    }
    setBuilderSnapshotBeforeLibraryEdit({ formType, config: cloneComponents(config) })
    setLibraryTemplateBeingEdited(t)
    setLibraryTemplateDisplayName(t.name)
    setFormType("custom")
    setConfig(cloneComponents(t.config || []))
    setAppliedTemplateId(null)
    setRichTextDrafts({})
    setFloatingToolbar({ compId: null, top: 0, left: 0, visible: false })
    toast.success(`Editing saved template “${t.name}”. Save template when you are done, or discard to undo.`)
  }

  const discardLibraryTemplateEdit = () => {
    if (!builderSnapshotBeforeLibraryEdit) {
      setLibraryTemplateBeingEdited(null)
      return
    }
    setFormType(builderSnapshotBeforeLibraryEdit.formType)
    setConfig(builderSnapshotBeforeLibraryEdit.config)
    setLibraryTemplateBeingEdited(null)
    setBuilderSnapshotBeforeLibraryEdit(null)
    setRichTextDrafts({})
    setFloatingToolbar({ compId: null, top: 0, left: 0, visible: false })
    toast.info("Closed template editor — builder restored.")
  }

  const saveLibraryTemplateEdits = async () => {
    if (!libraryTemplateBeingEdited || !libraryTemplateDisplayName.trim()) return
    setIsSavingLibraryTemplate(true)
    try {
      const response = await fetch("/api/registration-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: libraryTemplateBeingEdited.id,
          name: libraryTemplateDisplayName.trim(),
          config,
        }),
      })
      if (!response.ok) throw new Error("Failed to update template")
      toast.success("Saved template")
      setLibraryTemplateBeingEdited(null)
      setBuilderSnapshotBeforeLibraryEdit(null)
      await fetchTemplates()
    } catch (err) {
      toast.error("Failed to save template")
    } finally {
      setIsSavingLibraryTemplate(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      const response = await fetch(`/api/registration-templates?id=${templateId}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete")
      if (libraryTemplateBeingEdited?.id === templateId) {
        setLibraryTemplateBeingEdited(null)
        setBuilderSnapshotBeforeLibraryEdit(null)
      }
      toast.success("Template deleted")
      fetchTemplates()
    } catch (err) {
      toast.error("Failed to delete template")
    }
  }

  const handleFormTypeChange = (next: string) => {
    if (libraryTemplateBeingEdited) {
      if (
        !confirm(
          "Discard template editing and change base form type? Unsaved template changes will be lost."
        )
      )
        return
      setLibraryTemplateBeingEdited(null)
      setBuilderSnapshotBeforeLibraryEdit(null)
      setRichTextDrafts({})
      setFloatingToolbar({ compId: null, top: 0, left: 0, visible: false })
    }
    setFormType(next)
    if (next !== "custom" && course) {
      setConfig(cloneComponents(course?.registration_config || []))
    }
  }

  const applyTemplateAsCourseForm = async (template: Template): Promise<boolean> => {
    if (config.length > 0 && !confirm("This will replace your current form with this template. Continue?")) return false

    const nextConfig = cloneComponents(template.config || [])
    const prevState = {
      formType,
      config: cloneComponents(config),
      appliedTemplateId,
      richTextDrafts,
      floatingToolbar,
    }

    setLibraryTemplateBeingEdited(null)
    setBuilderSnapshotBeforeLibraryEdit(null)
    setConfig(nextConfig)
    setFormType("custom")
    setAppliedTemplateId(template.id)
    setRichTextDrafts({})
    setFloatingToolbar({ compId: null, top: 0, left: 0, visible: false })

    setSaving(true)
    try {
      const { error } = await tmsDb
        .from("courses")
        .update({
          registration_form_type: "custom",
          registration_config: nextConfig,
        })
        .eq("id", id)

      if (error) throw error

      setCourse((prev: any) =>
        prev
          ? { ...prev, registration_form_type: "custom", registration_config: nextConfig }
          : prev
      )

      toast.success(`Template selected for this course: ${template.name}`)
      return true
    } catch (err) {
      setConfig(prevState.config)
      setFormType(prevState.formType)
      setAppliedTemplateId(prevState.appliedTemplateId)
      setRichTextDrafts(prevState.richTextDrafts)
      setFloatingToolbar(prevState.floatingToolbar)
      toast.error("Failed to apply template to course")
      return false
    } finally {
      setSaving(false)
    }
  }

  /** One-time after load: if the course already uses custom config matching a saved template, show Applied (saving a new template does not steal this). */
  useEffect(() => {
    if (loading || hasSyncedAppliedFromCourse.current || !course || templates.length === 0) return
    hasSyncedAppliedFromCourse.current = true
    if (course.registration_form_type !== "custom") return
    const saved = course.registration_config || []
    const match = templates.find(
      (t) => JSON.stringify(t.config || []) === JSON.stringify(saved)
    )
    if (match) setAppliedTemplateId(match.id)
  }, [loading, course, templates])

  /** Clear “applied” badge if the live config no longer matches that template. */
  useEffect(() => {
    if (!appliedTemplateId) return
    const t = templates.find((x) => x.id === appliedTemplateId)
    if (!t) {
      setAppliedTemplateId(null)
      return
    }
    if (JSON.stringify(t.config || []) !== JSON.stringify(config || [])) {
      setAppliedTemplateId(null)
    }
  }, [config, templates, appliedTemplateId])

  const addOption = (compId: string) => {
    setConfig(config.map(c => {
      if (c.id === compId) {
        return { ...c, options: [...(c.options || []), `Option ${(c.options?.length || 0) + 1}`] }
      }
      return c
    }))
  }

  const removeOption = (compId: string, index: number) => {
    setConfig(config.map(c => {
      if (c.id === compId) {
        const newOptions = [...(c.options || [])]
        newOptions.splice(index, 1)
        return { ...c, options: newOptions }
      }
      return c
    }))
  }

  const updateOption = (compId: string, index: number, value: string) => {
    setConfig(config.map(c => {
      if (c.id === compId) {
        const newOptions = [...(c.options || [])]
        newOptions[index] = value
        return { ...c, options: newOptions }
      }
      return c
    }))
  }

  const togglePaymentMethod = (compId: string, method: string) => {
    setConfig(config.map(c => {
      if (c.id === compId) {
        const currentMethods = (c as any).methods || []
        const newMethods = currentMethods.includes(method)
          ? currentMethods.filter((m: string) => m !== method)
          : [...currentMethods, method]
        return { ...c, methods: newMethods }
      }
      return c
    }))
  }

  const toggleBlockField = (compId: string, field: string) => {
    setConfig(config.map(c => {
      if (c.id === compId) {
        const currentFields = (c as any).fields || ['first_name', 'last_name', 'email', 'phone']
        const newFields = currentFields.includes(field)
          ? currentFields.filter((f: string) => f !== field)
          : [...currentFields, field]
        return { ...c, fields: newFields }
      }
      return c
    }))
  }

  const toggleCourseInfoField = (compId: string, field: string) => {
    const defaults = ['course_name', 'schedule_date', 'price']
    setConfig(config.map(c => {
      if (c.id === compId) {
        const currentFields = (c as any).fields || defaults
        const newFields = currentFields.includes(field)
          ? currentFields.filter((f: string) => f !== field)
          : [...currentFields, field]
        return { ...c, fields: newFields }
      }
      return c
    }))
  }

  const triggerDownloadableFileUpload = (compId: string) => {
    currentDownloadableComponentId.current = compId
    downloadableFileInputRef.current?.click()
  }

  const handleDownloadableFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const compId = currentDownloadableComponentId.current

    if (!file || !compId) return

    setUploadingDownloadableId(compId)
    const toastId = toast.loading("Uploading downloadable file...")

    try {
      const data = new FormData()
      data.append("image", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: data,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      updateComponent(compId, {
        fileUrl: result.url,
        fileName: file.name,
      })

      toast.success("File uploaded successfully", { id: toastId })
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload file", { id: toastId })
    } finally {
      setUploadingDownloadableId(null)
      currentDownloadableComponentId.current = null
      if (downloadableFileInputRef.current) {
        downloadableFileInputRef.current.value = ""
      }
    }
  }

  const getRichTextValue = (comp: FormComponent) =>
    richTextDrafts[comp.id] ?? comp.content ?? ""

  const captureRichTextSelection = (compId: string) => {
    const editor = richTextEditorRefs.current[compId]
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) {
      richTextSelections.current[compId] = range.cloneRange()
    }
  }

  const restoreRichTextSelection = (compId: string) => {
    const savedRange = richTextSelections.current[compId]
    if (!savedRange) return

    const selection = window.getSelection()
    if (!selection) return

    selection.removeAllRanges()
    selection.addRange(savedRange)
  }

  const hideFloatingToolbar = () => {
    setFloatingToolbar({ compId: null, top: 0, left: 0, visible: false })
  }

  const handleRichTextSelectionChange = (compId: string) => {
    const editor = richTextEditorRefs.current[compId]
    const selection = window.getSelection()

    if (!editor || !selection || selection.rangeCount === 0) {
      hideFloatingToolbar()
      return
    }

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer) || range.collapsed) {
      hideFloatingToolbar()
      return
    }

    captureRichTextSelection(compId)

    const selectionRect = range.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const toolbarWidth = 280
    const rawLeft = selectionRect.left - editorRect.left + selectionRect.width / 2 - toolbarWidth / 2
    const clampedLeft = Math.max(8, Math.min(rawLeft, Math.max(8, editorRect.width - toolbarWidth - 8)))
    const top = Math.max(8, selectionRect.top - editorRect.top - 44)

    setFloatingToolbar({
      compId,
      top,
      left: clampedLeft,
      visible: true,
    })
  }

  const applyRichTextCommand = (
    compId: string,
    command: string,
    value?: string
  ) => {
    const editor = richTextEditorRefs.current[compId]
    if (!editor) return

    editor.focus()
    restoreRichTextSelection(compId)
    if (command === "foreColor") {
      document.execCommand("styleWithCSS", false, "true")
    }
    document.execCommand(command, false, value)
    const html = editor.innerHTML
    setRichTextDrafts((prev) => ({ ...prev, [compId]: html }))
    updateComponent(compId, { content: html })
  }

  const handleRichTextInput = (compId: string, html: string) => {
    setRichTextDrafts((prev) => ({ ...prev, [compId]: html }))
  }

  const handleRichTextBlur = (compId: string) => {
    const html = richTextEditorRefs.current[compId]?.innerHTML ?? richTextDrafts[compId] ?? ""
    updateComponent(compId, { content: html })
  }

  const addComponent = (type: FormComponentType) => {
    const newComponent: FormComponent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: AVAILABLE_COMPONENTS.find(c => c.type === type)?.label || 'New Component',
      required: !['downloadable_file', 'rich_text', 'page_break', 'course_information', 'course_price'].includes(type),
      options: ['Option 1', 'Option 2'],
      placeholder: '',
      fields: type === 'course_information' ? ['course_name', 'schedule_date', 'price'] : undefined,
      description: '',
      linkUrl: '',
      fileUrl: '',
      fileName: '',
      content: ''
    }
    setConfig([...config, newComponent])
  }

  const removeComponent = (compId: string) => {
    setConfig(config.filter(c => c.id !== compId))
  }

  const updateComponent = (compId: string, updates: Partial<FormComponent>) => {
    setConfig(config.map(c => c.id === compId ? { ...c, ...updates } : c))
  }

  const moveComponent = (index: number, direction: 'up' | 'down') => {
    const newConfig = [...config]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex >= 0 && targetIndex < newConfig.length) {
      const [moved] = newConfig.splice(index, 1)
      newConfig.splice(targetIndex, 0, moved)
      setConfig(newConfig)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await tmsDb
        .from("courses")
        .update({
          registration_form_type: formType,
          registration_config: config
        })
        .eq("id", id)

      if (error) throw error
      toast.success("Registration form updated successfully")
    } catch (err) {
      console.error("Error saving config:", err)
      toast.error("Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <style jsx global>{`
        .dark [data-rich-text-builder='true'],
        .dark [data-rich-text-builder='true'] *,
        [data-theme='dark'] [data-rich-text-builder='true'],
        [data-theme='dark'] [data-rich-text-builder='true'] * {
          color: #e5e7eb !important;
          -webkit-text-fill-color: #e5e7eb !important;
        }

        .dark [data-rich-text-builder='true'] [style*='color'],
        .dark [data-rich-text-builder='true'] [color],
        .dark [data-rich-text-builder='true'] font,
        [data-theme='dark'] [data-rich-text-builder='true'] [style*='color'],
        [data-theme='dark'] [data-rich-text-builder='true'] [color],
        [data-theme='dark'] [data-rich-text-builder='true'] font {
          color: #e5e7eb !important;
          -webkit-text-fill-color: #e5e7eb !important;
        }
      `}</style>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manage Registration Form</h1>
            <p className="text-muted-foreground">{course?.name}: {course?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {formType === 'custom' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Form Preview</DialogTitle>
                  <DialogDescription>This is how your custom registration form will look to students.</DialogDescription>
                </DialogHeader>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <CustomFormRenderer
                    config={config}
                    isSubmitting={false}
                    courseInformation={{
                      courseName: course?.name || "",
                      courseTitle: course?.title || "",
                      courseDescription: course?.description || "",
                      scheduleDate: "Preview schedule",
                      scheduleType: "Preview schedule type",
                      branch: "Preview branch",
                      price: course?.training_fee ?? null,
                      trainingFee: course?.training_fee ?? null,
                      onlineFee: course?.online_fee ?? null,
                      faceToFaceFee: course?.face_to_face_fee ?? null,
                      elearningFee: course?.elearning_fee ?? null,
                      hasPvcId: !!course?.has_pvc_id,
                      pvcIdType: course?.pvc_id_type || "",
                      pvcStudentPrice: course?.pvc_student_price ?? null,
                      pvcProfessionalPrice: course?.pvc_professional_price ?? null,
                    }}
                    onSave={(data) => console.log("Preview Save:", data)}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {libraryTemplateBeingEdited && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-sm font-semibold">Editing saved template</p>
              <Label htmlFor="library-template-name" className="text-xs text-muted-foreground">
                Template name
              </Label>
              <Input
                id="library-template-name"
                value={libraryTemplateDisplayName}
                onChange={(e) => setLibraryTemplateDisplayName(e.target.value)}
                className="max-w-md"
                placeholder="Template name"
              />
              <p className="text-xs text-muted-foreground">
                The custom builder below updates this saved template. Use Save template to write changes to the library, or Discard to restore what you had before opening the editor.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={discardLibraryTemplateEdit}>
                Discard
              </Button>
              <Button
                type="button"
                onClick={saveLibraryTemplateEdits}
                disabled={isSavingLibraryTemplate || !libraryTemplateDisplayName.trim()}
              >
                {isSavingLibraryTemplate ? "Saving…" : "Save template"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Step 1: Form Type Selection */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Base Form Type</CardTitle>
            <CardDescription>Select a standard template or build a custom one</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={formType} onValueChange={handleFormTypeChange} className="space-y-4">
              {['default', 'ivt', 'bls', 'acls', 'custom'].map((t) => (
                <div
                  key={t}
                  className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer hover:bg-muted/50 ${
                    formType === t ? "border-primary/60 bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value={t} id={t} />
                  <Label htmlFor={t} className="flex-1 cursor-pointer">
                    <span className="font-semibold block capitalize">{t} Registration</span>
                    <span className="text-xs text-muted-foreground">
                      {t === 'custom' ? 'Build your own form from components' : `Standard ${t.toUpperCase()} form`}
                    </span>
                  </Label>
                  {formType === t && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground">
                      Selected
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
                        className="flex-1 text-left min-w-0 rounded-md outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setPreviewTemplate(t)}
                        title="Preview template"
                      >
                        <p className="text-sm font-medium leading-tight">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">{t.config.length} components · click to preview</p>
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {appliedTemplateId === t.id && formType === "custom" ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground whitespace-nowrap">
                            Applied
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={async () => {
                              await applyTemplateAsCourseForm(t)
                            }}
                            disabled={saving}
                          >
                            {saving ? "Selecting..." : "Select"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openLibraryTemplateForEditing(t)}
                          title="Edit template in builder"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteTemplate(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Custom Builder Area */}
        {formType === 'custom' && (
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Custom Form Builder</h3>
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
                      <DialogDescription>Enter a name to save this form structure for future use across other courses.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input
                          placeholder="e.g. Standard Clinical Form"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={handleSaveTemplate} disabled={isSavingTemplate || !templateName}>
                        {isSavingTemplate ? "Saving..." : "Save Template"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COMPONENTS.map((item) => (
                <Button
                  key={item.type}
                  variant="outline"
                  size="sm"
                  className="h-9 flex items-center justify-start gap-2 px-3 text-[11px] font-semibold hover:bg-primary/5 hover:border-primary/50 transition-all shadow-sm"
                  onClick={() => addComponent(item.type)}
                >
                  <item.icon className="h-3.5 w-3.5 text-primary" />
                  {item.label}
                  <Plus className="h-3 w-3 ml-auto opacity-30" />
                </Button>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Form Structure</h3>
              {config.length === 0 && (
                <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
                  Your form is empty. Click components above to add them.
                </div>
              )}
              {config.map((comp, index) => {
                const getComponentStyle = (type: FormComponentType) => {
                  switch (type) {
                    case 'personal_info':
                    case 'employment_info':
                      return "bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900"
                    case 'id_upload':
                      return "bg-purple-50/40 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900"
                    case 'payment_section':
                      return "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                    case 'course_information':
                    case 'course_price':
                      return "bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                    case 'downloadable_file':
                      return "bg-cyan-50/40 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-900"
                    case 'rich_text':
                      return "bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800"
                    case 'page_break':
                      return "bg-orange-100 border-orange-300 py-1"
                    default:
                      return "bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800"
                  }
                }

                if (comp.type === 'page_break') {
                  return (
                    <div key={comp.id} className="relative flex items-center justify-center py-2 group">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t-2 border-dashed border-orange-300"></div>
                      </div>
                      <div className="relative flex items-center gap-2 bg-orange-100 px-4 py-1 rounded-full border border-orange-300 shadow-sm">
                        <FileText className="h-3 w-3 text-orange-600" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700">Page Break</span>
                        <div className="flex gap-1 ml-2 border-l border-orange-300 pl-2">
                          <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-orange-200" onClick={() => moveComponent(index, 'up')} disabled={index === 0}>
                            <ChevronLeft className="h-3 w-3 rotate-90" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-orange-200" onClick={() => moveComponent(index, 'down')} disabled={index === config.length - 1}>
                            <ChevronLeft className="h-3 w-3 -rotate-90" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-orange-700 hover:text-destructive hover:bg-orange-200" onClick={() => removeComponent(comp.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <Card key={comp.id} className={`relative active:ring-2 ring-primary/50 shadow-sm transition-all duration-200 hover:shadow-md ${getComponentStyle(comp.type)}`}>
                    <CardContent className="p-2 flex items-center gap-3">
                      {/* Drag & Reorder - Ultra Compact */}
                      <div className="flex flex-col gap-0 items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors pr-1">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveComponent(index, 'up')} disabled={index === 0}>
                          <ChevronLeft className="h-3 w-3 rotate-90" />
                        </Button>
                        <GripVertical className="h-3 w-3" />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveComponent(index, 'down')} disabled={index === config.length - 1}>
                          <ChevronLeft className="h-3 w-3 -rotate-90" />
                        </Button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4">
                          {/* Type Indicator */}
                          <div className="flex items-center gap-1.5 min-w-[120px]">
                            {(() => {
                              const Icon = AVAILABLE_COMPONENTS.find(c => c.type === comp.type)?.icon || Type
                              return <Icon className="h-3.5 w-3.5 text-primary" />
                            })()}
                            <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground truncate opacity-70">
                              {comp.type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Main Label - Inlined */}
                          <div className="flex-1 flex items-center gap-3">
                            <Input
                              className="h-7 text-xs bg-background border-border hover:border-muted-foreground/30 focus:bg-background transition-all py-1 px-2"
                              value={comp.label}
                              onChange={(e) => updateComponent(comp.id, { label: e.target.value })}
                              placeholder="Component Title..."
                            />

                            {!['downloadable_file', 'rich_text', 'course_information', 'course_price'].includes(comp.type) && (
                              <div className="flex items-center gap-2 px-2 border-l border-border whitespace-nowrap">
                                <Checkbox
                                  id={`req-${comp.id}`}
                                  checked={comp.required}
                                  className="h-3.5 w-3.5"
                                  onCheckedChange={(checked) => updateComponent(comp.id, { required: !!checked })}
                                />
                                <Label htmlFor={`req-${comp.id}`} className="text-[10px] font-medium cursor-pointer select-none text-muted-foreground">Required</Label>
                              </div>
                            )}
                          </div>

                          {/* Quick Delete */}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={() => removeComponent(comp.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Secondary Config - Only if needed */}
                        {['custom_input', 'custom_select', 'custom_radio', 'custom_file_upload'].includes(comp.type) && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1">
                            {comp.type === 'custom_input' && (
                              <Input
                                className="h-6 text-[10px] bg-background border-border hover:border-muted-foreground/30 focus:bg-background transition-all py-0 px-2 flex-1"
                                value={comp.placeholder}
                                onChange={(e) => updateComponent(comp.id, { placeholder: e.target.value })}
                                placeholder="Add placeholder text..."
                              />
                            )}
                            {(comp.type === 'custom_select' || comp.type === 'custom_radio') && (
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Options</p>
                                {comp.options?.map((opt, i) => (
                                  <div key={i} className="flex gap-1 items-center">
                                    <Input
                                      className="h-6 text-[10px] bg-background border-border hover:border-muted-foreground/30 focus:bg-background transition-all py-0 px-2 flex-1"
                                      value={opt}
                                      onChange={(e) => updateOption(comp.id, i, e.target.value)}
                                      placeholder={`Option ${i + 1}`}
                                    />
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive" onClick={() => removeOption(comp.id, i)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[9px] gap-1 hover:bg-primary/5 text-primary"
                                  onClick={() => addOption(comp.id)}
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Option
                                </Button>
                              </div>
                            )}
                            {comp.type === 'custom_file_upload' && (
                              <Input
                                className="h-6 text-[10px] bg-background border-border hover:border-muted-foreground/30 focus:bg-background transition-all py-0 px-2 flex-1"
                                value={comp.placeholder}
                                onChange={(e) => updateComponent(comp.id, { placeholder: e.target.value })}
                                placeholder="Optional upload help text..."
                              />
                            )}
                          </div>
                        )}

                        {comp.type === 'payment_section' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Active Payment Methods</p>
                            <div className="flex flex-wrap gap-4 mt-1">
                              {[
                                { id: 'BPI', label: 'Bank (BPI)', icon: '/bpi.svg' },
                                { id: 'GCASH', label: 'GCash', icon: '/gcash.jpeg' },
                                { id: 'COUNTER', label: 'Over the Counter', icon: '/otc.svg' }
                              ].map(pm => (
                                <div key={pm.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${comp.id}-${pm.id}`}
                                    checked={((comp as any).methods || []).includes(pm.id)}
                                    onCheckedChange={() => togglePaymentMethod(comp.id, pm.id)}
                                  />
                                  <Label htmlFor={`${comp.id}-${pm.id}`} className="flex items-center gap-2 text-[10px] cursor-pointer">
                                    <img src={pm.icon} alt={pm.label} className="w-5 h-5 rounded-sm object-contain" />
                                    {pm.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(comp.type === 'course_information' || comp.type === 'course_price') && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Show Course Information</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 mt-1">
                              {[
                                { id: 'course_name', label: 'Course Name' },
                                { id: 'course_title', label: 'Course Title' },
                                { id: 'course_description', label: 'Course Description' },
                                { id: 'schedule_date', label: 'Schedule Date' },
                                { id: 'schedule_type', label: 'Schedule Type' },
                                { id: 'branch', label: 'Branch' },
                                { id: 'event_type', label: 'Event Type' },
                                { id: 'price', label: 'Price (Current)' },
                                { id: 'training_fee', label: 'Training Fee' },
                                { id: 'online_fee', label: 'Online Fee' },
                                { id: 'face_to_face_fee', label: 'Face-to-Face Fee' },
                                { id: 'elearning_fee', label: 'E-learning Fee' },
                                { id: 'has_pvc_id', label: 'Has PVC ID' },
                                { id: 'pvc_id_type', label: 'PVC ID Type' },
                                { id: 'pvc_student_price', label: 'PVC Student Price' },
                                { id: 'pvc_professional_price', label: 'PVC Professional Price' },
                              ].map(field => (
                                <div key={field.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${comp.id}-${field.id}`}
                                    checked={((comp as any).fields || ['course_name', 'schedule_date', 'price']).includes(field.id)}
                                    onCheckedChange={() => toggleCourseInfoField(comp.id, field.id)}
                                  />
                                  <Label htmlFor={`${comp.id}-${field.id}`} className="text-[10px] cursor-pointer text-muted-foreground">{field.label}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {comp.type === 'personal_info' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Included Fields</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 mt-1">
                              {[
                                { id: 'first_name', label: 'First Name' },
                                { id: 'last_name', label: 'Last Name' },
                                { id: 'email', label: 'Email' },
                                { id: 'phone', label: 'Phone' },
                                { id: 'address', label: 'Address' },
                                { id: 'gender', label: 'Gender' },
                                { id: 'dob', label: 'Date of Birth' },
                                { id: 'nationality', label: 'Nationality' },
                                { id: 'religion', label: 'Religion' },
                                { id: 'civil_status', label: 'Civil Status' }
                              ].map(field => (
                                <div key={field.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${comp.id}-${field.id}`}
                                    checked={((comp as any).fields || ['first_name', 'last_name', 'email', 'phone']).includes(field.id)}
                                    onCheckedChange={() => toggleBlockField(comp.id, field.id)}
                                  />
                                  <Label htmlFor={`${comp.id}-${field.id}`} className="text-[10px] cursor-pointer text-muted-foreground">{field.label}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {comp.type === 'employment_info' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Included Fields</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 mt-1">
                              {[
                                { id: 'company', label: 'Company Name' },
                                { id: 'position', label: 'Position' },
                                { id: 'industry', label: 'Industry' },
                                { id: 'company_address', label: 'Company Address' },
                                { id: 'years_experience', label: 'Experience (Years)' }
                              ].map(field => (
                                <div key={field.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${comp.id}-${field.id}`}
                                    checked={((comp as any).fields || ['company', 'position', 'industry']).includes(field.id)}
                                    onCheckedChange={() => toggleBlockField(comp.id, field.id)}
                                  />
                                  <Label htmlFor={`${comp.id}-${field.id}`} className="text-[10px] cursor-pointer text-muted-foreground">{field.label}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {comp.type === 'id_upload' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Required Uploads</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 mt-1">
                              {[
                                { id: 'govt_id', label: 'Government ID' },
                                { id: 'photo', label: '2x2 Picture' },
                                { id: 'prc_license', label: 'PRC License' },
                                { id: 'signature', label: 'E-Signature' }
                              ].map(field => (
                                <div key={field.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${comp.id}-${field.id}`}
                                    checked={((comp as any).fields || ['govt_id', 'photo']).includes(field.id)}
                                    onCheckedChange={() => toggleBlockField(comp.id, field.id)}
                                  />
                                  <Label htmlFor={`${comp.id}-${field.id}`} className="text-[10px] cursor-pointer text-muted-foreground">{field.label}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {comp.type === 'downloadable_file' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <Input
                              className="h-6 text-[10px] bg-background border-border hover:border-muted-foreground/30 focus:bg-background transition-all py-0 px-2"
                              value={comp.description || ""}
                              onChange={(e) => updateComponent(comp.id, { description: e.target.value })}
                              placeholder="Optional description/instructions for this file..."
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[9px] gap-1"
                                onClick={() => triggerDownloadableFileUpload(comp.id)}
                                disabled={uploadingDownloadableId === comp.id}
                              >
                                {uploadingDownloadableId === comp.id ? "Uploading..." : comp.fileUrl ? "Replace File" : "Upload File"}
                              </Button>
                              {comp.fileUrl && (
                                <a
                                  href={comp.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary underline truncate max-w-[280px]"
                                >
                                  {comp.fileName || "View uploaded file"}
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {comp.type === 'rich_text' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-border pt-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "bold")} title="Bold">
                                <Bold className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "italic")} title="Italic">
                                <Italic className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "insertUnorderedList")} title="Bullet List">
                                <List className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "insertOrderedList")} title="Numbered List">
                                <ListOrdered className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "h1")} title="Heading 1">
                                <Heading1 className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "h2")} title="Heading 2">
                                <Heading2 className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "h3")} title="Heading 3">
                                <Heading3 className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "p")} title="Paragraph">
                                <Heading className="h-3 w-3" />
                              </Button>
                              <select
                                className="h-6 text-[10px] rounded-md border border-border bg-background px-2 text-foreground"
                                onChange={(e) => applyRichTextCommand(comp.id, "fontSize", e.target.value)}
                                defaultValue=""
                              >
                                <option value="" disabled>Font size</option>
                                <option value="2">Small</option>
                                <option value="3">Normal</option>
                                <option value="4">Large</option>
                                <option value="5">X-Large</option>
                              </select>
                              <label className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-border bg-background text-[10px] text-muted-foreground">
                                <Palette className="h-3 w-3" />
                                <span>Text Color</span>
                                <input
                                  type="color"
                                  className="h-4 w-4 border-0 bg-transparent p-0 cursor-pointer"
                                  defaultValue="#111827"
                                  onMouseDown={() => captureRichTextSelection(comp.id)}
                                  onChange={(e) => applyRichTextCommand(comp.id, "foreColor", e.target.value)}
                                  title="Set text color"
                                />
                              </label>
                            </div>
                            <div className="relative">
                              {floatingToolbar.visible && floatingToolbar.compId === comp.id && (
                                <div
                                  className="absolute z-20 flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/95 shadow-md p-1"
                                  style={{ top: floatingToolbar.top, left: floatingToolbar.left, width: 280 }}
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "bold")} title="Bold">
                                    <Bold className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "italic")} title="Italic">
                                    <Italic className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "insertUnorderedList")} title="Bullet List">
                                    <List className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "insertOrderedList")} title="Numbered List">
                                    <ListOrdered className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "h1")} title="Heading 1">
                                    <Heading1 className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "h2")} title="Heading 2">
                                    <Heading2 className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "h3")} title="Heading 3">
                                    <Heading3 className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => applyRichTextCommand(comp.id, "formatBlock", "p")} title="Paragraph">
                                    <Heading className="h-3 w-3" />
                                  </Button>
                                  <select
                                    className="h-6 text-[10px] rounded-md border border-border bg-background px-2 text-foreground"
                                    onChange={(e) => applyRichTextCommand(comp.id, "fontSize", e.target.value)}
                                    defaultValue=""
                                  >
                                    <option value="" disabled>Size</option>
                                    <option value="2">S</option>
                                    <option value="3">M</option>
                                    <option value="4">L</option>
                                    <option value="5">XL</option>
                                  </select>
                                  <label className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-border bg-background text-[10px] text-muted-foreground">
                                    <Palette className="h-3 w-3" />
                                    <input
                                      type="color"
                                      className="h-4 w-4 border-0 bg-transparent p-0 cursor-pointer"
                                      defaultValue="#111827"
                                      onMouseDown={() => captureRichTextSelection(comp.id)}
                                      onChange={(e) => applyRichTextCommand(comp.id, "foreColor", e.target.value)}
                                      title="Set text color"
                                    />
                                  </label>
                                </div>
                              )}
                              <div
                                id={`rich-text-editor-${comp.id}`}
                                data-rich-text-builder="true"
                                ref={(el) => {
                                  richTextEditorRefs.current[comp.id] = el
                                  if (el) {
                                    const currentValue = getRichTextValue(comp)
                                    if (el.innerHTML !== currentValue) {
                                      el.innerHTML = currentValue
                                    }
                                  }
                                }}
                                contentEditable
                                suppressContentEditableWarning
                                className="min-h-[120px] rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                onInput={(e) => handleRichTextInput(comp.id, (e.currentTarget as HTMLDivElement).innerHTML)}
                                onMouseUp={() => handleRichTextSelectionChange(comp.id)}
                                onKeyUp={() => handleRichTextSelectionChange(comp.id)}
                                onBlur={() => {
                                  handleRichTextBlur(comp.id)
                                  setTimeout(() => hideFloatingToolbar(), 0)
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {formType !== 'custom' && (
          <Card className="md:col-span-2 bg-muted/30">
            <CardContent className="p-12 text-center space-y-4">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Using Standard Form: {formType.toUpperCase()}</h3>
              <p className="text-muted-foreground">
                This course will use the pre-built {formType} registration form.
                Any customizations done in the builder will be ignored unless you switch to "Custom Builder".
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null) }}>
        <DialogContent className="lg:w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Review this saved template. Close when done, or use Select as course form to apply it to this course.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted/30 rounded-lg max-h-[60vh] overflow-y-auto">
            {previewTemplate && (
              <CustomFormRenderer
                config={previewTemplate.config}
                isSubmitting={false}
                onSave={() => {}}
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!previewTemplate) return
                const ok = await applyTemplateAsCourseForm(previewTemplate)
                if (ok) setPreviewTemplate(null)
              }}
              disabled={saving}
            >
              {saving ? "Selecting..." : "Select as course form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        type="file"
        ref={downloadableFileInputRef}
        className="hidden"
        onChange={handleDownloadableFileUpload}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
      />
    </div>
  )
}
