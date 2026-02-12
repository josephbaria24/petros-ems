"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function IVTTherapyRegistrationForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const scheduleId = searchParams.get("schedule_id")

    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [bookingReference, setBookingReference] = useState("")
    const [regions, setRegions] = useState<{ code: string; name: string }[]>([])

    const [form, setForm] = useState({
        training_program: "",
        training_status: "",
        first_name: "",
        last_name: "",
        middle_initial: "",
        professional_title: "",
        age: "",
        gender: "",
        phone_number: "",
        mailing_street: "",
        region: "",
        email: "",
    })

    useEffect(() => {
        if (!scheduleId) {
            toast.error("Invalid registration link")
            return
        }

        // Generate booking reference
        const bookingRef = Math.floor(Math.random() * 9000000 + 1000000).toString()
        setBookingReference(bookingRef)

        // Load regions
        fetch("/regions.json")
            .then(res => res.json())
            .then(setRegions)
            .catch(err => console.error("Failed to load regions", err))
    }, [scheduleId])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target

        if (name === "phone_number") {
            let digits = value.replace(/\D/g, "")
            if (!digits.startsWith("63")) digits = "63" + digits
            let formatted = "+" + digits.slice(0, 2)
            if (digits.length > 2) formatted += " " + digits.slice(2, 5)
            if (digits.length > 5) formatted += " " + digits.slice(5, 8)
            if (digits.length > 8) formatted += " " + digits.slice(8, 12)
            setForm(prev => ({ ...prev, phone_number: formatted }))
            return
        }

        if (name === "middle_initial") {
            const sanitized = value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase()
            setForm(prev => ({ ...prev, middle_initial: sanitized }))
            return
        }

        if (["first_name", "last_name"].includes(name)) {
            setForm(prev => ({ ...prev, [name]: value.toUpperCase() }))
            return
        }

        setForm(prev => ({ ...prev, [name]: value }))
    }

    const validateStep = () => {
        if (step === 1 && !form.training_program) {
            toast.error("Please select a training program")
            return false
        }
        if (step === 2 && !form.training_status) {
            toast.error("Please select your training status")
            return false
        }
        if (step === 3) {
            if (!form.first_name || !form.last_name || !form.professional_title) {
                toast.error("Please complete all required name fields")
                return false
            }
        }
        if (step === 4) {
            if (!form.age || !form.gender || !form.phone_number || !form.mailing_street || !form.region || !form.email) {
                toast.error("Please complete all required detail fields")
                return false
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(form.email)) {
                toast.error("Please enter a valid email address")
                return false
            }
        }
        return true
    }

    const handleNext = () => {
        if (validateStep()) {
            setStep(step + 1)
        }
    }

    const handleBack = () => {
        setStep(step - 1)
    }

    const handleSubmit = async () => {
        if (!validateStep()) return

        setIsSubmitting(true)
        toast.loading("Submitting registration...")

        try {
            const { data: scheduleData, error: scheduleError } = await tmsDb
                .from("schedules")
                .select("course_id, batch_number")
                .eq("id", scheduleId)
                .single()

            if (scheduleError || !scheduleData) {
                toast.error("Failed to retrieve schedule details")
                setIsSubmitting(false)
                return
            }

            const trainingPayload = {
                schedule_id: scheduleId,
                course_id: scheduleData.course_id,
                batch_number: scheduleData.batch_number,
                training_program: form.training_program,
                training_status: form.training_status,
                first_name: form.first_name,
                last_name: form.last_name,
                middle_initial: form.middle_initial,
                professional_title: form.professional_title,
                age: parseInt(form.age),
                gender: form.gender,
                phone_number: form.phone_number,
                mailing_street: form.mailing_street,
                region: form.region,
                email: form.email,
                status: "pending",
                payment_status: "pending",
                employment_status: "Employed", // Default for CLASS ROSTER forms
            }

            const { data: insertedTraining, error: insertError } = await tmsDb
                .from("trainings")
                .insert([trainingPayload])
                .select("id")
                .single()

            if (insertError || !insertedTraining) {
                console.error("Insert error:", insertError)
                toast.error("Failed to submit registration")
                setIsSubmitting(false)
                return
            }

            // Create booking summary
            const { error: bookingError } = await tmsDb
                .from("booking_summary")
                .insert([{
                    training_id: insertedTraining.id,
                    reference_number: bookingReference,
                }])

            if (bookingError) {
                console.error("Booking error:", bookingError)
                toast.error("Failed to create booking summary")
                setIsSubmitting(false)
                return
            }

            toast.dismiss()
            toast.success("Registration submitted successfully!")
            setIsSubmitted(true)
            setIsSubmitting(false)
        } catch (error) {
            console.error("Unexpected error:", error)
            toast.error("An unexpected error occurred")
            setIsSubmitting(false)
        }
    }

    if (!scheduleId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <p className="text-center text-destructive">Invalid registration link</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center space-y-4">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold">Registration Complete!</h2>
                        <p className="text-muted-foreground">
                            Your booking reference number is:
                        </p>
                        <p className="text-3xl font-bold text-primary">{bookingReference}</p>
                        <p className="text-sm text-muted-foreground">
                            Please save this reference number for your records.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <Card className="shadow-lg">
                    <CardContent className="p-8">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold mb-2">CLASS ROSTER</h1>
                            <p className="text-sm text-muted-foreground">
                                When you submit this form, it will not automatically collect your details like name and email address unless you provide it yourself.
                            </p>
                            <p className="text-sm text-red-600 mt-2">* Required</p>
                        </div>

                        {/* Step 1: Training Program */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">TRAINING/PROGRAM</h2>
                                    <Label className="text-base mb-4 block">
                                        1. What is your training program? <span className="text-red-600">*</span>
                                    </Label>
                                    <RadioGroup value={form.training_program} onValueChange={(value) => setForm(prev => ({ ...prev, training_program: value }))}>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="BLS" id="bls" />
                                            <Label htmlFor="bls" className="font-normal cursor-pointer">BLS</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="ACLS" id="acls" />
                                            <Label htmlFor="acls" className="font-normal cursor-pointer">ACLS</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="BLS and ACLS" id="bls-acls" />
                                            <Label htmlFor="bls-acls" className="font-normal cursor-pointer">BLS and ACLS</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="IVT Therapy" id="ivt" />
                                            <Label htmlFor="ivt" className="font-normal cursor-pointer">IVT Therapy</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Other" id="other" />
                                            <Label htmlFor="other" className="font-normal cursor-pointer">Other</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleNext} className="bg-[#1a1f71] hover:bg-[#151859]">
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Training Status */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">TRAINING STATUS</h2>
                                    <Label className="text-base mb-4 block">
                                        2. Please select your training status: <span className="text-red-600">*</span>
                                    </Label>
                                    <RadioGroup value={form.training_status} onValueChange={(value) => setForm(prev => ({ ...prev, training_status: value }))}>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="First Timer" id="first-timer" />
                                            <Label htmlFor="first-timer" className="font-normal cursor-pointer">First Timer</Label>
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <RadioGroupItem value="Renewal" id="renewal" />
                                            <Label htmlFor="renewal" className="font-normal cursor-pointer">Renewal</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Remedial" id="remedial" />
                                            <Label htmlFor="remedial" className="font-normal cursor-pointer">Remedial</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div className="flex justify-between">
                                    <Button onClick={handleBack} variant="outline">
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <Button onClick={handleNext} className="bg-[#1a1f71] hover:bg-[#151859]">
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Full Name */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">FULL NAME</h2>

                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="first_name" className="text-base">
                                                3. FIRST NAME <span className="text-sm text-muted-foreground">(please type in CAPITAL LETTERS)</span> <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="first_name"
                                                name="first_name"
                                                value={form.first_name}
                                                onChange={handleChange}
                                                placeholder="JUAN"
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="last_name" className="text-base">
                                                4. LAST NAME <span className="text-sm text-muted-foreground">(please type in CAPITAL LETTERS)</span> <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="last_name"
                                                name="last_name"
                                                value={form.last_name}
                                                onChange={handleChange}
                                                placeholder="DELA CRUZ"
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="middle_initial" className="text-base">
                                                5. MIDDLE INITIAL
                                            </Label>
                                            <Input
                                                id="middle_initial"
                                                name="middle_initial"
                                                value={form.middle_initial}
                                                onChange={handleChange}
                                                placeholder="L"
                                                maxLength={1}
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="professional_title" className="text-base">
                                                6. PROFESSIONAL TITLE <span className="text-sm text-muted-foreground">(e.g. RN, MSN, MD)</span> <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="professional_title"
                                                name="professional_title"
                                                value={form.professional_title}
                                                onChange={handleChange}
                                                placeholder="RN"
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <Button onClick={handleBack} variant="outline">
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <Button onClick={handleNext} className="bg-[#1a1f71] hover:bg-[#151859]">
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Details */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">DETAILS</h2>

                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="age" className="text-base">
                                                7. AGE <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="age"
                                                name="age"
                                                type="number"
                                                value={form.age}
                                                onChange={handleChange}
                                                placeholder="24"
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <Label className="text-base mb-3 block">
                                                8. GENDER <span className="text-red-600">*</span>
                                            </Label>
                                            <RadioGroup value={form.gender} onValueChange={(value) => setForm(prev => ({ ...prev, gender: value }))}>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <RadioGroupItem value="MALE" id="male" />
                                                    <Label htmlFor="male" className="font-normal cursor-pointer">MALE</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="FEMALE" id="female" />
                                                    <Label htmlFor="female" className="font-normal cursor-pointer">FEMALE</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div>
                                            <Label htmlFor="phone_number" className="text-base">
                                                9. PHONE NUMBER <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="phone_number"
                                                name="phone_number"
                                                value={form.phone_number}
                                                onChange={handleChange}
                                                placeholder="+63 XXX XXX XXXX"
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="mailing_street" className="text-base">
                                                10. MAILING ADDRESS <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="mailing_street"
                                                name="mailing_street"
                                                value={form.mailing_street}
                                                onChange={handleChange}
                                                placeholder="Enter your answer"
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="region" className="text-base">
                                                11. REGION <span className="text-red-600">*</span>
                                            </Label>
                                            <Select value={form.region} onValueChange={(value) => setForm(prev => ({ ...prev, region: value }))}>
                                                <SelectTrigger id="region" className="mt-2">
                                                    <SelectValue placeholder="Select region" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {regions.map((region) => (
                                                        <SelectItem key={region.code} value={region.name}>
                                                            {region.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="email" className="text-base">
                                                12. EMAIL ADDRESS <span className="text-red-600">*</span>
                                            </Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                value={form.email}
                                                onChange={handleChange}
                                                placeholder="your.email@example.com"
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <Button onClick={handleBack} variant="outline">
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="bg-[#1a1f71] hover:bg-[#151859]"
                                    >
                                        {isSubmitting ? "Submitting..." : "Submit"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Progress indicator */}
                        <div className="mt-8 pt-6 border-t">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Step {step} of 4</span>
                                <span>{Math.round((step / 4) * 100)}% Complete</span>
                            </div>
                            <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#1a1f71] transition-all duration-300"
                                    style={{ width: `${(step / 4) * 100}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Never give out your password. <a href="#" className="text-primary hover:underline">Report abuse</a>
                </p>
            </div>
        </div>
    )
}
