"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { Check, User, Briefcase, FileCheck, CheckCircle2, Upload, ArrowLeft, CreditCard, Calendar, ClipboardList } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
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

  useEffect(() => {
    const fetchCourseAndSchedule = async () => {
      const scheduleId = new URLSearchParams(window.location.search).get("schedule_id")
      if (!scheduleId) return
  
      const { data: schedule, error: scheduleError } = await supabase
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single()
  
      if (schedule && schedule.course_id) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("*")
          .eq("id", schedule.course_id)
          .single()
        setCourse(courseData)
      }
  
      const { data: rangeData } = await supabase
        .from("schedule_ranges")
        .select("start_date, end_date")
        .eq("schedule_id", scheduleId)
        .single()
  
      if (rangeData) {
        setScheduleRange(rangeData)
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

  function SearchableSelectItems({
    items,
  }: {
    items: { code: string; name: string }[]
  }) {
    const [search, setSearch] = useState("")
  
    const filteredItems = items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    )
  
    return (
      <>
        <div className="px-3 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 text-sm"
          />
        </div>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <SelectItem key={item.code} value={item.code}>
              {item.name}
            </SelectItem>
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-gray-500">No results found.</div>
        )}
      </>
    )
  }

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
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    setUploading(true);
  
    const reader = new FileReader();
    reader.onloadend = () => {
      const previewUrl = reader.result as string;
      if (field === "id_picture_url") setIdPreview(previewUrl);
      if (field === "picture_2x2_url") setPhotoPreview(previewUrl);
    };
    reader.readAsDataURL(file);
  
    try {
      const formData = new FormData();
      formData.append("image", file);
  
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
  
      const result = await res.json();
  
      if (res.ok) {
        setForm((prevForm: any) => {
          const updatedForm = {
            ...prevForm,
            [field]: result.url,
          };
          return updatedForm;
        });
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

  const handleSubmit = async () => {
    toast.loading("Submitting registration...");
  
    const searchParams = new URLSearchParams(window.location.search);
    const scheduleId = searchParams.get("schedule_id");
  
    if (!scheduleId) {
      toast.error("Missing schedule ID");
      return;
    }
  
    try {
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
  
      const payload = {
        ...form,
        schedule_id: scheduleId,
        course_id: courseId,
        status: "pending",
      };
  
      const { data: insertedTraining, error: insertError } = await supabase
        .from("trainings")
        .insert([payload])
        .select("id")
        .single();
  
      if (insertError || !insertedTraining) {
        console.error("Insert error:", insertError);
        toast.error("Submission failed.");
        return;
      }
  
      const { error: bookingError } = await supabase
        .from("booking_summary")
        .insert([
          {
            training_id: insertedTraining.id,
            reference_number: bookingReference,
          },
        ]);
  
      if (bookingError) {
        console.error("Booking summary insert error:", bookingError);
        toast.error("Failed to create booking summary.");
        return;
      }
  
      toast.dismiss();
      toast.success("Registration submitted successfully!", {
        duration: 3000,
      });
  
      setIsSubmitted(true);
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
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-[400px] rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 text-black p-8 flex-col">
        <div className="mb-12">
          <h1 className="text-2xl font-bold text-white">Training Registration</h1>
        </div>

        <div className="space-y-0 flex-1">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.id
            const isCompleted = s.completed
            
            return (
              <div key={s.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all ${
                    isCompleted ? "bg-emerald-500 border-emerald-500" : 
                    isActive ? "bg-white border-slate-500" : 
                    "bg-slate-400 border-slate-600"
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
                  <h3 className={`font-semibold text-sm ${isActive ? "text-white" : "text-slate-400"}`}>
                    {s.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{s.subtitle}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-2 pt-0 border-t border-slate-700">
          <h3 className="font-semibold mb-2 text-white">Complete your registration!</h3>
          <p className="text-sm text-slate-400">Explore many different options we offer after your trial.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {step > 0 && (
          <div className="lg:ml-55 sm:ml-5 md:ml-5 p-2">
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

        <div className="flex-1 overflow-auto p-6 lg:p-5 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            
            {step === 0 && (
              <div className="text-center space-y-8">
                <div className="inline-flex w-auto h-auto bg-slate-800/80 p-2 rounded-xl items-center justify-center">
                    <img src="/trans-logo.png" alt="Logo" className="w-full h-10 object-contain" />
                </div>

                <div>
                  <h2 className="text-4xl font-bold text-gray-900 mb-3">Welcome</h2>
                  <p className="text-gray-600">Hi there, please fill in all required fields and click submit button</p>
                </div>
                
                <Card className="border shadow-sm">
                  <CardContent className="p-6 space-y-4">
                    <Button 
                      onClick={() => setStep(1)}
                      variant="ghost"
                      className="w-full flex items-center gap-4 p-4 h-auto justify-start"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">Start your registration</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Personal Details</h2>
                  <p className="text-gray-600">Tell us a bit about yourself</p>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-sm font-medium">First Name *</Label>
                      <Input id="first_name" name="first_name" onChange={handleChange} placeholder="Enter first name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="middle_initial" className="text-sm font-medium">Middle Initial</Label>
                      <Input id="middle_initial" name="middle_initial" onChange={handleChange} placeholder="M.I." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-sm font-medium">Last Name *</Label>
                      <Input id="last_name" name="last_name" onChange={handleChange} placeholder="Enter last name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suffix" className="text-sm font-medium">Suffix</Label>
                      <Input id="suffix" name="suffix" onChange={handleChange} placeholder="Jr., Sr., etc." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone_number" className="text-sm font-medium">Mobile Number *</Label>
                      <Input id="phone_number" name="phone_number" onChange={handleChange} placeholder="+63" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                      <Input id="email" name="email" type="email" onChange={handleChange} placeholder="email@example.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium">Gender *</Label>
                      <Select
                        onValueChange={(value) => setForm({ ...form, gender: value })}
                        defaultValue={form.gender}
                        required
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <RadioGroup
                      value={form.employment_status || ""}
                      onValueChange={(val) => setForm({ ...form, employment_status: val })}
                      className="flex gap-6"
                      required
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
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={() => {
                      const missingFields = []
                      if (!form.first_name) missingFields.push("First Name")
                      if (!form.last_name) missingFields.push("Last Name")
                      if (!form.phone_number) missingFields.push("Mobile Number")
                      if (!form.email) missingFields.push("Email Address")
                      if (!form.gender) missingFields.push("Gender")
                      if (!form.age) missingFields.push("Age")
                      if (!form.mailing_street) missingFields.push("Street Address")
                      if (!form.mailing_city) missingFields.push("City")
                      if (!form.mailing_province) missingFields.push("Province")
                      if (!form.employment_status) missingFields.push("Employment Status")
                      
                      if (missingFields.length > 0) {
                        toast.error(`Please fill in: ${missingFields.join(", ")}`)
                        return
                      }
                      
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
                      <Select
                         onValueChange={(val) => {
                          const selectedCity = cities.find((c) => c.code === val)
                          setForm({ ...form, company_city: selectedCity?.name || val })
                        }}
                        defaultValue={form.company_city}
                        disabled={cities.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select City or Municipality" />
                        </SelectTrigger>
                        <SelectContent>
                          <SearchableSelectItems items={cities} />
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Select
                        onValueChange={(val) => handleRegionChange(val)}
                        defaultValue={form.company_region}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Region" />
                        </SelectTrigger>
                        <SelectContent>
                          <SearchableSelectItems items={regions} />
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_workers" className="text-sm font-medium">Total Number of Workers</Label>
                      <Input id="total_workers" name="total_workers" type="number" onChange={handleChange} placeholder="e.g., 50" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={() => {
                      const missingFields = []
                      if (!form.company_region) missingFields.push("Region")
                      if (!form.company_city) missingFields.push("City / Municipality")
                      
                      if (missingFields.length > 0) {
                        toast.error(`Please fill in: ${missingFields.join(", ")}`)
                        return
                      }
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
                            <img src={photoPreview} alt="Photo Preview" className="w-full h-40 object-cover rounded-lg" />
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
                      const missingFiles = []
                      if (!form.id_picture_url && !idPreview) missingFiles.push("Valid ID")
                      if (!form.picture_2x2_url && !photoPreview) missingFiles.push("2x2 Photo")
                      
                      if (missingFiles.length > 0) {
                        toast.error(`Please upload: ${missingFiles.join(", ")}`)
                        return
                      }
                      
                      if (uploading) {
                        toast.error("Please wait for uploads to complete")
                        return
                      }
                      
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
                          <p className="text-gray-600 text-sm">08:00 AM – 05:00 PM</p>
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

                          <div className="mt-3 space-y-1">
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
                                    toast.success("Coupon applied: 10% discount")
                                  } else {
                                    setDiscount(0)
                                    toast.error("Invalid coupon code")
                                  }
                                }}
                                variant="outline"
                                className="text-sm"
                              >
                                Apply
                              </Button>
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
                        onClick={() => {
                          const element = document.getElementById('summary-download');
                          if (element) {
                            import('html2canvas').then((html2canvas) => {
                              html2canvas.default(element, {
                                scale: 2,
                                backgroundColor: '#ffffff'
                              }).then((canvas) => {
                                const link = document.createElement('a');
                                link.download = `booking-${bookingReference}.png`;
                                link.href = canvas.toDataURL();
                                link.click();
                              });
                            });
                          }
                        }}
                      >
                        Download Summary
                      </Button>
                
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = "https://petrosphere.com.ph/"}
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
  )
}