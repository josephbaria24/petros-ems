//components\certificate-template-modal.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Upload, X, Plus, Minus, Trash2, Save, Eye, Loader2, Award, CalendarCheck, Trophy,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Maximize, Minimize,
  ArrowLeftRight, ArrowUpDown, Copy, FlipHorizontal, CircleHelp, Undo2, Redo2
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { tmsDb, supabase } from "@/lib/supabase-client"
import React from "react"
import { toast } from "sonner"
import { ImageCropDialog } from "@/components/image-crop-dialog"
import {
  PlaceholderChipEditor,
  formatPlaceholderPreview,
} from "@/components/placeholder-chip-editor"
import {
  getFallbackCanvasDimensions,
  loadImageDimensions,
  type CanvasDimensions,
} from "@/lib/template-canvas-dimensions"

function toPercentX(px: number, canvasW: number) {
  return px / canvasW
}

function toPercentY(px: number, canvasH: number) {
  return px / canvasH
}

function toPercentFont(size: number, canvasH: number) {
  return size / canvasH
}

interface TextField {
  id: string
  label: string
  value: string
  x: number
  y: number
  fontSize: number
  // Used for the {{trainee_picture}} placeholder box sizing (in px, editor-space)
  boxWidth?: number
  boxHeight?: number
  fontWeight: "normal" | "bold" | "extrabold"
  fontStyle: "normal" | "italic"
  fontFamily: "Helvetica" | "Times" | "Montserrat" | "Poppins"
  color: string
  align: "left" | "center" | "right"
  lineHeight?: number
}

interface PlaceholderOption {
  value: string
  label: string
  description: string
}

interface CertificateTemplateModalProps {
  courseId: string
  courseName: string
  open: boolean
  onClose: () => void
}

type TemplateType = "participation" | "completion" | "excellence"

const PLACEHOLDER_OPTIONS: PlaceholderOption[] = [
  { value: "{{trainee_name}}", label: "Trainee Name", description: "Full name of the trainee" },
  { value: "{{course_name}}", label: "Course Name", description: "Name of the course" },
  { value: "{{course_title}}", label: "Course Title", description: "Title of the course" },
  { value: "{{completion_date}}", label: "Completion Date", description: "Date of completion" },
  { value: "{{certificate_number}}", label: "Certificate Number", description: "Unique certificate ID" },
  { value: "{{batch_number}}", label: "Batch Number", description: "Training batch number" },
  { value: "{{training_provider}}", label: "Training Provider", description: "Provider organization" },
  { value: "{{trainee_picture}}", label: "Trainee Picture", description: "2x2 picture of the trainee" },
  { value: "{{held_on}}", label: "Held On", description: "Training date range (from schedules table)" },
  { value: "{{given_this}}", label: "Given This", description: "Today's date" },
]

const TEMPLATE_TYPES: { value: TemplateType; label: string; icon: any; description: string }[] = [
  { value: "participation", label: "Participation", icon: Award, description: "Certificate for course participants" },
  { value: "completion", label: "Completion", icon: CalendarCheck, description: "Certificate for course completion" },
  { value: "excellence", label: "ID Card", icon: Trophy, description: "ID card format (3.375\" × 2.125\")" }
]

const DEFAULT_FIELDS: Record<TemplateType, TextField[]> = {
  participation: [
    {
      id: "name",
      label: "Trainee Name",
      value: "{{trainee_name}}",
      x: 421,
      y: 335,
      fontSize: 36,
      fontWeight: "bold",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#2C3E50",
      align: "center"
    },
    {
      id: "course",
      label: "Course Name",
      value: "{{course_name}}",
      x: 421,
      y: 275,
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#34495E",
      align: "center"
    },
    {
      id: "cert_num",
      label: "Certificate Number",
      value: "Certificate No. {{certificate_number}}",
      x: 421,
      y: 400,
      fontSize: 12,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#7F8C8D",
      align: "center"
    }
  ],
  completion: [
    {
      id: "name",
      label: "Trainee Name",
      value: "{{trainee_name}}",
      x: 421,
      y: 335,
      fontSize: 36,
      fontWeight: "bold",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#27AE60",
      align: "center"
    },
    {
      id: "course",
      label: "Course Name",
      value: "has successfully completed {{course_name}}",
      x: 421,
      y: 275,
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#34495E",
      align: "center"
    },
    {
      id: "date",
      label: "Completion Date",
      value: "on {{completion_date}}",
      x: 421,
      y: 245,
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#34495E",
      align: "center"
    }
  ],
  excellence: [
    {
      id: "name",
      label: "Trainee Name",
      value: "{{trainee_name}}",
      x: 810,
      y: 300,
      fontSize: 28,
      fontWeight: "bold",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#000000",
      align: "left"
    },
    {
      id: "cert_num",
      label: "Certificate Number",
      value: "{{certificate_number}}",
      x: 810,
      y: 350,
      fontSize: 16,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#34495E",
      align: "left"
    },
    {
      id: "course",
      label: "Course Name",
      value: "{{course_name}}",
      x: 810,
      y: 390,
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#555555",
      align: "left"
    },
    {
      id: "valid",
      label: "Valid Until",
      value: "Valid Until: {{completion_date}}",
      x: 810,
      y: 430,
      fontSize: 12,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#666666",
      align: "left"
    }
  ]
}

// Helper function to get font string for canvas
function getFontString(field: TextField): string {
  let fontStr = ""
  
  // Font style (italic)
  if (field.fontStyle === "italic") {
    fontStr += "italic "
  }
  
  // Font weight
  if (field.fontWeight === "bold") {
    fontStr += "bold "
  } else if (field.fontWeight === "extrabold") {
    fontStr += "900 "
  }
  
  // Font size
  fontStr += `${field.fontSize}px `
  
  // Font family
  fontStr += field.fontFamily
  
  return fontStr
}

