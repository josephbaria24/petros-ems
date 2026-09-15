"use client"

import * as React from "react"
import { Eye, FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { downloadOshProgramPdf, oshPdfKind, oshProgramPdfBlob } from "@/lib/osh-program-pdf"
import type { OshProgram } from "@/lib/osh-program"

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

function PageStack({ pages }: { pages: string[] }) {
  return (
    <div className="space-y-4 bg-[#5f6368] p-4">
      {pages.map((src, i) => (
        <img
          key={`${i}-${src.slice(-24)}`}
          src={src}
          alt={`Program page ${i + 1}`}
          className="mx-auto block w-full max-w-[820px] bg-white shadow-md"
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Official DOLE PDF preview</p>
          <p className="text-xs text-muted-foreground">
            {kind === "cosh" ? "COSH 4-day template" : "BOSH SO2 4-day template"}. Tick boxes and type names — the
            printed agenda stays as in the original form.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Eye className="h-3.5 w-3.5" />
            Show preview
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-[#1A1D66] hover:bg-[#141654]"
            disabled={exporting || busy}
            onClick={() => void exportPdf()}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating preview…
          </div>
        ) : null}
        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : pages.length ? (
          <div className="max-h-[640px] overflow-y-auto">
            <PageStack pages={pages} />
          </div>
        ) : (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
            Building preview…
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92vh] w-[min(1000px,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-3">
            <DialogTitle>Program preview — this is the exported PDF</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {pages.length ? (
              <PageStack pages={pages} />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Building preview…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
