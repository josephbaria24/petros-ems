"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Copy, Download, Sparkles } from "lucide-react"
import { VoucherCard } from "@/components/voucher-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase-client"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group" // ✅ Add this import
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { VoucherImagePreview } from "./VoucherImagePreview"


interface Voucher {
  code: string
  amount: string
  description: string
  expiryDate: string
  generatedAt: string
  voucherType: string
}


interface Service {
  id: number
  name: string
}


export function VoucherGenerator() {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [voucherType, setVoucherType] = useState("Discount") // ✅ new state
  const [generatedVoucher, setGeneratedVoucher] = useState<Voucher | null>(null)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  const generateVoucherCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }



  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase.from("courses").select("id, name").order("name", { ascending: true })
      if (error) {
        toast({
          title: "Error loading services",
          description: error.message,
          variant: "destructive",
        })
        return
      }
      setServices(data)
    }
  
    fetchServices()
  }, [])

  
  const handleGenerate = async () => {
    if (voucherType === "Discount" && !amount) {
      toast({
        title: "Missing amount",
        description: "Please enter a value for discount vouchers.",
        variant: "destructive",
      })
      return
    }

    if (!selectedServiceId) {
      toast({
        title: "Missing service",
        description: "Please select a service or course.",
        variant: "destructive",
      })
      return
    }
    

    const voucher: Voucher = {
      code: generateVoucherCode(),
      amount: voucherType === "Free" ? "Free" : amount,
      description: services.find(s => s.id === selectedServiceId)?.name || "Unknown",
      expiryDate: expiryDate || "No expiry",
      generatedAt: new Date().toISOString(),
      voucherType,
    }
    
    setGeneratedVoucher(voucher)
    setLoading(true)
    
    const { error } = await supabase.from("vouchers").insert([
      {
        code: voucher.code,
        amount: voucher.amount, // always a string (either "Free" or a number like "₱500")
        service: voucher.description, // optional fallback
        service_id: selectedServiceId, // 🔗 tracked relationally
        voucher_type: voucher.voucherType,
        expiry_date: expiryDate ? expiryDate : null,
        generated_at: voucher.generatedAt,
      },
    ])
    

    setLoading(false)

    if (error) {
      console.error("Supabase insert error:", error)
      toast({
        title: "Database Error",
        description: "Failed to save voucher to Supabase.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Voucher generated!",
      description: "Your voucher has been created and saved to Supabase.",
    })
  }

  const handleCopyCode = () => {
    if (generatedVoucher) {
      navigator.clipboard.writeText(generatedVoucher.code)
      toast({
        title: "Copied!",
        description: "Voucher code copied to clipboard.",
      })
    }
  }

  const handleDownload = () => {
    if (generatedVoucher) {
      const data = JSON.stringify(generatedVoucher, null, 2)
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `voucher-${generatedVoucher.code}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded!",
        description: "Voucher data has been downloaded.",
      })
    }
  }

  const handleReset = () => {
    setAmount("")
    setDescription("")
    setExpiryDate("")
    setVoucherType("Discount")
    setGeneratedVoucher(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create New Voucher</CardTitle>
          <CardDescription>Fill in the details to generate and save a voucher</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ✅ Voucher Type Selection */}
          <div className="space-y-2">
            <Label>Voucher Type *</Label>
            <div className="flex gap-4">
              {["Discount", "Free"].map((type) => (
                <button
                  key={type}
                  onClick={() => setVoucherType(type)}
                  className={`px-6 py-2 rounded-2xl shadow-inner transition-all border  cursor-pointer
                    ${
                      voucherType === type
                        ? "bg-gray-100 shadow-md text-primary font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-gray-200"
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* ✅ Conditionally hide price input */}
          {voucherType === "Discount" && (
            <div className="space-y-2">
              <Label htmlFor="amount">Amount / Value *</Label>
              <Input
                id="amount"
                placeholder="e.g., ₱500, 10% off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}
            <div className="space-y-2">
              <Label htmlFor="service">Service / Course *</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {services.find((service) => service.id === selectedServiceId)?.name ||
                      "Select a service or course"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 max-h-64 overflow-y-auto">

                  <Command>
                    <CommandInput placeholder="Search services..." />
                    <CommandEmpty>No service found.</CommandEmpty>
                    <CommandGroup>
                      {services.map((service) => (
                        <CommandItem
                          key={service.id}
                          value={service.name}
                          onSelect={() => {
                            setSelectedServiceId(service.id)
                            setOpen(false)
                          }}
                        >
                          {service.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>


          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date (Optional)</Label>
            <Input id="expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleGenerate} className="flex-1" disabled={loading}>
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? "Saving..." : "Generate Voucher"}
            </Button>
            {generatedVoucher && (
              <Button onClick={handleReset} variant="outline">
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {generatedVoucher ? (
          <>
            {/* Your current preview */}
            {/* <VoucherCard voucher={generatedVoucher} /> */}

            {/* 👇 Add the image preview here */}
            <VoucherImagePreview voucher={generatedVoucher}  />

            {/* Existing download + code display */}
            <Card>
              <CardContent className="pt-1">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
                    <code className="text-sm font-mono font-semibold text-foreground">
                      {generatedVoucher.code}
                    </code>
                    <Button size="sm" variant="ghost" onClick={handleCopyCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[300px] items-center justify-center p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Your generated voucher will appear here</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  )
}
