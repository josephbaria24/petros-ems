export type CertificateNameParts = {
  courtesy_title?: string | null
  first_name?: string | null
  middle_initial?: string | null
  last_name?: string | null
  suffix?: string | null
}

export type CertificateFontFamily = "Helvetica" | "Times" | "Montserrat" | "Poppins"
export type CertificateFontWeight = "normal" | "bold" | "extrabold"

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

function capitalize(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function formatCertificateHolderDisplayName(trainee: CertificateNameParts) {
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
