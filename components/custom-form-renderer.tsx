"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { User, Briefcase, Upload, CreditCard, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Download, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// These would normally be imported from the actual registration page
// but for the sake of the custom renderer, they need to be modularized.

export function CustomFormRenderer({ 
  config, 
  onSave, 
  isSubmitting,
  courseInformation
}: { 
  config: any[], 
  onSave: (data: any) => void,
  isSubmitting: boolean,
  courseInformation?: {
    courseName?: string
    courseTitle?: string
    courseDescription?: string
    scheduleDate?: string
    scheduleType?: string
    branch?: string
    eventType?: string
    price?: number | null
    trainingFee?: number | null
    onlineFee?: number | null
    faceToFaceFee?: number | null
    elearningFee?: number | null
    hasPvcId?: boolean
    pvcIdType?: string
    pvcStudentPrice?: number | null
    pvcProfessionalPrice?: number | null
  }
}) {
  const [currentPage, setCurrentPage] = useState(0)
  const [formData, setFormData] = useState<any>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({})
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentUploadField = useRef<string | null>(null)

  const formatPhoneInput = (input: string) => {
    const digits = input.replace(/\D/g, "")
    if (!digits) return ""
    if (digits.startsWith("63")) {
      if (digits.length <= 4) return digits
      if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    }
    if (digits.length <= 4) return digits
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }

  const handleChange = (id: string, value: any) => {
    const nextValue =
      id === "phone" || id === "phone_number"
        ? formatPhoneInput(String(value ?? ""))
        : value

    setFormData((prev: any) => ({ ...prev, [id]: nextValue }))
    setValidationErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const getDownloadAckKey = (compId: string) => `download_ack_${compId}`

  const getPhoneWarning = (phoneNumber: string) => {
    const digits = phoneNumber.replace(/\D/g, "")
    if (!digits) return ""
    if (digits.startsWith("0") && digits.length > 11) {
      return "Mobile numbers starting with 0 should not exceed 11 digits."
    }
    if (digits.startsWith("63") && digits.length > 12) {
      return "Mobile numbers starting with 63 should not exceed 12 digits."
    }
    return ""
  }

  const isValidPhoneNumber = (phoneNumber: string) => {
    const digits = phoneNumber.replace(/\D/g, "")
    if (digits.startsWith("0")) return digits.length === 11
    if (digits.startsWith("63")) return digits.length === 12
    return false
  }

  const hasValue = (value: any) => {
    if (typeof value === "string") return value.trim().length > 0
    return value !== null && value !== undefined && value !== ""
  }

  const validateBeforeSubmit = () => {
    const nextErrors: Record<string, boolean> = {}
    const missingLabels: string[] = []

    const pushMissing = (key: string, label: string) => {
      nextErrors[key] = true
      missingLabels.push(label)
    }

    config.forEach((comp: any) => {
      if (!comp.required) return

      switch (comp.type) {
        case "personal_info": {
          const enabledFields = comp.fields || ["first_name", "last_name", "email", "phone"]
          const labels: Record<string, string> = {
            first_name: "First Name",
            last_name: "Last Name",
            email: "Email",
            phone: "Phone Number",
            address: "Address",
            gender: "Gender",
            dob: "Date of Birth",
            nationality: "Nationality",
            religion: "Religion",
            civil_status: "Civil Status",
          }

          enabledFields.forEach((field: string) => {
            if (!hasValue(formData[field])) pushMissing(field, labels[field] || field)
            if (field === "phone" && hasValue(formData[field]) && !isValidPhoneNumber(formData[field])) {
              pushMissing(field, "Phone Number")
            }
          })
          break
        }

        case "employment_info": {
          const empFields = comp.fields || ["company", "position", "industry"]
          const labels: Record<string, string> = {
            company: "Company Name",
            position: "Position",
            industry: "Industry",
            company_address: "Company Address",
            years_experience: "Years of Experience",
          }

          empFields.forEach((field: string) => {
            if (!hasValue(formData[field])) pushMissing(field, labels[field] || field)
          })
          break
        }

        case "id_upload": {
          const uploadFields = comp.fields || ["govt_id", "photo"]
          const labels: Record<string, string> = {
            govt_id: "Government ID",
            photo: "2x2 Picture",
            prc_license: "PRC License",
            signature: "E-Signature",
          }

          uploadFields.forEach((field: string) => {
            if (!hasValue(formData[field])) pushMissing(field, labels[field] || field)
          })
          break
        }

        case "payment_section":
          if (!hasValue(formData.payment_method)) pushMissing("payment_method", "Payment Method")
          break

        case "custom_input":
        case "custom_select":
        case "custom_radio":
        case "custom_file_upload":
          if (!hasValue(formData[comp.id])) pushMissing(comp.id, comp.label || "Required field")
          break

        case "downloadable_file": {
          const ackKey = getDownloadAckKey(comp.id)
          if (comp.fileUrl && !hasValue(formData[ackKey])) {
            pushMissing(ackKey, comp.label || "Downloadable file")
          }
          break
        }
      }
    })

    setValidationErrors(nextErrors)

    if (missingLabels.length > 0) {
      toast.error(`Please complete required fields before submitting.`)
      return false
    }

    return true
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
                  <Input required={comp.required} className={validationErrors.first_name ? "border-red-500" : ""} onChange={(e) => handleChange('first_name', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('last_name') && (
                <div className="space-y-2">
                  <Label>Last Name {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.last_name ? "border-red-500" : ""} onChange={(e) => handleChange('last_name', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('email') && (
                <div className="space-y-2">
                  <Label>Email {comp.required && "*"}</Label>
                  <Input type="email" required={comp.required} className={validationErrors.email ? "border-red-500" : ""} onChange={(e) => handleChange('email', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('phone') && (
                <div className="space-y-2">
                  <Label>Phone Number {comp.required && "*"}</Label>
                  <Input
                    required={comp.required}
                    inputMode="numeric"
                    value={formData.phone || ""}
                    className={validationErrors.phone ? "border-red-500" : ""}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                  {getPhoneWarning(formData.phone || "") && (
                    <p className="text-amber-600 text-xs">{getPhoneWarning(formData.phone || "")}</p>
                  )}
                </div>
              )}
              {enabledFields.includes('address') && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Address {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.address ? "border-red-500" : ""} onChange={(e) => handleChange('address', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('gender') && (
                <div className="space-y-2">
                  <Label>Gender {comp.required && "*"}</Label>
                  <select 
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${validationErrors.gender ? "border-red-500" : "border-input"}`}
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
                  <Input type="date" required={comp.required} className={validationErrors.dob ? "border-red-500" : ""} onChange={(e) => handleChange('dob', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('nationality') && (
                <div className="space-y-2">
                  <Label>Nationality {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.nationality ? "border-red-500" : ""} onChange={(e) => handleChange('nationality', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('religion') && (
                <div className="space-y-2">
                  <Label>Religion {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.religion ? "border-red-500" : ""} onChange={(e) => handleChange('religion', e.target.value)} />
                </div>
              )}
              {enabledFields.includes('civil_status') && (
                <div className="space-y-2">
                  <Label>Civil Status {comp.required && "*"}</Label>
                  <select 
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${validationErrors.civil_status ? "border-red-500" : "border-input"}`}
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
                  <Input required={comp.required} className={validationErrors.company ? "border-red-500" : ""} onChange={(e) => handleChange('company', e.target.value)} />
                </div>
              )}
              {empFields.includes('position') && (
                <div className="space-y-2">
                  <Label>Position {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.position ? "border-red-500" : ""} onChange={(e) => handleChange('position', e.target.value)} />
                </div>
              )}
              {empFields.includes('industry') && (
                <div className="space-y-2">
                  <Label>Industry {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.industry ? "border-red-500" : ""} onChange={(e) => handleChange('industry', e.target.value)} />
                </div>
              )}
              {empFields.includes('company_address') && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Company Address {comp.required && "*"}</Label>
                  <Input required={comp.required} className={validationErrors.company_address ? "border-red-500" : ""} onChange={(e) => handleChange('company_address', e.target.value)} />
                </div>
              )}
              {empFields.includes('years_experience') && (
                <div className="space-y-2">
                  <Label>Years of Experience {comp.required && "*"}</Label>
                  <Input type="number" required={comp.required} className={validationErrors.years_experience ? "border-red-500" : ""} onChange={(e) => handleChange('years_experience', e.target.value)} />
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
                <div className={`border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 ${validationErrors.govt_id ? "border-red-500" : ""}`}>
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
                <div className={`border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 ${validationErrors.photo ? "border-red-500" : ""}`}>
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
                <div className={`border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 ${validationErrors.prc_license ? "border-red-500" : ""}`}>
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
                <div className={`border-2 border-dashed rounded-lg p-6 text-center bg-muted/30 ${validationErrors.signature ? "border-red-500" : ""}`}>
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
                className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${validationErrors.payment_method ? "rounded-md border border-red-500 p-2" : ""}`}
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

      case 'course_information':
      case 'course_price': {
        const selectedFields = comp.fields || ['course_name', 'schedule_date', 'price']
        const infoMap: Record<string, { label: string; value?: string | number | null }> = {
          course_name: { label: 'Course Name', value: courseInformation?.courseName },
          course_title: { label: 'Course Title', value: courseInformation?.courseTitle },
          course_description: { label: 'Course Description', value: courseInformation?.courseDescription },
          schedule_date: { label: 'Schedule Date', value: courseInformation?.scheduleDate },
          schedule_type: { label: 'Schedule Type', value: courseInformation?.scheduleType },
          branch: { label: 'Branch', value: courseInformation?.branch },
          event_type: { label: 'Event Type', value: courseInformation?.eventType },
          price: { label: 'Price', value: courseInformation?.price },
          training_fee: { label: 'Training Fee', value: courseInformation?.trainingFee },
          online_fee: { label: 'Online Fee', value: courseInformation?.onlineFee },
          face_to_face_fee: { label: 'Face-to-Face Fee', value: courseInformation?.faceToFaceFee },
          elearning_fee: { label: 'E-learning Fee', value: courseInformation?.elearningFee },
          has_pvc_id: { label: 'Has PVC ID', value: courseInformation?.hasPvcId ? 'Yes' : 'No' },
          pvc_id_type: { label: 'PVC ID Type', value: courseInformation?.pvcIdType },
          pvc_student_price: { label: 'PVC Student Price', value: courseInformation?.pvcStudentPrice },
          pvc_professional_price: { label: 'PVC Professional Price', value: courseInformation?.pvcProfessionalPrice },
        }

        const rows = selectedFields
          .filter((field: string) => infoMap[field])
          .map((field: string) => ({
            key: field,
            label: infoMap[field].label,
            value: infoMap[field].value,
          }))
          .filter((row: any) => row.value !== null && row.value !== undefined && row.value !== "")

        return (
          <div className="space-y-4 border-b pb-6 mb-6" key={comp.id}>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">{comp.label || "Course Information"}</h3>
            </div>
            <div className="rounded-lg border bg-amber-50/50 p-4 space-y-2">
              {rows.length > 0 ? (
                <>
                  {rows.map((item: any) => (
                    <div key={item.key} className="flex items-center justify-between text-sm gap-4">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">
                        {typeof item.value === "number"
                          ? `PHP ${Number(item.value).toLocaleString()}`
                          : String(item.value)}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No course information is configured yet.</p>
              )}
            </div>
          </div>
        )
      }

      case 'custom_input':
        return (
          <div className="space-y-2 mb-6" key={comp.id}>
            <Label>{comp.label} {comp.required && "*"}</Label>
            <Input 
              required={comp.required} 
              placeholder={comp.placeholder} 
              className={validationErrors[comp.id] ? "border-red-500" : ""}
              onChange={(e) => handleChange(comp.id, e.target.value)}
            />
          </div>
        )

      case 'custom_select':
        return (
          <div className="space-y-2 mb-6" key={comp.id}>
            <Label>{comp.label} {comp.required && "*"}</Label>
            <Select onValueChange={(val) => handleChange(comp.id, val)}>
              <SelectTrigger className={validationErrors[comp.id] ? "border-red-500" : ""}>
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
            <RadioGroup
              onValueChange={(val) => handleChange(comp.id, val)}
              className={validationErrors[comp.id] ? "rounded-md border border-red-500 p-2" : ""}
            >
              {comp.options?.map((opt: string) => (
                <div className="flex items-center space-x-2" key={opt}>
                  <RadioGroupItem value={opt} id={`${comp.id}-${opt}`} />
                  <Label htmlFor={`${comp.id}-${opt}`}>{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )

      case 'custom_file_upload':
        return (
          <div className="space-y-2 mb-6" key={comp.id}>
            <Label>{comp.label} {comp.required && "*"}</Label>
            {comp.placeholder && (
              <p className="text-xs text-muted-foreground">{comp.placeholder}</p>
            )}
            <div className={`border-2 border-dashed rounded-lg p-4 bg-muted/20 ${validationErrors[comp.id] ? "border-red-500" : ""}`}>
              <Button
                variant={formData[comp.id] ? "secondary" : "outline"}
                size="sm"
                className="h-8 text-xs gap-2"
                onClick={() => triggerUpload(comp.id)}
                disabled={!!uploading}
              >
                {uploading === comp.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : formData[comp.id] ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {formData[comp.id] ? "Change File" : "Upload File"}
              </Button>
              {formData[comp.id] && (
                <a
                  href={formData[comp.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-xs text-primary underline break-all"
                >
                  View uploaded file
                </a>
              )}
            </div>
          </div>
        )

      case 'downloadable_file':
        const downloadAckKey = getDownloadAckKey(comp.id)
        const isDownloaded = !!formData[downloadAckKey]
        return (
          <div
            className={`space-y-3 mb-6 border rounded-lg p-4 bg-blue-50/40 ${validationErrors[downloadAckKey] ? "border-red-500" : ""}`}
            key={comp.id}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <Label className="font-semibold">{comp.label || "Downloadable File"}</Label>
            </div>
            {comp.description && (
              <p className="text-sm text-muted-foreground">{comp.description}</p>
            )}
            {comp.fileUrl ? (
              <div className="space-y-2">
                <a
                  href={comp.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={comp.fileName || true}
                  onClick={() => handleChange(downloadAckKey, true)}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  {comp.fileName || "Download File"}
                </a>
                <p className={`text-xs ${isDownloaded ? "text-green-600" : "text-muted-foreground"}`}>
                  {isDownloaded
                    ? "Download acknowledged. You can proceed."
                    : "Please click download before completing registration."}
                </p>
                {validationErrors[downloadAckKey] && (
                  <p className="text-xs text-red-500">
                    You must click and download this file before submitting.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No file attached yet.</p>
            )}
          </div>
        )

      case 'rich_text':
        return (
          <div className="space-y-3 mb-6" key={comp.id}>
            {comp.label && <Label className="font-semibold">{comp.label}</Label>}
            <div
              className="rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_strong]:font-semibold [&_em]:italic"
              dangerouslySetInnerHTML={{
                __html: comp.content || "",
              }}
            />
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
          
          <div className="pt-6 border-t">
            <div className="mb-4 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              By continuing, you acknowledge that you have read our{" "}
              <Link href="/privacy-policy" className="font-medium text-primary underline">
                Privacy Policy
              </Link>
              .
            </div>
            <div className="mb-4 flex items-start gap-3 rounded-md border bg-background p-3">
              <Checkbox
                id="privacy-policy-agreement-custom"
                checked={agreedToPrivacy}
                onCheckedChange={(checked) => setAgreedToPrivacy(Boolean(checked))}
                className="mt-0.5 h-5 w-5 border-2 border-slate-700 data-[state=checked]:border-slate-900 data-[state=checked]:bg-slate-900 dark:border-slate-300 dark:data-[state=checked]:border-slate-100 dark:data-[state=checked]:bg-slate-100"
              />
              <Label
                htmlFor="privacy-policy-agreement-custom"
                className="cursor-pointer text-xs leading-relaxed text-foreground font-medium"
              >
                I have read and agree to the Privacy Policy.
              </Label>
            </div>
          </div>

          <div className="flex justify-between items-center">
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
                onClick={() => {
                  if (!validateBeforeSubmit()) return
                  if (!agreedToPrivacy) {
                    toast.error("Please agree to the Privacy Policy before completing registration.")
                    return
                  }
                  onSave(formData)
                }} 
                disabled={isSubmitting || !agreedToPrivacy}
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
        accept="*/*"
      />
    </div>
  )
}
