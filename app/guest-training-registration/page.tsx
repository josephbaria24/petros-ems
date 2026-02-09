//app\guest-training-registration\page.tsx
"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { Check, User, Briefcase, Upload, ArrowLeft, CreditCard, Calendar, CheckCircle2, Crop, X, XCircle, AlertTriangle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import welcomeAnimation from '@/public/welcome.json';
import Lottie from 'lottie-react';
import { checkDuplicateRegistration, DuplicateRegistrationHandler } from "@/components/duplicate-registration-handler"





// Custom Searchable Dropdown Component
function SearchableDropdown({
  items,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = ""
}: {
  items: { code: string; name: string }[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )


  const selectedItem = items.find(item => item.code === value || item.name === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (isOpen && !target.closest('.custom-dropdown-container')) {
        setIsOpen(false)
        setSearch("")
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className={`relative custom-dropdown-container ${className}`}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-left font-normal"
      >
        <span className="truncate block">
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2 border-b">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                e.stopPropagation()
                setSearch(e.target.value)
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div 
            className="max-h-[200px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.code}
                  className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
                    (value === item.code || value === item.name) ? "bg-accent" : ""
                  }`}
                  onClick={() => {
                    onChange(item.code)
                    setIsOpen(false)
                    setSearch("")
                  }}
                >
                  {item.name}
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuestTrainingRegistration() {
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [duplicateData, setDuplicateData] = useState<any>(null)
  const [duplicateBookingRef, setDuplicateBookingRef] = useState<string>("")
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null)


  const [step, setStep] = useState(0)
  const [form, setForm] = useState<any>({})
  const [uploading, setUploading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [scheduleRange, setScheduleRange] = useState<{ start_date: string; end_date: string } | null>(null)
  const [couponCode, setCouponCode] = useState("")
  const [discount, setDiscount] = useState<number>(0)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [bookingReference, setBookingReference] = useState<string>("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [course, setCourse] = useState<any>(null)
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([])
  const [paymentMethod, setPaymentMethod] = useState("BPI")
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({})

  const [scheduleId, setScheduleId] = useState<string>("")


  
// First, add this helper function at the top of your component (around line 500):
const getPvcFee = () => {
  if (!course?.has_pvc_id) return 0;
  
  // If course has PVC included and no discount, PVC is free (already in price)
  if (course.pvc_id_type === 'included' && discount === 0) {
    return 0;
  }
  
  // If course has PVC optional OR has discount, charge based on employment status
  if (course.pvc_id_type === 'optional' || discount > 0) {
    // Determine if user is student/unemployed
    const isStudent = form.employment_status === 'Unemployed' && form.is_student;
    const isUnemployed = form.employment_status === 'Unemployed';
    
    // Use student price for students/unemployed
    if (isStudent || isUnemployed) {
      return course.pvc_student_price || 150; // fallback to 150
    }
    
    // Use professional price for employed
    return course.pvc_professional_price || 300; // fallback to 300
  }
  
  return 0;
};



    // Add state for schedule event type
const [scheduleEventType, setScheduleEventType] = useState<string>("")

  const [voucherCode, setVoucherCode] = useState("")
  const [voucherDetails, setVoucherDetails] = useState<any>(null)
  const [isVerifyingVoucher, setIsVerifyingVoucher] = useState(false)
  const [voucherError, setVoucherError] = useState("")

  const requiredPersonalFields = [
    "first_name",
    "last_name",
    "phone_number",
    "email",
    "gender",
    "age",
    "mailing_street",
    "mailing_city",
    "mailing_province",
    "employment_status",
  ]

  const requiredEmploymentFields: string[] = [
  "company_name",
  "company_position",
  "company_industry",
  "company_email",
  "company_city",
  "company_region",
  "total_workers",
]

  const validateStep3 = () => {
    if (!form.id_picture_url) {
      toast.error("Please upload a valid ID.")
      return false
    }
    if (!form.picture_2x2_url) {
      toast.error("Please upload a 2x2 photo.")
      return false
    }
    return true
  }

const validateStep1 = async () => {
  const newErrors: any = {}
  let firstErrorField: string | null = null

  requiredPersonalFields.forEach((field) => {
    if (!form[field] || form[field].toString().trim() === "") {
      newErrors[field] = true
      if (!firstErrorField) firstErrorField = field
    }
  })

  if (form.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      newErrors.email = true
      if (!firstErrorField) firstErrorField = "email"
      toast.error("Please enter a valid email address.")
    }
  }

  if (form.phone_number) {
    const phoneDigits = form.phone_number.replace(/\D/g, "")
    if (phoneDigits.length < 12) {
      newErrors.phone_number = true
      if (!firstErrorField) firstErrorField = "phone_number"
      toast.error("Please enter a complete mobile number.")
    }
  }

  setErrors(newErrors)

  if (firstErrorField) {
    const element = document.getElementById(firstErrorField)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      element.focus()
    }
    if (!Object.keys(newErrors).includes("email") && !Object.keys(newErrors).includes("phone_number")) {
      toast.error("Please complete all required personal details.")
    }
    return false
  }

  // ✅ NEW: Check for duplicate registration before proceeding
  if (!isEditMode) {
    const scheduleId = new URLSearchParams(window.location.search).get("schedule_id")
    if (scheduleId && form.email && form.phone_number) {
      const duplicateCheck = await checkDuplicateRegistration(
        scheduleId,
        form.email,
        form.phone_number
      )

      if (duplicateCheck.isDuplicate) {
        setDuplicateData(duplicateCheck.data)
        setDuplicateBookingRef(duplicateCheck.bookingRef || "")
        setShowDuplicateDialog(true)
        return false
      }
    }
  }

  return true
}




const handleProceedWithNewRegistration = () => {
  // User wants to create a new registration despite duplicate
  setShowDuplicateDialog(false)
  setDuplicateData(null)
  setDuplicateBookingRef("")
  
  // Proceed to next step
  if (form.employment_status === "Unemployed") {
    setStep(3)
  } else {
    setStep(2)
  }
}

const handleEditExistingRegistration = (existingData: any) => {
  setIsEditMode(true)
  setEditingTrainingId(existingData.id)
  
  setForm({
    ...existingData,
    first_name: existingData.first_name || "",
    last_name: existingData.last_name || "",
    middle_initial: existingData.middle_initial || "",
    suffix: existingData.suffix || "",
    courtesy_title: existingData.courtesy_title || "",
    email: existingData.email || "",
    phone_number: existingData.phone_number || "",
    gender: existingData.gender || "",
    age: existingData.age || "",
    mailing_street: existingData.mailing_street || "",
    mailing_city: existingData.mailing_city || "",
    mailing_province: existingData.mailing_province || "",
    employment_status: existingData.employment_status || "",
    company_name: existingData.company_name || "",
    company_position: existingData.company_position || "",
    company_industry: existingData.company_industry || "",
    company_email: existingData.company_email || "",
    company_landline: existingData.company_landline || "",
    company_city: existingData.company_city || "",
    company_region: existingData.company_region || "",
    total_workers: existingData.total_workers || null,  // ✅ CHANGE THIS LINE - use null instead of ""
    id_picture_url: existingData.id_picture_url || "",
    picture_2x2_url: existingData.picture_2x2_url || "",
    is_student: existingData.is_student || false,
    school_name: existingData.school_name || "",
    add_pvc_id: existingData.add_pvc_id || false,
  })

  if (existingData.id_picture_url) {
    setIdPreview(existingData.id_picture_url)
  }
  if (existingData.picture_2x2_url) {
    setPhotoPreview(existingData.picture_2x2_url)
  }

  setBookingReference(duplicateBookingRef)
  toast.success("Loaded existing registration for editing")
  setShowDuplicateDialog(false)
  setStep(1)
}



useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  setScheduleId(params.get("schedule_id") || "")
}, [])


  const validateStep2 = () => {
  if (form.employment_status !== "Employed") return true

  const newErrors: any = {}
  let firstErrorField: string | null = null

  requiredEmploymentFields.forEach((field: string) => {
    if (!form[field] || form[field].toString().trim() === "") {
      newErrors[field] = true
      if (!firstErrorField) firstErrorField = field
    }
  })

  // Email format check
  if (form.company_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.company_email)) {
      newErrors.company_email = true
      firstErrorField ??= "company_email"
      toast.error("Please enter a valid company email.")
    }
  }

  setErrors((prev) => ({ ...prev, ...newErrors }))

  if (firstErrorField) {
    const el = document.getElementById(firstErrorField)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
    el?.focus()
    toast.error("Please complete all required employment details.")
    return false
  }

  return true
}

useEffect(() => {
  const fetchCourseAndSchedule = async () => {
    const scheduleId = new URLSearchParams(window.location.search).get("schedule_id")
    if (!scheduleId) {
      console.log("No schedule_id found in URL")
      return
    }

    console.log("Fetching data for schedule_id:", scheduleId)

    try {
      const { data: scheduleData, error: scheduleError } = await tmsDb
        .from("schedules")
        .select(`
          course_id,
          schedule_type,
          event_type,
          schedule_ranges (start_date, end_date),
          schedule_dates (date)
        `)
        .eq("id", scheduleId)
        .single()

      console.log("Schedule data:", scheduleData)

      if (scheduleError) {
        console.error("Error fetching schedule:", scheduleError)
        return
      }

      if (!scheduleData) {
        console.log("No schedule data found")
        return
      }

      // ✅ Set event type FIRST
      if (scheduleData?.event_type) {
        setScheduleEventType(scheduleData.event_type)
      }

      if (scheduleData.course_id) {
       const { data: courseData, error: courseError } = await tmsDb
          .from("courses")
          .select(`
            *,
            has_pvc_id,
            pvc_id_type,
            pvc_student_price,
            pvc_professional_price
          `)
          .eq("id", scheduleData.course_id)
          .single()

        console.log("Course data:", courseData)
        
        if (courseError) {
          console.error("Error fetching course:", courseError)
        } else {
          setCourse(courseData)
        }
      }

      if (scheduleData.schedule_type === "regular" && scheduleData.schedule_ranges?.length > 0) {
        const range = scheduleData.schedule_ranges[0]
        console.log("Setting regular range:", range)
        setScheduleRange({
          start_date: range.start_date,
          end_date: range.end_date
        })
      } else if (scheduleData.schedule_type === "staggered" && scheduleData.schedule_dates?.length > 0) {
        const dates = scheduleData.schedule_dates
          .map(d => d.date)
          .sort()
        
        console.log("Setting staggered range:", {
          start_date: dates[0],
          end_date: dates[dates.length - 1]
        })
        
        setScheduleRange({
          start_date: dates[0],
          end_date: dates[dates.length - 1]
        })
      } else {
        console.log("No valid schedule dates found")
      }
    } catch (error) {
      console.error("Unexpected error:", error)
    }
  }

  fetchCourseAndSchedule()
  
  const bookingRef = Math.floor(Math.random() * 9000000 + 1000000).toString()
  setBookingReference(bookingRef)
}, [])


useEffect(() => {
  fetch("/regions.json")
    .then(res => {
      if (!res.ok) throw new Error("Failed to load regions")
      return res.json()
    })
    .then(setRegions)
    .catch(err => console.error("Failed to load local regions", err))
}, [])

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  // Check if same date
  if (start === end) {
    return startDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
  }
  
  // Check if same month and year
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit' })}–${endDate.toLocaleDateString('en-US', { day: '2-digit' })}, ${endDate.getFullYear()}`
  } 
  
  // Check if same year but different months
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit' })} – ${endDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit' })}, ${endDate.getFullYear()}`
  }
  
  // Different years
  return `${startDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}`
}
  const handleDownloadSummary = async () => {
    const element = document.getElementById("summary-download");
    if (!element) {
      toast.error("Summary not found.");
      return;
    }

    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, imgHeight);
    pdf.save(`Booking-Summary-${bookingReference}.pdf`);
  };

const handleRegionChange = (regionCode: string) => {
  const selectedRegion = regions.find(r => r.code === regionCode)

  setForm((prev: any) => ({
    ...prev,
    company_region: selectedRegion?.name || regionCode,
  }))
}





// Add this to your existing state declarations (around line 40)
const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])


// Add this useEffect to fetch industries (place it after your existing useEffects, around line 180)
useEffect(() => {
  const fetchIndustries = async () => {
    try {
      const { data, error } = await tmsDb
        .from("industries")
        .select("id, name")
        .order("display_order")

      if (error) {
        console.error("Error fetching industries:", error)
        toast.error("Failed to load industries")
        return
      }

      setIndustries(data || [])
    } catch (err) {
      console.error("Unexpected error fetching industries:", err)
    }
  }

  fetchIndustries()
}, [])

// Complete handleVerifyVoucher function
const handleVerifyVoucher = async () => {
  if (!voucherCode.trim()) {
    setVoucherError("Please enter a voucher code")
    return
  }

  setIsVerifyingVoucher(true)
  setVoucherError("")
  setVoucherDetails(null)

  try {
    const { data, error } = await tmsDb
      .from("vouchers")
      .select("*")
      .eq("code", voucherCode.trim().toUpperCase())
      .single()

    if (error || !data) {
      setVoucherError("This voucher code does not exist.")
      toast.error("Invalid voucher code")
      setIsVerifyingVoucher(false)
      return
    }

    // Check expiry
    const isExpired = data.expiry_date && new Date(data.expiry_date) < new Date()
    
    // Check if voucher is fully used (batch or single)
    const isFullyUsed = data.is_batch 
      ? data.batch_remaining <= 0 
      : data.is_used

    if (isFullyUsed) {
      setVoucherError(
        data.is_batch 
          ? "This batch voucher has no remaining uses." 
          : "This voucher has already been used."
      )
      toast.error("Voucher fully used")
      setIsVerifyingVoucher(false)
      return
    }

    if (isExpired) {
      setVoucherError("This voucher has expired.")
      toast.error("Voucher expired")
      setIsVerifyingVoucher(false)
      return
    }

    // Check if voucher is for the correct course
if (data.service_id && course?.id !== data.service_id) {
  setVoucherError("This voucher is not valid for the selected course.")
  toast.error("Invalid voucher for this course")
  setIsVerifyingVoucher(false)
  return
}
    // Voucher is valid
    setVoucherDetails(data)
    
    // Calculate discount amount
    let discountAmount = 0
    if (data.voucher_type === "Free") {
      discountAmount = getApplicableFee() || 0
    } else {
      // Parse discount amount (e.g., "20%" or "₱500")
      const amountStr = data.amount.replace(/₱/g, "").trim()
      if (amountStr.includes("%")) {
        const percentage = parseFloat(amountStr.replace("%", ""))
        discountAmount = ((getApplicableFee() || 0) * percentage) / 100
      } else {
        discountAmount = parseFloat(amountStr) || 0
      }
    }
    
    setDiscount(discountAmount)
    
    const remainingText = data.is_batch 
      ? ` (${data.batch_remaining} uses remaining)` 
      : ""
    
    toast.success(`Voucher applied successfully!${remainingText}`, {
      description: `You saved ₱${discountAmount.toLocaleString()}`
    })
  } catch (err) {
    console.error("Voucher verification error:", err)
    setVoucherError("Failed to verify voucher. Please try again.")
    toast.error("Verification failed")
  } finally {
    setIsVerifyingVoucher(false)
  }
}




const handleRemoveVoucher = () => {
  setVoucherCode("")
  setVoucherDetails(null)
  setVoucherError("")
  setDiscount(0)
  toast.info("Voucher removed")
}



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "phone_number") {
      let digits = value.replace(/\D/g, "");
      if (!digits.startsWith("63")) digits = "63" + digits;
      let formatted = "+" + digits.slice(0, 2);

      if (digits.length > 2) formatted += " " + digits.slice(2, 5);
      if (digits.length > 5) formatted += " " + digits.slice(5, 8);
      if (digits.length > 8) formatted += " " + digits.slice(8, 12);

      setForm((prev: any) => ({ ...prev, phone_number: formatted }));
      return;
    }

    if (name === "birthday") {
      const birth = new Date(value);
      const age = new Date().getFullYear() - birth.getFullYear();
      setForm((prev: any) => ({
        ...prev,
        birthday: value,
        age
      }));
      return;
    }

    if (name === "middle_initial") {
      const sanitized = value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
      setForm((prev: any) => ({ ...prev, middle_initial: sanitized }));
      return;
    }

    const autoCapitalizeFields = [
      "first_name",
      "last_name",
      "suffix"
    ];

    let formattedValue = value;

    if (autoCapitalizeFields.includes(name)) {
      formattedValue = value.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    setForm((prev: any) => ({
      ...prev,
      [name]: formattedValue
    }));

    setErrors((prev) => ({ ...prev, [name]: false }));
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    setUploading(true);
  
    const reader = new FileReader();
    reader.onloadend = async () => {
      const previewUrl = reader.result as string;
  
      if (field === "picture_2x2_url") {
        setPhotoPreview(previewUrl);
      } else if (field === "id_picture_url") {
        setIdPreview(previewUrl);
      }
  
      try {
        const formData = new FormData();
        formData.append("image", file);
  
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
  
        const result = await res.json();
  
        if (res.ok) {
          setForm((prevForm: any) => ({
            ...prevForm,
            [field]: result.url,
          }));
          toast.success("Image uploaded successfully!");
        } else {
          toast.error("Upload failed: " + result.error);
        }
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Unexpected upload error.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };



const getApplicableFee = () => {
  if (!course) return 0;
  
  const eventType = scheduleEventType.toLowerCase();
  
  if (eventType === 'online') {
    return Number(course.online_fee) || 0;
  } else if (eventType === 'face-to-face') {
    return Number(course.face_to_face_fee) || 0;
  } else if (eventType === 'elearning') {
    return Number(course.elearning_fee) || 0;
  }
  
  return Number(course.training_fee) || 0;
};

const getEventTypeLabel = () => {
  const typeMap: { [key: string]: string } = {
    'online': 'Online',
    'face-to-face': 'Face-to-Face',
    'elearning': 'E-Learning'
  };
  
  return typeMap[scheduleEventType.toLowerCase()] || scheduleEventType;
};

// Update your handleSubmit function to handle both create and update:
const handleSubmit = async () => {
  toast.loading(isEditMode ? "Updating registration..." : "Submitting registration...")

  const searchParams = new URLSearchParams(window.location.search)
  const scheduleId = searchParams.get("schedule_id")

  if (!scheduleId) {
    toast.error("Missing schedule ID")
    return
  }

  try {
    // ✅ FIXED: Fetch schedule details only once
    const { data: scheduleDetails, error: scheduleDetailsError } = await tmsDb
      .from("schedules")
      .select("batch_number, course_id")
      .eq("id", scheduleId)
      .single()

    if (scheduleDetailsError) {
      console.error("Schedule fetch error:", scheduleDetailsError)
      toast.error("Failed to retrieve schedule details.")
      return
    }

    if (!scheduleDetails) {
      toast.error("Schedule not found.")
      return
    }

    const courseId = scheduleDetails.course_id
    const batchNumber = scheduleDetails.batch_number

    // Log for debugging
    console.log("📊 Schedule Details:", {
      scheduleId,
      courseId,
      batchNumber,
    })

    if (!batchNumber) {
      console.warn("⚠️ Warning: Schedule has no batch number assigned!")
    }

    const { data: courseData, error: feeError } = await tmsDb
      .from("courses")
      .select("training_fee, online_fee, face_to_face_fee, elearning_fee, name")
      .eq("id", courseId)
      .single()

    if (feeError) console.error("Error fetching course fee:", feeError)

    const trainingFee = courseData?.training_fee || 0

    const trainingPayload = {
      ...form,
      schedule_id: scheduleId,
      course_id: courseId,
      batch_number: batchNumber,
      status: isEditMode ? form.status || "pending" : "pending",
      payment_method: paymentMethod,
      payment_status: isEditMode 
        ? form.payment_status || (paymentMethod === "COUNTER" ? "pending" : "awaiting receipt")
        : (paymentMethod === "COUNTER" ? "pending" : "awaiting receipt"),
      amount_paid: isEditMode ? form.amount_paid || 0 : 0,
      courtesy_title: form.courtesy_title || null,
      discounted_fee: discount > 0 ? (getApplicableFee() || 0) - discount : null,
      has_discount: discount > 0,
      add_pvc_id: form.add_pvc_id || false,
      pvc_fee: form.add_pvc_id ? getPvcFee() : null, 
      is_student: form.employment_status === "Unemployed" ? !!form.is_student : false,
      school_name: form.employment_status === "Unemployed" && form.is_student ? form.school_name : null,
      total_workers: form.employment_status === "Employed" && form.total_workers ? parseInt(form.total_workers) : null,
    }

    let trainingId: string

    if (isEditMode && editingTrainingId) {
      // ✅ UPDATE existing training
      const { error: updateError } = await tmsDb
        .from("trainings")
        .update(trainingPayload)
        .eq("id", editingTrainingId)

      if (updateError) {
        console.error("Update training error:", updateError)
        toast.error("Failed to update registration.")
        return
      }

      trainingId = editingTrainingId
      
      toast.dismiss()
      toast.success("Registration updated successfully!", { duration: 3000 })
    } else {
      // ✅ INSERT new training
      const { data: insertedTraining, error: insertError } = await tmsDb
        .from("trainings")
        .insert([trainingPayload])
        .select("id")
        .single()

      if (insertError || !insertedTraining) {
        console.error("Insert training error:", insertError)
        toast.error("Failed to submit registration.")
        return
      }

      trainingId = insertedTraining.id

      // Create booking summary for new registrations
      const { error: bookingError } = await tmsDb
        .from("booking_summary")
        .insert([
          {
            training_id: trainingId,
            reference_number: bookingReference,
          },
        ])

      if (bookingError) {
        console.error("Booking summary insert error:", bookingError)
        toast.error("Failed to create booking summary.")
        return
      }

      toast.dismiss()
      toast.success("Registration submitted successfully!", { duration: 3000 })
    }

    // Mark voucher as used if applied
    if (voucherDetails && !isEditMode) {
      if (voucherDetails.is_batch) {
        const newRemaining = voucherDetails.batch_remaining - 1
        const newUsed = voucherDetails.batch_used + 1
        const isFullyUsed = newRemaining <= 0

        const { error: voucherUpdateError } = await tmsDb
          .from("vouchers")
          .update({ 
            batch_remaining: newRemaining,
            batch_used: newUsed,
            is_used: isFullyUsed
          })
          .eq("code", voucherDetails.code)

        if (voucherUpdateError) {
          console.error("Failed to update batch voucher:", voucherUpdateError)
        } else {
          const { error: usageLogError } = await tmsDb
            .from("voucher_usage")
            .insert([{
              voucher_id: voucherDetails.id,
              used_by: `${form.first_name} ${form.last_name}`,
              training_id: trainingId
            }])
          
          if (usageLogError) {
            console.error("Failed to log voucher usage:", usageLogError)
          }
        }
      } else {
        const { error: voucherUpdateError } = await tmsDb
          .from("vouchers")
          .update({ is_used: true })
          .eq("code", voucherDetails.code)

        if (voucherUpdateError) {
          console.error("Failed to mark voucher as used:", voucherUpdateError)
        }
      }
    }

    setIsSubmitted(true)

    // Send emails only for new registrations
    if (!isEditMode) {
      // Send admin notification email
      try {
        await fetch("/api/send-registration-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingReference,
            courseName: courseData?.name || course?.name || "N/A",
            scheduleRange: scheduleRange
              ? {
                  startDate: scheduleRange.start_date,
                  endDate: scheduleRange.end_date
                }
              : null,
            traineeInfo: {
              name: `${form.first_name} ${form.middle_initial || ""} ${form.last_name}`.trim(),
              email: form.email,
              phone: form.phone_number,
              gender: form.gender,
              age: form.age,
              address: `${form.mailing_street}, ${form.mailing_city}, ${form.mailing_province}`,
              employmentStatus: form.employment_status,
            },
            employmentInfo:
              form.employment_status === "Employed"
                ? {
                    companyName: form.company_name,
                    position: form.company_position,
                    industry: form.company_industry,
                    companyEmail: form.company_email,
                    city: form.company_city,
                    region: form.company_region,
                  }
                : null,
           paymentInfo: {
            trainingFee: getApplicableFee(),
            discount,
            pvcIdFee: form.add_pvc_id ? getPvcFee() : 0,  // ✅ NEW
            totalAmount: getApplicableFee() - discount + (form.add_pvc_id ? getPvcFee() : 0),  // ✅ NEW
            paymentMethod,
            paymentStatus: paymentMethod === "COUNTER" ? "Pending" : "Awaiting receipt",
          },
          }),
        })
        console.log("Admin notification email sent")
      } catch (emailErr) {
        console.error("Admin email sending failed:", emailErr)
      }

      // Send booking summary to trainee
      try {
        await fetch("/api/send-booking-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: form.email,
            bookingReference,
            courseName: courseData?.name || course?.name || "N/A",
            scheduleRange: scheduleRange
              ? {
                  startDate: scheduleRange.start_date,
                  endDate: scheduleRange.end_date
                }
              : null,
            traineeInfo: {
              name: `${form.first_name} ${form.middle_initial || ""} ${form.last_name}`.trim(),
              email: form.email,
              phone: form.phone_number,
              gender: form.gender,
              age: form.age,
              address: `${form.mailing_street}, ${form.mailing_city}, ${form.mailing_province}`,
              employmentStatus: form.employment_status,
            },
            employmentInfo:
              form.employment_status === "Employed"
                ? {
                    companyName: form.company_name,
                    position: form.company_position,
                    industry: form.company_industry,
                    companyEmail: form.company_email,
                    city: form.company_city,
                    region: form.company_region,
                  }
                : null,
           paymentInfo: {
              trainingFee: getApplicableFee(),
              discount,
              pvcIdFee: form.add_pvc_id ? getPvcFee() : 0,  // ✅ NEW
              totalAmount: getApplicableFee() - discount + (form.add_pvc_id ? getPvcFee() : 0),  // ✅ NEW
              paymentMethod,
              paymentStatus: paymentMethod === "COUNTER" ? "Pending" : "Awaiting receipt",
            },
          }),
        })
        console.log("Booking summary email sent to trainee")
      } catch (emailErr) {
        console.error("Trainee email sending failed:", emailErr)
      }
    }

  } catch (err) {
    console.error("Unexpected error:", err)
    toast.error("Something went wrong.")
  }
}
  const isEmployed = form.employment_status === "Employed"
  
  const steps = [
    { id: 1, title: "Personal Details", subtitle: "Tell us a bit about yourself", icon: User, completed: step > 1 },
    ...(isEmployed ? [{ id: 2, title: "Employment Details", subtitle: "Share your employment information", icon: Briefcase, completed: step > 2 }] : []),
    { id: 3, title: "Verification Details", subtitle: "Upload your identification documents", icon: Upload, completed: step > 3 },
    { id: 4, title: "Confirmation", subtitle: "You're all set! Enjoy your journey.", icon: CheckCircle2, completed: step > 4 }
  ]
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-white to-emerald-50 flex items-center justify-center p-2 sm:p-4 md:p-8">
      <div className="w-full max-w-7xl h-full flex gap-2 sm:gap-4 md:gap-8">
      <div className="hidden lg:flex lg:w-[45%] rounded-3xl bg-banded text-black p-8 flex-col backdrop-blur-sm shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-0">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Training Registration</h1>
            {/* {course && (
              <div className="border rounded-xl inline-block p-3 mt-2">
                <p className="text-md text-white/90 font-bold m-0 mb-1">
                  {course.name}
                </p>
                {scheduleEventType && (
                  <p className={`text-xs font-semibold m-0 ${
                    scheduleEventType === 'online' 
                      ? 'text-emerald-300' 
                      : scheduleEventType === 'face-to-face'
                      ? 'text-blue-300'
                      : 'text-purple-300'
                  }`}>
                    {getEventTypeLabel()} Training
                  </p>
                )}
              </div>
            )} */}
        </div>

        <div className="space-y-0 flex-1 pt-10">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.id
            const isCompleted = s.completed
            
            return (
              <div key={s.id} className="flex items-start gap-4 ">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all ${
                    isCompleted ? "bg-emerald-500 border-emerald-500" : 
                    isActive ? "bg-primary border-slate-500 text-white" : 
                    "bg-slate-300 border-slate-400"
                  }`}>
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-0.5 h-16 mt-0 ${
                      isCompleted ? "bg-emerald-500" : "bg-slate-600"
                    }`}></div>
                  )}
                </div>
                
                <div className="flex-1 pt-2">
                  <h3 className={`font-semibold text-sm ${isActive ? "text-primary" : "text-slate-600"}`}>
                    {s.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{s.subtitle}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className=" border-0 p-3 rounded-2xl">
          <h3 className="font-semibold mb-2 text-primary">Complete your registration!</h3>
          <p className="text-sm text-slate-600">Start your training career now.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/40 overflow-hidden">
        {step > 0 && (
          <div className="p-2 sm:p-4 flex items-center justify-between border-b">
            <Button 
              variant="ghost"
              onClick={() => {
                if (step === 3 && form.employment_status === "Unemployed") {
                  setStep(1)
                } else {
                  setStep(Math.max(0, step - 1))
                }
              }}
              className="flex items-center gap-2 rounded-2xl border-1 cursor-pointer font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>

            {/* Course + Event Type Badge */}
            {course && scheduleEventType && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {course.name}
                    </p>
                    <p className={`text-[10px] font-medium leading-tight ${
                      scheduleEventType === 'online' 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : scheduleEventType === 'face-to-face'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-purple-600 dark:text-purple-400'
                    }`}>
                      {getEventTypeLabel()}
                    </p>
                  </div>
                </div>

                {/* Mobile version - icon only */}
                <div className="sm:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  {/* <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" /> */}
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {course.name}
                    </p>
                    <p className={`text-[10px] font-medium leading-tight ${
                      scheduleEventType === 'online' 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : scheduleEventType === 'face-to-face'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-purple-600 dark:text-purple-400'
                    }`}>
                      {getEventTypeLabel()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8 flex items-center justify-center">
         <div className="w-full max-w-2xl overflow-auto max-h-full px-1 sm:px-0">
            
            {step === 0 && (
             <div className="text-center space-y-4 sm:space-y-6 md:space-y-8">
    <div className="inline-flex px-4 py-2 from-slate-800 to-slate-700">
      <img src="/trans-logo-dark.png" alt="logo" className="w-60 h-auto" />
    </div>
    <div className="flex flex-col items-center space-y-6">
      <Lottie 
  animationData={welcomeAnimation} 
  loop={true}
  autoplay={true}
  style={{ width: '300px', height: '300px' }}
/>
    </div>

    <div className="space-y-3">
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 font-welcome">
        Welcome!
      </h2>
      <p className="text-lg text-gray-600 max-w-md mx-auto">
        Begin your training journey with us. Please complete all required fields to get started.
      </p>
    </div>
    
    <div className="max-w-md mx-auto">
      <Button 
        variant={"default"}
        onClick={() => setStep(1)}
        size="lg"
        className="w-full border-1 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg font-semibold cursor-pointer"
      >
        <div className="flex items-center justify-center gap-3">
          <User className="w-6 h-6" />
          <span>Start Your Registration</span>
        </div>
      </Button>
      
      <p className="text-sm text-gray-500 mt-4">
        Takes approximately 5 minutes to complete
      </p>
    </div>
  </div>
            )}
            {step === 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-3xl font-bold">Personal Details</h2>
              </div>
              <p className="text-gray-500">Tell us a bit about yourself</p>
                          
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="courtesy_title" className="text-sm font-medium">
                        Courtesy Title
                      </Label>
                      <Input
                        id="courtesy_title"
                        name="courtesy_title"
                        onChange={handleChange}
                        placeholder="e.g., Mr., Ms., Engr., Dr."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-sm font-medium">First Name *</Label>
                        <Input
                          id="first_name"
                          name="first_name"
                          value={form.first_name || ""}
                          onChange={handleChange}
                          className={errors.first_name ? "border-red-500 focus:ring-red-500" : ""}
                          placeholder="Enter first name"
                          required
                        />

                      {errors.first_name && (
                        <p className="text-red-500 text-xs">First name is required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="middle_initial" className="text-sm font-medium">Middle Initial</Label>
                      <Input id="middle_initial" name="middle_initial" value={form.middle_initial || ""} onChange={handleChange} placeholder="M.I." maxLength={1}  />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-sm font-medium">Last Name *</Label>
                      <Input
                          id="last_name"
                          name="last_name"
                          value={form.last_name || ""}
                          onChange={handleChange}
                          placeholder="Enter last name"
                          required
                        />

                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suffix" className="text-sm font-medium">Suffix</Label>
                      <Input id="suffix" name="suffix" onChange={handleChange} placeholder="Jr., Sr., etc." />
                    </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone_number" className="text-sm font-medium">Mobile Number *</Label>
                        <Input 
                          id="phone_number" 
                          name="phone_number" 
                          value={form.phone_number || ""}
                          onChange={handleChange} 
                          placeholder="+63 912 345 6789" 
                          className={errors.phone_number ? "border-red-500 focus:ring-red-500" : ""}
                          required 
                        />
                        {errors.phone_number && (
                          <p className="text-red-500 text-xs">Complete mobile number is required</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                        <Input 
                          id="email" 
                          name="email" 
                          type="email" 
                          value={form.email || ""}
                          onChange={handleChange} 
                          placeholder="email@example.com" 
                          className={errors.email ? "border-red-500 focus:ring-red-500" : ""}
                          required 
                        />
                        {errors.email && (
                          <p className="text-red-500 text-xs">Valid email address is required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender" className="text-sm font-medium">Gender *</Label>

                        <div className={errors.gender ? "border border-red-500 rounded-md p-1" : ""}>
                          <Select
                            onValueChange={(value) => {
                              setForm({ ...form, gender: value })
                              setErrors((prev) => ({ ...prev, gender: false }))
                            }}
                            defaultValue={form.gender}
                          >
                            <SelectTrigger id="gender" className="w-full">
                              <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {errors.gender && (
                          <p className="text-red-500 text-xs">Gender is required</p>
                        )}
                      </div>
                    <div className="space-y-2">
                      <Label htmlFor="age" className="text-sm font-medium">Age *</Label>
                      <Input id="age" name="age" type="number" onChange={handleChange} placeholder="18" required />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="mailing_street" className="text-sm font-medium">Street Address *</Label>
                      <Input id="mailing_street" name="mailing_street" onChange={handleChange} placeholder="House no., Street, Barangay" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mailing_city" className="text-sm font-medium">City *</Label>
                      <Input id="mailing_city" name="mailing_city" onChange={handleChange} placeholder="Enter city" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mailing_province" className="text-sm font-medium">Province *</Label>
                      <Input id="mailing_province" name="mailing_province" onChange={handleChange} placeholder="Enter province" required />
                    </div>
                  </div>

                    <div className="space-y-3 pt-2">
                      <Label className="text-sm font-medium">Employment Status *</Label>

                      <div className={errors.employment_status ? "border border-red-500 rounded-md p-2" : ""}>
                        <RadioGroup
                          value={form.employment_status || ""}
                          onValueChange={(val) => {
                            setForm((prev: any) => ({
                              ...prev,
                              employment_status: val,
                              is_student: val === "Unemployed" ? prev.is_student ?? false : false,
                              school_name: val === "Unemployed" ? prev.school_name ?? "" : null,
                            }))
                            setErrors((prev) => ({ ...prev, employment_status: false }))
                          }}

                          className="flex gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="Unemployed" id="unemployed" />
                            <Label htmlFor="unemployed" className="font-normal cursor-pointer">Unemployed</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="Employed" id="employed" />
                            <Label htmlFor="employed" className="font-normal cursor-pointer">Employed</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      {form.employment_status === "Unemployed" && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id="is_student"
                              checked={!!form.is_student}
                              onCheckedChange={(checked) =>
                                setForm((prev: any) => ({
                                  ...prev,
                                  is_student: Boolean(checked),
                                  school_name: checked ? prev.school_name ?? "" : null,
                                }))
                              }
                            />
                            <Label htmlFor="is_student" className="cursor-pointer">
                              I am currently a student
                            </Label>
                          </div>

                          {form.is_student && (
                            <div className="space-y-2">
                              <Label htmlFor="school_name" className="text-sm font-medium">
                                School / University Name *
                              </Label>
                              <Input
                                id="school_name"
                                name="school_name"
                                value={form.school_name || ""}
                                onChange={handleChange}
                                placeholder="Enter school or university"
                              />
                            </div>
                          )}
                        </div>
                      )}


                      {errors.employment_status && (
                        <p className="text-red-500 text-xs">Employment status is required</p>
                      )}
                    </div>

                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => {
                      if (!validateStep1()) return

                      if (form.employment_status === "Unemployed") {
                        setStep(3)
                      } else {
                        setStep(2)
                      }
                    }}
                    size="lg"
                    className="bg-slate-900 hover:bg-slate-700 cursor-pointer"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Employment Details</h2>
                  <p className="text-gray-600">Share your employment information</p>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name" className="text-sm font-medium">Company Name</Label>
                      <Input id="company_name" required={isEmployed} name="company_name" onChange={handleChange} placeholder="Enter company name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_position" className="text-sm font-medium">Position</Label>
                      <Input id="company_position" required={isEmployed} name="company_position" onChange={handleChange} placeholder="Your position" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_industry" className="text-sm font-medium">
                        Industry *
                      </Label>
                      <SearchableDropdown
                        items={industries.map(ind => ({ code: ind.id, name: ind.name }))}
                        value={form.company_industry || ""}
                        onChange={(industryId) => {
                          const selectedIndustry = industries.find(ind => ind.id === industryId)
                          setForm((prev: any) => ({
                            ...prev,
                            company_industry: selectedIndustry?.name || industryId,
                          }))
                          setErrors((prev) => ({ ...prev, company_industry: false }))
                        }}
                        placeholder="Select Industry"
                        className="w-full"
                        disabled={!isEmployed}
                      />
                      {errors.company_industry && (
                        <p className="text-red-500 text-xs">Industry is required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_email" className="text-sm font-medium">Company Email</Label>
                      <Input id="company_email" required={isEmployed} name="company_email" type="email" onChange={handleChange} placeholder="company@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_landline" className="text-sm font-medium">Company Landline</Label>
                      <Input id="company_landline" required={isEmployed} name="company_landline" onChange={handleChange} placeholder="(02) 1234-5678" />
                    </div>
                      <div className="space-y-2">
                          <Label htmlFor="company_city"  className="text-sm font-medium">
                            City / Municipality
                          </Label>
                          <Input
                            id="company_city"
                            name="company_city"
                            value={form.company_city || ""}
                            onChange={handleChange}
                            placeholder="Enter city or municipality"
                            required={isEmployed}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="region">Region</Label>
                          <SearchableDropdown
                            items={regions}
                            value={form.company_region || ""}
                            onChange={(regionCode) => handleRegionChange(regionCode)}
                            placeholder="Select Region"
                            className="w-full"
                            
                          />
                        </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_workers" className="text-sm font-medium">Total Number of Workers</Label>
                      <Input id="total_workers" required={isEmployed} name="total_workers" type="number" onChange={handleChange} placeholder="e.g., 50" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => {
                      if (!validateStep2()) return
                      setStep(3)
                    }}
                    size="lg"
                    className="bg-slate-900 hover:bg-slate-700 cursor-pointer"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

          {step === 3 && (
  <div className="space-y-6">
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Verification Details</h2>
      <p className="text-gray-600">Upload your identification documents</p>
    </div>

    {/* Important Notice */}
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-amber-900">Important: Photo Requirements</h4>
          <p className="text-sm text-amber-800 leading-relaxed">
            Please ensure your <strong>2x2 photo is digital and properly sized</strong>. This photo will be used for your <strong>Training Certificate and ID Card</strong>. Make sure it is:
          </p>
          <ul className="text-sm text-amber-800 list-disc list-inside space-y-1 mt-2">
            <li>Clear and high-quality (not blurry)</li>
            <li>Recent photo with white or light-colored background</li>
            <li>Formal attire (business casual or professional)</li>
            <li>Face clearly visible (no sunglasses or face coverings)</li>
            <li>Proper 2x2 dimensions (passport-style photo)</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Label htmlFor="id_picture" className="text-sm font-medium">Valid ID *</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
          <Input 
            id="id_picture"
            type="file" 
            accept="image/*" 
            onChange={(e) => handleFileChange(e, "id_picture_url")}
            className="hidden"
            required
          />
          <label htmlFor="id_picture" className="cursor-pointer block">
            {idPreview ? (
              <div className="space-y-3">
                <img src={idPreview} alt="ID Preview" className="w-full h-40 object-cover rounded-lg" />
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Uploaded</span>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900">Click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
              </div>
            )}
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="picture_2x2" className="text-sm font-medium">
          2x2 Photo * 
          <span className="text-amber-600 ml-1">(For Certificate & ID)</span>
        </Label>
        <div className="border-2 border-dashed border-amber-300 rounded-xl p-6 text-center hover:border-amber-500 transition-colors bg-amber-50/30">
          <Input 
            id="picture_2x2"
            type="file" 
            accept="image/*" 
            onChange={(e) => handleFileChange(e, "picture_2x2_url")}
            className="hidden"
            required
          />
          <label htmlFor="picture_2x2" className="cursor-pointer block">
            {photoPreview ? (
              <div className="space-y-3">
                <div className="relative w-full aspect-[1/1] rounded-lg overflow-hidden">
                  <img 
                    src={photoPreview} 
                    alt="Photo Preview" 
                    className="w-full h-full object-cover rounded-lg" 
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Uploaded</span>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="w-12 h-12 bg-amber-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">Click to upload your 2x2 photo</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  ⚠️ This will appear on your certificate
                </p>
              </div>
            )}
          </label>
        </div>
      </div>
    </div>

    <div className="flex justify-end pt-4">
      <Button 
        onClick={() => {
          if (!validateStep3()) return
          setStep(4)
        }}
        size="lg"
        className="bg-slate-900 hover:bg-slate-700 cursor-pointer"
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Continue"}
      </Button>
    </div>
  </div>
)}

            {step === 4 && (
              <div className="space-y-3">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Review & Confirm</h2>
                  <p className="text-gray-600">Please review your information before submitting</p>
                </div>

                {!isSubmitted ? (
                  <>
                    <Card className="border shadow-sm" id="booking-summary">
                      <CardContent className="px-4 space-y-4">
                        <div className="flex justify-between">
                          <h2 className="text-xl font-bold text-indigo-900">Booking Summary</h2>
                          <div className="text-sm text-gray-700 text-right">
                            <p><strong>Booking Reference:</strong> {bookingReference}</p>
                            <p><strong>Booking Date:</strong> {new Date().toLocaleDateString()}</p>
                          </div>
                        </div>

                        <fieldset className="border border-gray-300 rounded-md px-4 pt-4 pb-2 bg-slate-50 relative">
                          <legend className="text-sm font-medium px-2 text-gray-700 flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            Training Details
                          </legend>
                          <p className="text-gray-900 font-medium">{course?.name || "N/A"}</p>
                          <p className="text-gray-600 text-sm">
                            {scheduleRange ? formatDateRange(scheduleRange.start_date, scheduleRange.end_date) : "Loading..."}
                          </p>
                        </fieldset>

                        <fieldset className="border border-gray-300 rounded-md px-4 pt-4 pb-2 bg-slate-50 relative">
                          <legend className="text-sm font-medium px-2 text-gray-700 flex items-center gap-1">
                            <User className="w-4 h-4 text-gray-500" />
                            Attendee Details
                          </legend>
                          <p><strong>Name:</strong> {form.first_name} {form.middle_initial} {form.last_name} {form.suffix}</p>
                          <p><strong>Email:</strong> {form.email}</p>
                          <p><strong>Phone:</strong> {form.phone_number}</p>
                          <p><strong>Address:</strong> {form.mailing_street}, {form.mailing_city}, {form.mailing_province}</p>
                        </fieldset>
                                                  
                          <fieldset className="border border-gray-300 rounded-md px-4 pt-4 pb-2 bg-slate-50 relative">
                            <legend className="text-sm font-medium px-2 text-gray-700 flex items-center gap-1">
                              <CreditCard className="w-4 h-4 text-gray-500" />
                              Payment Details
                            </legend>

                            <p className="text-sm text-gray-900">
                              <strong>Training Fee ({getEventTypeLabel()}):</strong> ₱{getApplicableFee()?.toLocaleString() || "0.00"}
                            </p>
                         {/* Voucher Code Input */}
                          <div className="space-y-2 mt-3">
                            <Label htmlFor="voucher_code" className="text-sm font-medium">
                              Have a voucher code?
                            </Label>
                            
                            {!voucherDetails ? (
                              <div className="flex gap-2">
                                <Input
                                  id="voucher_code"
                                  placeholder="Enter voucher code"
                                  value={voucherCode}
                                  onChange={(e) => {
                                    setVoucherCode(e.target.value.toUpperCase())
                                    setVoucherError("")
                                  }}
                                  className="font-mono"
                                  maxLength={14}
                                  disabled={isVerifyingVoucher}
                                />
                                <Button
                                  type="button"
                                  onClick={handleVerifyVoucher}
                                  disabled={isVerifyingVoucher || !voucherCode.trim()}
                                  variant="outline"
                                  className="whitespace-nowrap"
                                >
                                  {isVerifyingVoucher ? "Verifying..." : "Apply"}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <div>
                                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                                      {voucherDetails.code}
                                    </p>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                      {voucherDetails.service || voucherDetails.description}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  onClick={handleRemoveVoucher}
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-1 text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
                                >
                                  Remove
                                </Button>
                              </div>
                            )}
                            
                            {voucherError && (
                              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {voucherError}
                              </p>
                            )}
                          </div>

                         {/* ✅ NEW: PVC ID Logic Based on Course Settings */}
  {course?.has_pvc_id && (
    <>
      {/* Case 1: PVC Included in original price (like BOSHSO2) */}
      {course.pvc_id_type === 'included' && discount === 0 && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-900">
              Physical PVC ID Included
            </span>
          </div>
          <p className="text-xs text-green-700">
            Your course registration includes a Physical PVC ID card at no additional cost.
          </p>
        </div>
      )}

      {/* Case 2: PVC Included course but WITH discount - show option */}
      {course.pvc_id_type === 'included' && discount > 0 && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-900 font-medium mb-2">
            ⚠️ Discounted Package: Digital ID Only
          </p>
          <p className="text-xs text-amber-700 mb-3">
            Normally this course includes a Physical PVC ID, but discounted packages include Digital ID only. 
            You can add Physical PVC ID for ₱{getPvcFee()}.
          </p>
          <div className="flex items-center gap-3">
            <Checkbox
              id="add_pvc"
              checked={!!form.add_pvc_id}
              onCheckedChange={(checked) =>
                setForm((prev: any) => ({
                  ...prev,
                  add_pvc_id: Boolean(checked),
                }))
              }
            />
            <Label htmlFor="add_pvc" className="cursor-pointer text-sm font-medium">
              Add Physical PVC ID (+₱{getPvcFee()})
            </Label>
          </div>
        </div>
      )}

      {/* Case 3: PVC Optional (like BOSHSO1) - always show option */}
      {course.pvc_id_type === 'optional' && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900 font-medium mb-2">
            📇 Optional: Physical PVC ID Card
          </p>
          <p className="text-xs text-blue-700 mb-3">
            You can optionally add a Physical PVC ID card to your registration.
            {form.employment_status === 'Unemployed' 
              ? ' Student/Unemployed rate applies.' 
              : ' Professional rate applies.'}
          </p>
          <div className="flex items-center gap-3">
            <Checkbox
              id="add_pvc"
              checked={!!form.add_pvc_id}
              onCheckedChange={(checked) =>
                setForm((prev: any) => ({
                  ...prev,
                  add_pvc_id: Boolean(checked),
                }))
              }
            />
            <Label htmlFor="add_pvc" className="cursor-pointer text-sm font-medium">
              Add Physical PVC ID (+₱{getPvcFee()})
            </Label>
          </div>
        </div>
      )}
    </>
  )}


                         {/* Discount Display */}
                      {discount > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Discount Applied: -₱{discount.toLocaleString()}
                          </p>
                        </div>
                      )}

                      {/* ✅ UPDATED: Total calculation */}
                      <div className="border-t mt-3 pt-3">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 flex justify-between">
                            <span>Course Fee:</span>
                            <span>₱{((getApplicableFee() || 0) - discount).toLocaleString()}</span>
                          </p>
                          
                          {/* Show PVC fee if user opted for it */}
                          {form.add_pvc_id && getPvcFee() > 0 && (
                            <p className="text-sm text-gray-600 flex justify-between">
                              <span>Physical PVC ID:</span>
                              <span>₱{getPvcFee().toLocaleString()}</span>
                            </p>
                          )}

                          {/* Show PVC included notice */}
                          {course?.pvc_id_type === 'included' && discount === 0 && (
                            <p className="text-xs text-green-600 italic">
                              *Physical PVC ID included in course fee
                            </p>
                          )}
                          
                          <p className="text-base text-gray-900 font-bold flex justify-between pt-2 border-t">
                            <span>Total Payable:</span>
                            <span className={discount > 0 ? "text-emerald-600" : ""}>
                              ₱{(
                                (getApplicableFee() || 0) - 
                                discount + 
                                (form.add_pvc_id ? getPvcFee() : 0)
                              ).toLocaleString()}
                            </span>
                          </p>
                        </div>
                        {discount > 0 && (
                          <p className="text-xs text-gray-500 line-through mt-1">
                            Original: ₱{getApplicableFee()?.toLocaleString() || "0.00"}
                          </p>
                        )}
                      </div>
                    </fieldset>
                        
                        <fieldset className="border border-gray-300 rounded-md px-4 pt-4 pb-2 bg-slate-50 relative">
                          <legend className="text-sm font-medium px-2 text-gray-700 flex items-center gap-1">
                            <CreditCard className="w-4 h-4 text-gray-500" />
                            Payment Method
                          </legend>

                          <div className="space-y-2 mt-2">
                            <RadioGroup
                              value={paymentMethod}
                              onValueChange={(val) => setPaymentMethod(val)}
                              className="flex flex-col gap-2"
                            >
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="BPI" id="pm-bpi" />
                                <img src="/bpi.svg" alt="BPI" className="w-8 h-8" />
                                <Label htmlFor="pm-bpi" className="cursor-pointer">BPI Bank Deposit/Transfer</Label>
                              </div>
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="GCASH" id="pm-gcash" />
                                <img src="/gcash.jpeg" alt="GCash" className="w-8 h-8 rounded-sm" />
                                <Label htmlFor="pm-gcash" className="cursor-pointer">GCash</Label>
                              </div>
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="COUNTER" id="pm-counter" />
                                <img src="/otc.svg" alt="Over the Counter" className="w-8 h-8" />
                                <Label htmlFor="pm-counter" className="cursor-pointer">Pay Over the Counter</Label>
                              </div>
                            </RadioGroup>

                            <div className="text-sm text-gray-700 mt-4 border-t pt-4">
                              {paymentMethod === "BPI" && (
                                <div>
                                  <p className="font-medium text-gray-900 mb-1">BPI Bank Deposit/Transfer</p>
                                  <p>Make your payment via deposit at any nearest BPI branches or via bank transfer with the following details:</p>
                                  <p className="mt-2"><strong>Account Name:</strong> PETROSPHERE INCORPORATED</p>
                                  <p><strong>Account Number:</strong> 3481 0038 99</p>
                                </div>
                              )}

                              {paymentMethod === "GCASH" && (
                                <div>
                                  <p className="font-medium text-gray-900 mb-1">GCash</p>
                                  <ol className="list-decimal ml-5 space-y-1">
                                    <li>Login in your GCash App and tap Bank Transfer.</li>
                                    <li>Select BPI from the list of banks.</li>
                                    <li>Enter the corresponding training fee and the following details:</li>
                                    <ul className="list-disc ml-6">
                                      <li><strong>Account Name:</strong> PETROSPHERE INCORPORATED</li>
                                      <li><strong>Account Number:</strong> 3481 0038 99</li>
                                    </ul>
                                    <li>Tap send money, review the details, then tap confirm to complete your transaction.</li>
                                    <li>Download receipt and upload it by clicking the submit payment button found below this email.</li>
                                  </ol>
                                  <p className="mt-2">If you have questions, feel free to contact us at 0917 708 7994.</p>
                                </div>
                              )}

                              {paymentMethod === "COUNTER" && (
                                <div>
                                  <p className="font-medium text-gray-900 mb-1">Pay Over the Counter</p>
                                  <p>To process your payment, drop by the office at:</p>
                                  <p className="mt-2">
                                    Unit 305 3F, Trigold Business Park,<br />
                                    Barangay San Pedro National Highway,<br />
                                    Puerto Princesa City, 5300 Palawan, Philippines
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </fieldset>

                      </CardContent>
                    </Card>

                    <Card className="border shadow-sm">
                      <CardContent className="p-6 space-y-4">
                        <h3 className="font-semibold text-gray-900">Terms and Conditions</h3>
                        <div className="max-h-64 overflow-y-auto text-sm space-y-2 bg-gray-50 p-4 rounded-lg border">
                          <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>
                              <strong>STANDARD TRAINING:</strong> Training sessions will be conducted at Petrosphere Inc. venues.
                            </li>
                            <li>
                              <strong>INCLUSION:</strong> Certificate and ID.
                            </li>
                            <li>
                              <strong>CONFIRMATION:</strong> At least FIVE (5) WORKING DAYS before the training date.
                            </li>
                            <li>
                              <strong>BILLING ARRANGEMENT:</strong> 50% down payment upon confirmation, full payment within training duration.
                            </li>
                            <li>
                              <strong>NO MULTIPLE DISCOUNT:</strong> Discounts cannot be used with other offers.
                            </li>
                            <li>
                              <strong>CANCELLATION OF RESERVATION:</strong>
                              <ol className="list-[lower-alpha] list-inside ml-4 mt-1 space-y-1">
                                <li>5 days before: 50% of total estimated cost.</li>
                                <li>2 days before or on the day: 100% of total estimated cost.</li>
                              </ol>
                            </li>
                            <li>
                              <strong>POSTPONEMENT OF SCHEDULE:</strong> Due to insufficient attendees, emergencies, or natural disasters (notice 5 days before event). Full refund within 5 days or payment may be applied to future training.
                            </li>
                            <li>
                              <strong>CONFIDENTIALITY:</strong> Both parties agree to keep this agreement private.
                            </li>
                          </ol>
                        </div>

                        <div className="flex items-start space-x-3 pt-2">
                          <Checkbox
                            id="terms"
                            checked={agreed}
                            onCheckedChange={() => setAgreed(!agreed)}
                            className="mt-1"
                          />
                          <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-gray-700">
                            I have read and agree to the terms and conditions stated above. *
                          </Label>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={() => setShowConfirmDialog(true)} 
                        disabled={!agreed}
                        size="lg"
                        className="bg-slate-900 hover:bg-slate-700 cursor-pointer"
                      >
                        Submit Registration
                      </Button>
                    </div>
                  </>
                ) : (
                  <Card style={{ border: '1px solid #d1d5db', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', backgroundColor: '#ecfdf5' }}>
                  <CardContent style={{ padding: '2rem', textAlign: 'center' }}>
                    
                    <div>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                        Registration Successful!
                      </h3>
                      <p style={{ color: '#4b5563' }}>
                        Your training registration has been submitted successfully.
                      </p>
                    </div>
                
                    <div
                      id="summary-download"
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '1.5rem',
                        borderRadius: '0.5rem',
                        border: '2px solid #a7f3d0',
                        marginTop: '1.5rem'
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                          <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                            Booking Summary
                          </h4>
                          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.25rem' }}>
                            Please save this for your records
                          </p>
                        </div>
                
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>Booking Reference:</span>
                            <span style={{ color: '#059669', fontWeight: 'bold' }}>{bookingReference}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>Booking Date:</span>
                            <span>{new Date().toLocaleDateString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>Training:</span>
                            <span>{course?.name || "N/A"}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>Schedule:</span>
                            <span style={{ fontSize: '0.875rem' }}>
                              {scheduleRange ? formatDateRange(scheduleRange.start_date, scheduleRange.end_date) : "Loading..."}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>Attendee:</span>
                            <span>{form.first_name} {form.last_name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>Email:</span>
                            <span style={{ fontSize: '0.875rem' }}>{form.email}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                            <span style={{ fontWeight: '600' }}>Total Amount:</span>
                            <span style={{ fontWeight: 'bold' }}>₱{((getApplicableFee() || 0) - discount).toLocaleString()}</span>
                          </div>
                        </div>
                
                        <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
                          <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                            <strong>Next Steps:</strong> Please check your email for confirmation and payment instructions.
                            Use your booking reference <strong>{bookingReference}</strong> for any inquiries.
                          </p>
                        </div>
                      </div>
                    </div>
                
                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <Button
                        style={{ backgroundColor: '#059669', color: 'white' }}
                        onClick={handleDownloadSummary}
                      >
                        Download Summary
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = 'https://petrosphere.com.ph'}
                      >
                        Return to Homepage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm that all the information you provided is accurate. Once submitted, your registration will be forwarded for admin verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConfirmDialog(false)
              handleSubmit()
            }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      <DuplicateRegistrationHandler
 scheduleId={scheduleId}
  email={form.email || ""}
  phoneNumber={form.phone_number || ""}
  onProceedNew={handleProceedWithNewRegistration}
  onEditExisting={handleEditExistingRegistration}
  isOpen={showDuplicateDialog}
  onClose={() => setShowDuplicateDialog(false)}
  duplicateData={duplicateData}
  bookingRef={duplicateBookingRef} 
/>
    </div>
  )
}