"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import {
  buildCertificateCsvTemplate,
  csvRowToRecordPayload,
  downloadCsvFile,
  parseCertificateCsv,
  recordsToCsv,
} from "@/lib/certificate-csv"
import { Copy, Download, Loader2, Trash2, Upload } from "lucide-react"

type CertificateVerifierToolsProps = {
  onRefresh: () => void
  logActivity: (action: string, details: string, serial_number?: string) => Promise<void>
}

async function fetchAllCertificateRecords() {
  const pageSize = 1000
  const all: Record<string, unknown>[] = []
  let from = 0

  while (true) {
    const { data, error } = await tmsDb
      .from("certificate_records")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return all
}

function ToolRow({
  title,
  description,
  children,
}: {
  title: string
  description: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-3 md:items-end">{children}</div>
    </div>
  )
}

export function CertificateVerifierTools({
  onRefresh,
  logActivity,
}: CertificateVerifierToolsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [autoGenerateSerial, setAutoGenerateSerial] = useState(true)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)

  const verifierUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/guest-certificate-verifier`
      : `${process.env.NEXT_PUBLIC_APP_URL || ""}/guest-certificate-verifier`

  const embedSnippet = `<a href="${verifierUrl}" target="_blank" rel="noopener noreferrer">Verify Certificate</a>`

  const handleGenerateBackup = async () => {
    setIsBackingUp(true)
    try {
      const records = await fetchAllCertificateRecords()
      const csv = recordsToCsv(records)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsvFile(`certificate_records_backup_${date}.csv`, csv)
      await logActivity("BACKUP", `Generated CSV backup with ${records.length} records`)
      toast.success(`Backup generated (${records.length} records)`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Backup failed"
      toast.error(message)
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleDownloadTemplate = () => {
    downloadCsvFile("certificate_import_template.csv", buildCertificateCsvTemplate())
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const handleImportCsv = async () => {
    if (!selectedFile) {
      toast.error("Please choose a CSV file first")
      return
    }

    setIsImporting(true)

    try {
      const text = await selectedFile.text()
      const rows = parseCertificateCsv(text)
      const payloads = rows.map((row, index) => {
        const payload = csvRowToRecordPayload(row, index, autoGenerateSerial)
        if (!payload.serial_number) {
          throw new Error(
            `Row ${index + 2} is missing serial_number. Enable auto-generate or add a serial in the CSV.`
          )
        }
        return payload
      })

      const chunkSize = 100
      let imported = 0

      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize)
        const { error } = await tmsDb.from("certificate_records").insert(chunk)
        if (error) throw error
        imported += chunk.length
      }

      await logActivity("IMPORT", `Imported ${imported} certificate records from CSV`)
      toast.success(`Successfully imported ${imported} certificate records`)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      onRefresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Import failed"
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  const handleCopyVerifierLink = async () => {
    try {
      await navigator.clipboard.writeText(verifierUrl)
      toast.success("Verifier link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleCopyEmbedSnippet = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet)
      toast.success("Embed snippet copied")
    } catch {
      toast.error("Failed to copy snippet")
    }
  }

  const handleDeleteDatabase = async () => {
    if (!deleteConfirmed) {
      toast.error("Please confirm deletion first")
      return
    }

    setIsDeletingAll(true)
    try {
      const records = await fetchAllCertificateRecords()
      if (records.length === 0) {
        toast.info("Certificate database is already empty")
        return
      }

      const ids = records.map((record) => String(record.id))
      const chunkSize = 100

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { error } = await tmsDb.from("certificate_records").delete().in("id", chunk)
        if (error) throw error
      }

      await logActivity("DELETE_ALL", `Deleted all ${ids.length} certificate records`)
      toast.success(`Deleted ${ids.length} certificate records`)
      setDeleteConfirmed(false)
      onRefresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Delete failed"
      toast.error(message)
    } finally {
      setIsDeletingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Tools</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ToolRow
            title="Backup of certificates"
            description="Generates a .csv file of the certificate database."
          >
            <Button onClick={handleGenerateBackup} disabled={isBackingUp}>
              {isBackingUp ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Generate Backup
            </Button>
          </ToolRow>

          <Separator />

          <ToolRow
            title="Massive Load"
            description={
              <>
                Up to 1000 certificates in a .csv file.{" "}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="font-medium text-primary hover:underline"
                >
                  Download template
                </button>
              </>
            }
          >
            <div className="flex w-full max-w-md flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isImporting}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No file chosen</p>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-generate-serial"
                  checked={autoGenerateSerial}
                  onCheckedChange={(checked) => setAutoGenerateSerial(checked === true)}
                />
                <Label htmlFor="auto-generate-serial" className="text-sm font-normal">
                  Generate serial number automatically
                </Label>
              </div>
              <Button disabled={isImporting || !selectedFile} onClick={handleImportCsv}>
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Load Data
              </Button>
            </div>
          </ToolRow>

          <Separator />

          {/* <ToolRow
            title="Certificate Verifier Link"
            description="Share this public link or embed snippet so users can verify certificates."
          >
            <div className="flex w-full max-w-md flex-col gap-2">
              <div className="flex gap-2">
                <Input value={verifierUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={handleCopyVerifierLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>
              <div className="flex gap-2">
                <Input value={embedSnippet} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={handleCopyEmbedSnippet}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Embed
                </Button>
              </div>
            </div>
          </ToolRow> */}
        </CardContent>
      </Card>

      {/* <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-destructive">Delete the database</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ToolRow
            title="Delete all certificate records"
            description="Remember to make a backup before deleting the database. This removes every record in certificate_records."
          >
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirm-delete-database"
                  checked={deleteConfirmed}
                  onCheckedChange={(checked) => setDeleteConfirmed(checked === true)}
                />
                <Label htmlFor="confirm-delete-database" className="text-sm font-normal">
                  Confirm deletion
                </Label>
              </div>
              <Button
                variant="destructive"
                disabled={!deleteConfirmed || isDeletingAll}
                onClick={handleDeleteDatabase}
              >
                {isDeletingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Database
              </Button>
            </div>
          </ToolRow>
        </CardContent>
      </Card> */}
    </div>
  )
}