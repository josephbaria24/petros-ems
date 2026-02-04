//components\VoucherImagePreview.tsx
"use client"

import Image from "next/image"
import { useRef } from "react"
import { toPng } from "html-to-image"
import { Button } from "@/components/ui/button"

interface Voucher {
  code: string
  amount: string
  description: string
  expiryDate: string
  voucherType: string // "Discount" or "Free"
}

export function VoucherImagePreview({ voucher }: { voucher: Voucher }) {
  const ref = useRef<HTMLDivElement>(null)

  const handleDownload = async () => {
    if (ref.current === null) return
  
    const dataUrl = await toPng(ref.current, {
      pixelRatio: 2, // Higher quality
    })
  
    const link = document.createElement("a")
    link.download = `voucher-${voucher.code}.png`
    link.href = dataUrl
    link.click()
  }
  
  const template =
    voucher.voucherType === "Discount"
      ? "/discount-voucher-template.png"
      : "/free-voucher-template.png"

  return (
    <div className="space-y-3">
      {/* Wrapper with overflow hidden to contain scaled content */}
      <div className="w-full overflow-hidden rounded-lg border shadow-sm bg-muted/30 flex justify-center items-center p-4">
        {/* Scaled container - adjust scale values as needed */}
        <div className="scale-[0.35] sm:scale-[0.45] md:scale-[0.5] lg:scale-[0.55] xl:scale-[0.6] origin-center">
          <div
            ref={ref}
            className="relative w-[1024px] h-[480px] rounded overflow-hidden border shadow-lg"
          >
            <Image
              src={template}
              alt="Voucher Template"
              fill
              priority
              className="object-cover"
            />

            {/* Promo Code */}
            <div className="absolute top-[33px] right-[120px] text-xl font-[Montserrat] font-extrabold text-[#2e266d] tracking-wider">
              {voucher.code}
            </div>

            {/* Main Content */}
            {voucher.voucherType === "Discount" ? (
              <div className="absolute top-[50px] left-[400px] text-[150px] font-[Montserrat] font-black text-[#2e266d]">
                ₱{voucher.amount}
              </div>
            ) : (
              <>
                <div className="absolute top-[200px] left-[320px] text-[28px] text-[#2e266d] font-[Montserrat] font-medium tracking-wide">
                  ({voucher.description})
                </div>
              </>
            )}

            {/* Expiry Disclaimer */}
           <div className="absolute bottom-[60px] right-[100px] text-gray-300 text-sm font-[Montserrat]">
            {voucher.description === "All Services" 
              ? "*Valid for all available trainings."
              : `*Exclusive for ${voucher.description} Training only.`
            }
          </div>

            {/* Expiry */}
            <div className="absolute bottom-[35px] right-[100px] text-white text-base font-[Montserrat] font-normal">
              USE BEFORE :{" "} 
              {voucher.expiryDate === "No expiry"
                ? "N/A"
                : new Date(voucher.expiryDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleDownload}>Download Voucher Image</Button>
      </div>
    </div>
  )
}