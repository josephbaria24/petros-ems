import { createCanvas, loadImage } from "canvas"

export type CompressedPdfImage = {
  bytes: Uint8Array
  format: "jpg" | "png"
}

/**
 * Downscale and optionally JPEG-encode images before pdf-lib embed.
 * Uncompressed template PNGs + trainee photos easily make a 2-PDF email exceed
 * SendLayer's 10MB SMTP DATA limit (base64 adds ~33%).
 */
export async function compressImageForPdf(
  input: ArrayBuffer,
  opts: { maxEdge: number; quality?: number; preferJpeg: boolean },
): Promise<CompressedPdfImage> {
  const img = await loadImage(Buffer.from(input))
  const maxEdge = Math.max(64, opts.maxEdge)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext("2d")

  if (opts.preferJpeg) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  if (opts.preferJpeg) {
    const quality = opts.quality ?? 0.72
    return {
      bytes: new Uint8Array(canvas.toBuffer("image/jpeg", { quality })),
      format: "jpg",
    }
  }

  return {
    bytes: new Uint8Array(canvas.toBuffer("image/png")),
    format: "png",
  }
}
