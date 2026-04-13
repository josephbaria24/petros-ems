"use client"

import { useEffect, useState, use } from "react"
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
  FolderOpen,
  Edit2
} from "lucide-react"

type FormComponentType =
  | 'personal_info'
  | 'employment_info'
  | 'id_upload'
  | 'payment_section'
  | 'custom_input'
  | 'custom_select'
  | 'custom_radio'
  | 'page_break'

interface FormComponent {
  id: string
  type: FormComponentType
  label: string
  required: boolean
  options?: string[] // For select and radio
  placeholder?: string
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
  { type: 'payment_section', label: 'Payment Section', icon: CreditCard, description: 'Displays course fees and payment methods' },
  { type: 'custom_input', label: 'Custom Text Input', icon: Type, description: 'A single text input field' },
  { type: 'custom_select', label: 'Custom Select', icon: Layout, description: 'A dropdown selection field' },
  { type: 'custom_radio', label: 'Custom Radio', icon: CircleDot, description: 'Radio button selection' },
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
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

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

  const handleRenameTemplate = async () => {
    if (!editingTemplate || !templateName.trim()) return
    try {
      const response = await fetch("/api/registration-templates", {
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
      const response = await fetch(`/api/registration-templates?id=${templateId}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete")
      toast.success("Template deleted")
      fetchTemplates()
    } catch (err) {
      toast.error("Failed to delete template")
    }
  }

  const loadTemplate = (template: Template) => {
    if (config.length > 0 && !confirm("Loading a template will overwrite your current configuration. Proceed?")) return
    setConfig(template.config)
    toast.success(`Loaded template: ${template.name}`)
    setIsTemplateDialogOpen(false)
  }

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

  const addComponent = (type: FormComponentType) => {
    const newComponent: FormComponent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: AVAILABLE_COMPONENTS.find(c => c.type === type)?.label || 'New Component',
      required: true,
      options: ['Option 1', 'Option 2'],
      placeholder: ''
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Step 1: Form Type Selection */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Base Form Type</CardTitle>
            <CardDescription>Select a standard template or build a custom one</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={formType} onValueChange={setFormType} className="space-y-4">
              {['default', 'ivt', 'bls', 'acls', 'custom'].map((t) => (
                <div key={t} className="flex items-center space-x-2 border p-3 rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value={t} id={t} />
                  <Label htmlFor={t} className="flex-1 cursor-pointer">
                    <span className="font-semibold block capitalize">{t} Registration</span>
                    <span className="text-xs text-muted-foreground">
                      {t === 'custom' ? 'Build your own form from components' : `Standard ${t.toUpperCase()} form`}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Step 2: Custom Builder Area */}
        {formType === 'custom' && (
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Custom Form Builder</h3>
              <div className="flex gap-2">
                <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Saved Templates
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="lg:w-[50vw] w-[90vw]">
                    <DialogHeader>
                      <DialogTitle>Registration Templates</DialogTitle>
                      <DialogDescription>Manage and load your saved registration form layouts.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                      {templates.length === 0 && <p className="text-center text-muted-foreground py-4">No templates saved yet.</p>}
                      {templates.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex-1 cursor-pointer" onClick={() => loadTemplate(t)}>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.config.length} components</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              setEditingTemplate(t)
                              setTemplateName(t.name)
                            }}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTemplate(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>

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
                      return "bg-blue-50/30 border-blue-200"
                    case 'id_upload':
                      return "bg-purple-50/30 border-purple-200"
                    case 'payment_section':
                      return "bg-emerald-50/30 border-emerald-200"
                    case 'page_break':
                      return "bg-orange-100 border-orange-300 py-1"
                    default:
                      return "bg-slate-50 border-slate-200"
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
                              className="h-7 text-xs bg-white/50 border-transparent hover:border-muted focus:bg-white transition-all py-1 px-2"
                              value={comp.label}
                              onChange={(e) => updateComponent(comp.id, { label: e.target.value })}
                              placeholder="Component Title..."
                            />

                            <div className="flex items-center gap-2 px-2 border-l border-black/5 whitespace-nowrap">
                              <Checkbox
                                id={`req-${comp.id}`}
                                checked={comp.required}
                                className="h-3.5 w-3.5"
                                onCheckedChange={(checked) => updateComponent(comp.id, { required: !!checked })}
                              />
                              <Label htmlFor={`req-${comp.id}`} className="text-[10px] font-medium cursor-pointer select-none text-muted-foreground">Required</Label>
                            </div>
                          </div>

                          {/* Quick Delete */}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={() => removeComponent(comp.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Secondary Config - Only if needed */}
                        {['custom_input', 'custom_select', 'custom_radio'].includes(comp.type) && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1">
                            {comp.type === 'custom_input' && (
                              <Input
                                className="h-6 text-[10px] bg-white/30 border-transparent hover:border-muted focus:bg-white transition-all py-0 px-2 flex-1"
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
                                      className="h-6 text-[10px] bg-white/30 border-transparent hover:border-muted focus:bg-white transition-all py-0 px-2 flex-1"
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
                          </div>
                        )}

                        {comp.type === 'payment_section' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-black/5 pt-2">
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

                        {comp.type === 'personal_info' && (
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-black/5 pt-2">
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
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-black/5 pt-2">
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
                          <div className="flex flex-col gap-2 pl-[135px] mt-1 pb-1 border-t border-black/5 pt-2">
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
    </div>
  )
}
