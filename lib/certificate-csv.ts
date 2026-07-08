export const CERTIFICATE_CSV_HEADERS = [
  "course_code",
  "training",
  "serial_number",
  "last_name",
  "first_name",
  "middle_name",
  "suffix",
  "sex",
  "age",
  "company",
  "email_address",
  "contact_number",
  "training_venue",
  "training_date",
  "start_date",
  "end_date",
] as const

export type CertificateCsvRow = Record<(typeof CERTIFICATE_CSV_HEADERS)[number], string>

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i++
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

export function buildCertificateCsvTemplate() {
  const sample = [
    "BOSH SO2",
    "Basic Occupational Safety and Health for Safety Officer 2",
    "PSI-BOSHSO2-000001",
    "Doe",
    "John",
    "A",
    "",
    "Male",
    "30",
    "Petrosphere",
    "john@example.com",
    "09171234567",
    "Manila",
    "January 10-12, 2026",
    "2026-01-10",
    "2026-01-12",
  ]

  return [CERTIFICATE_CSV_HEADERS.join(","), sample.map(escapeCsvValue).join(",")].join("\n")
}

export function recordsToCsv(records: Array<Record<string, unknown>>) {
  const rows = records.map((record) =>
    CERTIFICATE_CSV_HEADERS.map((header) =>
      escapeCsvValue(String(record[header] ?? ""))
    ).join(",")
  )

  return [CERTIFICATE_CSV_HEADERS.join(","), ...rows].join("\n")
}

export function parseCertificateCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error("CSV file is empty or invalid")
  }

  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase())
  const missingHeaders = CERTIFICATE_CSV_HEADERS.filter(
    (required) => !header.includes(required)
  )

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`)
  }

  const indexes = Object.fromEntries(
    CERTIFICATE_CSV_HEADERS.map((column) => [column, header.indexOf(column)])
  ) as Record<(typeof CERTIFICATE_CSV_HEADERS)[number], number>

  const rows: CertificateCsvRow[] = []

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line)
    if (values.every((value) => !value)) continue

    const row = Object.fromEntries(
      CERTIFICATE_CSV_HEADERS.map((column) => [column, values[indexes[column]] ?? ""])
    ) as CertificateCsvRow

    rows.push(row)
  }

  if (rows.length === 0) {
    throw new Error("No valid rows found in CSV")
  }

  if (rows.length > 1000) {
    throw new Error("CSV exceeds the maximum of 1000 certificates per upload")
  }

  return rows
}

export function csvRowToRecordPayload(
  row: CertificateCsvRow,
  index: number,
  autoGenerateSerial: boolean
) {
  const serial = row.serial_number.trim()

  return {
    course_code: row.course_code.trim() || null,
    training: row.training.trim() || null,
    serial_number:
      serial ||
      (autoGenerateSerial
        ? `PSI-IMPORT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(index + 1).padStart(5, "0")}`
        : ""),
    last_name: row.last_name.trim() || null,
    first_name: row.first_name.trim() || null,
    middle_name: row.middle_name.trim() || null,
    suffix: row.suffix.trim() || null,
    sex: row.sex.trim() || null,
    age: row.age.trim() ? parseInt(row.age, 10) : null,
    company: row.company.trim() || null,
    email_address: row.email_address.trim() || null,
    contact_number: row.contact_number.trim() || null,
    training_venue: row.training_venue.trim() || null,
    training_date: row.training_date.trim() || null,
    start_date: row.start_date.trim() || null,
    end_date: row.end_date.trim() || null,
    source: "import",
  }
}

export function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
