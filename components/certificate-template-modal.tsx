//components\certificate-template-modal.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, X, Plus, Trash2, Save, Eye, Loader2, Award, CalendarCheck, Trophy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { supabase } from "@/lib/supabase-client"
import React from "react"

function toPercentX(px: number, isID: boolean) {
  return isID ? px / 1350 : px / 842
}

function toPercentY(px: number, isID: boolean) {
  return isID ? px / 850 : px / 595
}

function toPercentFont(size: number, isID: boolean) {
  return isID ? size / 850 : size / 595
}

interface TextField {
  id: string
  label: string
  value: string
  x: number
  y: number
  fontSize: number
  fontWeight: "normal" | "bold" | "extrabold"
  fontStyle: "normal" | "italic"
  fontFamily: "Helvetica" | "Montserrat" | "Poppins"
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [textFields, setTextFields] = useState<Record<TemplateType, TextField[]>>({
    participation: DEFAULT_FIELDS.participation,
    completion: DEFAULT_FIELDS.completion,
    excellence: DEFAULT_FIELDS.excellence
  })

  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showPlaceholderMenu, setShowPlaceholderMenu] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")

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
            const canvasW = isID ? 1350 : 842
            const canvasH = isID ? 850 : 595
            
            const restoredFields = (data.template.fields as TextField[]).map(
              (f: TextField): TextField => ({
                ...f,
                x: f.x * canvasW,
                y: f.y * canvasH,
                fontSize: f.fontSize * canvasH,
                fontWeight: f.fontWeight || "normal",
                fontStyle: f.fontStyle || "normal",
                fontFamily: f.fontFamily || "Helvetica"
              })
            );

            setTemplateImage(prev => ({ ...prev, [type.value]: data.template.image_url }));
            setTextFields(prev => ({ ...prev, [type.value]: restoredFields }));
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setTemplateImage(prev => ({ ...prev, [currentTemplateType]: event.target?.result as string }))
      }
      reader.readAsDataURL(file)
      setTemplateFile(prev => ({ ...prev, [currentTemplateType]: file }))
    }
  }

useEffect(() => {
  if (!canvasRef.current || !templateImage[currentTemplateType]) return

  const canvas = canvasRef.current
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    const isIDTemplate = currentTemplateType === "excellence"
    if (isIDTemplate) {
      canvas.width = 1350
      canvas.height = 850
    } else {
      canvas.width = 842
      canvas.height = 595
    }
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    if (isIDTemplate && previewMode) {
      const photoSize = 240
      const photoX = 227
      const photoY = 351
      
      ctx.fillStyle = "#CCCCCC"
      ctx.fillRect(photoX, photoY, photoSize, photoSize)
      ctx.strokeStyle = "#999999"
      ctx.lineWidth = 2
      ctx.strokeRect(photoX, photoY, photoSize, photoSize)
      ctx.fillStyle = "#666666"
      ctx.font = "16px Arial"
      ctx.textAlign = "center"
      ctx.fillText("2x2 PHOTO", photoX + photoSize/2, photoY + photoSize/2)
    }

    // ✅ FIXED: Multi-line text rendering with PROPER left alignment
    textFields[currentTemplateType].forEach((field) => {
      ctx.font = getFontString(field)
      ctx.fillStyle = field.color

      let displayText = field.value
      if (previewMode) {
        displayText = displayText
          .replace(/\{\{trainee_name\}\}/g, "Dr. Juan Dela Cruz Jr.")
          .replace(/\{\{course_name\}\}/g, courseName)
          .replace(/\{\{course_title\}\}/g, "Basic Occupational Safety and Health (BOSH) for Safety Officer 1")
          .replace(/\{\{completion_date\}\}/g, "November 22, 2025")
          .replace(/\{\{certificate_number\}\}/g, "PSI-BOSHSO1-001264")
          .replace(/\{\{batch_number\}\}/g, "Batch 42")
          .replace(/\{\{training_provider\}\}/g, "Petrosphere Inc.")
          .replace(/\{\{trainee_picture\}\}/g, "[Picture]")
          .replace(/\{\{held_on\}\}/g, "January 10–12, 2025")
          .replace(/\{\{given_this\}\}/g, "January 15, 2025")
          .replace(/\{\{schedule_range\}\}/g, "January 10–12, 2025")
      }

      // Split text by newlines
      const lines = displayText.split('\n')
      const lineHeight = (field.lineHeight || 1.2) * field.fontSize
      let currentY = field.y

      // ✅ KEY FIX: Set textAlign BEFORE drawing each line
      // This ensures the anchor point is consistent
      if (field.align === "center") {
        ctx.textAlign = "center"
      } else if (field.align === "right") {
        ctx.textAlign = "right"
      } else {
        ctx.textAlign = "left"  // ✅ This is the key for left-aligned text
      }

      lines.forEach((line) => {
        // ✅ For left-aligned text, finalX is always field.x
        // Canvas textAlign="left" handles the rest
        ctx.fillText(line, field.x, currentY)
        currentY += lineHeight
      })

      // ✅ UPDATED: Selection box calculation
      if (selectedField === field.id && !previewMode) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        
        // Calculate bounding box - must set textAlign to "left" for accurate measurement
        const originalAlign = ctx.textAlign
        ctx.textAlign = "left"
        
        const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
        const totalHeight = lines.length * lineHeight
        
        // Restore original alignment
        ctx.textAlign = originalAlign
        
        let boxX = field.x
        if (field.align === "center") {
          boxX = field.x - maxWidth / 2
        } else if (field.align === "right") {
          boxX = field.x - maxWidth
        }
        // For left: boxX = field.x (no change)

        ctx.strokeRect(boxX - 5, field.y - field.fontSize, maxWidth + 10, totalHeight + 5)
      }
    })
  }
  img.src = templateImage[currentTemplateType]!
}, [templateImage, textFields, selectedField, previewMode, currentTemplateType, courseName])

