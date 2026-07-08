"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Search,
  ShieldCheck,
  BadgeCheck,
  ListChecks,
  FileSearch,
  Sparkles,
  Mail,
  Lock,
  Info,
} from "lucide-react"
import { VerificationResult } from "@/components/verification-result"
import { CertificateMatchPicker } from "@/components/certificate-match-picker"
import { tmsDb } from "@/lib/supabase-client"
import {
  findCertificateRecords,
  toVerificationDetails,
  type CertificateRecord,
} from "@/lib/certificate-verification"

const steps = [
  {
    icon: FileSearch,
    title: "Enter details",
    description: "Serial number or full name",
  },
  {
    icon: ListChecks,
    title: "Select match",
    description: "Pick the right training record",
  },
  {
    icon: BadgeCheck,
    title: "View result",
    description: "Confirm certificate authenticity",
  },
]

export default function GuestCertificateVerifierPage() {
  const [certificateId, setCertificateId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [matchOptions, setMatchOptions] = useState<CertificateRecord[] | null>(null)
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

  const showVerificationResult = (record: CertificateRecord, query: string) => {
    setMatchOptions(null)
    setVerificationResult({
      status: "valid",
      ...toVerificationDetails(record, query),
    })
  }

  const handleVerify = async () => {
    const trimmedCode = certificateId.trim()
    if (!trimmedCode) return

    setIsVerifying(true)
    setMatchOptions(null)
    setVerificationResult(null)

    const { matches, error } = await findCertificateRecords(tmsDb, trimmedCode)

    if (error) {
      setVerificationResult({
        status: "invalid",
        certificateId: trimmedCode,
      })
    } else if (matches.length === 0) {
      setVerificationResult({
        status: "not-found",
        certificateId: trimmedCode,
      })
    } else if (matches.length === 1) {
      showVerificationResult(matches[0], trimmedCode)
    } else {
      setMatchOptions(matches)
    }

    setIsVerifying(false)
  }

  const handleReset = () => {
    setCertificateId("")
    setMatchOptions(null)
    setVerificationResult(null)
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#1b1b63]/10 blur-3xl" />
        <div className="absolute top-40 right-0 h-56 w-56 rounded-full bg-yellow-400/15 blur-3xl" />
      </div>

      <div className="flex-1">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="w-full max-w-3xl mx-auto space-y-8">
          <section className="text-center space-y-6">
            <div className="inline-flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-xl scale-150" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[#1b1b63] shadow-lg shadow-[#1b1b63]/25">
                  <ShieldCheck className="h-10 w-10 text-yellow-400" strokeWidth={1.75} />
                </div>
                <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 shadow-md">
                  <Sparkles className="h-4 w-4 text-[#1b1b63]" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1b1b63]/70">
                Petrosphere Certificate Portal
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">
                Verify Your Certificate
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Instantly confirm the authenticity of training certificates issued by Petrosphere
                using a serial number or the certificate holder&apos;s name.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.title}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 dark:bg-slate-900/50 dark:border-slate-700 px-4 py-3 text-left shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1b1b63]/10 text-[#1b1b63] dark:text-yellow-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400">Step {index + 1}</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <Card className="border border-slate-200/80 shadow-md dark:border-slate-700 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#1b1b63] via-[#1b1b63] to-yellow-400" />
            <CardHeader className="space-y-3 p-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Search className="h-6 w-6 text-[#1b1b63] dark:text-yellow-400" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Certificate Lookup
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Enter your certificate serial number or name to verify authenticity
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-3">
                <Label htmlFor="certificate-id" className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  Serial Number or Name
                </Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <FileSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="certificate-id"
                      placeholder="PSI-XXXX-XXX-XX-XXX or John Doe"
                      value={certificateId}
                      onChange={(e) => setCertificateId(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                      className="flex-1 h-12 pl-10"
                      disabled={isVerifying}
                    />
                  </div>
                  <Button
                    onClick={handleVerify}
                    disabled={!certificateId.trim() || isVerifying}
                    className="bg-[#1b1b63] hover:bg-[#141454] text-white h-12 px-6 font-medium shadow-md shadow-[#1b1b63]/20"
                    size="lg"
                  >
                    {isVerifying ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Verifying...
                      </div>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5 mr-2" />
                        Verify
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {matchOptions && (
            <CertificateMatchPicker
              matches={matchOptions}
              onSelect={(record) => showVerificationResult(record, certificateId.trim())}
              onBack={handleReset}
            />
          )}

          {verificationResult && (
            <VerificationResult result={verificationResult} onReset={handleReset} />
          )}
          </div>
        </div>
      </div>

      <section className="mt-auto bg-[#1b1b63]">
        <div className="h-1 bg-yellow-400" />
        <div className="container mx-auto px-4 py-10 md:py-12">
          <div className="w-full max-w-3xl mx-auto">
            <Card className="border-0 bg-white/95 shadow-lg dark:bg-slate-900/95">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1b1b63]/10">
                    <Info className="h-5 w-5 text-[#1b1b63] dark:text-yellow-400" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Important Information</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                    <Lock className="h-5 w-5 shrink-0 text-[#1b1b63] dark:text-yellow-400 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      This system is for certificate owners and authorized parties verifying authenticity,
                      handled in compliance with the <strong className="text-slate-800 dark:text-slate-200">Data Privacy Act</strong>.
                    </p>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                    <Mail className="h-5 w-5 shrink-0 text-[#1b1b63] dark:text-yellow-400 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Need help verifying? Contact us at{" "}
                      <a
                        href="mailto:info@petrosphere.com.ph"
                        className="font-medium text-[#1b1b63] dark:text-yellow-400 hover:underline"
                      >
                        info@petrosphere.com.ph
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
