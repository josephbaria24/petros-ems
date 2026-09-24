/** Max edge length for certificate/ID 2×2 photos (pixels). */
const DEFAULT_MAX_EDGE = 900
/** Certificate template art — high enough for ~300 DPI on A4 without huge uploads. */
export const TEMPLATE_MAX_EDGE = 4000
/** Stay under Vercel/proxy body limits (~4.5MB) including multipart overhead. */
const TARGET_MAX_BYTES = 1.2 * 1024 * 1024
/** Templates upload to storage, not the photo API, so a higher cap is safe. */
const TEMPLATE_MAX_BYTES = 3.5 * 1024 * 1024

export type CompressUploadOptions = {
  maxEdge?: number
  quality?: number
  maxBytes?: number
}

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
    ctx.imageSmoothingEnabled = true
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
  maxBytes = TARGET_MAX_BYTES,
): Promise<Blob> {
  const canvas = await resizeToCanvas(blob, maxEdge)
  const out = await canvasToBlob(canvas, "image/png")

  if (out.size > maxBytes && maxEdge > 360) {
    return compressPngBlob(out, Math.floor(maxEdge * 0.72), maxBytes)
  }

  return out
}

/** JPEG compression for images that do not need a transparent background. */
export async function compressJpegBlob(
  blob: Blob,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = 0.82,
  maxBytes = TARGET_MAX_BYTES,
): Promise<Blob> {
  const canvas = await resizeToCanvas(blob, maxEdge)
  const out = await canvasToBlob(canvas, "image/jpeg", quality)

  if (out.size > maxBytes && (maxEdge > 360 || quality > 0.5)) {
    return compressJpegBlob(
      out,
      quality > 0.55 ? maxEdge : Math.floor(maxEdge * 0.72),
      Math.max(0.5, quality - 0.12),
      maxBytes,
    )
  }

  return out
}

export async function compressForUpload(
  blob: Blob,
  preserveAlpha: boolean,
  opts?: CompressUploadOptions,
): Promise<Blob> {
  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE
  const maxBytes = opts?.maxBytes ?? TARGET_MAX_BYTES
  return preserveAlpha
    ? compressPngBlob(blob, maxEdge, maxBytes)
    : compressJpegBlob(blob, maxEdge, opts?.quality ?? 0.82, maxBytes)
}

export const TEMPLATE_COMPRESS_OPTS: CompressUploadOptions = {
  maxEdge: TEMPLATE_MAX_EDGE,
  quality: 0.92,
  maxBytes: TEMPLATE_MAX_BYTES,
}