export default function CertificateTemplateModal({ courseId, courseName, open, onClose }: CertificateTemplateModalProps) {
  const [currentTemplateType, setCurrentTemplateType] = useState<TemplateType>("participation")
  const [templateImage, setTemplateImage] = useState<Record<TemplateType, string | null>>({
    participation: null,
    completion: null,
    excellence: null
  })
  const [templateFile, setTemplateFile] = useState<Record<TemplateType, File | null>>({
    participation: null,
    completion: null,
    excellence: null
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  // ✅ Front/Back ID Card state
  const [idCardSide, setIdCardSide] = useState<"front" | "back">("front")
  const [backTemplateImage, setBackTemplateImage] = useState<string | null>(null)
  const [backTemplateFile, setBackTemplateFile] = useState<File | null>(null)
  const [backTextFields, setBackTextFields] = useState<TextField[]>([])
  const [canvasZoom, setCanvasZoom] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const lastAutoFitKeyRef = useRef<string>("")
  const [showTemplateCropDialog, setShowTemplateCropDialog] = useState(false)
  const [pendingCropTarget, setPendingCropTarget] = useState<"front" | "back">("front")
  const [existingTemplateCropUrl, setExistingTemplateCropUrl] = useState<string | undefined>(undefined)
  const [templateCanvasDimensions, setTemplateCanvasDimensions] = useState<
    Record<TemplateType, CanvasDimensions | null>
  >({
    participation: null,
    completion: null,
    excellence: null,
  })
  const [backCanvasDimensions, setBackCanvasDimensions] = useState<CanvasDimensions | null>(null)
  
  const [textFields, setTextFields] = useState<Record<TemplateType, TextField[]>>({
    participation: DEFAULT_FIELDS.participation,
    completion: DEFAULT_FIELDS.completion,
    excellence: DEFAULT_FIELDS.excellence
  })
  const textFieldsRef = useRef(textFields)
  const backTextFieldsRef = useRef(backTextFields)
  textFieldsRef.current = textFields
  backTextFieldsRef.current = backTextFields

  type FieldsSnapshot = {
    textFields: Record<TemplateType, TextField[]>
    backTextFields: TextField[]
  }
  const undoStackRef = useRef<FieldsSnapshot[]>([])
  const redoStackRef = useRef<FieldsSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const cloneFieldsSnapshot = (): FieldsSnapshot => ({
    textFields: JSON.parse(JSON.stringify(textFieldsRef.current)),
    backTextFields: JSON.parse(JSON.stringify(backTextFieldsRef.current)),
  })

  const syncHistoryButtons = () => {
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(redoStackRef.current.length > 0)
  }

  const clearFieldHistory = () => {
    undoStackRef.current = []
    redoStackRef.current = []
    syncHistoryButtons()
  }

  /** Call before a user edit so Ctrl+Z can restore prior field layout. */
  const pushFieldHistory = () => {
    undoStackRef.current.push(cloneFieldsSnapshot())
    if (undoStackRef.current.length > 60) undoStackRef.current.shift()
    redoStackRef.current = []
    syncHistoryButtons()
  }

  const undoFields = () => {
    if (undoStackRef.current.length === 0) return
    redoStackRef.current.push(cloneFieldsSnapshot())
    const prev = undoStackRef.current.pop()!
    setTextFields(prev.textFields)
    setBackTextFields(prev.backTextFields)
    syncHistoryButtons()
  }

  const redoFields = () => {
    if (redoStackRef.current.length === 0) return
    undoStackRef.current.push(cloneFieldsSnapshot())
    const next = redoStackRef.current.pop()!
    setTextFields(next.textFields)
    setBackTextFields(next.backTextFields)
    syncHistoryButtons()
  }

  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [canvasCursor, setCanvasCursor] = useState("default")
  const dragSessionRef = useRef<{
    fieldId: string
    offsetX: number
    offsetY: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const [isResizingPhoto, setIsResizingPhoto] = useState(false)
  const [resizeInfo, setResizeInfo] = useState<{
    fieldId: string | null
    startX: number
    startY: number
    startW: number
    startH: number
    startFieldX: number
    startFieldY: number
    handle: "corner" | "right" | "bottom" | "left" | "top"
  }>({
    fieldId: null,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    startFieldX: 0,
    startFieldY: 0,
    handle: "corner",
  })
  const [showPlaceholderMenu, setShowPlaceholderMenu] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [activeTab, setActiveTab] = useState<"fields" | "edit">("fields")
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false)
  const [coursesWithTemplates, setCoursesWithTemplates] = useState<{ id: string, name: string }[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)

  const fetchCoursesWithTemplates = async () => {
    setLoadingCourses(true)
    try {
      // Find courses that have templates for the current template type
      const { data: templates, error } = await supabase
        .from('certificate_templates')
        .select('course_id')
        .eq('template_type', currentTemplateType)
      
      if (error) throw error
      
      if (!templates || templates.length === 0) {
        setCoursesWithTemplates([])
        return
      }

      const uniqueCourseIds = Array.from(new Set(templates.map(t => t.course_id))).filter(id => id !== courseId)
      
      if (uniqueCourseIds.length === 0) {
        setCoursesWithTemplates([])
        return
      }

      // Fetch the actual course names
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name')
        .in('id', uniqueCourseIds)
      
      if (coursesError) throw coursesError
      
      setCoursesWithTemplates(courses || [])
    } catch (error) {
      console.error("Error fetching courses with templates:", error)
      toast.error("Failed to load courses with templates.")
    } finally {
      setLoadingCourses(false)
    }
  }

  const copyLayoutFrom = async (sourceCourseId: string) => {
    try {
      const response = await fetch(`/api/certificate-template?courseId=${sourceCourseId}&templateType=${currentTemplateType}`)
      if (response.ok) {
        const data = await response.json()
        if (data.template && data.template.fields) {
          const isID = currentTemplateType === "excellence"
          const canvasDims =
            templateCanvasDimensions[currentTemplateType] ?? getFallbackCanvasDimensions(isID)
          const canvasW = canvasDims.width
          const canvasH = canvasDims.height
          
          const restoredFields = (data.template.fields as TextField[]).map(
            (f: TextField): TextField => ({
              ...f,
              x: f.x * canvasW,
              y: f.y * canvasH,
              fontSize: f.fontSize * canvasH,
              boxWidth: typeof f.boxWidth === "number" ? f.boxWidth * canvasW : undefined,
              boxHeight: typeof f.boxHeight === "number" ? f.boxHeight * canvasH : undefined,
              fontWeight: f.fontWeight || "normal",
              fontStyle: f.fontStyle || "normal",
              fontFamily: f.fontFamily || "Helvetica"
            })
          );
          
          pushFieldHistory()
          setTextFields(prev => ({ ...prev, [currentTemplateType]: restoredFields }))
          setIsCopyDialogOpen(false)
          toast.success("Layout copied successfully!")
        }
      }
    } catch (error) {
      console.error("Error copying layout:", error)
      toast.error("Failed to copy layout.")
    }
  }

  const handleFitToScreen = () => {
    const canvas = canvasRef.current
    const viewport = canvasViewportRef.current
    if (!canvas || !viewport || !canvas.width || !canvas.height) return

    const padding = 16
    const availableW = Math.max(80, viewport.clientWidth - padding)
    const availableH = Math.max(80, viewport.clientHeight - padding)

    const scaleX = availableW / canvas.width
    const scaleY = availableH / canvas.height
    const fitScale = Math.min(scaleX, scaleY)

    // Allow very small scales so large templates still fit; cap upper end for usability
    setCanvasZoom(Number(Math.max(0.05, Math.min(fitScale, 2.5)).toFixed(3)))
  }

  const scheduleFitToScreen = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        handleFitToScreen()
      })
    })
  }

  const handleDeleteTemplate = async () => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const response = await fetch(
        `/api/certificate-template?courseId=${courseId}&templateType=${currentTemplateType}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        alert("🗑️ Template deleted successfully!");
        setTemplateImage(prev => ({ ...prev, [currentTemplateType]: null }));
        setTextFields(prev => ({ ...prev, [currentTemplateType]: DEFAULT_FIELDS[currentTemplateType] }));
        setSelectedField(null);
      } else {
        alert("❌ Failed to delete template");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("❌ Error deleting template.");
    }
  };

  useEffect(() => {
    if (open && courseId) {
      loadAllTemplates()
      clearFieldHistory()
    }
    if (!open) {
      lastAutoFitKeyRef.current = ""
      clearFieldHistory()
    }
  }, [open, courseId])

  const loadAllTemplates = async () => {
    for (const type of TEMPLATE_TYPES) {
      try {
        const response = await fetch(`/api/certificate-template?courseId=${courseId}&templateType=${type.value}`)
        if (response.ok) {
          const data = await response.json()
          if (data.template && data.template.fields) {
            const isID = type.value === "excellence"
            let canvasW: number
            let canvasH: number

            if (data.template.image_url) {
              try {
                const dims = await loadImageDimensions(data.template.image_url)
                canvasW = dims.width
                canvasH = dims.height
                setTemplateCanvasDimensions((prev) => ({
                  ...prev,
                  [type.value]: dims,
                }))
              } catch {
                const fallback = getFallbackCanvasDimensions(isID)
                canvasW = fallback.width
                canvasH = fallback.height
              }
            } else {
              const fallback = getFallbackCanvasDimensions(isID)
              canvasW = fallback.width
              canvasH = fallback.height
            }
            
            const restoredFields = (data.template.fields as TextField[]).map(
              (f: TextField): TextField => ({
                ...f,
                x: f.x * canvasW,
                y: f.y * canvasH,
                fontSize: f.fontSize * canvasH,
                boxWidth: typeof f.boxWidth === "number" ? f.boxWidth * canvasW : undefined,
                boxHeight: typeof f.boxHeight === "number" ? f.boxHeight * canvasH : undefined,
                fontWeight: f.fontWeight || "normal",
                fontStyle: f.fontStyle || "normal",
                fontFamily: f.fontFamily || "Helvetica"
              })
            );

            setTemplateImage(prev => ({ ...prev, [type.value]: data.template.image_url }));
            setTextFields(prev => ({ ...prev, [type.value]: restoredFields }));

            if (isID) {
              setBackTemplateImage(data.template.back_image_url || null)
              let backDims = getFallbackCanvasDimensions(true)
              if (data.template.back_image_url) {
                try {
                  backDims = await loadImageDimensions(data.template.back_image_url)
                  setBackCanvasDimensions(backDims)
                } catch {
                  setBackCanvasDimensions(getFallbackCanvasDimensions(true))
                }
              } else {
                setBackCanvasDimensions(null)
              }
              if (data.template.back_fields) {
                const restoredBack = (data.template.back_fields as TextField[]).map(
                  (f: TextField): TextField => ({
                    ...f,
                    x: f.x * backDims.width,
                    y: f.y * backDims.height,
                    fontSize: f.fontSize * backDims.height,
                    boxWidth: typeof f.boxWidth === "number" ? f.boxWidth * backDims.width : undefined,
                    boxHeight: typeof f.boxHeight === "number" ? f.boxHeight * backDims.height : undefined,
                    fontWeight: f.fontWeight || "normal",
                    fontStyle: f.fontStyle || "normal",
                    fontFamily: f.fontFamily || "Helvetica"
                  })
                )
                setBackTextFields(restoredBack)
              } else {
                setBackTextFields([])
              }
            }
          } else {
            setTemplateImage(prev => ({ ...prev, [type.value]: null }));
            setTextFields(prev => ({ ...prev, [type.value]: DEFAULT_FIELDS[type.value] }));
          }
        }
      } catch (error) {
        console.error(`Error loading ${type.value} template:`, error)
      }
    }
  }

  const uploadImageToStorage = async (file: File, templateType: TemplateType): Promise<string | null> => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${courseId}-${templateType}-${Date.now()}.${fileExt}`
      const filePath = `certificate-templates/${fileName}`

      const { data, error } = await supabase.storage
        .from('trainee-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('trainee-photos')
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("❌ Failed to upload image")
      return null
    } finally {
      setUploading(false)
    }
  }

  const scaleFieldsToCanvas = (
    fields: TextField[],
    from: CanvasDimensions,
    to: CanvasDimensions,
  ): TextField[] => {
    if (
      !from.width ||
      !from.height ||
      !to.width ||
      !to.height ||
      (from.width === to.width && from.height === to.height)
    ) {
      return fields
    }
    const sx = to.width / from.width
    const sy = to.height / from.height
    return fields.map((f) => ({
      ...f,
      x: f.x * sx,
      y: f.y * sy,
      fontSize: f.fontSize * sy,
      boxWidth: typeof f.boxWidth === "number" ? f.boxWidth * sx : undefined,
      boxHeight: typeof f.boxHeight === "number" ? f.boxHeight * sy : undefined,
    }))
  }

  const applyCroppedTemplateImage = async (file: File, previewDataUrl: string) => {
    const isID = currentTemplateType === "excellence"
    let dims: CanvasDimensions
    try {
      dims = await loadImageDimensions(previewDataUrl)
    } catch {
      dims = getFallbackCanvasDimensions(isID)
    }

    // Keep text/photo layout in the same relative places when the new image size differs
    if (pendingCropTarget === "back") {
      const prevDims =
        backCanvasDimensions ??
        (canvasRef.current?.width
          ? { width: canvasRef.current.width, height: canvasRef.current.height }
          : getFallbackCanvasDimensions(true))
      pushFieldHistory()
      setBackTextFields((prev) => scaleFieldsToCanvas(prev, prevDims, dims))
      setBackTemplateImage(previewDataUrl)
      setBackTemplateFile(file)
      setBackCanvasDimensions(dims)
    } else {
      const prevDims =
        templateCanvasDimensions[currentTemplateType] ??
        (canvasRef.current?.width
          ? { width: canvasRef.current.width, height: canvasRef.current.height }
          : getFallbackCanvasDimensions(isID))
      pushFieldHistory()
      setTextFields((prev) => ({
        ...prev,
        [currentTemplateType]: scaleFieldsToCanvas(prev[currentTemplateType], prevDims, dims),
      }))
      setTemplateImage((prev) => ({ ...prev, [currentTemplateType]: previewDataUrl }))
      setTemplateFile((prev) => ({ ...prev, [currentTemplateType]: file }))
      setTemplateCanvasDimensions((prev) => ({ ...prev, [currentTemplateType]: dims }))
    }
  }

  const openTemplateCrop = (target: "front" | "back", useExisting = false) => {
    setPendingCropTarget(target)
    if (useExisting) {
      const existing =
        target === "back" ? backTemplateImage : templateImage[currentTemplateType]
      setExistingTemplateCropUrl(existing || undefined)
    } else {
      setExistingTemplateCropUrl(undefined)
    }
    setShowTemplateCropDialog(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Replaced by ImageCropDialog; keep for fallback compatibility.
    const file = e.target.files?.[0]
    if (!file) return
    const target =
      currentTemplateType === "excellence" && idCardSide === "back" ? "back" : "front"
    setPendingCropTarget(target)
    setExistingTemplateCropUrl(undefined)
    setShowTemplateCropDialog(true)
    e.target.value = ""
  }

  // Computed: get the active image/fields based on front/back side
  const isEditingBack = currentTemplateType === "excellence" && idCardSide === "back"
  const activeImage = isEditingBack ? backTemplateImage : templateImage[currentTemplateType]
  const activeFields = isEditingBack ? backTextFields : textFields[currentTemplateType]

useEffect(() => {
  if (!canvasRef.current || !activeImage) return

  const canvas = canvasRef.current
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    const isIDTemplate = currentTemplateType === "excellence"
    const canvasW = img.naturalWidth || img.width
    const canvasH = img.naturalHeight || img.height

    if (isEditingBack) {
      setBackCanvasDimensions({ width: canvasW, height: canvasH })
    } else {
      setTemplateCanvasDimensions((prev) => ({
        ...prev,
        [currentTemplateType]: { width: canvasW, height: canvasH },
      }))
    }

    canvas.width = canvasW
    canvas.height = canvasH
    
    ctx.drawImage(img, 0, 0, canvasW, canvasH)

    const fitKey = `${activeImage}:${canvasW}x${canvasH}:${isEditingBack ? "back" : "front"}`
    if (lastAutoFitKeyRef.current !== fitKey) {
      lastAutoFitKeyRef.current = fitKey
      scheduleFitToScreen()
    }

    // Draw all fields (text + special photo box)
    activeFields.forEach((field) => {
      const isPhotoField = field.value.includes("{{trainee_picture}}")

      // Special handling for trainee photo placeholder: draw movable box instead of text
      if (isPhotoField) {
        const defaultPhotoSize = isIDTemplate ? 240 : 0.12 * canvas.height
        const photoW = field.boxWidth ?? field.fontSize ?? defaultPhotoSize
        const photoH = field.boxHeight ?? field.fontSize ?? defaultPhotoSize
        const photoX = field.x
        const photoY = field.y

        ctx.setLineDash([6, 4])
        ctx.strokeStyle = "#22c55e"
        ctx.lineWidth = 2
        ctx.strokeRect(photoX, photoY, photoW, photoH)
        ctx.setLineDash([])

        if (selectedField === field.id && !previewMode) {
          ctx.strokeStyle = "#0ea5e9"
          ctx.lineWidth = 2
          ctx.strokeRect(photoX - 4, photoY - 4, photoW + 8, photoH + 8)

          // Visible resize handles
          const hs = 8
          const handles = [
            [photoX + photoW - hs / 2, photoY + photoH - hs / 2],
            [photoX + photoW - hs / 2, photoY + photoH / 2 - hs / 2],
            [photoX + photoW / 2 - hs / 2, photoY + photoH - hs / 2],
            [photoX - hs / 2, photoY + photoH / 2 - hs / 2],
            [photoX + photoW / 2 - hs / 2, photoY - hs / 2],
          ]
          ctx.fillStyle = "#ffffff"
          ctx.strokeStyle = "#0ea5e9"
          handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx, hy, hs, hs)
            ctx.strokeRect(hx, hy, hs, hs)
          })
        }

        // Do not render any text for the picture placeholder
        return
      }

      ctx.font = getFontString(field)
      ctx.fillStyle = field.color

      let displayText = field.value
      if (previewMode) {
        displayText = displayText
          .replace(/\{\{trainee_name\}\}/g, "Dr. Juan Dela Cruz Jr.")
          .replace(/\{\{course_name\}\}/g, courseName)
          .replace(/\{\{course_title\}\}/g, "Basic Occupational Safety and Health (BOSH) for Safety Officer 1")
          .replace(/\{\{completion_date\}\}/g, "November 22, 2025")
          .replace(/\{\{certificate_number\}\}/g, "PSI-BOSHSO1-001521")
          .replace(/\{\{batch_number\}\}/g, "Batch 42")
          .replace(/\{\{training_provider\}\}/g, "Petrosphere Inc.")
          .replace(/\{\{held_on\}\}/g, "January 10\u201312, 2025")
          .replace(/\{\{given_this\}\}/g, "January 15, 2025")
          .replace(/\{\{schedule_range\}\}/g, "January 10\u201312, 2025")
      }

      // Split text by newlines
      const lines = displayText.split('\n')
      const lineHeight = (field.lineHeight || 1.2) * field.fontSize
      let currentY = field.y

      // Set textAlign BEFORE drawing each line
      if (field.align === "center") {
        ctx.textAlign = "center"
      } else if (field.align === "right") {
        ctx.textAlign = "right"
      } else {
        ctx.textAlign = "left"
      }

      lines.forEach((line) => {
        ctx.fillText(line, field.x, currentY)
        currentY += lineHeight
      })

      // Selection box calculation
      if (selectedField === field.id && !previewMode) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        
        const originalAlign = ctx.textAlign
        ctx.textAlign = "left"
        
        const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
        const totalHeight = lines.length * lineHeight
        
        ctx.textAlign = originalAlign
        
        let boxX = field.x
        if (field.align === "center") {
          boxX = field.x - maxWidth / 2
        } else if (field.align === "right") {
          boxX = field.x - maxWidth
        }

        ctx.strokeRect(boxX - 5, field.y - field.fontSize, maxWidth + 10, totalHeight + 5)
      }
    })
  }
  img.src = activeImage!
}, [activeImage, activeFields, selectedField, previewMode, currentTemplateType, courseName, idCardSide])

