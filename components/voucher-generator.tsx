//`components\voucher-generator.tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Copy, Download, Sparkles, Trash2, RefreshCw } from "lucide-react"
import { VoucherCard } from "@/components/voucher-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { tmsDb } from "@/lib/supabase-client"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { VoucherImagePreview } from "./VoucherImagePreview"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Voucher {
  code: string
  amount: string
  description: string
  expiryDate: string
  generatedAt: string
  voucherType: string
  isBatch?: boolean
  batchCount?: number
}

interface SavedVoucher {
  id: string
  code: string
  amount: string
  service: string
  service_id: string
  expiry_date: string
  voucher_type: string
  is_used: boolean
  is_batch: boolean
  batch_count: number
  batch_used: number
  batch_remaining: number
  created_at: string
}

interface Service {
  id: string
  name: string
}

export function VoucherGenerator() {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [voucherType, setVoucherType] = useState("Discount")
  const [isBatchVoucher, setIsBatchVoucher] = useState(false)
  const [batchCount, setBatchCount] = useState("10")
  const [customBatchCount, setCustomBatchCount] = useState("")
  const [generatedVoucher, setGeneratedVoucher] = useState<Voucher | null>(null)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  
  // Voucher list states
  const [savedVouchers, setSavedVouchers] = useState<SavedVoucher[]>([])
  const [loadingVouchers, setLoadingVouchers] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [voucherToDelete, setVoucherToDelete] = useState<string | null>(null)

  const generateVoucherCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const fetchServices = async () => {
    const { data, error } = await tmsDb
      .from("courses")
      .select("id, name")
      .order("name", { ascending: true })
    
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

  const fetchVouchers = async () => {
    setLoadingVouchers(true)
    const { data, error } = await tmsDb
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (error) {
      toast({
        title: "Error loading vouchers",
        description: error.message,
        variant: "destructive",
      })
    } else {
      setSavedVouchers(data || [])
    }
    setLoadingVouchers(false)
  }

  useEffect(() => {
    fetchServices()
    fetchVouchers()
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

    // if (!selectedServiceId) {
    //   toast({
    //     title: "Missing service",
    //     description: "Please select a service or course.",
    //     variant: "destructive",
    //   })
    //   return
    // }

    const finalBatchCount = batchCount === "custom" 
      ? parseInt(customBatchCount) || 1 
      : parseInt(batchCount) || 1

    if (isBatchVoucher && finalBatchCount < 1) {
      toast({
        title: "Invalid batch count",
        description: "Please enter a valid number for batch count.",
        variant: "destructive",
      })
      return
    }

const selectedService = services.find(s => s.id === selectedServiceId)

const voucher: Voucher = {
  code: generateVoucherCode(),
  amount: voucherType === "Free" ? "Free" : amount,
  description: selectedServiceId ? (selectedService?.name || "Unknown") : "All Services",
  expiryDate: expiryDate || "No expiry",
  generatedAt: new Date().toISOString(),
  voucherType,
  isBatch: isBatchVoucher,
  batchCount: isBatchVoucher ? finalBatchCount : 1,
}
      
    setGeneratedVoucher(voucher)
    setLoading(true)
    
const { error } = await tmsDb.from("vouchers").insert([
  {
    code: voucher.code,
    amount: voucher.amount,
    service: selectedServiceId ? voucher.description : "All Services",
    service_id: selectedServiceId || null, // Allow null for all services
    voucher_type: voucher.voucherType,
    expiry_date: expiryDate ? expiryDate : null,
    generated_at: voucher.generatedAt,
    is_batch: isBatchVoucher,
    batch_count: isBatchVoucher ? finalBatchCount : 1,
    batch_used: 0,
    batch_remaining: isBatchVoucher ? finalBatchCount : 1,
    is_used: false,
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
      description: isBatchVoucher 
        ? `Batch voucher created with ${finalBatchCount} uses.`
        : "Your voucher has been created and saved.",
    })
    
    // Refresh voucher list
    fetchVouchers()
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({
      title: "Copied!",
      description: "Voucher code copied to clipboard.",
    })
  }

  const handleDelete = async () => {
    if (!voucherToDelete) return

    const { error } = await tmsDb
      .from("vouchers")
      .delete()
      .eq("id", voucherToDelete)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete voucher.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Deleted",
        description: "Voucher has been deleted.",
      })
      fetchVouchers()
    }
    
    setDeleteDialogOpen(false)
    setVoucherToDelete(null)
  }

  const handleReset = () => {
    setAmount("")
    setExpiryDate("")
    setVoucherType("Discount")
    setIsBatchVoucher(false)
    setBatchCount("10")
    setCustomBatchCount("")
    setGeneratedVoucher(null)
  }

  const getStatusBadge = (voucher: SavedVoucher) => {
    if (voucher.is_batch) {
      const percentage = (voucher.batch_remaining / voucher.batch_count) * 100
      if (percentage === 0) return <Badge variant="destructive">Fully Used</Badge>
      if (percentage < 30) return <Badge variant="secondary">Low ({voucher.batch_remaining} left)</Badge>
      return <Badge variant="default">{voucher.batch_remaining}/{voucher.batch_count} available</Badge>
    }
    return voucher.is_used 
      ? <Badge variant="destructive">Used</Badge>
      : <Badge variant="default">Available</Badge>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create New Voucher</CardTitle>
          <CardDescription>Fill in the details to generate and save a voucher</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Voucher Type Selection */}
          <div className="space-y-2">
            <Label>Voucher Type *</Label>
            <div className="flex gap-4">
              {["Discount", "Free"].map((type) => (
                <button
                  key={type}
                  onClick={() => setVoucherType(type)}
                  className={`px-6 py-2 rounded-2xl shadow-inner transition-all border cursor-pointer
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

          {/* Amount Input */}
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

          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="service">Service / Course (Optional - leave blank for all services)</Label>
            <Popover open={open} onOpenChange={setOpen}>
             <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedServiceId === null 
                    ? "All Services (Universal Voucher)"
                    : services.find((service) => service.id === selectedServiceId)?.name || "Select a service or course"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 max-h-64 overflow-y-auto">
                <Command>
                  <CommandInput placeholder="Search services..." />
                  <CommandEmpty>No service found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all-services"
                      onSelect={() => {
                        setSelectedServiceId(null)
                        setOpen(false)
                      }}
                    >
                      <span className="font-semibold text-primary">All Services (Universal Voucher)</span>
                    </CommandItem>
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

          {/* Batch Voucher Toggle */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch-toggle" className="font-semibold">Batch Voucher</Label>
              <button
                id="batch-toggle"
                onClick={() => setIsBatchVoucher(!isBatchVoucher)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isBatchVoucher ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isBatchVoucher ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Allow this voucher to be used multiple times
            </p>

            {isBatchVoucher && (
              <div className="space-y-2 mt-3">
                <Label>Number of Uses</Label>
                <Select value={batchCount} onValueChange={setBatchCount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 uses</SelectItem>
                    <SelectItem value="20">20 uses</SelectItem>
                    <SelectItem value="50">50 uses</SelectItem>
                    <SelectItem value="100">100 uses</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                {batchCount === "custom" && (
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter custom count"
                    value={customBatchCount}
                    onChange={(e) => setCustomBatchCount(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date (Optional)</Label>
            <Input 
              id="expiry" 
              type="date" 
              value={expiryDate} 
              onChange={(e) => setExpiryDate(e.target.value)} 
            />
          </div>

          {/* Action Buttons */}
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

      <div className="space-y-4">
        {/* Generated Voucher Preview */}
        {generatedVoucher ? (
          <>
            <VoucherImagePreview voucher={generatedVoucher} />
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
                    <div>
                      <code className="text-sm font-mono font-semibold text-foreground">
                        {generatedVoucher.code}
                      </code>
                      {generatedVoucher.isBatch && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {generatedVoucher.batchCount} uses available
                        </p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleCopyCode(generatedVoucher.code)}
                    >
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

        {/* Voucher List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Created Vouchers</CardTitle>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchVouchers}
              disabled={loadingVouchers}
            >
              <RefreshCw className={`h-4 w-4 ${loadingVouchers ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {loadingVouchers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : savedVouchers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No vouchers created yet
              </p>
            ) : (
              <div className="space-y-2">
                {savedVouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-semibold">
                          {voucher.code}
                        </code>
                        {getStatusBadge(voucher)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {voucher.service} • {voucher.amount}
                      </p>
                      {voucher.expiry_date && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(voucher.expiry_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(voucher.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setVoucherToDelete(voucher.id)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Voucher</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this voucher? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}