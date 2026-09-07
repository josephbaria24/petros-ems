"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  Paintbrush,
  Eraser,
  Pipette,
  PaintBucket,
  Undo2,
  Redo2,
  RotateCcw,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type PaintTool = "paint" | "erase" | "soft-erase" | "eyedropper" | "fill"

type ImagePaintDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current photo to edit */
  imageUrl: string
  /** Fallback for Reset (usually picture_2x2_original) */
  originalImageUrl?: string | null
  title?: string
  /** Called with the uploaded public URL after save */
  onSave: (editedImageUrl: string) => Promise<void>
}

const MAX_HISTORY = 30
const DEFAULT_COLOR = "#000000"
const SWATCHES = ["#000000", "#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#78716c"]

function rgbaMatch(
  data: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number,
  tol = 8,
) {
  return (
    Math.abs(data[i] - r) <= tol &&
    Math.abs(data[i + 1] - g) <= tol &&
    Math.abs(data[i + 2] - b) <= tol &&
    Math.abs(data[i + 3] - a) <= tol
  )
}

function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillR: number,
  fillG: number,
  fillB: number,
  fillA: number,
) {
  const { width, height, data } = imageData
  const x0 = Math.floor(startX)
  const y0 = Math.floor(startY)
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return

  const startIdx = (y0 * width + x0) * 4
  const tr = data[startIdx]
  const tg = data[startIdx + 1]
  const tb = data[startIdx + 2]
  const ta = data[startIdx + 3]

  if (tr === fillR && tg === fillG && tb === fillB && ta === fillA) return

  const stack: number[] = [x0, y0]
  const visited = new Uint8Array(width * height)

  while (stack.length) {
    const y = stack.pop()!
    const x = stack.pop()!
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const vi = y * width + x
    if (visited[vi]) continue
    const i = vi * 4
    if (!rgbaMatch(data, i, tr, tg, tb, ta)) continue
    visited[vi] = 1
    data[i] = fillR
    data[i + 1] = fillG
    data[i + 2] = fillB
    data[i + 3] = fillA
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

export function ImagePaintDialog({
  open,
  onOpenChange,
  imageUrl,
  originalImageUrl,
  title = "Edit Picture",
  onSave,
}: ImagePaintDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const redoRef = useRef<ImageData[]>([])
  const baseUrlRef = useRef(imageUrl)
  const fitScaleRef = useRef(1)
  const brushSizeRef = useRef(24)
  const toolRef = useRef<PaintTool>("erase")
  const colorRef = useRef(DEFAULT_COLOR)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tool, setTool] = useState<PaintTool>("erase")
  const [brushSize, setBrushSize] = useState(24)
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [recentColors, setRecentColors] = useState<string[]>(SWATCHES)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [displayScale, setDisplayScale] = useState(1)
  const [userZoom, setUserZoom] = useState(1)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  /** Cursor position in wrap-local CSS pixels (for brush indicator). */
  const [cursorUi, setCursorUi] = useState<{ x: number; y: number } | null>(null)
  /** Short hover trail in wrap-local CSS pixels. */
  const [trailUi, setTrailUi] = useState<Array<{ x: number; y: number; t: number }>>([])

  brushSizeRef.current = brushSize
  toolRef.current = tool
  colorRef.current = color

  const syncHistoryButtons = () => {
    setCanUndo(historyRef.current.length > 1)
    setCanRedo(redoRef.current.length > 0)
  }

  const applyDisplayScale = useCallback((fit: number, zoom: number) => {
    setDisplayScale(Math.max(0.15, Math.min(6, fit * zoom)))
  }, [])

  /** Push current canvas as the tip of history (call after a completed edit). */
  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d", { willReadFrequently: true })
    if (!canvas || !ctx) return
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current.push(snap)
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    redoRef.current = []
    syncHistoryButtons()
  }, [])

  const loadIntoCanvas = useCallback(
    async (url: string) => {
      setLoading(true)
      setLoadError(null)
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`
        const res = await fetch(proxyUrl)
        if (!res.ok) throw new Error("Failed to load image")
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error("Invalid image"))
          img.src = objectUrl
        })
        URL.revokeObjectURL(objectUrl)

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return

        const maxEdge = 1200
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        canvas.width = w
        canvas.height = h
        setCanvasSize({ w, h })
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        historyRef.current = []
        redoRef.current = []
        pushHistory()

        const wrap = wrapRef.current
        let fit = 1
        if (wrap) {
          const availW = Math.max(200, wrap.clientWidth - 16)
          const availH = Math.max(200, Math.min(480, window.innerHeight * 0.45))
          fit = Math.min(1, availW / w, availH / h)
        }
        fitScaleRef.current = fit
        setUserZoom(1)
        applyDisplayScale(fit, 1)
        setCursorUi(null)
        setTrailUi([])
        baseUrlRef.current = url
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load image")
      } finally {
        setLoading(false)
      }
    },
    [pushHistory, applyDisplayScale],
  )

  useEffect(() => {
    if (!open || !imageUrl) return
    void loadIntoCanvas(imageUrl)
  }, [open, imageUrl, loadIntoCanvas])

  // Ctrl + mouse wheel zoom (prevent browser page zoom)
  useEffect(() => {
    if (!open) return
    const wrap = wrapRef.current
    if (!wrap) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const direction = e.deltaY < 0 ? 1 : -1
      setUserZoom((prev) => {
        const next = Math.max(0.25, Math.min(5, Number((prev * (direction > 0 ? 1.12 : 1 / 1.12)).toFixed(3))))
        applyDisplayScale(fitScaleRef.current, next)
        return next
      })
    }

    wrap.addEventListener("wheel", onWheel, { passive: false })
    return () => wrap.removeEventListener("wheel", onWheel)
  }, [open, applyDisplayScale])

  const getWrapPoint = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current
    if (!wrap) return null
    const rect = wrap.getBoundingClientRect()
    // Viewport-relative to the visible wrap (absolute overlays sit on the padding box)
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const x = ((clientX - rect.left) / rect.width) * canvas.width
    const y = ((clientY - rect.top) / rect.height) * canvas.height
    return { x, y }
  }

  const updateCursorChrome = (clientX: number, clientY: number) => {
    const ui = getWrapPoint(clientX, clientY)
    if (!ui) return
    setCursorUi(ui)
    const t = toolRef.current
    if (t === "paint" || t === "erase" || t === "soft-erase") {
      setTrailUi((prev) => {
        const next = [...prev, { x: ui.x, y: ui.y, t: Date.now() }].slice(-18)
        return next
      })
    } else {
      setTrailUi([])
    }
  }

  const strokeAt = (x: number, y: number, from: { x: number; y: number } | null) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d", { willReadFrequently: true })
    if (!canvas || !ctx) return

    const size = brushSizeRef.current
    const activeTool = toolRef.current
    const activeColor = colorRef.current

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = size

    if (activeTool === "erase") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.globalAlpha = 1
      ctx.strokeStyle = "rgba(0,0,0,1)"
    } else if (activeTool === "soft-erase") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = "rgba(0,0,0,1)"
    } else if (activeTool === "paint") {
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1
      ctx.strokeStyle = activeColor
    } else {
      return
    }

    // Dense interpolation so fast strokes leave a continuous trail
    const start = from ?? { x, y }
    const dx = x - start.x
    const dy = y - start.y
    const dist = Math.hypot(dx, dy)
    const step = Math.max(1, size * 0.25)
    const steps = from ? Math.max(1, Math.ceil(dist / step)) : 1

    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const px = start.x + dx * t
      const py = start.y + dy * t
      const prevX = start.x + dx * ((i - 1) / steps)
      const prevY = start.y + dy * ((i - 1) / steps)
      ctx.beginPath()
      ctx.moveTo(prevX, prevY)
      ctx.lineTo(px + 0.01, py)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (loading || saving) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    updateCursorChrome(e.clientX, e.clientY)
    const pt = getCanvasPoint(e.clientX, e.clientY)
    if (!pt) return

    if (tool === "eyedropper") {
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      const pixel = ctx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data
      if (pixel[3] < 16) return
      const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
      setColor(hex)
      setRecentColors((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 8))
      setTool("paint")
      return
    }

    if (tool === "fill") {
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const { r, g, b } = hexToRgb(color)
      if (e.altKey) {
        floodFill(imageData, pt.x, pt.y, 0, 0, 0, 0)
      } else {
        floodFill(imageData, pt.x, pt.y, r, g, b, 255)
      }
      ctx.putImageData(imageData, 0, 0)
      pushHistory()
      return
    }

    drawingRef.current = true
    lastPointRef.current = pt
    strokeAt(pt.x, pt.y, null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    updateCursorChrome(e.clientX, e.clientY)
    if (!drawingRef.current) return
    const pt = getCanvasPoint(e.clientX, e.clientY)
    if (!pt) return
    strokeAt(pt.x, pt.y, lastPointRef.current)
    lastPointRef.current = pt
  }

  const handlePointerUp = () => {
    if (drawingRef.current) {
      pushHistory()
    }
    drawingRef.current = false
    lastPointRef.current = null
  }

  const handlePointerLeave = () => {
    if (!drawingRef.current) {
      setCursorUi(null)
      setTrailUi([])
    }
  }

  const handleUndo = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d", { willReadFrequently: true })
    if (!canvas || !ctx || historyRef.current.length <= 1) return
    const current = historyRef.current.pop()!
    redoRef.current.push(current)
    const prev = historyRef.current[historyRef.current.length - 1]
    ctx.putImageData(prev, 0, 0)
    syncHistoryButtons()
  }

  const handleRedo = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d", { willReadFrequently: true })
    if (!canvas || !ctx || redoRef.current.length === 0) return
    const next = redoRef.current.pop()!
    historyRef.current.push(next)
    ctx.putImageData(next, 0, 0)
    syncHistoryButtons()
  }

  const handleReset = () => {
    const resetUrl = originalImageUrl || baseUrlRef.current || imageUrl
    void loadIntoCanvas(resetUrl)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    try {
      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export image"))), "image/png")
      })
      const { compressForUpload } = await import("@/lib/compress-image-blob")
      const blob = await compressForUpload(rawBlob, true)
      const formData = new FormData()
      formData.append("image", blob, `edited_2x2_${Date.now()}.png`)
      const response = await fetch("/api/upload", { method: "POST", body: formData })
      if (response.status === 413) {
        throw new Error("Edited image is too large for the server.")
      }
      if (!response.ok) throw new Error("Upload failed")
      const data = await response.json()
      if (!data.url) throw new Error("Upload did not return a URL")
      await onSave(data.url as string)
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Failed to save edited picture")
    } finally {
      setSaving(false)
    }
  }

  const toolBtn = (id: PaintTool, label: string, icon: React.ReactNode) => (
    <Button
      key={id}
      type="button"
      size="sm"
      variant={tool === id ? "default" : "outline"}
      className="h-8 gap-1.5"
      onClick={() => setTool(id)}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {toolBtn("erase", "Erase", <Eraser className="h-3.5 w-3.5" />)}
          {toolBtn("soft-erase", "Soft erase", <Eraser className="h-3.5 w-3.5 opacity-60" />)}
          {toolBtn("paint", "Paint", <Paintbrush className="h-3.5 w-3.5" />)}
          {toolBtn("eyedropper", "Eyedropper", <Pipette className="h-3.5 w-3.5" />)}
          {toolBtn("fill", "Fill", <PaintBucket className="h-3.5 w-3.5" />)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs shrink-0">Brush {brushSize}px</Label>
              <Slider
                value={[brushSize]}
                min={2}
                max={80}
                step={1}
                onValueChange={(v) => setBrushSize(v[0] ?? 24)}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Color</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 p-1 cursor-pointer"
                disabled={tool === "erase" || tool === "soft-erase"}
              />
              <div className="flex gap-1">
                {recentColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-sm border border-border",
                      color === c && "ring-2 ring-primary",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setColor(c)
                      setTool("paint")
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Erase makes pixels transparent. Fill paints a region; hold Alt while filling to clear to
              transparent. Zoom with Ctrl + mouse wheel ({Math.round(userZoom * 100)}%).
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={!canUndo} onClick={handleUndo}>
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Undo
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!canRedo} onClick={handleRedo}>
              <Redo2 className="h-3.5 w-3.5 mr-1" />
              Redo
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handleReset} disabled={loading}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={userZoom === 1}
              onClick={() => {
                setUserZoom(1)
                applyDisplayScale(fitScaleRef.current, 1)
              }}
            >
              Zoom 100%
            </Button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative flex items-center justify-center rounded-md border overflow-auto min-h-[220px] max-h-[52vh] p-2"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
            backgroundColor: "#eee",
          }}
          onPointerLeave={handlePointerLeave}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {loadError && (
            <p className="text-sm text-destructive p-4">{loadError}</p>
          )}
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="touch-none max-w-none"
              style={{
                width: canvasSize.w ? canvasSize.w * displayScale : undefined,
                height: canvasSize.h ? canvasSize.h * displayScale : undefined,
                cursor: "none",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>

          {/* Brush trail + size indicator (overlay in wrap scroll space) */}
          {(tool === "paint" || tool === "erase" || tool === "soft-erase") && trailUi.length > 1 && (
            <svg
              className="pointer-events-none absolute inset-0 z-20 overflow-visible"
              width="100%"
              height="100%"
            >
              <polyline
                fill="none"
                stroke={tool === "paint" ? color : "rgba(15,23,42,0.45)"}
                strokeWidth={Math.max(1, brushSize * displayScale * (tool === "soft-erase" ? 0.6 : 0.85))}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.28}
                points={trailUi.map((p) => `${p.x},${p.y}`).join(" ")}
              />
            </svg>
          )}
          {cursorUi && (tool === "paint" || tool === "erase" || tool === "soft-erase") && (
            <div
              className="pointer-events-none absolute z-30 rounded-full border-2 shadow-sm"
              style={{
                left: cursorUi.x,
                top: cursorUi.y,
                width: Math.max(6, brushSize * displayScale),
                height: Math.max(6, brushSize * displayScale),
                transform: "translate(-50%, -50%)",
                borderColor: tool === "paint" ? color : "#0f172a",
                borderStyle: tool === "soft-erase" ? "dashed" : "solid",
                backgroundColor:
                  tool === "paint"
                    ? `${color}33`
                    : tool === "erase"
                      ? "rgba(255,255,255,0.35)"
                      : "rgba(148,163,184,0.25)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.8)",
              }}
            />
          )}
          {cursorUi && (tool === "eyedropper" || tool === "fill") && (
            <div
              className="pointer-events-none absolute z-30 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{
                left: cursorUi.x,
                top: cursorUi.y,
                backgroundColor: tool === "fill" ? color : "transparent",
              }}
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loading || !!loadError}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
