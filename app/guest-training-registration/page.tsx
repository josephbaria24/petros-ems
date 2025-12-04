"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { Check, User, Briefcase, Upload, ArrowLeft, CreditCard, Calendar, CheckCircle2, Crop, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"

export default function GuestTrainingRegistration() {
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
  const [cities, setCities] = useState<{ code: string; name: string }[]>([])
  const [paymentMethod, setPaymentMethod] = useState("BPI")
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({})

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




const validateStep1 = () => {
  const newErrors: any = {}
  let firstErrorField: string | null = null

  requiredPersonalFields.forEach((field) => {
    if (!form[field] || form[field].toString().trim() === "") {
      newErrors[field] = true
      if (!firstErrorField) firstErrorField = field
    }
  })

  // Additional validation for email format
  if (form.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      newErrors.email = true
      if (!firstErrorField) firstErrorField = "email"
      toast.error("Please enter a valid email address.")
    }
  }

  // Additional validation for phone number (must have digits after +63)
  if (form.phone_number) {
    const phoneDigits = form.phone_number.replace(/\D/g, "")
    if (phoneDigits.length < 12) { // +63 + 10 digits
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
      // Fetch schedule with related data in one query
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedules")
        .select(`
          course_id,
          schedule_type,
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

      // Fetch course data
      if (scheduleData.course_id) {
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("*")
          .eq("id", scheduleData.course_id)
          .single()

        console.log("Course data:", courseData)
        
        if (courseError) {
          console.error("Error fetching course:", courseError)
        } else {
          setCourse(courseData)
        }
      }

      // Handle schedule dates based on type
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
    fetch("https://psgc.cloud/api/regions")
      .then(res => res.json())
      .then(data => {
        setRegions(data)
      })
      .catch(err => console.error("Failed to fetch regions", err))
  }, [])

  function formatDateRange(start: string, end: string) {
    const startDate = new Date(start)
    const endDate = new Date(end)
  
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit' })}–${endDate.toLocaleDateString('en-US', { day: '2-digit', year: 'numeric' })}`
    } else {
      return `${startDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit' })} – ${endDate.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}`
    }
  }

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

  // Close dropdown when clicking outside
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




  const handleRegionChange = async (regionCode: string) => {
    const selectedRegion = regions.find(r => r.code === regionCode)
  
    setForm({
      ...form,
      company_region: selectedRegion?.name || regionCode,
      company_city: "",
    })
  
    try {
      const res = await fetch(`https://psgc.cloud/api/regions/${regionCode}/cities-municipalities`)
      const data = await res.json()
      setCities(data)
    } catch (err) {
      console.error("Failed to fetch cities", err)
      setCities([])
    }
  }

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;

  // 📌 PHONE AUTO-FORMAT (+63 912 345 6789)
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

  // 📌 BIRTHDAY → AUTO-CALCULATE AGE
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

  // 📌 SPECIAL RULE — MIDDLE INITIAL (only 1 letter)
  if (name === "middle_initial") {
    const sanitized = value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
    setForm((prev: any) => ({ ...prev, middle_initial: sanitized }));
    return;
  }

  // 📌 AUTO-CAPITALIZE fields
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

  // Clear any error for this field
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
        // Direct upload for 2x2 photo (no cropping)
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
  
const handleSubmit = async () => {
  toast.loading("Submitting registration...");

  const searchParams = new URLSearchParams(window.location.search);
  const scheduleId = searchParams.get("schedule_id");

  if (!scheduleId) {
    toast.error("Missing schedule ID");
    return;
  }

  try {
    // 1️⃣ Get course linked to schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("course_id")
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      toast.error("Failed to retrieve course");
      return;
    }

    const courseId = schedule.course_id;

    // 2️⃣.5 Get the batch number from the schedule itself
    const { data: scheduleDetails, error: scheduleDetailsError } = await supabase
      .from("schedules")
      .select("batch_number")
      .eq("id", scheduleId)
      .single()

    if (scheduleDetailsError || !scheduleDetails?.batch_number) {
      toast.error("Failed to get batch number from schedule.")
      return
    }

    const batchNumber = scheduleDetails.batch_number

    // 2️⃣ Fetch training fee
    const { data: courseData, error: feeError } = await supabase
      .from("courses")
      .select("training_fee, name")
      .eq("id", courseId)
      .single();

    if (feeError) console.error("Error fetching course fee:", feeError);

    const trainingFee = courseData?.training_fee || 0;

    // 3️⃣ Create trainee record (store payment summary info here)
    const trainingPayload = {
      ...form,
      schedule_id: scheduleId,
      course_id: courseId,
      batch_number: batchNumber,
      status: "pending",
      payment_method: paymentMethod,
      payment_status:
        paymentMethod === "COUNTER" ? "pending" : "awaiting receipt",
      amount_paid: 0,
      courtesy_title: form.courtesy_title || null,
    };

    const { data: insertedTraining, error: insertError } = await supabase
      .from("trainings")
      .insert([trainingPayload])
      .select("id")
      .single();

    if (insertError || !insertedTraining) {
      console.error("Insert training error:", insertError);
      toast.error("Failed to submit registration.");
      return;
    }

    const trainingId = insertedTraining.id;

    // 4️⃣ Create booking summary record
    const { error: bookingError } = await supabase
      .from("booking_summary")
      .insert([
        {
          training_id: trainingId,
          reference_number: bookingReference,
        },
      ]);

    if (bookingError) {
      console.error("Booking summary insert error:", bookingError);
      toast.error("Failed to create booking summary.");
      return;
    }

    // 5️⃣ Success feedback
    toast.dismiss();
    toast.success("Registration submitted successfully!", {
      duration: 3000,
    });

    setIsSubmitted(true);

    // 6️⃣ Send registration email to admin
    try {
      await fetch("/api/send-registration-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingReference,
          courseName: courseData?.name || course?.name || "N/A",
          scheduleRange: scheduleRange
            ? `${formatDateRange(scheduleRange.start_date, scheduleRange.end_date)}`
            : "N/A",
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
            trainingFee: trainingFee,
            discount,
            totalAmount: trainingFee - discount,
            paymentMethod,
            paymentStatus:
              paymentMethod === "COUNTER" ? "Pending" : "Awaiting receipt",
          },
        }),
      })
      console.log("Admin notification email sent")
    } catch (emailErr) {
      console.error("Admin email sending failed:", emailErr)
    }

    // 7️⃣ Send booking summary email to trainee
    try {
      await fetch("/api/send-booking-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: form.email,
          bookingReference,
          courseName: courseData?.name || course?.name || "N/A",
          scheduleRange: scheduleRange
            ? `${formatDateRange(scheduleRange.start_date, scheduleRange.end_date)}`
            : "N/A",
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
            trainingFee: trainingFee,
            discount,
            totalAmount: trainingFee - discount,
            paymentMethod,
            paymentStatus:
              paymentMethod === "COUNTER" ? "Pending" : "Awaiting receipt",
          },
        }),
      })
      console.log("Booking summary email sent to trainee")
    } catch (emailErr) {
      console.error("Trainee email sending failed:", emailErr)
      // Don't show error to user since registration was successful
    }

  } catch (err) {
    console.error("Unexpected error:", err);
    toast.error("Something went wrong.");
  }
};
  const isEmployed = form.employment_status === "Employed"
  
  const steps = [
    { id: 1, title: "Personal Details", subtitle: "Tell us a bit about yourself", icon: User, completed: step > 1 },
    ...(isEmployed ? [{ id: 2, title: "Employment Details", subtitle: "Share your employment information", icon: Briefcase, completed: step > 2 }] : []),
    { id: 3, title: "Verification Details", subtitle: "Upload your identification documents", icon: Upload, completed: step > 3 },
    { id: 4, title: "Confirmation", subtitle: "You're all set! Enjoy your journey.", icon: CheckCircle2, completed: step > 4 }
  ]

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-white to-emerald-50 flex items-center justify-center p-8">
      <div className="w-full max-w-7xl h-full flex gap-8">
      <div className="hidden lg:flex lg:w-[45%] rounded-3xl bg-banded text-black p-8 flex-col backdrop-blur-sm shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-0">
        <div className="mb-25">
          <h1 className="text-2xl font-bold text-white">Training Registration</h1>
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
          <div className="p-2">
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
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 lg:p-8 flex items-center justify-center">
          <div className="w-full max-w-2xl overflow-auto max-h-full">
            
            {step === 0 && (
              <div className="text-center space-y-8">
                  <div className="inline-flex px-4 py-2 from-slate-800 to-slate-700 ">
                    <img src="/trans-logo-dark.png" alt="logo" className="w-60 h-auto" />
                  </div>
                <div className="flex flex-col items-center space-y-6">
                  <img 
                    src="/registration.svg" 
                    alt="Registration" 
                    className="w-64 h-64 object-contain"
                  />
                  


                </div>

                <div className="space-y-3">
                <h2 className="text-5xl font-bold mb-3">
                    Welcome!
                  </h2>
                  <p className="text-lg text-gray-600 max-w-md mx-auto">
                    Begin your training journey with us. Please complete all required fields to get started.
                  </p>
                </div>
                
                <div className="max-w-md mx-auto">
                  <Button 

                  variant={"outline"}
                    onClick={() => setStep(1)}
                    size="lg"
                    className="w-full border-1   py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg font-semibold cursor-pointer"
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
                            setForm({ ...form, employment_status: val })
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
                      <Input id="company_name" name="company_name" onChange={handleChange} placeholder="Enter company name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_position" className="text-sm font-medium">Position</Label>
                      <Input id="company_position" name="company_position" onChange={handleChange} placeholder="Your position" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_industry" className="text-sm font-medium">Industry</Label>
                      <Input id="company_industry" name="company_industry" onChange={handleChange} placeholder="e.g., Technology, Finance" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_email" className="text-sm font-medium">Company Email</Label>
                      <Input id="company_email" name="company_email" type="email" onChange={handleChange} placeholder="company@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_landline" className="text-sm font-medium">Company Landline</Label>
                      <Input id="company_landline" name="company_landline" onChange={handleChange} placeholder="(02) 1234-5678" />
                    </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City / Municipality</Label>
                        <SearchableDropdown
                          items={cities}
                          value={form.company_city || ""}
                          onChange={(cityCode) => {
                            const selectedCity = cities.find((c) => c.code === cityCode)
                            setForm({ ...form, company_city: selectedCity?.name || cityCode })
                          }}
                          placeholder="Select City or Municipality"
                          disabled={cities.length === 0}
                          className="w-full"
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
                      <Input id="total_workers" name="total_workers" type="number" onChange={handleChange} placeholder="e.g., 50" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={() => setStep(3)} 
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
                    <Label htmlFor="picture_2x2" className="text-sm font-medium">2x2 Photo *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
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
                            <strong>Training Fee:</strong> ₱{course?.training_fee?.toLocaleString() || "0.00"}
                          </p>

                          <p className="text-sm text-gray-900">
                            <strong>Discount:</strong> -₱{discount.toLocaleString()}
                          </p>

                          <p className="text-sm text-gray-900 font-semibold">
                            Total Payable: ₱{((course?.training_fee || 0) - discount).toLocaleString()}
                          </p>

                          {/* <div className="mt-3 space-y-1">
                            <Label htmlFor="coupon_code" className="text-sm font-medium">Coupon Code</Label>
                            <div className="flex gap-2">
                              <Input
                                id="coupon_code"
                                placeholder="Enter code"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                onClick={() => {
                                  if (couponCode === "PETRO10") {
                                    setDiscount(0.1 * (course?.training_fee || 0))
                                  } else {
                                    setDiscount(0)
                                  }
                                }}
                                variant="outline"
                                className="text-sm"
                              >
                                Apply
                              </Button>
                            </div>
                          </div> */}
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
                              <strong>INCLUSION:</strong> Certificate, ID, AM/PM Snacks, Lunch meal.
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
                            <span style={{ fontWeight: 'bold' }}>₱{((course?.training_fee || 0) - discount).toLocaleString()}</span>
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
    </div>
  )
}