const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (previewMode) return
  const canvas = canvasRef.current
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  for (const field of textFields[currentTemplateType]) {
    ctx.font = getFontString(field)
    
    // ✅ FIX: Set textAlign to "left" for accurate width measurement
    ctx.textAlign = "left"
    
    const lines = field.value.split('\n')
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
    const lineHeight = (field.lineHeight || 1.2) * field.fontSize
    const totalHeight = lines.length * lineHeight

    // ✅ Calculate bounding box based on alignment
    let boxX = field.x
    let boxY = field.y - field.fontSize
    let boxWidth = maxWidth
    let boxHeight = totalHeight + 5

    if (field.align === "center") {
      boxX = field.x - maxWidth / 2
    } else if (field.align === "right") {
      boxX = field.x - maxWidth
    }
    // For "left": boxX = field.x (text starts here and extends right)

    if (
      x >= boxX - 5 &&
      x <= boxX + boxWidth + 5 &&
      y >= boxY &&
      y <= boxY + boxHeight
    ) {
      setSelectedField(field.id)
      setDragOffset({ x: x - field.x, y: y - field.y })
      return
    }
  }
  setSelectedField(null)
}

// REPLACE the handleCanvasDoubleClick function in certificate-template-modal.tsx (around line 530)

const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (previewMode) return
  const canvas = canvasRef.current
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  for (const field of textFields[currentTemplateType]) {
    ctx.font = getFontString(field)
    
    // ✅ FIX: Set textAlign to "left" for accurate width measurement
    ctx.textAlign = "left"
    
    const lines = field.value.split('\n')
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
    const lineHeight = (field.lineHeight || 1.2) * field.fontSize
    const totalHeight = lines.length * lineHeight

    // ✅ Calculate bounding box based on alignment
    let boxX = field.x
    let boxY = field.y - field.fontSize
    let boxWidth = maxWidth
    let boxHeight = totalHeight + 5

    if (field.align === "center") {
      boxX = field.x - maxWidth / 2
    } else if (field.align === "right") {
      boxX = field.x - maxWidth
    }
    // For "left": boxX = field.x (text starts here and extends right)

    if (
      x >= boxX - 5 &&
      x <= boxX + boxWidth + 5 &&
      y >= boxY &&
      y <= boxY + boxHeight
    ) {
      setEditingField(field.id)
      setEditingValue(field.value)
      setSelectedField(field.id)
      return
    }
  }
}
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedField || previewMode) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setTextFields((prev) => ({
      ...prev,
      [currentTemplateType]: prev[currentTemplateType].map((field) =>
        field.id === selectedField
          ? { ...field, x: x - dragOffset.x, y: y - dragOffset.y }
          : field
      )
    }))
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
      fontWeight: "normal",
      fontStyle: "normal",
      fontFamily: "Helvetica",
      color: "#000000",
      align: isIDTemplate ? "left" : "center"
    }
    setTextFields(prev => ({
      ...prev,
      [currentTemplateType]: [...prev[currentTemplateType], newField]
    }))
    setSelectedField(newField.id)
  }

  const updateField = (updates: Partial<TextField>) => {
    if (!selectedField) return
    setTextFields((prev) => ({
      ...prev,
      [currentTemplateType]: prev[currentTemplateType].map((field) =>
        field.id === selectedField ? { ...field, ...updates } : field
      )
    }))
  }

  const deleteField = (id: string) => {
    setTextFields(prev => ({
      ...prev,
      [currentTemplateType]: prev[currentTemplateType].filter((field) => field.id !== id)
    }))
    if (selectedField === id) {
      setSelectedField(null)
    }
  }

  const insertPlaceholder = (placeholder: string) => {
    if (!selectedField) return
    setTextFields((prev) => ({
      ...prev,
      [currentTemplateType]: prev[currentTemplateType].map((field) =>
        field.id === selectedField 
          ? { ...field, value: field.value + (field.value ? " " : "") + placeholder }
          : field
      )
    }))
    setShowPlaceholderMenu(false)
  }

  const handleSave = async () => {
    if (!templateImage[currentTemplateType]) {
      alert("Please upload a template image first")
      return
    }

    setSaving(true)
    try {
      let imageUrl = templateImage[currentTemplateType]!
  
      if (imageUrl.startsWith('data:') || templateFile[currentTemplateType]) {
        const uploadedUrl = await uploadImageToStorage(templateFile[currentTemplateType]!, currentTemplateType)
        if (!uploadedUrl) {
          alert("❌ Failed to upload image")
          setSaving(false)
          return
        }
        imageUrl = uploadedUrl
        setTemplateFile(prev => ({ ...prev, [currentTemplateType]: null }))
        setTemplateImage(prev => ({ ...prev, [currentTemplateType]: imageUrl }))
      }

      const isID = currentTemplateType === "excellence"

      const response = await fetch("/api/certificate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          imageUrl: imageUrl,
          fields: textFields[currentTemplateType].map((f: TextField): TextField => ({
            ...f,
            x: toPercentX(f.x, isID),
            y: toPercentY(f.y, isID),
            fontSize: toPercentFont(f.fontSize, isID)
          })),
          templateType: currentTemplateType
        })
      })

      if (response.ok) {
        alert(`✅ ${TEMPLATE_TYPES.find(t => t.value === currentTemplateType)?.label} template saved successfully!`)
      } else {
        alert("❌ Failed to save template")
      }
    } catch (error) {
      console.error("Error saving template:", error)
      alert("❌ Failed to save template")
    } finally {
      setSaving(false)
    }
  }

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

        const response = await fetch("/api/certificate-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            imageUrl: imageUrl,
            fields: textFields[type.value].map((f: TextField): TextField => ({
              ...f,
              x: toPercentX(f.x, isID),
              y: toPercentY(f.y, isID),
              fontSize: toPercentFont(f.fontSize, isID)
            })),
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

  const currentField = textFields[currentTemplateType].find((f) => f.id === selectedField)
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
      </div>
      <div className="flex gap-2">
        <Button
          variant={previewMode ? "default" : "outline"}
          size="sm"
          onClick={() => setPreviewMode(!previewMode)}
        >
          <Eye className="h-4 w-4 mr-2" />
          {previewMode ? "Edit Mode" : "Preview"}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </>
          )}
        </Button>
      </div>
    </div>

    <div className="border rounded-lg overflow-hidden bg-gray-50 relative">
      {templateImage[currentTemplateType] ? (
        <>
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setIsDragging(false)}
          />
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
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Upload a {currentTemplateInfo.label.toLowerCase()} template</p>
            <p className="text-xs mt-1">
              {currentTemplateType === "excellence" 
                ? "Recommended: 1350x850 pixels (ID card format)"
                : "Recommended: 842x595 pixels (A4 landscape)"}
            </p>
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
    <Tabs defaultValue="fields" className="w-full">
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
          {textFields[currentTemplateType].map((field) => (
            <div
              key={field.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedField === field.id
                  ? "border-blue-500 bg-card"
                  : "hover:bg-secondary"
              }`}
              onClick={() => setSelectedField(field.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm">{field.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {field.value}
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

  {/* ✅ UPDATED: Multi-line textarea with better instructions */}
      <div>
        <Label>Text / Placeholder</Label>
        <div className="space-y-2">
          <textarea
            value={currentField.value}
            onChange={(e) => updateField({ value: e.target.value })}
            placeholder="Enter text or add placeholders below&#10;Press Enter for new lines&#10;&#10;Example for multi-line:&#10;Name: {{trainee_name}}&#10;Course: {{course_title}}"
            className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-y font-mono"
            rows={5}
          />
          
          {/* ✅ NEW: Visual hint for alignment behavior */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
            <p className="font-medium mb-1">💡 Alignment Guide:</p>
            <ul className="space-y-1 ml-3">
              <li><strong>Left:</strong> Text starts at position, extends right (best for labels + names)</li>
              <li><strong>Center:</strong> Text centers on position</li>
              <li><strong>Right:</strong> Text ends at position, extends left</li>
            </ul>
          </div>

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
                    className="w-full px-3 py-2 text-left hover:bg-secondary transition-colors border-b last:border-b-0"
                    onClick={() => insertPlaceholder(option.value)}
                    type="button"
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                    <div className="text-xs text-blue-500 mt-1 font-mono">{option.value}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> for new lines. 
          Use placeholders like <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{{trainee_name}}'}</code> for dynamic data.
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
          <Input
            type="number"
            value={Math.round(currentField.x)}
            onChange={(e) => updateField({ x: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Y Position</Label>
          <Input
            type="number"
            value={Math.round(currentField.y)}
            onChange={(e) => updateField({ y: Number(e.target.value) })}
          />
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

      <div>
        <Label>Font Family</Label>
        <Select
          value={currentField.fontFamily}
          onValueChange={(value: "Helvetica" | "Montserrat" | "Poppins") =>
            updateField({ fontFamily: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Helvetica">Helvetica</SelectItem>
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
        <Label>Text Align</Label>
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
</Dialog>
)
}