const DRAG_THRESHOLD_PX = 4

const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    canvas,
  }
}

const getFieldBounds = (
  field: TextField,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) => {
  const isPhotoField = field.value.includes("{{trainee_picture}}")
  if (isPhotoField) {
    const isIDTemplate = currentTemplateType === "excellence"
    const defaultPhotoSize = isIDTemplate ? 240 : 0.12 * canvas.height
    const photoW = field.boxWidth ?? field.fontSize ?? defaultPhotoSize
    const photoH = field.boxHeight ?? field.fontSize ?? defaultPhotoSize
    return {
      isPhotoField: true as const,
      boxX: field.x,
      boxY: field.y,
      boxWidth: photoW,
      boxHeight: photoH,
      pad: 8,
    }
  }

  ctx.font = getFontString(field)
  ctx.textAlign = "left"
  const lines = field.value.split("\n")
  const maxWidth = Math.max(24, ...lines.map((line) => ctx.measureText(line).width))
  const lineHeight = (field.lineHeight || 1.2) * field.fontSize
  const totalHeight = Math.max(field.fontSize, lines.length * lineHeight)
  let boxX = field.x
  if (field.align === "center") boxX = field.x - maxWidth / 2
  else if (field.align === "right") boxX = field.x - maxWidth
  return {
    isPhotoField: false as const,
    boxX,
    boxY: field.y - field.fontSize,
    boxWidth: maxWidth,
    boxHeight: totalHeight + 5,
    pad: 10,
  }
}

