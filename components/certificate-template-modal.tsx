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

interface TextField {
  id: string
  label: string
  value: string
  x: number
  y: number
  fontSize: number
  fontWeight: "normal" | "bold"
  color: string
  align: "left" | "center" | "right"
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
  { value: "{{completion_date}}", label: "Completion Date", description: "Date of completion" },
  { value: "{{certificate_number}}", label: "Certificate Number", description: "Unique certificate ID" },
  { value: "{{batch_number}}", label: "Batch Number", description: "Training batch number" },
  { value: "{{training_provider}}", label: "Training Provider", description: "Provider organization" },
]

const TEMPLATE_TYPES: { value: TemplateType; label: string; icon: any; description: string }[] = [
  { 
    value: "participation", 
    label: "Participation", 
    icon: Award,
    description: "Certificate for course participants"
  },
  { 
    value: "completion", 
    label: "Completion", 
    icon: CalendarCheck,
    description: "Certificate for course completion"
  },
  { 
    value: "excellence", 
    label: "Excellence", 
    icon: Trophy,
    description: "Certificate for outstanding performance"
  }
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
      color: "#34495E",
      align: "center"
    }
  ],
  excellence: [
    {
      id: "name",
      label: "Trainee Name",
      value: "{{trainee_name}}",
      x: 421,
      y: 335,
      fontSize: 40,
      fontWeight: "bold",
      color: "#C0392B",
      align: "center"
    },
    {
      id: "award",
      label: "Award Title",
      value: "Certificate of Excellence",
      x: 421,
      y: 275,
      fontSize: 18,
      fontWeight: "bold",
      color: "#8E44AD",
      align: "center"
    },
    {
      id: "course",
      label: "Course Name",
      value: "in {{course_name}}",
      x: 421,
      y: 245,
      fontSize: 14,
      fontWeight: "normal",
      color: "#34495E",
      align: "center"
    }
  ]
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

  // Load all templates from database
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
          if (data.template) {
            setTemplateImage(prev => ({ ...prev, [type.value]: data.template.image_url }))
            if (data.template.fields) {
              setTextFields(prev => ({ ...prev, [type.value]: data.template.fields }))
            }
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
        .from('Certificates')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('Certificates')
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

  // Draw canvas
  useEffect(() => {
    if (!canvasRef.current || !templateImage[currentTemplateType]) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = 842
      canvas.height = 595
      ctx.drawImage(img, 0, 0, 842, 595)

      textFields[currentTemplateType].forEach((field) => {
        ctx.font = `${field.fontWeight === "bold" ? "bold " : ""}${field.fontSize}px Arial`
        ctx.fillStyle = field.color
        ctx.textAlign = field.align

        let x = field.x

        let displayText = field.value
        if (previewMode) {
          displayText = displayText
            .replace("{{trainee_name}}", "Juan Dela Cruz")
            .replace("{{course_name}}", courseName)
            .replace("{{completion_date}}", "November 22, 2025")
            .replace("{{certificate_number}}", "CERT-2025-001234")
            .replace("{{batch_number}}", "Batch 42")
            .replace("{{training_provider}}", "Petrosphere Inc.")
        }

        ctx.fillText(displayText, x, field.y)

        if (selectedField === field.id && !previewMode) {
          ctx.strokeStyle = "#3b82f6"
          ctx.lineWidth = 2
          const metrics = ctx.measureText(displayText)
          const textWidth = metrics.width
          const textHeight = field.fontSize
          
          let boxX = x
          if (field.align === "center") {
            boxX = x - textWidth / 2
          } else if (field.align === "right") {
            boxX = x - textWidth
          }

          ctx.strokeRect(boxX - 5, field.y - textHeight, textWidth + 10, textHeight + 5)
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
      ctx.font = `${field.fontWeight === "bold" ? "bold " : ""}${field.fontSize}px Arial`
      const metrics = ctx.measureText(field.value)
      const textWidth = metrics.width
      const textHeight = field.fontSize

      let boxX = field.x
      if (field.align === "center") {
        boxX = field.x - textWidth / 2
      } else if (field.align === "right") {
        boxX = field.x - textWidth
      }

      if (
        x >= boxX - 5 &&
        x <= boxX + textWidth + 5 &&
        y >= field.y - textHeight &&
        y <= field.y + 5
      ) {
        setSelectedField(field.id)
        setDragOffset({
          x: x - field.x,
          y: y - field.y
        })
        return
      }
    }

    setSelectedField(null)
  }

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
      ctx.font = `${field.fontWeight === "bold" ? "bold " : ""}${field.fontSize}px Arial`
      const metrics = ctx.measureText(field.value)
      const textWidth = metrics.width
      const textHeight = field.fontSize

      let boxX = field.x
      if (field.align === "center") {
        boxX = field.x - textWidth / 2
      } else if (field.align === "right") {
        boxX = field.x - textWidth
      }

      if (
        x >= boxX - 5 &&
        x <= boxX + textWidth + 5 &&
        y >= field.y - textHeight &&
        y <= field.y + 5
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
    const newField: TextField = {
      id: `field_${Date.now()}`,
      label: "New Field",
      value: "Sample Text",
      x: 421,
      y: 300,
      fontSize: 16,
      fontWeight: "normal",
      color: "#000000",
      align: "center"
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

      if (templateFile[currentTemplateType]) {
        const uploadedUrl = await uploadImageToStorage(templateFile[currentTemplateType]!, currentTemplateType)
        if (!uploadedUrl) {
          alert("❌ Failed to upload image")
          setSaving(false)
          return
        }
        imageUrl = uploadedUrl
        setTemplateFile(prev => ({ ...prev, [currentTemplateType]: null }))
      }

      const response = await fetch("/api/certificate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          imageUrl: imageUrl,
          fields: textFields[currentTemplateType],
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

        const response = await fetch("/api/certificate-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            imageUrl: imageUrl,
            fields: textFields[type.value],
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Certificate Template Editor - {courseName}</DialogTitle>
          <DialogDescription>
            Upload and customize certificate templates for this course
          </DialogDescription>
        </DialogHeader>

        {/* Template Type Selector */}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingField(null)}
                        >
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
                    <p>Upload a {currentTemplateInfo.label.toLowerCase()} certificate template</p>
                    <p className="text-xs mt-1">Recommended: 842x595 pixels (A4 landscape)</p>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addTextField}
                >
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

                    <div>
                      <Label>Text / Placeholder</Label>
                      <div className="space-y-2">
                        <Input
                          value={currentField.value}
                          onChange={(e) => updateField({ value: e.target.value })}
                          placeholder="Enter text or add placeholders below"
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
                        Placeholders will be replaced with actual data when generating certificates
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>X Position</Label>
                        <Input
                          type="number"
                          value={Math.round(currentField.x)}
                          onChange={(e) =>
                            updateField({ x: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <Label>Y Position</Label>
                        <Input
                          type="number"
                          value={Math.round(currentField.y)}
                          onChange={(e) =>
                            updateField({ y: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Font Size: {currentField.fontSize}px</Label>
                      <Slider
                        value={[currentField.fontSize]}
                        onValueChange={([value]) =>
                          updateField({ fontSize: value })
                        }
                        min={8}
                        max={72}
                        step={1}
                      />
                    </div>

                    <div>
                      <Label>Font Weight</Label>
                      <Select
                        value={currentField.fontWeight}
                        onValueChange={(value: "normal" | "bold") =>
                          updateField({ fontWeight: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
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