"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, RotateCw, Maximize2, Upload, Crop as CropIcon } from "lucide-react"

export type ImageCropType = "2x2" | "id" | "template" | "free"

interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageType?: ImageCropType
  /** Uploads crop via /api/upload and returns URLs (default trainee photo flow) */
  onSave?: (croppedImageUrl: string, originalImageUrl: string) => Promise<void>
  /** Returns a local File + preview without uploading (template editor flow) */
  onLocalSave?: (file: File, previewDataUrl: string) => Promise<void> | void
  existingImageUrl?: string
  title?: string
  /** Force an aspect ratio (overrides imageType default). Pass null for free crop. */
  aspect?: number | null
}

function getDefaultAspect(imageType: ImageCropType, aspect?: number | null) {
  if (aspect === null) return undefined
  if (typeof aspect === "number") return aspect
  if (imageType === "2x2") return 1
  if (imageType === "id") return 3 / 4
  return undefined
}

function createCenteredCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect?: number
): Crop {
  if (aspect) {
    return centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 80,
        },
        aspect,
        mediaWidth,
        mediaHeight
      ),
      mediaWidth,
      mediaHeight
    )
  }

  return centerCrop(
    {
      unit: "%",
      width: 80,
      height: 80,
    },
    mediaWidth,
    mediaHeight
  )
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageType = "2x2",
  onSave,
  onLocalSave,
  existingImageUrl,
  title,
  aspect: aspectProp,
}: ImageCropDialogProps) {
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageSrc, setImageSrc] = useState("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [rotation, setRotation] = useState(0)
  const [lockAspect, setLockAspect] = useState(imageType === "2x2" || imageType === "id")
  const imgRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)

  const aspect = lockAspect ? getDefaultAspect(imageType, aspectProp) : undefined
  const isLocalMode = typeof onLocalSave === "function" && !onSave

  useEffect(() => {
    if (!open) {
      if (imageSrc.startsWith("blob:")) URL.revokeObjectURL(imageSrc)
      setImageSrc("")
      setOriginalFile(null)
      setCrop(undefined)
      setCompletedCrop(null)
      setRotation(0)
      setLockAspect(imageType === "2x2" || imageType === "id")
      return
    }

    if (!existingImageUrl) return

    let cancelled = false
    let objectUrl = ""

    const loadImage = async () => {
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(existingImageUrl)}`
        const response = await fetch(proxyUrl)
        if (!response.ok) {
          if (!cancelled) setImageSrc(existingImageUrl)
          return
        }
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setImageSrc(objectUrl)
      } catch {
        if (!cancelled) setImageSrc(existingImageUrl)
      }
    }

    loadImage()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingImageUrl, imageType])

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = event.currentTarget
    const nextCrop = createCenteredCrop(width, height, aspect)
    setCrop(nextCrop)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOriginalFile(file)
    setUploading(true)
    setCompletedCrop(null)

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setUploading(false)
      setRotation(0)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const getCroppedImg = useCallback(
    (image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No 2d context")

      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height
      const cropWidth = pixelCrop.width * scaleX
      const cropHeight = pixelCrop.height * scaleY
      const rotRad = (rotation * Math.PI) / 180

      if (rotation === 90 || rotation === 270) {
        canvas.width = Math.round(cropHeight)
        canvas.height = Math.round(cropWidth)
      } else {
        canvas.width = Math.round(cropWidth)
        canvas.height = Math.round(cropHeight)
      }

      ctx.imageSmoothingQuality = "high"
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(rotRad)

      if (rotation === 90 || rotation === 270) {
        ctx.drawImage(
          image,
          pixelCrop.x * scaleX,
          pixelCrop.y * scaleY,
          cropWidth,
          cropHeight,
          -cropHeight / 2,
          -cropWidth / 2,
          cropHeight,
          cropWidth
        )
      } else {
        ctx.drawImage(
          image,
          pixelCrop.x * scaleX,
          pixelCrop.y * scaleY,
          cropWidth,
          cropHeight,
          -cropWidth / 2,
          -cropHeight / 2,
          cropWidth,
          cropHeight
        )
      }

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
          "image/jpeg",
          0.95
        )
      })
    },
    [rotation]
  )

  const uploadImage = async (blob: Blob, filename: string): Promise<string> => {
    const formData = new FormData()
    formData.append("image", blob, filename)
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
    if (!response.ok) throw new Error("Upload failed")
    const data = await response.json()
    return data.url
  }

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
      alert("Drag and resize the crop box to select part of the image first")
      return
    }

    setSaving(true)
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop)
      const fileName = `cropped_${imageType}_${Date.now()}.jpg`

      if (isLocalMode && onLocalSave) {
        const file = new File([croppedBlob], fileName, { type: "image/jpeg" })
        const previewDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(croppedBlob)
        })
        await onLocalSave(file, previewDataUrl)
      } else if (onSave) {
        let originalUrl = existingImageUrl || ""
        if (originalFile) {
          originalUrl = await uploadImage(originalFile, `original_${imageType}_${Date.now()}.jpg`)
        }
        const croppedUrl = await uploadImage(croppedBlob, fileName)
        await onSave(croppedUrl, originalUrl)
      }

      onOpenChange(false)
    } catch (error) {
      console.error("Error saving image:", error)
      alert("Failed to save image. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleResetCrop = () => {
    if (!imgRef.current) return
    const next = createCenteredCrop(imgRef.current.width, imgRef.current.height, aspect)
    setCrop(next)
  }

  const dialogTitle =
    title ||
    `${existingImageUrl ? "Crop" : "Upload & Crop"} ${
      imageType === "2x2"
        ? "2x2 Photo"
        : imageType === "id"
          ? "ID Picture"
          : imageType === "template"
            ? "Template Image"
            : "Image"
    }`

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="lg:w-[56vw] w-[95vw] max-h-[92vh] overflow-hidden flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-5 w-5" />
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto space-y-4">
            {!imageSrc ? (
              <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed rounded-xl bg-muted/30">
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="lg">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-5 w-5" />
                      Select Image
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-3 text-center px-6">
                  Choose a photo, then drag the selection box to crop the part you want.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
                  <Button variant="outline" size="sm" onClick={() => setRotation((prev) => (prev + 90) % 360)}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Rotate
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetCrop}>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Reset Selection
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Replace Image
                  </Button>

                  {imageType !== "2x2" && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch
                        id="lock-aspect"
                        checked={lockAspect}
                        onCheckedChange={(checked) => {
                          setLockAspect(checked)
                          if (imgRef.current) {
                            const nextAspect = checked
                              ? getDefaultAspect(imageType, aspectProp)
                              : undefined
                            setCrop(
                              createCenteredCrop(
                                imgRef.current.width,
                                imgRef.current.height,
                                nextAspect
                              )
                            )
                          }
                        }}
                      />
                      <Label htmlFor="lock-aspect" className="text-xs font-medium cursor-pointer">
                        Lock aspect
                      </Label>
                    </div>
                  )}

                  {rotation > 0 && (
                    <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                      Rotated {rotation}°
                    </span>
                  )}
                </div>

                <div className="flex justify-center rounded-xl border bg-[#1a1a1a] p-4 overflow-auto">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspect}
                    circularCrop={imageType === "2x2"}
                    keepSelection
                    ruleOfThirds
                    className="max-w-full"
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      style={{
                        transform: rotation ? `rotate(${rotation}deg)` : undefined,
                        maxHeight: "520px",
                        maxWidth: "100%",
                        display: "block",
                      }}
                    />
                  </ReactCrop>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-sm text-blue-900 dark:text-blue-200">
                  <p className="font-semibold mb-1">How to crop</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-300">
                    <li>Drag inside the box to move the selected area</li>
                    <li>Drag the corner / edge handles to resize</li>
                    <li>Only the selected area will be saved</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            {imageSrc && (
              <Button onClick={handleSave} disabled={saving || !completedCrop}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Cropped Image"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