const pointInBounds = (
  x: number,
  y: number,
  b: { boxX: number; boxY: number; boxWidth: number; boxHeight: number; pad: number },
) =>
  x >= b.boxX - b.pad &&
  x <= b.boxX + b.boxWidth + b.pad &&
  y >= b.boxY - b.pad &&
  y <= b.boxY + b.boxHeight + b.pad

const findFieldAtPoint = (x: number, y: number, canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  for (let i = activeFields.length - 1; i >= 0; i--) {
    const field = activeFields[i]
    const bounds = getFieldBounds(field, canvas, ctx)
    if (pointInBounds(x, y, bounds)) {
      return { field, bounds }
    }
  }
  return null
}

const findResizeHandleAtPoint = (x: number, y: number, canvas: HTMLCanvasElement) => {
  const isIDTemplate = currentTemplateType === "excellence"
  const sidePad = 8
  const handleSize = 12

  for (let i = activeFields.length - 1; i >= 0; i--) {
    const field = activeFields[i]
    if (!field.value.includes("{{trainee_picture}}")) continue
    const defaultPhotoSize = isIDTemplate ? 240 : 0.12 * canvas.height
    const photoW = field.boxWidth ?? field.fontSize ?? defaultPhotoSize
    const photoH = field.boxHeight ?? field.fontSize ?? defaultPhotoSize
    const boxX = field.x
    const boxY = field.y

    const cornerXStart = boxX + photoW - handleSize
    const cornerYStart = boxY + photoH - handleSize
    if (
      x >= cornerXStart &&
      x <= boxX + photoW + handleSize &&
      y >= cornerYStart &&
      y <= boxY + photoH + handleSize
    ) {
      return { field, handle: "corner" as const, photoW, photoH, cursor: "nwse-resize" }
    }

    const rightHit =
      x >= boxX + photoW - sidePad &&
      x <= boxX + photoW + sidePad &&
      y >= boxY &&
      y <= boxY + photoH
    if (rightHit) return { field, handle: "right" as const, photoW, photoH, cursor: "ew-resize" }

    const bottomHit =
      y >= boxY + photoH - sidePad &&
      y <= boxY + photoH + sidePad &&
      x >= boxX &&
      x <= boxX + photoW
    if (bottomHit) return { field, handle: "bottom" as const, photoW, photoH, cursor: "ns-resize" }

    const leftHit =
      x >= boxX - sidePad &&
      x <= boxX + sidePad &&
      y >= boxY &&
      y <= boxY + photoH
    if (leftHit) return { field, handle: "left" as const, photoW, photoH, cursor: "ew-resize" }

    const topHit =
      y >= boxY - sidePad &&
      y <= boxY + sidePad &&
      x >= boxX &&
      x <= boxX + photoW
    if (topHit) return { field, handle: "top" as const, photoW, photoH, cursor: "ns-resize" }
  }
  return null
}

const patchActiveFields = (updater: (fields: TextField[]) => TextField[]) => {
  if (isEditingBack) {
    setBackTextFields((prev) => updater(prev))
  } else {
    setTextFields((prev) => ({
      ...prev,
      [currentTemplateType]: updater(prev[currentTemplateType]),
    }))
  }
}

const endCanvasInteraction = () => {
  dragSessionRef.current = null
  setIsDragging(false)
  setIsResizingPhoto(false)
  setResizeInfo((prev) => ({ ...prev, fieldId: null }))
}

const handleCanvasClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
  // Selection handled on mousedown so blank clicks never teleport fields
}

