"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight,
  Users,
  GraduationCap,
  Hash,
  Award,
  Layers,
} from "lucide-react"
import {
  type CertificateRecord,
  formatCertificateHolderName,
} from "@/lib/certificate-verification"

type CertificateMatchPickerProps = {
  matches: CertificateRecord[]
  onSelect: (record: CertificateRecord) => void
  onBack: () => void
}

export function CertificateMatchPicker({
  matches,
  onSelect,
  onBack,
}: CertificateMatchPickerProps) {
  return (
    <Card className="border border-slate-200/80 shadow-md dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="h-1.5 bg-gradient-to-r from-yellow-400 via-[#1b1b63] to-[#1b1b63]" />
      <CardHeader className="space-y-4 p-6 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/20">
            <Layers className="h-6 w-6 text-[#1b1b63] dark:text-yellow-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Multiple Certificates Found
              </CardTitle>
              <Badge variant="secondary" className="bg-[#1b1b63]/10 text-[#1b1b63] dark:text-yellow-400">
                {matches.length} records
              </Badge>
            </div>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              This name appears on more than one training. Select the certificate you want to verify.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        {matches.map((record, index) => {
          const name = formatCertificateHolderName(record) || "Unknown"
          const key = record.id ?? record.serial_number ?? `${name}-${index}`

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(record)}
              className="group w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 transition-all hover:border-[#1b1b63]/30 hover:bg-[#1b1b63]/[0.03] hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1b1b63] text-yellow-400 shadow-sm group-hover:scale-105 transition-transform">
                  <Award className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="h-4 w-4 shrink-0 text-slate-400" />
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#1b1b63] dark:group-hover:text-yellow-400 shrink-0 transition-colors" />
                  </div>

                  <div className="flex items-start gap-2">
                    <GraduationCap className="h-4 w-4 shrink-0 text-[#1b1b63]/60 dark:text-yellow-400/80 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {record.training || "Training not specified"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 break-all">
                      {record.serial_number || "No serial number"}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          )
        })}

        <Button onClick={onBack} variant="outline" className="w-full h-11 font-medium mt-2">
          Search Again
        </Button>
      </CardContent>
    </Card>
  )
}
