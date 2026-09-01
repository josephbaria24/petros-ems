/** Fixed canvas for ID / excellence templates when no image is loaded yet. */
export const ID_TEMPLATE_CANVAS = { width: 1350, height: 850 }

/** Default certificate canvas (A4 landscape) when no image is loaded yet. */
export const DEFAULT_CERTIFICATE_CANVAS = { width: 842, height: 595 }

export type CanvasDimensions = { width: number; height: number }

export function getFallbackCanvasDimensions(isIDTemplate: boolean): CanvasDimensions {
  return isIDTemplate ? { ...ID_TEMPLATE_CANVAS } : { ...DEFAULT_CERTIFICATE_CANVAS }
}

/** Load natural pixel dimensions from an image URL or data URL. */
export function loadImageDimensions(src: string): Promise<CanvasDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      if (width > 0 && height > 0) {
        resolve({ width, height })
      } else {
        reject(new Error("Image has no dimensions"))
      }
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.crossOrigin = "anonymous"
    img.src = src
  })
}
