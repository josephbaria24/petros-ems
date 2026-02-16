"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Search, Home, BookOpen, Phone } from "lucide-react"
import { VerificationResult } from "@/components/verification-result"
import { tmsDb } from "@/lib/supabase-client"
import Image from "next/image"
import Link from "next/link"

// Header moved to layout.tsx for cleaner structure

export default function GuestCertificateVerifierPage() {
    const [certificateId, setCertificateId] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [verificationResult, setVerificationResult] = useState<{
        status: "valid" | "invalid" | "not-found"
        certificateId: string
        holderName?: string
        training?: string
        trainingDate?: string
        startDate?: string
        endDate?: string
        venue?: string
    } | null>(null)

    const handleVerify = async () => {
        const trimmedCode = certificateId.trim().toUpperCase()
        if (!trimmedCode) return

        setIsVerifying(true)

        const { data: records, error } = await tmsDb
            .from("certificate_records")
            .select("*")
            .or(`serial_number.eq."${trimmedCode}",last_name.ilike."${trimmedCode}"`)
            .limit(1)

        const data = records?.[0]

        console.log("Checking certificate:", trimmedCode)
        console.log("Supabase response:", { error, data })

        if (error) {
            setVerificationResult({
                status: "invalid",
                certificateId: trimmedCode,
            })
        } else if (!data) {
            setVerificationResult({
                status: "not-found",
                certificateId: trimmedCode,
            })
        } else {
            const fullName = `${data.first_name ?? ""} ${data.middle_name ?? ""} ${data.last_name ?? ""}${data.suffix ? ` ${data.suffix}` : ""}`.replace(/\s+/g, " ").trim()

            setVerificationResult({
                status: "valid",
                certificateId: data.serial_number,
                holderName: fullName || "N/A",
                training: data.training || "N/A",
                trainingDate: data.training_date || "N/A",
                startDate: data.start_date || "N/A",
                endDate: data.end_date || "N/A",
                venue: data.training_venue || "N/A",
            })
        }

        setIsVerifying(false)
    }

    const handleReset = () => {
        setCertificateId("")
        setVerificationResult(null)
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="w-full max-w-2xl mx-auto space-y-8">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="space-y-2 p-6">
                        <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
                            Verify Your Certificate
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">
                            Enter your certificate serial number or last name to verify authenticity
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        <div className="space-y-3">
                            <Label htmlFor="certificate-id" className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                Serial Number or Last Name
                            </Label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    id="certificate-id"
                                    placeholder="e.g., PSI-BOSH-BTS-17-001 or Abrea"
                                    value={certificateId}
                                    onChange={(e) => setCertificateId(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                                    className="flex-1 h-12"
                                    disabled={isVerifying}
                                />
                                <Button
                                    onClick={handleVerify}
                                    disabled={!certificateId.trim() || isVerifying}
                                    className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-6 font-medium"
                                    size="lg"
                                >
                                    {isVerifying ? (
                                        <div className="flex items-center">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Verifying...
                                        </div>
                                    ) : (
                                        <>
                                            <Search className="w-5 h-5 mr-2" />
                                            Verify
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {verificationResult && (
                    <VerificationResult result={verificationResult} onReset={handleReset} />
                )}

                {/* Footer Note Section */}
                <div className="mt-6 text-sm text-slate-700 dark:text-slate-400 space-y-4">
                    <p>
                        <strong>Note:</strong> The Certificate Verification System is intended exclusively for use
                        by the certificate owner and authorized third parties who have been granted permission to
                        verify the validity and authenticity of the issued certificate.
                    </p>
                    <p>
                        All information accessed through this system is handled in compliance with the{" "}
                        <strong>Data Privacy Act</strong> to ensure the confidentiality, integrity, and security
                        of personal data.
                    </p>
                    <p>
                        If you are unable to verify the certificate details, please contact us at{" "}
                        <a
                            href="mailto:info@petrosphere.com.ph"
                            className="text-blue-600 hover:underline"
                        >
                            info@petrosphere.com.ph
                        </a>{" "}
                        for further assistance.
                    </p>
                </div>
            </div>
        </div>
    )
}
