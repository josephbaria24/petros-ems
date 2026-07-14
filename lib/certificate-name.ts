export type CertificateNameParts = {
  courtesy_title?: string | null
  first_name?: string | null
  middle_initial?: string | null
  last_name?: string | null
  suffix?: string | null
}

export type CertificateFontFamily = "Helvetica" | "Times" | "Montserrat" | "Poppins"
export type CertificateFontWeight = "normal" | "bold" | "extrabold"
export type CourtesyTitlePosition = "before" | "after"

/** Stored in certificate_layout_overrides.field_overrides */
export const COURTESY_POSITION_OVERRIDE_KEY = "__courtesyPosition"

export const CERTIFICATE_FONT_OPTIONS: { value: CertificateFontFamily; label: string }[] = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times", label: "Times" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
]

export const CERTIFICATE_FONT_WEIGHT_OPTIONS: { value: CertificateFontWeight; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
  { value: "extrabold", label: "Extra Bold" },
]

export const COURTESY_POSITION_OPTIONS: { value: CourtesyTitlePosition; label: string }[] = [
  { value: "before", label: "Before name (default)" },
  { value: "after", label: "After name" },
]

function capitalize(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function resolveCourtesyTitlePosition(
  fieldOverrides?: Record<string, any> | null
): CourtesyTitlePosition {
  const value = fieldOverrides?.[COURTESY_POSITION_OVERRIDE_KEY]
  return value === "after" ? "after" : "before"
}

export function formatCertificateHolderDisplayName(
  trainee: CertificateNameParts,
  options?: { courtesyPosition?: CourtesyTitlePosition }
) {
  // Only use an explicitly stored courtesy title — never invent Mr./Ms. from gender
  const title = trainee.courtesy_title?.trim() || ""
  const first = capitalize(trainee.first_name)
  const middleRaw = trainee.middle_initial?.trim()
  const middle = middleRaw
    ? `${middleRaw.replace(/\.$/, "")}. `
    : ""
  const last = capitalize(trainee.last_name)
  const suffixRaw = trainee.suffix?.trim()
  const suffix = suffixRaw
    ? ` ${suffixRaw.endsWith(".") ? suffixRaw : `${suffixRaw}.`}`
    : ""

  const fullName = `${first} ${middle}${last}${suffix}`.replace(/\s+/g, " ").trim()
  if (!fullName) return title || "Trainee Name"
  if (!title) return fullName

  const position = options?.courtesyPosition === "after" ? "after" : "before"
  if (position === "after") {
    return `${fullName} ${title}`.replace(/\s+/g, " ").trim()
  }
  return `${title} ${fullName}`.replace(/\s+/g, " ").trim()
}

export function canvasFontFamily(family?: string | null) {
  switch (family) {
    case "Times":
      return `"Times New Roman", Times, serif`
    case "Montserrat":
      return `"Montserrat", Helvetica, Arial, sans-serif`
    case "Poppins":
      return `"Poppins", Helvetica, Arial, sans-serif`
    case "Helvetica":
    default:
      return `Helvetica, Arial, sans-serif`
  }
}
