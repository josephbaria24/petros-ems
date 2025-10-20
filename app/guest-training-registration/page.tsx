"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { Check, User, Briefcase, FileCheck, CheckCircle2, Upload, ArrowLeft } from "lucide-react"

export default function GuestTrainingRegistration() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<any>({})
  const [uploading, setUploading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      if (field === "id_picture_url") {
        setIdPreview(reader.result as string)
      } else if (field === "picture_2x2_url") {
        setPhotoPreview(reader.result as string)
      }
    }
    reader.readAsDataURL(file)

    setUploading(true)
    setTimeout(() => {
      setForm({ ...form, [field]: `uploaded_${file.name}` })
      setUploading(false)
    }, 1500)
  }

  const handleSubmit = () => {
    console.log("Form submitted:", form)
    alert("Registration successful!")
  }

  const steps = [
    { id: 1, title: "Personal Details", subtitle: "Tell us a bit about yourself", icon: User, completed: step > 1 },
    { id: 2, title: "Employment Details", subtitle: "Share your employment information", icon: Briefcase, completed: step > 2 },
    { id: 3, title: "Verification Details", subtitle: "Upload your identification documents", icon: Upload, completed: step > 3 },
    { id: 4, title: "Confirmation", subtitle: "You're all set! Enjoy your journey.", icon: CheckCircle2, completed: step > 4 }
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar */}
      <div className="hidden lg:flex lg:w-[400px] rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 text-black p-8 flex-col">

        <div className="mb-12">
          <h1 className="text-2xl font-bold text-white">Training Registration</h1>
        </div>

        {/* Timeline Steps */}
        <div className="space-y-0 flex-1">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.id
            const isCompleted = s.completed
            
            return (
              <div key={s.id} className="flex items-start gap-4">
                {/* Timeline connector */}
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
                
                {/* Step content */}
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

        {/* Bottom Section */}
        <div className="mt-2 pt-0 border-t border-slate-700">
          <h3 className="font-semibold mb-2 text-white">Complete your registration!</h3>
          <p className="text-sm text-slate-400">Explore many different options we offer after your trial.</p>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {step > 0 && (
          <div className="lg:ml-55 sm:ml-5 md:ml-5 p-2">
            <Button 
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              className="flex items-center gap-2 rounded-2xl border-1 cursor-pointer font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6 lg:p-5 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            
            {/* Step 0: Welcome */}
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

            {/* Step 1: Personal Details */}
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
                      <Input id="first_name" name="first_name" onChange={handleChange} placeholder="Enter first name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="middle_initial" className="text-sm font-medium">Middle Initial</Label>
                      <Input id="middle_initial" name="middle_initial" onChange={handleChange} placeholder="M.I." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-sm font-medium">Last Name *</Label>
                      <Input id="last_name" name="last_name" onChange={handleChange} placeholder="Enter last name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="suffix" className="text-sm font-medium">Suffix</Label>
                      <Input id="suffix" name="suffix" onChange={handleChange} placeholder="Jr., Sr., etc." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone_number" className="text-sm font-medium">Mobile Number *</Label>
                      <Input id="phone_number" name="phone_number" onChange={handleChange} placeholder="+63" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                      <Input id="email" name="email" type="email" onChange={handleChange} placeholder="email@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium">Gender *</Label>
                      <select 
                        id="gender"
                        name="gender" 
                        onChange={handleChange} 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age" className="text-sm font-medium">Age *</Label>
                      <Input id="age" name="age" type="number" onChange={handleChange} placeholder="18" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="mailing_street" className="text-sm font-medium">Street Address *</Label>
                      <Input id="mailing_street" name="mailing_street" onChange={handleChange} placeholder="House no., Street, Barangay" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mailing_city" className="text-sm font-medium">City *</Label>
                      <Input id="mailing_city" name="mailing_city" onChange={handleChange} placeholder="Enter city" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mailing_province" className="text-sm font-medium">Province *</Label>
                      <Input id="mailing_province" name="mailing_province" onChange={handleChange} placeholder="Enter province" />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-medium">Employment Status *</Label>
                    <RadioGroup
                      defaultValue="Unemployed"
                      onValueChange={(val) => setForm({ ...form, employment_status: val })}
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
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep(2)} size="lg" className="bg-slate-900 hover:bg-slate-700 cursor-pointer">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Employment Details */}
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
                      <Label htmlFor="company_city" className="text-sm font-medium">City / Municipality</Label>
                      <Input id="company_city" name="company_city" onChange={handleChange} placeholder="Enter city" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_region" className="text-sm font-medium">Region</Label>
                      <Input id="company_region" name="company_region" onChange={handleChange} placeholder="Enter region" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_workers" className="text-sm font-medium">Total Number of Workers</Label>
                      <Input id="total_workers" name="total_workers" type="number" onChange={handleChange} placeholder="e.g., 50" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep(3)} size="lg" className="bg-slate-900 hover:bg-slate-700 cursor-pointer">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Verification Details */}
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
                  <Button onClick={() => setStep(4)} size="lg" className="bg-slate-900 hover:bg-slate-700 cursor-pointer">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Review & Confirm</h2>
                  <p className="text-gray-600">Please review your information before submitting</p>
                </div>

                <Card className="border shadow-sm">
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Full Name</p>
                        <p className="text-sm font-semibold text-gray-900">{form.first_name} {form.middle_initial} {form.last_name} {form.suffix}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Email</p>
                        <p className="text-sm font-semibold text-gray-900">{form.email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Phone</p>
                        <p className="text-sm font-semibold text-gray-900">{form.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Age & Gender</p>
                        <p className="text-sm font-semibold text-gray-900">{form.age}, {form.gender}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-gray-500 mb-1">Address</p>
                        <p className="text-sm font-semibold text-gray-900">{form.mailing_street}, {form.mailing_city}, {form.mailing_province}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Terms and Conditions</h3>
                    <div className="max-h-64 overflow-y-auto text-sm space-y-2 bg-gray-50 p-4 rounded-lg border">
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li><strong>STANDARD TRAINING:</strong> Training sessions will be conducted at Petrosphere Inc. venues.</li>
                        <li><strong>INCLUSION:</strong> Certificate, ID, AM/PM Snacks, Lunch meal.</li>
                        <li><strong>CONFIRMATION:</strong> At least FIVE (5) WORKING DAYS before the training date.</li>
                        <li><strong>BILLING ARRANGEMENT:</strong> 50% down payment upon confirmation, full payment within training duration.</li>
                        <li><strong>NO MULTIPLE DISCOUNT:</strong> Discounts cannot be used with other offers.</li>
                        <li><strong>CANCELLATION OF RESERVATION:</strong> 
                          <ul className="list-disc list-inside ml-4 mt-1">
                            <li>5 days before: 50% of total estimated cost.</li>
                            <li>2 days before or on the day: 100% of total estimated cost.</li>
                          </ul>
                        </li>
                        <li><strong>POSTPONEMENT OF SCHEDULE:</strong> Due to insufficient attendees, emergencies, or natural disasters (notice 5 days before event). Full refund within 5 days or payment may be applied to future training.</li>
                        <li><strong>CONFIDENTIALITY:</strong> Both parties agree to keep this agreement private.</li>
                      </ul>
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
                    onClick={handleSubmit} 
                    disabled={!agreed}
                    size="lg"
                    className="bg-slate-900 hover:bg-slate-700 cursor-pointer"
                  >
                    Submit Registration
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}