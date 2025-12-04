"use client"

import { useState } from "react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Alert, AlertDescription, AlertTitle,
} from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import {
  Search, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { VoucherImagePreview } from "@/components/VoucherImagePreview"

interface VerificationResult {
  status: "valid" | "invalid" | "expired" | "used"
  message: string
  details?: {
    code: string
    amount: string
    description: string
    expiryDate: string
    generatedAt: string
    isUsed: boolean
  }
}

export function VoucherVerifier() {
  const { toast } = useToast()
  const [voucherCode, setVoucherCode] = useState("")
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleVerify = async () => {
    if (!voucherCode.trim()) {
      toast({
        title: "Missing code",
        description: "Please enter a voucher code to verify.",
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)

    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", voucherCode.trim())
      .single()

    if (error || !data) {
      setVerificationResult({
        status: "invalid",
        message: "This voucher code does not exist.",
      })
      toast({
        title: "Invalid voucher",
        description: "No matching voucher found.",
        variant: "destructive",
      })
      setIsVerifying(false)
      return
    }

    const isExpired = data.expiry_date && new Date(data.expiry_date) < new Date()
    const isUsed = data.is_used

    if (isUsed) {
      setVerificationResult({
        status: "used",
        message: "This voucher has already been used.",
        details: {
          code: data.code,
          amount: data.amount,
          description: data.service ?? data.description,
          expiryDate: data.expiry_date, // 🔥 map this properly
          generatedAt: data.generated_at,
          isUsed: data.is_used,
        },
      })
    } else if (isExpired) {
      setVerificationResult({
        status: "expired",
        message: "This voucher is expired.",
        details: {
          code: data.code,
          amount: data.amount,
          description: data.service ?? data.description,
          expiryDate: data.expiry_date, // 🔥 map this properly
          generatedAt: data.generated_at,
          isUsed: data.is_used,
        },
      })
    } else {
      setVerificationResult({
        status: "valid",
        message: "This voucher is valid and ready to use!",
        details: {
          code: data.code,
          amount: data.amount,
          description: data.service ?? data.description,
          expiryDate: data.expiry_date, // 🔥 map this properly
          generatedAt: data.generated_at,
          isUsed: data.is_used,
        },
      })
      
      toast({
        title: "Voucher verified!",
        description: "This voucher is valid.",
      })
    }

    setIsVerifying(false)
  }

  const handleReset = () => {
    setVoucherCode("")
    setVerificationResult(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left card: Input & Details */}
      <Card>
        <CardHeader>
          <CardTitle>Verify Voucher</CardTitle>
          <CardDescription>
            Enter a voucher code to check its validity and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="voucher-code">Voucher Code</Label>
            <div className="flex gap-2">
              <Input
                id="voucher-code"
                placeholder="XXXX-XXXX-XXXX"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={14}
              />
              <Button onClick={handleVerify} disabled={isVerifying}>
                <Search className="mr-2 h-4 w-4" />
                {isVerifying ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </div>

          {/* Alerts */}
          {verificationResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {verificationResult.status === "valid" && (
                <Alert className="border-emerald-700 bg-emerald-400/55 dark:bg-emerald-700/20">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  <AlertTitle className="font-bold">Valid Voucher</AlertTitle>
                  <AlertDescription className="text-emerald-900 dark:text-emerald-400">
                    {verificationResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {verificationResult.status === "invalid" && (
                <Alert variant="destructive">
                  <XCircle className="h-5 w-5" />
                  <AlertTitle>Invalid Voucher</AlertTitle>
                  <AlertDescription>{verificationResult.message}</AlertDescription>
                </Alert>
              )}

              {verificationResult.status === "expired" && (
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                  <AlertTitle className="text-yellow-900 dark:text-yellow-400">Expired Voucher</AlertTitle>
                  <AlertDescription className="text-yellow-800 dark:text-yellow-500">
                    {verificationResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {verificationResult.status === "used" && (
                <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                  <AlertTitle className="text-orange-900 dark:text-orange-400">Used Voucher</AlertTitle>
                  <AlertDescription className="text-orange-800 dark:text-orange-500">
                    {verificationResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Details */}
              {verificationResult.details && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Voucher Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Code:</span>
                      <span className="font-mono font-semibold">{verificationResult.details.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Value:</span>
                      <span>{verificationResult.details.amount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Description:</span>
                      <span className="text-right">{verificationResult.details.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expiry:</span>
                      <span>
  {!verificationResult.details.expiryDate
    ? "No expiry"
    : isNaN(new Date(verificationResult.details.expiryDate).getTime())
    ? "Invalid Date"
    : new Date(verificationResult.details.expiryDate).toLocaleDateString()}
</span>


                    </div>
                  </CardContent>
                </Card>
              )}

              <Button onClick={handleReset} variant="outline" className="w-full">
                Verify Another Voucher
              </Button>

              {verificationResult?.status === "valid" && (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("vouchers")
                      .update({ is_used: true })
                      .eq("code", voucherCode.trim())

                    if (error) {
                      toast({
                        title: "Error",
                        description: "Failed to mark voucher as used.",
                        variant: "destructive",
                      })
                    } else {
                      toast({
                        title: "Marked as Used",
                        description: "Voucher status updated.",
                      })
                      handleVerify()
                    }
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Used
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right card: Voucher Preview */}
      <Card className="flex flex-col items-center justify-center min-h-[500px] px-4 py-6">
  <CardContent className="flex items-center justify-center w-full h-full">
    {verificationResult?.details ? (
      <div className="rounded ml-65 scale-[0.9] sm:scale-[1] md:scale-[0.75] lg:scale-[0.9] origin-top w-[1024px] h-[480px]">
        <VoucherImagePreview
          voucher={{
            code: verificationResult.details.code,
            amount: verificationResult.details.amount,
            description: verificationResult.details.description,
            expiryDate: verificationResult.details.expiryDate,
            voucherType:
              verificationResult.details.amount === "Free" ? "Free" : "Discount",
          }}
        />
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
        <div className="bg-muted rounded-full p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <p className="text-sm text-center">Your verified voucher will appear here</p>
      </div>
    )}
  </CardContent>
</Card>


    </div>
  )
}
