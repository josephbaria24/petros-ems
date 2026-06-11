/** PDF page dimensions in points (72 pt = 1 inch). Used for certificate PDF export/preview. */

export type CertificatePageSizeKey =
  | "a4-landscape"
  | "a4-portrait"
  | "letter-landscape"
  | "letter-portrait"
  | "legal-landscape"
  | "legal-portrait"

export const DEFAULT_CERTIFICATE_PAGE_SIZE: CertificatePageSizeKey = "a4-landscape"

export const CERTIFICATE_PAGE_SIZES: Record<
  CertificatePageSizeKey,
  { width: number; height: number; label: string }
> = {
  "a4-landscape": { width: 842, height: 595, label: "A4 (Landscape)" },
  "a4-portrait": { width: 595, height: 842, label: "A4 (Portrait)" },
  "letter-landscape": { width: 792, height: 612, label: "Letter (Landscape)" },
  "letter-portrait": { width: 612, height: 792, label: "Letter (Portrait)" },
  "legal-landscape": { width: 1008, height: 612, label: "Legal (Landscape)" },
  "legal-portrait": { width: 612, height: 1008, label: "Legal (Portrait)" },
}

/** Fixed canvas for ID / excellence templates (not paper sizes). */
export const ID_TEMPLATE_PAGE = { width: 1350, height: 850 }

export function isCertificatePageSizeKey(value: string): value is CertificatePageSizeKey {
  return value in CERTIFICATE_PAGE_SIZES
}

export function resolveCertificatePageDimensions(
  pageSize: string | undefined,
  isIDTemplate: boolean
): { width: number; height: number } {
  if (isIDTemplate) {
    return { width: ID_TEMPLATE_PAGE.width, height: ID_TEMPLATE_PAGE.height }
  }
  const key =
    pageSize && isCertificatePageSizeKey(pageSize)
      ? pageSize
      : DEFAULT_CERTIFICATE_PAGE_SIZE
  const spec = CERTIFICATE_PAGE_SIZES[key]
  return { width: spec.width, height: spec.height }
}
