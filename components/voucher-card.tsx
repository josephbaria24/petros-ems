import { Card, CardContent } from "@/components/ui/card"
import { Ticket, Calendar, FileText } from "lucide-react"

interface VoucherCardProps {
  voucher: {
    code: string
    amount: string
    description: string
    expiryDate: string
    generatedAt: string
  }
}

export function VoucherCard({ voucher }: VoucherCardProps) {
  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Ticket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Voucher Code</p>
              <p className="font-mono text-lg font-bold text-foreground">{voucher.code}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/20">
              <span className="text-lg font-bold text-accent-foreground">$</span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Value</p>
              <p className="font-semibold text-foreground">{voucher.amount}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
              <FileText className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm text-foreground">{voucher.description}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
              <Calendar className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm text-foreground">
                {voucher.expiryDate === "No expiry" ? "No expiry" : new Date(voucher.expiryDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Generated on {new Date(voucher.generatedAt).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  )
}
