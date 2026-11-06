"use client"

import * as React from "react"
import QRCode from "qrcode"
import { format } from "date-fns"
import {
  Archive,
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  QrCode,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  defaultTitleFromContent,
  deleteQrBinItem,
  loadQrBin,
  upsertQrBinItem,
  type QrBinItem,
  type QrBinSize,
} from "@/lib/qr-bin"

const SIZE_OPTIONS = [
  { label: "256", value: 256 as QrBinSize },
  { label: "512", value: 512 as QrBinSize },
  { label: "1024", value: 1024 as QrBinSize },
] as const

async function buildQrDataUrl(item: {
  content: string
  size: QrBinSize
  fg: string
  bg: string
}) {
  return QRCode.toDataURL(item.content.trim(), {
    width: item.size,
    margin: 2,
    color: { dark: item.fg, light: item.bg },
    errorCorrectionLevel: "M",
  })
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

export default function QrGeneratorPage() {
  const [text, setText] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [size, setSize] = React.useState<QrBinSize>(512)
  const [fg, setFg] = React.useState("#1A1D66")
  const [bg, setBg] = React.useState("#ffffff")
  const [dataUrl, setDataUrl] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [bin, setBin] = React.useState<QrBinItem[]>([])
  const [binLoading, setBinLoading] = React.useState(true)
  const [schemaMissing, setSchemaMissing] = React.useState(false)
  const [binPreviews, setBinPreviews] = React.useState<Record<string, string>>({})
  const [binBusyId, setBinBusyId] = React.useState<string | null>(null)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [saveTitle, setSaveTitle] = React.useState("")

  const refreshBin = React.useCallback(async () => {
    setBinLoading(true)
    const result = await loadQrBin()
    setBinLoading(false)
    if (result.schemaMissing) {
      setSchemaMissing(true)
      setBin([])
      return
    }
    setSchemaMissing(false)
    if (result.error) {
      toast.error("Could not load QR bin", { description: result.error })
      setBin([])
      return
    }
    setBin(result.items)
  }, [])

  React.useEffect(() => {
    void refreshBin()
  }, [refreshBin])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      const next: Record<string, string> = {}
      for (const item of bin) {
        try {
          next[item.id] = await buildQrDataUrl(item)
        } catch {
          // skip broken entries
        }
      }
      if (!cancelled) setBinPreviews(next)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [bin])

  const generate = async () => {
    const value = text.trim()
    if (!value) {
      toast.error("Enter text or a URL to generate a QR code")
      setDataUrl("")
      return
    }
    setBusy(true)
    try {
      const url = await buildQrDataUrl({ content: value, size, fg, bg })
      setDataUrl(url)
      toast.success("QR code generated")
    } catch (error) {
      console.error(error)
      toast.error("Could not generate QR code")
      setDataUrl("")
    } finally {
      setBusy(false)
    }
  }

  const downloadPng = () => {
    if (!dataUrl) return
    downloadDataUrl(dataUrl, `qr-${Date.now()}.png`)
    toast.success("QR downloaded")
  }

  const copyContent = async () => {
    const value = text.trim()
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Content copied")
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Could not copy")
    }
  }

  const clearAll = () => {
    setText("")
    setTitle("")
    setDataUrl("")
    setCopied(false)
    setEditingId(null)
  }

  const openSaveDialog = () => {
    if (!text.trim()) {
      toast.error("Generate or enter content first")
      return
    }
    setSaveTitle(title.trim() || defaultTitleFromContent(text))
    setSaveOpen(true)
  }

  const saveToBin = async () => {
    const value = text.trim()
    if (!value) {
      toast.error("Nothing to save")
      return
    }
    setBusy(true)
    try {
      // Ensure preview exists with current settings
      const url = dataUrl || (await buildQrDataUrl({ content: value, size, fg, bg }))
      setDataUrl(url)
      const result = await upsertQrBinItem({
        id: editingId || undefined,
        title: saveTitle.trim() || defaultTitleFromContent(value),
        content: value,
        size,
        fg,
        bg,
      })
      if (result.schemaMissing) {
        setSchemaMissing(true)
        toast.error("QR bin table is missing", {
          description: "Run scripts/add-qr-bin.sql in Supabase, then refresh.",
        })
        return
      }
      if (result.error || !result.item) {
        toast.error("Could not save QR", { description: result.error })
        return
      }
      setEditingId(result.item.id)
      setTitle(result.item.title)
      setSaveOpen(false)
      await refreshBin()
      toast.success(editingId ? "QR updated in Supabase" : "Saved to QR bin (Supabase)")
    } catch (error) {
      console.error(error)
      toast.error("Could not save QR")
    } finally {
      setBusy(false)
    }
  }

  const loadForEdit = (item: QrBinItem) => {
    setEditingId(item.id)
    setTitle(item.title)
    setText(item.content)
    setSize(item.size)
    setFg(item.fg)
    setBg(item.bg)
    setDataUrl(binPreviews[item.id] || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
    toast.message("Loaded for editing", { description: item.title })
  }

  const downloadBinItem = async (item: QrBinItem) => {
    setBinBusyId(item.id)
    try {
      const url = binPreviews[item.id] || (await buildQrDataUrl(item))
      const safe = item.title.replace(/[^\w.-]+/g, "-").slice(0, 48) || "qr"
      downloadDataUrl(url, `${safe}.png`)
      toast.success("QR downloaded")
    } catch {
      toast.error("Could not download QR")
    } finally {
      setBinBusyId(null)
    }
  }

  const removeBinItem = async (item: QrBinItem) => {
    if (!window.confirm(`Delete “${item.title}” from QR bin?`)) return
    setBinBusyId(item.id)
    const result = await deleteQrBinItem(item.id)
    setBinBusyId(null)
    if (result.schemaMissing) {
      setSchemaMissing(true)
      toast.error("QR bin table is missing", {
        description: "Run scripts/add-qr-bin.sql in Supabase, then refresh.",
      })
      return
    }
    if (result.error) {
      toast.error("Could not delete QR", { description: result.error })
      return
    }
    if (editingId === item.id) {
      setEditingId(null)
    }
    await refreshBin()
    toast.success("Removed from QR bin")
  }

  return (
    <div className="page-shell mx-auto w-full min-w-0 max-w-5xl space-y-4 sm:space-y-6">
      <div className="overflow-hidden rounded-lg border border-[#FFCC00]/40 bg-gradient-to-br from-[#1A1D66] via-[#24286f] to-[#141654] text-white shadow-md sm:rounded-xl">
        <div className="h-0.5 bg-[#FFCC00] sm:h-1" />
        <div className="flex items-start gap-3 p-3 sm:p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#FFCC00]/15 sm:size-12">
            <QrCode className="size-5 text-[#FFCC00] sm:size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-2xl">QR Generator</h1>
            <p className="mt-0.5 text-xs text-white/75 sm:text-sm">
              Generate a QR, download it, or save it to your QR bin to manage later.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="gap-0 border-border/80 py-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-base sm:text-lg">
              {editingId ? "Edit QR" : "Content"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {editingId
                ? "Update this saved QR, then save again to overwrite it in the bin."
                : "Paste a URL, booking link, or any text, then click Generate."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            {editingId ? (
              <div className="rounded-lg border border-[#1A1D66]/15 bg-[#1A1D66]/5 px-3 py-2 text-xs text-[#1A1D66] dark:border-white/10 dark:bg-white/5 dark:text-[#FFCC00]">
                Editing saved QR — save to update, or clear to start a new one.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="qr-title">Title (optional)</Label>
              <Input
                id="qr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Attendance check-in"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-text">Text / URL</Label>
              <Textarea
                id="qr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://example.com or any text…"
                className="min-h-28 resize-y text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label>Size (px)</Label>
                <div className="flex gap-1.5">
                  {SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSize(opt.value)}
                      className={cn(
                        "h-9 flex-1 rounded-md border text-xs font-medium transition-colors",
                        size === opt.value
                          ? "border-[#1A1D66] bg-[#1A1D66] text-white"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-fg">Foreground</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="qr-fg"
                    type="color"
                    value={fg}
                    onChange={(e) => setFg(e.target.value)}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                  <Input
                    value={fg}
                    onChange={(e) => setFg(e.target.value)}
                    className="h-9 font-mono text-xs uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-bg">Background</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="qr-bg"
                    type="color"
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                  <Input
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="h-9 font-mono text-xs uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-1.5 bg-[#1A1D66] hover:bg-[#141654]"
                disabled={busy || !text.trim()}
                onClick={() => void generate()}
              >
                {busy ? <Spinner size={14} /> : <QrCode className="h-4 w-4" />}
                Generate
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" disabled={!text.trim()} onClick={() => void copyContent()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy text"}
              </Button>
              <Button type="button" variant="ghost" className="gap-1.5" onClick={clearAll}>
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-border/80 py-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-base sm:text-lg">Preview</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Download a PNG or save it to your QR bin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 px-4 py-5 sm:px-6">
            <p className="w-full max-w-[280px] text-center text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
              You will die first before this QR expires.
            </p>
            <div className="flex aspect-square w-full max-w-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-3">
              {busy ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Spinner size={28} />
                  <span className="text-xs">Generating…</span>
                </div>
              ) : dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt="Generated QR code" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                  <QrCode className="size-10 opacity-40" />
                  <p className="text-xs">Enter content to preview a QR code</p>
                </div>
              )}
            </div>
            <div className="flex w-full max-w-[280px] flex-col gap-2">
              <Button
                type="button"
                className="w-full gap-1.5 bg-[#FFCC00] text-[#1A1D66] hover:bg-[#e6b800]"
                disabled={!dataUrl || busy}
                onClick={downloadPng}
              >
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-1.5"
                disabled={!text.trim() || busy}
                onClick={openSaveDialog}
              >
                <Save className="h-4 w-4" />
                {editingId ? "Update in QR bin" : "Save to QR bin"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 border-border/80 py-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Archive className="h-4 w-4 text-primary" />
                QR bin
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Stored in Supabase. Download, edit, or delete anytime.
              </CardDescription>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {bin.length} saved
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-3 py-3 sm:px-6 sm:py-4">
          {schemaMissing ? (
            <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              The QR bin table is not set up yet. Run{" "}
              <code className="rounded bg-amber-200/70 px-1 dark:bg-amber-900">scripts/add-qr-bin.sql</code>{" "}
              in the Supabase SQL editor, then refresh this page.
            </div>
          ) : binLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner size={18} />
              Loading QR bin…
            </div>
          ) : bin.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <Archive className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">No QRs in the bin yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate a QR, then click Save to QR bin.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {bin.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
                    editingId === item.id && "ring-2 ring-[#1A1D66]/40"
                  )}
                >
                  <div className="flex items-center justify-center bg-muted/20 p-3">
                    {binPreviews[item.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={binPreviews[item.id]}
                        alt={item.title}
                        className="size-28 object-contain"
                      />
                    ) : (
                      <div className="flex size-28 items-center justify-center text-muted-foreground">
                        <Spinner size={20} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 border-t p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground" title={item.content}>
                        {item.content}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Updated {format(new Date(item.updatedAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 px-1.5 text-[11px]"
                        disabled={binBusyId === item.id}
                        onClick={() => void downloadBinItem(item)}
                      >
                        {binBusyId === item.id ? <Spinner size={12} /> : <Download className="h-3.5 w-3.5" />}
                        PNG
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 px-1.5 text-[11px]"
                        onClick={() => loadForEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 px-1.5 text-[11px] text-destructive hover:text-destructive"
                        disabled={binBusyId === item.id}
                        onClick={() => void removeBinItem(item)}
                      >
                        {binBusyId === item.id ? <Spinner size={12} /> : <Trash2 className="h-3.5 w-3.5" />}
                        Del
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Update QR in bin" : "Save to QR bin"}</DialogTitle>
            <DialogDescription>
              Give it a short name so you can find it later. Saved to your Supabase database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="bin-title">Title</Label>
            <Input
              id="bin-title"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="QR title"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-1.5 bg-[#1A1D66] hover:bg-[#141654]"
              disabled={busy}
              onClick={() => void saveToBin()}
            >
              {busy ? <Spinner size={14} /> : <Save className="h-4 w-4" />}
              {editingId ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
