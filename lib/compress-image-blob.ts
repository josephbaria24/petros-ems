/** Max edge length for certificate/ID 2×2 photos (pixels). */
const DEFAULT_MAX_EDGE = 1024
/** Keep uploads under typical reverse-proxy / Vercel body limits. */
const TARGET_MAX_BYTES = 2.5 * 1024 * 1024

/**
 * Resize any image blob to a PNG (preserving alpha when present) so uploads
 * stay under typical reverse-proxy / Vercel body-size limits (~4.5MB).
 * Retries at smaller sizes if the encoded blob is still too large.
 */
export async function compressPngBlob(
  blob: Blob,
  maxEdge = DEFAULT_MAX_EDGE,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not prepare image for upload")

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png")
    })
    if (!out) throw new Error("Could not encode processed photo")

    if (out.size > TARGET_MAX_BYTES && maxEdge > 480) {
      return compressPngBlob(out, Math.floor(maxEdge * 0.7))
    }

    return out
  } finally {
    bitmap.close()
  }
}
