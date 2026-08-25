/** Max edge length for certificate/ID 2×2 photos (pixels). */
const DEFAULT_MAX_EDGE = 900
/** Stay under Vercel/proxy body limits (~4.5MB) including multipart overhead. */
const TARGET_MAX_BYTES = 1.2 * 1024 * 1024

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      mime,
      quality,
    )
  })
}

async function resizeToCanvas(blob: Blob, maxEdge: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("Could not prepare image for upload")
    ctx.clearRect(0, 0, width, height)
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas
  } finally {
    bitmap.close()
  }
}

/**
 * Resize any image blob to a PNG (preserving alpha when present) so uploads
 * stay under typical reverse-proxy / Vercel body-size limits (~4.5MB).
 */
export async function compressPngBlob(
  blob: Blob,
  maxEdge = DEFAULT_MAX_EDGE,
): Promise<Blob> {
  const canvas = await resizeToCanvas(blob, maxEdge)
  const out = await canvasToBlob(canvas, "image/png")

  if (out.size > TARGET_MAX_BYTES && maxEdge > 360) {
    return compressPngBlob(out, Math.floor(maxEdge * 0.72))
  }

  return out
}

/** JPEG compression for images that do not need a transparent background. */
export async function compressJpegBlob(
  blob: Blob,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = 0.82,
): Promise<Blob> {
  const canvas = await resizeToCanvas(blob, maxEdge)
  const out = await canvasToBlob(canvas, "image/jpeg", quality)

  if (out.size > TARGET_MAX_BYTES && (maxEdge > 360 || quality > 0.5)) {
    return compressJpegBlob(
      out,
      quality > 0.55 ? maxEdge : Math.floor(maxEdge * 0.72),
      Math.max(0.5, quality - 0.12),
    )
  }

  return out
}

export async function compressForUpload(blob: Blob, preserveAlpha: boolean): Promise<Blob> {
  return preserveAlpha ? compressPngBlob(blob) : compressJpegBlob(blob)
}