const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (previewMode) return
  e.preventDefault()
  const pt = getCanvasPoint(e)
  if (!pt) return
  const { x, y, canvas } = pt

  const resizeHit = findResizeHandleAtPoint(x, y, canvas)
  if (resizeHit) {
    pushFieldHistory()
    setSelectedField(resizeHit.field.id)
    setIsResizingPhoto(true)
    setIsDragging(false)
    dragSessionRef.current = null
    setResizeInfo({
      fieldId: resizeHit.field.id,
      startX: x,
      startY: y,
      startW: resizeHit.photoW,
      startH: resizeHit.photoH,
      startFieldX: resizeHit.field.x,
      startFieldY: resizeHit.field.y,
      handle: resizeHit.handle,
    })
    setCanvasCursor(resizeHit.cursor)
    return
  }

  const hit = findFieldAtPoint(x, y, canvas)
  if (hit) {
    pushFieldHistory()
    setSelectedField(hit.field.id)
    setDragOffset({ x: x - hit.field.x, y: y - hit.field.y })
    dragSessionRef.current = {
      fieldId: hit.field.id,
      offsetX: x - hit.field.x,
      offsetY: y - hit.field.y,
      startX: x,
      startY: y,
      moved: false,
    }
    setIsDragging(false)
    setCanvasCursor("grabbing")
    return
  }

  // Blank space: deselect only — never teleport the last field
  setSelectedField(null)
  endCanvasInteraction()
  setCanvasCursor("default")
}

const handleCanvasMouseUp = () => {
  const session = dragSessionRef.current
  // Click-to-select without drag should not leave an empty undo step
  if (session && !session.moved) {
    undoStackRef.current.pop()
    syncHistoryButtons()
  }
  endCanvasInteraction()
}

const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (previewMode) return
  const pt = getCanvasPoint(e)
  if (!pt) return
  const hit = findFieldAtPoint(pt.x, pt.y, pt.canvas)
  if (!hit || hit.bounds.isPhotoField) return
  setSelectedField(hit.field.id)
  setEditingField(hit.field.id)
  setEditingValue(hit.field.value)
  setActiveTab("edit")
}

const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (previewMode) return
  const pt = getCanvasPoint(e)
  if (!pt) return
  const { x, y, canvas } = pt

  if (isResizingPhoto && resizeInfo.fieldId) {
    patchActiveFields((currentFields) => {
      const target = currentFields.find((f) => f.id === resizeInfo.fieldId)
      if (!target) return currentFields

      const isIDTemplate = currentTemplateType === "excellence"
      const minSize = isIDTemplate ? 80 : 30
      const dx = x - resizeInfo.startX
      const dy = y - resizeInfo.startY

      let nextX = resizeInfo.startFieldX
      let nextY = resizeInfo.startFieldY
      let nextW = resizeInfo.startW
      let nextH = resizeInfo.startH

      if (resizeInfo.handle === "corner") {
        const delta = Math.max(dx, dy)
        const s = Math.max(minSize, Math.min(resizeInfo.startW + delta, resizeInfo.startH + delta))
        nextW = s
        nextH = s
      } else if (resizeInfo.handle === "right") {
        nextW = Math.max(minSize, resizeInfo.startW + dx)
      } else if (resizeInfo.handle === "bottom") {
        nextH = Math.max(minSize, resizeInfo.startH + dy)
      } else if (resizeInfo.handle === "left") {
        const w = Math.max(minSize, resizeInfo.startW - dx)
        nextX = resizeInfo.startFieldX + (resizeInfo.startW - w)
        nextW = w
      } else if (resizeInfo.handle === "top") {
        const h = Math.max(minSize, resizeInfo.startH - dy)
        nextY = resizeInfo.startFieldY + (resizeInfo.startH - h)
        nextH = h
      }

      return currentFields.map((field) =>
        field.id === resizeInfo.fieldId
          ? {
              ...field,
              x: nextX,
              y: nextY,
              boxWidth: nextW,
              boxHeight: nextH,
              fontSize: Math.min(nextW, nextH),
            }
          : field,
      )
    })
    return
  }

  const session = dragSessionRef.current
  if (session) {
    const dist = Math.hypot(x - session.startX, y - session.startY)
    if (!session.moved && dist < DRAG_THRESHOLD_PX) {
      setCanvasCursor("grabbing")
      return
    }
    if (!session.moved) {
      session.moved = true
      setIsDragging(true)
    }
    patchActiveFields((fields) =>
      fields.map((field) =>
        field.id === session.fieldId
          ? { ...field, x: x - session.offsetX, y: y - session.offsetY }
          : field,
      ),
    )
    setCanvasCursor("grabbing")
    return
  }

  if (e.buttons === 0) {
    const resizeHit = findResizeHandleAtPoint(x, y, canvas)
    if (resizeHit) {
      setCanvasCursor(resizeHit.cursor)
      return
    }
    const hit = findFieldAtPoint(x, y, canvas)
    setCanvasCursor(hit ? "grab" : "default")
  }
}

useEffect(() => {
  if (!open) return

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.altKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault()
      undoFields()
      return
    }
    if (mod && !e.altKey && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault()
      redoFields()
      return
    }

    if (previewMode || !selectedField || editingField) return

    const step = e.shiftKey ? 10 : 1
    let dx = 0
    let dy = 0
    if (e.key === "ArrowLeft") dx = -step
    else if (e.key === "ArrowRight") dx = step
    else if (e.key === "ArrowUp") dy = -step
    else if (e.key === "ArrowDown") dy = step
    else if (e.key === "Escape") {
      setSelectedField(null)
      return
    } else return

    e.preventDefault()
    pushFieldHistory()
    if (isEditingBack) {
      setBackTextFields((fields) =>
        fields.map((field) =>
          field.id === selectedField ? { ...field, x: field.x + dx, y: field.y + dy } : field,
        ),
      )
    } else {
      setTextFields((prev) => ({
        ...prev,
        [currentTemplateType]: prev[currentTemplateType].map((field) =>
          field.id === selectedField ? { ...field, x: field.x + dx, y: field.y + dy } : field,
        ),
      }))
    }
  }

  window.addEventListener("keydown", onKeyDown)
  return () => window.removeEventListener("keydown", onKeyDown)
}, [open, previewMode, selectedField, editingField, currentTemplateType, idCardSide, isEditingBack])

  // Helper: set fields for either front or back
  const setActiveFieldsSetter = (updater: (fields: TextField[]) => TextField[]) => {
    pushFieldHistory()
    if (isEditingBack) {
      setBackTextFields(prev => updater(prev))
    } else {
      setTextFields(prev => ({
        ...prev,
        [currentTemplateType]: updater(prev[currentTemplateType])
      }))
    }
  }

  const addTextField = () => {
    const isIDTemplate = currentTemplateType === "excellence"
    const defaultX = isIDTemplate ? 810 : 421
    const defaultY = isIDTemplate ? 500 : 300
    
    const newField: TextField = {
      id: `field_${Date.now()}`,
      label: "New Field",
      value: "Sample Text",
      x: defaultX,
      y: defaultY,
      fontSize: 16,
      boxWidth: undefined,
      boxHeight: undefined,
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#000000",
      align: isIDTemplate ? "left" : "center"
    }
    setActiveFieldsSetter(fields => [...fields, newField])
    setSelectedField(newField.id)
  }

  const updateField = (updates: Partial<TextField>) => {
    if (!selectedField) return
    setActiveFieldsSetter(fields =>
      fields.map(field =>
        field.id === selectedField ? { ...field, ...updates } : field
      )
    )
  }

  const deleteField = (id: string) => {
    setActiveFieldsSetter(fields => fields.filter(field => field.id !== id))
    if (selectedField === id) {
      setSelectedField(null)
    }
  }

  const insertPlaceholder = (placeholder: string) => {
    if (!selectedField) return
    setActiveFieldsSetter(fields =>
      fields.map(field =>
        field.id === selectedField 
          ? { ...field, value: field.value + (field.value ? " " : "") + placeholder }
          : field
      )
    )
    setShowPlaceholderMenu(false)
  }

