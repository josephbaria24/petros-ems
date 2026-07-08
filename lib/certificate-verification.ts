export type CertificateRecord = {
  id?: string | null
  serial_number?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  suffix?: string | null
  training?: string | null
  training_date?: string | null
  start_date?: string | null
  end_date?: string | null
  training_venue?: string | null
  course_code?: string | null
}

type CertificateNameFields = Pick<
  CertificateRecord,
  "first_name" | "middle_name" | "last_name" | "suffix" | "serial_number"
>

function escapeFilterValue(value: string) {
  return value.replace(/"/g, '\\"')
}

export function formatCertificateHolderName(record: CertificateNameFields) {
  return `${record.first_name ?? ""} ${record.middle_name ?? ""} ${record.last_name ?? ""}${record.suffix ? ` ${record.suffix}` : ""}`
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function isLikelyMiddleInitial(word: string) {
  const cleaned = word.replace(/\./g, "")
  return cleaned.length === 1
}

function getInitialLetter(word: string) {
  return word.replace(/\./g, "").charAt(0).toLowerCase()
}

function splitNameQuery(query: string) {
  const words = normalizeForMatch(query).split(/\s+/).filter(Boolean)
  const initials = words.filter(isLikelyMiddleInitial)
  const significant = words.filter((word) => !isLikelyMiddleInitial(word))
  return { initials, significant, words }
}

function middleInitialMatches(middleName: string | null | undefined, initial: string) {
  const letter = getInitialLetter(initial)
  if (!middleName?.trim()) return false

  const normalized = middleName.trim().toLowerCase()
  return (
    normalized === letter ||
    normalized.startsWith(`${letter}.`) ||
    normalized.startsWith(`${letter} `)
  )
}

function fullNameHasStandaloneInitial(fullName: string, initial: string) {
  const letter = getInitialLetter(initial)
  return new RegExp(`\\b${letter}\\.?\\b`, "i").test(fullName)
}

export function recordMatchesNameQuery(record: CertificateNameFields, query: string) {
  const { initials, significant, words } = splitNameQuery(query)
  if (words.length === 0) return false

  const fullName = normalizeForMatch(formatCertificateHolderName(record))

  for (const word of significant) {
    if (!fullName.includes(word)) return false
  }

  for (const initial of initials) {
    const matchesMiddle =
      middleInitialMatches(record.middle_name, initial) ||
      fullNameHasStandaloneInitial(fullName, initial)
    if (!matchesMiddle) return false
  }

  return true
}

function buildNameSearchOrConditions(words: string[]) {
  return words
    .map((word) => {
      const escaped = escapeFilterValue(word)
      if (isLikelyMiddleInitial(word)) {
        const letter = escapeFilterValue(getInitialLetter(word))
        return `middle_name.ilike.${letter}%,middle_name.ilike.${letter}.%`
      }
      return `first_name.ilike.%${escaped}%,middle_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`
    })
    .join(",")
}

function looksLikeSerial(input: string) {
  const trimmed = input.trim()
  return /^PSI-/i.test(trimmed) || /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(trimmed)
}

type CertificateDb = {
  from: (table: string) => {
    select: (columns: string) => {
      ilike: (column: string, value: string) => CertificateQuery
      or: (filters: string) => CertificateQuery
    }
  }
}

type CertificateQuery = {
  ilike: (column: string, value: string) => CertificateQuery
  or: (filters: string) => CertificateQuery
  limit: (count: number) => Promise<{ data: CertificateRecord[] | null; error: { message: string } | null }>
}

export async function findCertificateRecords(
  db: CertificateDb,
  rawInput: string
): Promise<{ matches: CertificateRecord[]; error: { message: string } | null }> {
  const trimmed = rawInput.trim()
  if (!trimmed) return { matches: [], error: null }

  const words = trimmed.split(/\s+/).filter(Boolean)
  const { significant, initials } = splitNameQuery(trimmed)
  const searchWords = significant.length > 0 ? significant : initials
  let query = db.from("certificate_records").select("*")

  if (looksLikeSerial(trimmed)) {
    query = query.ilike("serial_number", trimmed.toUpperCase())
  } else if (words.length === 1) {
    const word = escapeFilterValue(words[0])
    if (isLikelyMiddleInitial(words[0])) {
      const letter = escapeFilterValue(getInitialLetter(words[0]))
      query = query.or(`middle_name.ilike.${letter}%,middle_name.ilike.${letter}.%`)
    } else {
      query = query.or(
        `serial_number.ilike.%${word}%,first_name.ilike.%${word}%,middle_name.ilike.%${word}%,last_name.ilike.%${word}%`
      )
    }
  } else {
    query = query.or(buildNameSearchOrConditions(searchWords))
  }

  const { data: records, error } = await query.limit(50)
  if (error) return { matches: [], error }
  if (!records?.length) return { matches: [], error: null }

  if (looksLikeSerial(trimmed)) {
    const serial = trimmed.toUpperCase()
    const exact = records.filter((record) => record.serial_number?.toUpperCase() === serial)
    return { matches: exact.length > 0 ? exact : records, error: null }
  }

  const nameMatches = records.filter((record) => recordMatchesNameQuery(record, trimmed))
  return { matches: nameMatches, error: null }
}

export async function findCertificateRecord(
  db: CertificateDb,
  rawInput: string
): Promise<{ data: CertificateRecord | null; error: { message: string } | null }> {
  const { matches, error } = await findCertificateRecords(db, rawInput)
  return { data: matches[0] ?? null, error }
}

export function toVerificationDetails(record: CertificateRecord, fallbackId = "") {
  return {
    certificateId: record.serial_number ?? fallbackId,
    holderName: formatCertificateHolderName(record) || "N/A",
    training: record.training || "N/A",
    trainingDate: record.training_date || "N/A",
    startDate: record.start_date || "N/A",
    endDate: record.end_date || "N/A",
    venue: record.training_venue || "N/A",
  }
}
