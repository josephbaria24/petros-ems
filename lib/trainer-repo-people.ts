import { format, isValid, parseISO } from "date-fns"

export type TrainerPerson = {
  id: string
  name: string
  accreditation: string
  validity: string
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function asText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string") return value.trim()
  if (value instanceof Date && isValid(value)) return format(value, "MM/dd/yyyy")
  return String(value).trim()
}

function getByKeys(data: Record<string, unknown>, candidates: string[]): string {
  const map = new Map<string, unknown>()
  for (const [key, value] of Object.entries(data || {})) {
    const normalized = normalizeKey(key)
    if (!map.has(normalized)) map.set(normalized, value)
  }
  for (const candidate of candidates) {
    const value = map.get(normalizeKey(candidate))
    const text = asText(value)
    if (text) return text
  }
  return ""
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  return isValid(date) ? date : null
}

function formatValidity(raw: string): string {
  if (!raw) return ""
  const numeric = Number(raw)
  if (raw !== "" && Number.isFinite(numeric) && !raw.includes("/") && !raw.includes("-")) {
    const excelDate = excelSerialToDate(numeric)
    if (excelDate) return format(excelDate, "MM/dd/yyyy")
  }
  const iso = parseISO(raw)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && isValid(iso)) {
    return format(iso, "MM/dd/yyyy")
  }
  const parsed = new Date(raw)
  if (isValid(parsed) && /\d{4}/.test(raw) && (raw.includes("-") || raw.includes("/"))) {
    return format(parsed, "MM/dd/yyyy")
  }
  return raw
}

export function trainerPersonFromRow(id: string, data: Record<string, unknown> | null | undefined): TrainerPerson | null {
  const row = (data || {}) as Record<string, unknown>
  const firstName = getByKeys(row, ["first name", "firstname", "given name"])
  const lastName = getByKeys(row, ["last name", "lastname", "surname", "family name"])
  const middle =
    getByKeys(row, ["middle initial", "m i", "mi", "middle name"]) || ""
  const fullName = getByKeys(row, [
    "full name",
    "fullname",
    "trainer name",
    "resource person",
    "name",
  ])

  let name = ""
  if (lastName && firstName) {
    const mi = middle ? ` ${middle.replace(/\.$/, "")}.` : ""
    name = `${lastName}, ${firstName}${mi}`.trim()
  } else if (fullName) {
    name = fullName
  } else if (firstName || lastName) {
    name = `${firstName} ${lastName}`.trim()
  }

  if (!name) return null

  const accreditationType = getByKeys(row, [
    "accreditation type",
    "type of accreditation",
    "accred type",
  ])
  const accreditationNumber = getByKeys(row, [
    "accreditation number",
    "accreditation no",
    "accreditation #",
    "accred no",
    "accred number",
    "oshc accreditation no",
    "osh accreditation no",
  ])
  const accreditationSingle = getByKeys(row, [
    "accreditation type and number",
    "accreditation",
    "oshc accreditation",
    "osh accreditation",
    "accreditation details",
  ])
  const accreditation =
    [accreditationType, accreditationNumber].filter(Boolean).join(" ") || accreditationSingle

  const validity = formatValidity(
    getByKeys(row, [
      "validity of accreditation",
      "accreditation validity",
      "validity",
      "valid until",
      "valid till",
      "expiry date",
      "expiration date",
      "date of expiry",
      "expiration",
      "expiry",
    ])
  )

  return { id, name, accreditation, validity }
}

export function listTrainerPeople(
  rows: Array<{ id?: string; data?: Record<string, unknown> | null }> | null | undefined
): TrainerPerson[] {
  const seen = new Set<string>()
  const people: TrainerPerson[] = []
  for (const row of rows || []) {
    const person = trainerPersonFromRow(row.id || `row-${people.length}`, row.data || {})
    if (!person) continue
    const key = `${person.name.toLowerCase()}|${person.accreditation.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    people.push(person)
  }
  return people.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}
