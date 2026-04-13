"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { User, Briefcase, Upload, CreditCard, ChevronRight, ChevronLeft, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

// These would normally be imported from the actual registration page
// but for the sake of the custom renderer, they need to be modularized.

export function CustomFormRenderer({ 
  config, 
  onSave, 
  isSubmitting 
}: { 
  config: any[], 
  onSave: (data: any) => void,
  isSubmitting: boolean
}) {
  const [currentPage, setCurrentPage] = useState(0)
  const [formData, setFormData] = useState<any>({})
  const [uploading, setUploading] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentUploadField = useRef<string | null>(null)

  const handleChange = (id: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [id]: value }))
  }

  const triggerUpload = (field: string) => {
    currentUploadField.current = field
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUploadField.current) return

    const field = currentUploadField.current
    setUploading(field)
    
    const toastId = toast.loading(`Uploading document...`)

    try {
      const data = new FormData()
      data.append("image", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      })

      const result = await res.json()

      if (res.ok) {
        handleChange(field, result.url)
        toast.success("Uploaded successfully!", { id: toastId })
      } else {
        toast.error(result.error || "Upload failed", { id: toastId })
      }
    } catch (err) {
      console.error("Upload error:", err)
      toast.error("An unexpected error occurred during upload", { id: toastId })
    } finally {
      setUploading(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Split config into pages based on 'page_break'
  const pages: any[][] = [[]]
  config.forEach(item => {
    if (item.type === 'page_break') {
      pages.push([])
    } else {
      pages[pages.length - 1].push(item)
    }
  })

  const renderComponent = (comp: any) => {
    switch (comp.type) {
      case 'personal_info':
        const enabledFields = comp.fields || ['first_name', 'last_name', 'email', 'phone']
        return (
          <div className="space-y-4 border-b pb-6 mb-6" key={comp.id}>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">{comp.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enabledFields.includes('first_name') && (
                <div className="space-y-2">
                  <Label>First Name {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('first_name', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('last_name') && (
                <div className="space-y-2">
                  <Label>Last Name {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('last_name', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('email') && (
                <div className="space-y-2">
                  <Label>Email {comp.required && "*"}</Label>
                  <Input type="email" required={comp.required} onChange={(e) => handleChange('email', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('phone') && (
                <div className="space-y-2">
                  <Label>Phone Number {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('phone', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('address') && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Address {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('address', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('gender') && (
                <div className="space-y-2">
                  <Label>Gender {comp.required && "*"}</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required={comp.required} 
                    onChange={(e) => handleChange('gender', e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              )}
              {enabledFields.includes('dob') && (
                <div className="space-y-2">
                  <Label>Date of Birth {comp.required && "*"}</Label>
                  <Input type="date" required={comp.required} onChange={(e) => handleChange('dob', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('nationality') && (
                <div className="space-y-2">
                  <Label>Nationality {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('nationality', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('religion') && (
                <div className="space-y-2">
                  <Label>Religion {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('religion', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('civil_status') && (
                <div className="space-y-2">
                  <Label>Civil Status {comp.required && "*"}</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required={comp.required} 
                    onChange={(e) => handleChange('civil_status', e.target.value)}
                  >
                    <option value="">Select Civil Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )

      case 'employment_info':
        const empFields = comp.fields || ['company', 'position', 'industry']
        return (
          <div className="space-y-4 border-b pb-6 mb-6" key={comp.id}>
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">{comp.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {empFields.includes('company') && (
                <div className="space-y-2">
                  <Label>Company Name {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('company', e.target.value)} />
                </div>
              )}
              {empFields.includes('position') && (
                <div className="space-y-2">
                  <Label>Position {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('position', e.target.value)} />
                </div>
              )}
              {empFields.includes('industry') && (
                <div className="space-y-2">
                  <Label>Industry {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('industry', e.target.value)} />
                </div>
              )}
              {empFields.includes('company_address') && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Company Address {comp.required && "*"}</Label>
                  <Input required={comp.required} onChange={(e) => handleChange('company_address', e.target.value)} />
                </div>
              )}
              {empFields.includes('years_experience') && (
                <div className="space-y-2">
                  <Label>Years of Experience {comp.required && "*"}</Label>
                  <Input type="number" required={comp.required} onChange={(e) => handleChange('years_experience', e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )

      case 'id_upload':
        const uploadFields = comp.fields || ['govt_id', 'photo']
        return (
          <div className="space-y-4 border-b pb-6 mb-6" key={comp.id}>
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">{comp.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {uploadFields.includes('govt_id') && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
                  <p className="text-sm font-bold">Government Issued ID</p>
                  <p className="text-[10px] text-muted-foreground mb-3 italic">Upload clear image/PDF</p>
                  <Button 
                    variant={formData.govt_id ? "secondary" : "outline"} 
                    size="sm" 
                    className="h-8 text-xs gap-2"
                    onClick={() => triggerUpload('govt_id')}
                    disabled={!!uploading}
                  >
                    {uploading === 'govt_id' ? <Loader2 className="h-3 w-3 animate-spin" /> : formData.govt_id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Upload className="h-3 w-3" />}
                    {formData.govt_id ? "Change ID" : "Browse ID"}
                  </Button>
                </div>
              )}
              {uploadFields.includes('photo') && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
                  <p className="text-sm font-bold">2x2 Picture</p>
                  <p className="text-[10px] text-muted-foreground mb-3 italic">White background preferred</p>
                  <Button 
                    variant={formData.photo ? "secondary" : "outline"} 
                    size="sm" 
                    className="h-8 text-xs gap-2"
                    onClick={() => triggerUpload('photo')}
                    disabled={!!uploading}
                  >
                    {uploading === 'photo' ? <Loader2 className="h-3 w-3 animate-spin" /> : formData.photo ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Upload className="h-3 w-3" />}
                    {formData.photo ? "Change Photo" : "Browse Photo"}
                  </Button>
                </div>
              )}
              {uploadFields.includes('prc_license') && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
                  <p className="text-sm font-bold">PRC License</p>
                  <p className="text-[10px] text-muted-foreground mb-3 italic">For clinical courses</p>
                  <Button 
                    variant={formData.prc_license ? "secondary" : "outline"} 
                    size="sm" 
                    className="h-8 text-xs gap-2"
                    onClick={() => triggerUpload('prc_license')}
                    disabled={!!uploading}
                  >
                    {uploading === 'prc_license' ? <Loader2 className="h-3 w-3 animate-spin" /> : formData.prc_license ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Upload className="h-3 w-3" />}
                    {formData.prc_license ? "Change License" : "Browse License"}
                  </Button>
                </div>
              )}
              {uploadFields.includes('signature') && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
                  <p className="text-sm font-bold">E-Signature</p>
                  <p className="text-[10px] text-muted-foreground mb-3 italic">Upload or Use Pad</p>
                  <Button 
                    variant={formData.signature ? "secondary" : "outline"} 
                    size="sm" 
                    className="h-8 text-xs gap-2"
                    onClick={() => triggerUpload('signature')}
                    disabled={!!uploading}
                  >
                    {uploading === 'signature' ? <Loader2 className="h-3 w-3 animate-spin" /> : formData.signature ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Upload className="h-3 w-3" />}
                    {formData.signature ? "Change Signature" : "Browse Signature"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )

      case 'payment_section':
        const activeMethods = comp.methods || ['BPI', 'GCASH', 'COUNTER']
        const ALL_METHODS = [
          { id: 'BPI', label: 'Bank (BPI)', icon: '/bpi.svg' },
          { id: 'GCASH', label: 'GCash', icon: '/gcash.jpeg' },
          { id: 'COUNTER', label: 'Over the Counter', icon: '/otc.svg' }
        ]
        return (
          <div className="space-y-4 border-b pb-6 mb-6" key={comp.id}>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">{comp.label}</h3>
            </div>
            <div className="p-4 bg-primary/5 rounded-lg border space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Select Payment Method:</p>
              <RadioGroup 
                value={formData.payment_method} 
                onValueChange={(val) => handleChange('payment_method', val)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {ALL_METHODS.filter(m => activeMethods.includes(m.id)).map(pm => (
                  <div key={pm.id} className="relative">
                    <RadioGroupItem 
                      value={pm.id} 
                      id={`pay-${pm.id}`} 
                      className="peer sr-only" 
                    />
                    <Label
                      htmlFor={`pay-${pm.id}`}
                      className="flex items-center gap-3 p-3 bg-white rounded border border-primary/10 cursor-pointer hover:border-primary/40 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary transition-all duration-200"
                    >
                      <img src={pm.icon} alt={pm.label} className="w-8 h-8 rounded-sm object-contain" />
                      <span className="text-xs font-semibold">{pm.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        )

      case 'custom_input':
        return (
          <div className="space-y-2 mb-6" key={comp.id}>
            <Label>{comp.label} {comp.required && "*"}</Label>
            <Input 
              required={comp.required} 
              placeholder={comp.placeholder} 
              onChange={(e) => handleChange(comp.id, e.target.value)}
            />
          </div>
        )

      case 'custom_select':
        return (
          <div className="space-y-2 mb-6" key={comp.id}>
            <Label>{comp.label} {comp.required && "*"}</Label>
            <Select onValueChange={(val) => handleChange(comp.id, val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {comp.options?.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case 'custom_radio':
        return (
          <div className="space-y-2 mb-6" key={comp.id}>
            <Label>{comp.label} {comp.required && "*"}</Label>
            <RadioGroup onValueChange={(val) => handleChange(comp.id, val)}>
              {comp.options?.map((opt: string) => (
                <div className="flex items-center space-x-2" key={opt}>
                  <RadioGroupItem value={opt} id={`${comp.id}-${opt}`} />
                  <Label htmlFor={`${comp.id}-${opt}`}>{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )

      default:
        return null
    }
  }

  const isLastPage = currentPage === pages.length - 1

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-t-4 border-t-primary">
        <CardContent className="p-8">
          {pages[currentPage].map(renderComponent)}
          
          <div className="flex justify-between items-center pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={() => setCurrentPage(cp => Math.max(0, cp - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {isLastPage ? (
              <Button 
                onClick={() => onSave(formData)} 
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? 'Submitting...' : 'Complete Registration'}
              </Button>
            ) : (
              <Button 
                onClick={() => setCurrentPage(cp => cp + 1)}
              >
                Next Step
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          
          {pages.length > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {pages.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentPage ? 'w-8 bg-primary' : 'w-2 bg-muted'}`} 
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileUpload}
        accept="image/*,.pdf"
      />
    </div>
  )
}
