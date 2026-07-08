"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import type { CertificateCsvRow } from "@/lib/certificate-csv"
import {
  CERTIFICATE_CSV_HEADERS,
  filterImportRows,
  getImportPreviewSummary,
  getImportRowName,
  importPreviewRowsToPayloads,
  sortImportRowsAlphabetically,
  toggleImportRowIncluded,
  updateImportPreviewRow,
  type ImportPreviewRow,
} from "@/lib/certificate-import-preview"
import { AlertTriangle, Loader2, Pencil, Search, Upload } from "lucide-react"

type CertificateImportReviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: ImportPreviewRow[]
  existingSerials: Set<string>
  onRowsChange: (rows: ImportPreviewRow[]) => void
  onImported: () => void
  logActivity: (action: string, details: string, serial_number?: string) => Promise<void>
}

function EditImportRowDialog({
  row,
  open,
  onOpenChange,
  onSave,
}: {
  row: ImportPreviewRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CertificateCsvRow) => void
}) {
  const [form, setForm] = useState<CertificateCsvRow | null>(null)

  useEffect(() => {
    if (open && row) {
      setForm({ ...row.data })
    } else {
      setForm(null)
    }
  }, [open, row])

  if (!row || !form) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Import Row {row.csvRowNumber}</DialogTitle>
          <DialogDescription>Update the row before importing it into the database.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CERTIFICATE_CSV_HEADERS.map((field) => (
            <div key={field} className={field === "training" ? "sm:col-span-2" : ""}>
              <Label htmlFor={`import-${field}`} className="capitalize">
                {field.replace(/_/g, " ")}
              </Label>
              <Input
                id={`import-${field}`}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(form)
              onOpenChange(false)
            }}
          >
            Save Row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CertificateImportReviewDialog({
  open,
  onOpenChange,
  rows,
  existingSerials,
  onRowsChange,
  onImported,
  logActivity,
}: CertificateImportReviewDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [editingRow, setEditingRow] = useState<ImportPreviewRow | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const summary = useMemo(() => getImportPreviewSummary(rows), [rows])

  const visibleRows = useMemo(() => {
    const sorted = sortImportRowsAlphabetically(rows)
    return filterImportRows(sorted, searchQuery)
  }, [rows, searchQuery])

  const handleToggleIncluded = (rowId: string, included: boolean) => {
    onRowsChange(toggleImportRowIncluded(rows, rowId, included))
  }

  const handleSaveRow = (data: CertificateCsvRow) => {
    if (!editingRow) return
    onRowsChange(updateImportPreviewRow(rows, editingRow.id, data, existingSerials))
    setEditingRow(null)
  }

  const handleConfirmImport = async () => {
    setIsImporting(true)
    try {
      const payloads = importPreviewRowsToPayloads(rows)
      if (payloads.length === 0) {
        toast.error("No valid rows selected for import")
        return
      }

      const chunkSize = 100
      let imported = 0

      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize)
        const { error } = await tmsDb.from("certificate_records").insert(chunk)
        if (error) throw error
        imported += chunk.length
      }

      await logActivity("IMPORT", `Imported ${imported} certificate records from CSV review`)
      toast.success(`Successfully imported ${imported} certificate records`)
      onOpenChange(false)
      onImported()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Import failed"
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Import</DialogTitle>
            <DialogDescription>
              Review duplicate serial numbers, edit rows, and choose which records to import.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{summary.total} total</Badge>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {summary.ready} ready
            </Badge>
            <Badge variant="outline">{summary.selected} selected</Badge>
            {summary.withIssues > 0 ? (
              <Badge variant="destructive">{summary.withIssues} with issues</Badge>
            ) : null}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, serial number, training, or issue..."
              className="pl-9"
            />
          </div>

          <ScrollArea className="flex-1 min-h-[320px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Import</TableHead>
                  <TableHead className="w-[70px]">Row</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No rows match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const hasIssues = row.issues.length > 0

                    return (
                      <TableRow key={row.id} className={hasIssues ? "bg-destructive/5" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={row.included}
                            onCheckedChange={(checked) =>
                              handleToggleIncluded(row.id, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.csvRowNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{row.data.serial_number || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{getImportRowName(row.data) || "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{row.data.training || "—"}</TableCell>
                        <TableCell>
                          {hasIssues ? (
                            <div className="space-y-1">
                              {row.issues.map((issue) => (
                                <div key={issue} className="flex items-start gap-1 text-xs text-destructive">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Ready
                            </Badge>
                          )}
                          {row.included && hasIssues ? (
                            <p className="mt-1 text-xs text-muted-foreground">Fix or uncheck to skip</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingRow(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={isImporting || summary.ready === 0}>
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import {summary.ready} Record{summary.ready === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditImportRowDialog
        row={editingRow}
        open={!!editingRow}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingRow(null)
        }}
        onSave={handleSaveRow}
      />
    </>
  )
}
