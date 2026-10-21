"use client"

import * as React from "react"
import { Spinner } from "@/components/ui/spinner"
import { Eye, FileDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { downloadOshProgramPdf, oshPdfKind, oshProgramPdfBlob } from "@/lib/osh-program-pdf"
import type { OshProgram } from "@/lib/osh-program"
import { cn } from "@/lib/utils"

type OshProgramPreviewProps = {
  program: OshProgram
  filename?: string
}

async function pdfToPageImages(blob: Blob) {
  const pdfjs = await import("pdfjs-dist")
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  const data = new Uint8Array(await blob.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1.45 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")
    if (!ctx) continue
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    pages.push(canvas.toDataURL("image/jpeg", 0.9))
  }
  return pages
}

function PageStack({ pages, compact }: { pages: string[]; compact?: boolean }) {
  return (
    <div className={cn(compact ? "space-y-2 bg-[#5f6368] p-2" : "space-y-4 bg-[#5f6368] p-4")}>
      {pages.map((src, i) => (
        <img
          key={`${i}-${src.slice(-24)}`}
          src={src}
          alt={`Program page ${i + 1}`}
          className="mx-auto block h-auto w-full max-w-[820px] bg-white shadow-md"
        />
      ))}
    </div>
  )
}

export function OshProgramPreview({ program, filename = "osh-training-program.pdf" }: OshProgramPreviewProps) {
  const [pages, setPages] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setBusy(true)
      void oshProgramPdfBlob(program)
        .then((blob) => pdfToPageImages(blob))
        .then((next) => {
          if (cancelled) return
          setPages(next)
          setError(null)
        })
        .catch((e) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : "Could not build preview")
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [program])

  const exportPdf = async () => {
    setExporting(true)
    try {
      await downloadOshProgramPdf(program, filename)
    } catch (e) {
      toast.error("Could not export PDF", {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  const kind = oshPdfKind(program)

  return (
    <div className="w-full min-w-0 space-y-2 sm:space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Official DOLE PDF preview</p>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            <span className="sm:hidden">
              {kind === "cosh" ? "COSH 4-day" : "BOSH SO2 4-day"} template.
            </span>
            <span className="hidden sm:inline">
              {kind === "cosh" ? "COSH 4-day template" : "BOSH SO2 4-day template"}. Tick boxes and type names — the
              printed agenda stays as in the original form.
            </span>
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-[11px] sm:h-8 sm:text-xs"
            onClick={() => setOpen(true)}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Preview</span>
            <span className="hidden sm:inline">Show preview</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 bg-[#1A1D66] text-[11px] hover:bg-[#141654] sm:h-8 sm:text-xs"
            disabled={exporting || busy}
            onClick={() => void exportPdf()}
          >
            {exporting ? <Spinner size={14} /> : <FileDown className="h-3.5 w-3.5 shrink-0" />}
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      </div>

      {/* Mobile: first-page thumbnail only — full stack opens in dialog */}
      <div className="relative overflow-hidden rounded-lg border sm:hidden">
        {busy ? (
          <div className="flex h-36 items-center justify-center gap-2 bg-muted/40 text-xs text-muted-foreground">
            <Spinner size={16} />
            Updating…
          </div>
        ) : error ? (
          <p className="p-3 text-xs text-destructive">{error}</p>
        ) : pages[0] ? (
          <button type="button" className="block w-full bg-[#5f6368] p-2" onClick={() => setOpen(true)}>
            <img
              src={pages[0]}
              alt="Program preview page 1"
              className="mx-auto block h-auto w-full max-w-[420px] bg-white shadow-md"
            />
            <span className="mt-1.5 block text-center text-[10px] font-medium text-white/90">
              Tap to view all {pages.length} page{pages.length === 1 ? "" : "s"}
            </span>
          </button>
        ) : (
          <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">Building preview…</div>
        )}
      </div>

      {/* Desktop / tablet: full inline stack */}
      <div className="relative hidden rounded-lg border sm:block">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted-foreground">
            <Spinner size={18} />
            Updating preview…
          </div>
        ) : null}
        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : pages.length ? (
          <PageStack pages={pages} />
        ) : (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
            Building preview…
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92vh] w-[min(1000px,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-2.5 sm:px-5 sm:py-3">
            <DialogTitle className="text-sm sm:text-base">Program preview — this is the exported PDF</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {pages.length ? (
              <PageStack pages={pages} compact />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                <Spinner size={20} />
                Building preview…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