const handleSave = async () => {
  if (!templateImage[currentTemplateType]) {
    toast.error("Please upload a template image first.");
    return;
  }

  setSaving(true);

  try {
    let imageUrl = templateImage[currentTemplateType]!;

    if (imageUrl.startsWith("data:") || templateFile[currentTemplateType]) {
      const uploadedUrl = await uploadImageToStorage(templateFile[currentTemplateType]!, currentTemplateType);

      if (!uploadedUrl) {
        toast.error("❌ Failed to upload image.");
        setSaving(false);
        return;
      }

      imageUrl = uploadedUrl;
      setTemplateFile(prev => ({ ...prev, [currentTemplateType]: null }));
      setTemplateImage(prev => ({ ...prev, [currentTemplateType]: imageUrl }));
    }

    const isID = currentTemplateType === "excellence";
    const canvasDims =
      templateCanvasDimensions[currentTemplateType] ?? getFallbackCanvasDimensions(isID);
    const backDims = backCanvasDimensions ?? getFallbackCanvasDimensions(true);

    let finalBackImageUrl = backTemplateImage;
    if (isID && (finalBackImageUrl?.startsWith("data:") || backTemplateFile)) {
      if (!backTemplateFile) {
        toast.error("Please provide the file for the back template image.");
        setSaving(false);
        return;
      }
      const uploadedBackUrl = await uploadImageToStorage(backTemplateFile, `${currentTemplateType}_back` as TemplateType);
      
      if (!uploadedBackUrl) {
        toast.error("❌ Failed to upload back image.");
        setSaving(false);
        return;
      }

      finalBackImageUrl = uploadedBackUrl;
      setBackTemplateFile(null);
      setBackTemplateImage(finalBackImageUrl);
    }

    const response = await fetch("/api/certificate-template", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    courseId,
    imageUrl: imageUrl,
    fields: textFields[currentTemplateType].map((f) => ({
      ...f,
      x: toPercentX(f.x, canvasDims.width),
      y: toPercentY(f.y, canvasDims.height),
      fontSize: toPercentFont(f.fontSize, canvasDims.height),
      boxWidth: typeof f.boxWidth === "number" ? toPercentX(f.boxWidth, canvasDims.width) : undefined,
      boxHeight: typeof f.boxHeight === "number" ? toPercentY(f.boxHeight, canvasDims.height) : undefined,
    })),
    backImageUrl: finalBackImageUrl,
    backFields: backTextFields.map((f) => ({
      ...f,
      x: toPercentX(f.x, backDims.width),
      y: toPercentY(f.y, backDims.height),
      fontSize: toPercentFont(f.fontSize, backDims.height),
      boxWidth: typeof f.boxWidth === "number" ? toPercentX(f.boxWidth, backDims.width) : undefined,
      boxHeight: typeof f.boxHeight === "number" ? toPercentY(f.boxHeight, backDims.height) : undefined,
    })),
    templateType: currentTemplateType,
  }),
})



if (!response.ok) {
  const err = await response.json().catch(async () => ({ error: await response.text() }))
  console.log("API save error:", err)
  toast.error(err.details || err.error || "Failed to save template.")
  return
}

toast.success("Template saved successfully!")


    if (response.ok) {
      toast.success(`${TEMPLATE_TYPES.find(t => t.value === currentTemplateType)?.label} template saved successfully!`);
    } else {
      toast.error("Failed to save template.");
    }
  } catch (error) {
    console.error("Error saving template:", error);
    toast.error("Failed to save template.");
  } finally {
    setSaving(false);
  }
};


  const handleSaveAll = async () => {
    setSaving(true)
    let successCount = 0
    let errorCount = 0

    for (const type of TEMPLATE_TYPES) {
      if (!templateImage[type.value]) continue

      try {
        let imageUrl = templateImage[type.value]!

        if (templateFile[type.value]) {
          const uploadedUrl = await uploadImageToStorage(templateFile[type.value]!, type.value)
          if (!uploadedUrl) {
            errorCount++
            continue
          }
          imageUrl = uploadedUrl
        }

        const isID = type.value === "excellence"
        const canvasDims =
          templateCanvasDimensions[type.value] ?? getFallbackCanvasDimensions(isID)
        const backDims = backCanvasDimensions ?? getFallbackCanvasDimensions(true)
        let finalBackImageUrl = backTemplateImage

        if (isID && backTemplateFile) {
          const uploadedBackUrl = await uploadImageToStorage(backTemplateFile, `${type.value}_back` as TemplateType)
          if (!uploadedBackUrl) {
            errorCount++
            continue
          }
          finalBackImageUrl = uploadedBackUrl
        }

        const response = await fetch("/api/certificate-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            imageUrl: imageUrl,
            fields: textFields[type.value].map((f: TextField): TextField => ({
              ...f,
              x: toPercentX(f.x, canvasDims.width),
              y: toPercentY(f.y, canvasDims.height),
              fontSize: toPercentFont(f.fontSize, canvasDims.height),
              boxWidth: typeof f.boxWidth === "number" ? toPercentX(f.boxWidth, canvasDims.width) : undefined,
              boxHeight: typeof f.boxHeight === "number" ? toPercentY(f.boxHeight, canvasDims.height) : undefined,
            })),
            ...(isID ? {
              backImageUrl: finalBackImageUrl,
              backFields: backTextFields.map((f: TextField): TextField => ({
                ...f,
                x: toPercentX(f.x, backDims.width),
                y: toPercentY(f.y, backDims.height),
                fontSize: toPercentFont(f.fontSize, backDims.height),
                boxWidth: typeof f.boxWidth === "number" ? toPercentX(f.boxWidth, backDims.width) : undefined,
                boxHeight: typeof f.boxHeight === "number" ? toPercentY(f.boxHeight, backDims.height) : undefined,
              })),
            } : {}),
            templateType: type.value
          })
        })

        if (response.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        console.error(`Error saving ${type.value} template:`, error)
        errorCount++
      }
    }

    setSaving(false)
    
    if (errorCount === 0) {
      alert(`✅ All ${successCount} template(s) saved successfully!`)
      onClose()
    } else {
      alert(`⚠️ Saved ${successCount} template(s), ${errorCount} failed`)
    }
  }

  const currentField = activeFields.find((f) => f.id === selectedField)
  const currentTemplateInfo = TEMPLATE_TYPES.find(t => t.value === currentTemplateType)!

  // UI COMPONENT STARTS HERE - See next message for complete JSX
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="lg:w-[70vw] sm:w-[70vw] max-h-[95vh] overflow-y-auto">

<DialogHeader>
  <DialogTitle>Certificate Template Editor - {courseName}</DialogTitle>
  <DialogDescription>
    Upload and customize certificate templates for this course
  </DialogDescription>
</DialogHeader>

