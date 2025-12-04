"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VoucherGenerator } from "@/components/voucher-generator"
import { VoucherVerifier } from "@/components/voucher-verifier"
import { Ticket } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">


<div className="flex justify-end px-4 mt-3">
    </div>
      <main className="container mx-auto lg:px-4 py-0 sm:px-8 md:px-3">

        <div className="flex justify-center pb-4">
        <h1 className="text-lg sm:text-xl font-semibold">Voucher Manager System</h1>
        </div>
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="verify">Verify</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-0">
            <VoucherGenerator />
          </TabsContent>

          <TabsContent value="verify" className="mt-0">
            <VoucherVerifier />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
