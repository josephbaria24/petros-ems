const PUBLIC_ORIGIN = "https://petrosphere.com.ph/training-manuals"

export function toPublicManualUrl(input: string, entryFile?: string) {
  const raw = input.trim()
  if (!raw) return ""

  let path = ""
  try {
    const decoded = decodeURIComponent(raw)
    const match = decoded.match(/training-manuals\/(.+?)(?:[?#].*)?$/i)
    if (match) path = match[1].replace(/^\/+/, "").replace(/\/+$/, "")
  } catch {
    path = ""
  }

  if (!path && /^https?:\/\//i.test(raw)) return raw
  if (!path) return raw

  const parts = path.split("/").filter(Boolean)
  if (entryFile && !parts[parts.length - 1]?.toLowerCase().endsWith(".html")) {
    parts.push(entryFile)
  }

  return `${PUBLIC_ORIGIN}/${parts.map((part) => encodeURIComponent(part)).join("/")}`
}