<div className="flex gap-2 p-4 bg-muted rounded-lg">
  {TEMPLATE_TYPES.map((type) => {
    const Icon = type.icon
    const hasTemplate = !!templateImage[type.value]
    
    return (
      <Button
        key={type.value}
        variant={currentTemplateType === type.value ? "default" : "outline"}
        className="flex-1 flex flex-col h-auto py-3"
        onClick={() => {
          setCurrentTemplateType(type.value)
          setSelectedField(null)
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4" />
          {type.label}
          {hasTemplate && <span className="text-xs">✓</span>}
        </div>
        <span className="text-xs opacity-70 font-normal">{type.description}</span>
      </Button>
    )
  })}
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2 space-y-4">
    <div className="flex justify-between items-center">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          {React.createElement(currentTemplateInfo.icon, { className: "h-4 w-4" })}
          {currentTemplateInfo.label} Template
        </h3>
        <p className="text-xs text-muted-foreground">{currentTemplateInfo.description}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Drag fields to move · click empty area to deselect · arrow keys nudge (Shift = 10px) · Ctrl+Z / Ctrl+Y undo/redo · double-click text to edit
        </p>
      </div>
      <div className="flex gap-2 items-center flex-wrap justify-end">
        <div className="flex items-center gap-1 mr-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCanvasZoom((z) => Math.max(0.05, Number((z - 0.1).toFixed(2))))}
          >
            -
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setCanvasZoom(1)}
          >
            {Math.round(canvasZoom * 100)}%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCanvasZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
          >
            +
          </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canUndo}
              onClick={undoFields}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canRedo}
              onClick={redoFields}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-[10px]"
                  onClick={handleFitToScreen}
                >
                  Fit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to Screen (default on load)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        {currentTemplateType === "excellence" && (
          <div className="flex items-center bg-muted p-0.5 rounded-md">
            <Button
              variant={idCardSide === "front" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setIdCardSide("front")}
            >
              Front
            </Button>
            <Button
              variant={idCardSide === "back" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setIdCardSide("back")}
            >
              Back
            </Button>
          </div>
        )}

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        <Button
          variant={previewMode ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setPreviewMode(!previewMode)}
        >
          <Eye className="h-4 w-4 mr-2" />
          {previewMode ? "Edit Mode" : "Preview"}
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8"
                onClick={() => {
                  fetchCoursesWithTemplates();
                  setIsCopyDialogOpen(true);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Layout
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Copy field positions from another course
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button 
          variant="outline" 
          size="sm" 
          className="h-8"
          onClick={() =>
            openTemplateCrop(
              currentTemplateType === "excellence" && idCardSide === "back" ? "back" : "front",
              false
            )
          }
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Crop
            </>
          )}
        </Button>
        {activeImage && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8"
            onClick={() =>
              openTemplateCrop(
                currentTemplateType === "excellence" && idCardSide === "back" ? "back" : "front",
                true
              )
            }
          >
            Recrop Image
          </Button>
        )}
      </div>
    </div>
    
    {/* Specialized controls for Trainee Picture */}
    {selectedField && activeFields.find(f => f.id === selectedField)?.value.includes("{{trainee_picture}}") && (
      <div className="flex items-center gap-1.5 p-1.5 bg-primary/5 border border-primary/20 rounded-lg mb-2 w-fit shadow-sm animate-in fade-in slide-in-from-top-1">
        <div className="flex items-center gap-1 px-2 border-r border-primary/10">
          <Maximize className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Trainee Photo Controller</span>
        </div>
        
        <div className="flex items-center gap-1 bg-background/50 rounded-md p-1 border shadow-inner">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => updateField({ y: (currentField?.y || 0) - 1 })}>
                  <ChevronUp className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Up (1px)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => updateField({ y: (currentField?.y || 0) + 1 })}>
                  <ChevronDown className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Down (1px)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => updateField({ x: (currentField?.x || 0) - 1 })}>
                  <ChevronLeft className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Left (1px)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={() => updateField({ x: (currentField?.x || 0) + 1 })}>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Right (1px)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-0.5 bg-background/50 rounded-md p-1 border shadow-inner">
          <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Size</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const w = currentField?.boxWidth ?? currentField?.fontSize ?? defaultSize
                    const h = currentField?.boxHeight ?? currentField?.fontSize ?? defaultSize
                    const nextW = Math.max(20, w - 32)
                    const nextH = Math.max(20, h - 32)
                    updateField({
                      boxWidth: nextW,
                      boxHeight: nextH,
                      fontSize: Math.min(nextW, nextH),
                    })
                  }}
                >
                  <Minus className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Decrease size</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const w = currentField?.boxWidth ?? currentField?.fontSize ?? defaultSize
                    const h = currentField?.boxHeight ?? currentField?.fontSize ?? defaultSize
                    const nextW = Math.min(800, w + 32)
                    const nextH = Math.min(800, h + 32)
                    updateField({
                      boxWidth: nextW,
                      boxHeight: nextH,
                      fontSize: Math.min(nextW, nextH),
                    })
                  }}
                >
                  <Plus className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Increase size</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1 bg-background/50 rounded-md p-1 border shadow-inner">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const w = currentField?.boxWidth ?? currentField?.fontSize ?? defaultSize
                    const h = currentField?.boxHeight ?? currentField?.fontSize ?? defaultSize
                    updateField({
                      boxWidth: Math.min(800, w + 24),
                      boxHeight: Math.min(800, h + 24),
                      fontSize: Math.min(w + 24, h + 24),
                    })
                  }}
                >
                  <Maximize className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Scale up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const w = currentField?.boxWidth ?? currentField?.fontSize ?? defaultSize
                    const h = currentField?.boxHeight ?? currentField?.fontSize ?? defaultSize
                    const nextW = Math.max(20, w - 24)
                    const nextH = Math.max(20, h - 24)
                    updateField({
                      boxWidth: nextW,
                      boxHeight: nextH,
                      fontSize: Math.min(nextW, nextH),
                    })
                  }}
                >
                  <Minimize className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Scale down</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1 bg-background/50 rounded-md p-1 border shadow-inner">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const w = currentField?.boxWidth ?? currentField?.fontSize ?? defaultSize
                    updateField({ boxWidth: Math.min(800, w + 24) })
                  }}
                >
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Wider</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const w = currentField?.boxWidth ?? currentField?.fontSize ?? defaultSize
                    updateField({ boxWidth: Math.max(20, w - 24) })
                  }}
                >
                  <Minimize className="h-3 w-3 rotate-90 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Narrower</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const h = currentField?.boxHeight ?? currentField?.fontSize ?? defaultSize
                    updateField({ boxHeight: Math.min(800, h + 24) })
                  }}
                >
                  <ArrowUpDown className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Taller</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/10"
                  onClick={() => {
                    const defaultSize = currentTemplateType === "excellence" ? 240 : 100
                    const h = currentField?.boxHeight ?? currentField?.fontSize ?? defaultSize
                    updateField({ boxHeight: Math.max(20, h - 24) })
                  }}
                >
                  <Minimize className="h-3 w-3 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shorter</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    )}

    <div className="border rounded-lg overflow-hidden bg-gray-50 relative">
      {templateImage[currentTemplateType] ? (
        <>
          <div
            ref={canvasViewportRef}
            className="w-full overflow-auto h-[min(58vh,560px)]"
          >
            <div
              style={{
                width: Math.max(
                  1,
                  (isEditingBack
                    ? (backCanvasDimensions?.width ?? canvasRef.current?.width ?? 1)
                    : (templateCanvasDimensions[currentTemplateType]?.width ??
                        canvasRef.current?.width ??
                        1)) * canvasZoom,
                ),
                height: Math.max(
                  1,
                  (isEditingBack
                    ? (backCanvasDimensions?.height ?? canvasRef.current?.height ?? 1)
                    : (templateCanvasDimensions[currentTemplateType]?.height ??
                        canvasRef.current?.height ??
                        1)) * canvasZoom,
                ),
              }}
            >
              <canvas
                ref={canvasRef}
                className="origin-top-left"
                style={{
                  transform: `scale(${canvasZoom})`,
                  transformOrigin: "top left",
                  cursor: canvasCursor,
                }}
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => {
                  endCanvasInteraction()
                  setCanvasCursor("default")
                }}
              />
            </div>
          </div>
          {editingField && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-96 bg-background border-2 border-primary rounded-lg shadow-lg p-4 z-10">
              <Label className="mb-2 block">Edit Text</Label>
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateField({ value: editingValue })
                    setEditingField(null)
                  } else if (e.key === 'Escape') {
                    setEditingField(null)
                  }
                }}
                autoFocus
                className="mb-2"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    updateField({ value: editingValue })
                    setEditingField(null)
                  }}
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to save, Escape to cancel
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center bg-card justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Upload a {currentTemplateInfo.label.toLowerCase()} {isEditingBack ? "back" : "front"} template</p>
            <p className="text-xs mt-1">
              {currentTemplateType === "excellence" 
                ? "Any size supported — recommended 1350×850 px (ID card)"
                : "Any orientation — e.g. A4 landscape (842×595), portrait (595×842), Letter, Legal, or custom"}
            </p>
            {activeImage && templateCanvasDimensions[currentTemplateType] && !isEditingBack && (
              <p className="text-[10px] mt-1 text-muted-foreground/80">
                Current: {templateCanvasDimensions[currentTemplateType]!.width}×
                {templateCanvasDimensions[currentTemplateType]!.height} px
              </p>
            )}
            {activeImage && isEditingBack && backCanvasDimensions && (
              <p className="text-[10px] mt-1 text-muted-foreground/80">
                Current: {backCanvasDimensions.width}×{backCanvasDimensions.height} px
              </p>
            )}
          </div>
        </div>
      )}
    </div>

    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleImageUpload}
    />
  </div>

  <div className="space-y-4">
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as "fields" | "edit")}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="fields">Text Fields</TabsTrigger>
        <TabsTrigger value="edit">Edit Field</TabsTrigger>
      </TabsList>

      <TabsContent value="fields" className="space-y-2 mt-4">
        <Button variant="outline" size="sm" className="w-full" onClick={addTextField}>
          <Plus className="h-4 w-4 mr-2" />
          Add Text Field
        </Button>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activeFields.map((field) => (
            <div
              key={field.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedField === field.id
                  ? "border-blue-500 bg-card"
                  : "hover:bg-secondary"
              }`}
              onClick={() => setSelectedField(field.id)}
              onDoubleClick={() => {
                setSelectedField(field.id)
                setActiveTab("edit")
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm">{field.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatPlaceholderPreview(field.value, PLACEHOLDER_OPTIONS)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteField(field.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="edit" className="space-y-4 mt-4">
  {currentField ? (
    <>
      <div>
        <Label>Field Label</Label>
        <Input
          value={currentField.label}
          onChange={(e) => updateField({ label: e.target.value })}
          placeholder="e.g., Trainee Name, Course Title"
        />
        <p className="text-xs text-muted-foreground mt-1">
          This is just a label for your reference
        </p>
      </div>

      <div>
        <Label>Text / Placeholder</Label>
        <div className="space-y-2">
          <PlaceholderChipEditor
            value={currentField.value}
            options={PLACEHOLDER_OPTIONS}
            onChange={(nextValue) => updateField({ value: nextValue })}
          />

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowPlaceholderMenu(!showPlaceholderMenu)}
              type="button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Insert Placeholder
            </Button>
            {showPlaceholderMenu && (
              <div className="absolute z-10 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {PLACEHOLDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className="w-full px-3 py-2.5 text-left hover:bg-secondary transition-colors border-b last:border-b-0"
                    onClick={() => insertPlaceholder(option.value)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {option.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Placeholders appear as buttons. Press{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> for new lines,
          or type normal text around them.
        </p>
      </div>


      {/* ✅ UPDATED: Line height control with better explanation */}
      
      {/* ✅ NEW: Line height control */}
      <div>
        <Label>Line Height: {currentField.lineHeight || 1.2}x</Label>
        <Slider
          value={[currentField.lineHeight || 1.2]}
          onValueChange={([value]) => updateField({ lineHeight: value })}
          min={0.8}
          max={2.5}
          step={0.1}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Adjust spacing between lines (1.0 = single spacing, 1.5 = 1.5x spacing)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>X Position</Label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => updateField({ x: (currentField.x || 0) - 2 })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={Math.round(currentField.x)}
              onChange={(e) => updateField({ x: Number(e.target.value) })}
            />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => updateField({ x: (currentField.x || 0) + 2 })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label>Y Position</Label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => updateField({ y: (currentField.y || 0) - 2 })}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={Math.round(currentField.y)}
              onChange={(e) => updateField({ y: Number(e.target.value) })}
            />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => updateField({ y: (currentField.y || 0) + 2 })}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label>Font Size: {currentField.fontSize}px</Label>
        <Slider
          value={[currentField.fontSize]}
          onValueChange={([value]) => updateField({ fontSize: value })}
          min={8}
          max={72}
          step={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Font Family</Label>
          <Select
            value={currentField.fontFamily}
            onValueChange={(value: "Helvetica" | "Times" | "Montserrat" | "Poppins") =>
              updateField({ fontFamily: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Helvetica">Helvetica</SelectItem>
              <SelectItem value="Times">Times</SelectItem>
              <SelectItem value="Montserrat">Montserrat</SelectItem>
              <SelectItem value="Poppins">Poppins</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Font Weight</Label>
          <Select
            value={currentField.fontWeight}
            onValueChange={(value: "normal" | "bold" | "extrabold") =>
              updateField({ fontWeight: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
              <SelectItem value="extrabold">Extra Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Font Style</Label>
          <Select
            value={currentField.fontStyle}
            onValueChange={(value: "normal" | "italic") =>
              updateField({ fontStyle: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="italic">Italic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Label className="mb-0">Align</Label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Alignment help"
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[240px] space-y-1.5 p-3 text-xs">
                  <p><strong>Left:</strong> Text starts at position, extends right</p>
                  <p><strong>Center:</strong> Text centers on position</p>
                  <p><strong>Right:</strong> Text ends at position, extends left</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={currentField.align}
            onValueChange={(value: "left" | "center" | "right") =>
              updateField({ align: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Text Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={currentField.color}
            onChange={(e) => updateField({ color: e.target.value })}
            className="w-20 h-10"
          />
          <Input
            value={currentField.color}
            onChange={(e) => updateField({ color: e.target.value })}
            placeholder="#000000"
          />
        </div>
      </div>
    </>
  ) : (
    <div className="text-center text-muted-foreground py-8">
      <p className="mb-2">Select a field from the left to edit</p>
      <p className="text-xs">or click on a text field in the certificate preview</p>
    </div>
  )}
</TabsContent>
    </Tabs>
  </div>
</div>

<div className="flex justify-between gap-2 pt-4 border-t">
  <Button variant="outline" onClick={onClose}>
    Cancel
  </Button>
  <div className="flex gap-2">
    <Button variant="destructive" onClick={handleDeleteTemplate}>
      <Trash2 className="h-4 w-4 mr-2" />
      Delete Template
    </Button>
    <Button onClick={handleSave} disabled={saving || uploading} variant="outline">
      <Save className="h-4 w-4 mr-2" />
      Save This Template
    </Button>
    <Button onClick={handleSaveAll} disabled={saving || uploading}>
      <Save className="h-4 w-4 mr-2" />
      {saving ? "Saving All..." : "Save All Templates"}
    </Button>
      </div>
    </div>
  </DialogContent>

  <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Copy Layout from Course</DialogTitle>
        <DialogDescription>
          Select a course to copy its {currentTemplateType} template layout.
          This will overwrite your current field positions and settings.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
        {loadingCourses ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : coursesWithTemplates.length > 0 ? (
          <div className="grid gap-2">
            {coursesWithTemplates.map((course) => (
              <Button
                key={course.id}
                variant="outline"
                className="justify-start text-left h-auto py-3 px-4"
                onClick={() => copyLayoutFrom(course.id)}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium">{course.name}</span>
                  <span className="text-xs opacity-70">Copy {currentTemplateType} layout</span>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No other courses found with a {currentTemplateType} template.</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <ImageCropDialog
    open={showTemplateCropDialog}
    onOpenChange={setShowTemplateCropDialog}
    imageType="template"
    aspect={null}
    existingImageUrl={existingTemplateCropUrl}
    title={
      pendingCropTarget === "back"
        ? "Crop Back Template Image"
        : "Crop Certificate Template Image"
    }
    onLocalSave={(file, previewDataUrl) => {
      applyCroppedTemplateImage(file, previewDataUrl)
      toast.success("Template image cropped. Remember to save the template.")
    }}
  />
</Dialog>
)
}