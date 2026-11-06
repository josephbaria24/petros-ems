import { createClient, tmsDb } from "@/lib/supabase-client"

export type QrBinSize = 256 | 512 | 1024

export type QrBinItem = {
  id: string
  title: string
  content: string
  size: QrBinSize
  fg: string
  bg: string
  created_by?: string | null
  createdAt: string
  updatedAt: string
}

function normalizeSize(value: unknown): QrBinSize {
  if (value === 256 || value === 512 || value === 1024) return value
  return 512
}

function mapRow(row: Record<string, unknown>): QrBinItem {
  return {
    id: String(row.id),
    title: String(row.title || "Untitled QR"),
    content: String(row.content || ""),
    size: normalizeSize(row.size),
    fg: String(row.fg || "#1A1D66"),
    bg: String(row.bg || "#ffffff"),
    created_by: (row.created_by as string | null | undefined) ?? null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  }
}

export function missingQrBinSchema(message: string) {
  return /relation|does not exist|schema cache|Could not find.*qr_bin/i.test(message)
}

export async function loadQrBin(): Promise<{ items: QrBinItem[]; error?: string; schemaMissing?: boolean }> {
  const { data, error } = await tmsDb
    .from("qr_bin_items")
    .select("id, title, content, size, fg, bg, created_by, created_at, updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    return {
      items: [],
      error: error.message,
      schemaMissing: missingQrBinSchema(error.message),
    }
  }

  return {
    items: (data || []).map((row) => mapRow(row as Record<string, unknown>)),
  }
}

async function currentUserId() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function upsertQrBinItem(input: {
  id?: string
  title: string
  content: string
  size: QrBinSize
  fg: string
  bg: string
}): Promise<{ item?: QrBinItem; error?: string; schemaMissing?: boolean }> {
  const title = input.title.trim() || "Untitled QR"
  const content = input.content.trim()
  if (!content) {
    return { error: "Content is required" }
  }

  const now = new Date().toISOString()

  if (input.id) {
    const { data, error } = await tmsDb
      .from("qr_bin_items")
      .update({
        title,
        content,
        size: input.size,
        fg: input.fg,
        bg: input.bg,
        updated_at: now,
      })
      .eq("id", input.id)
      .select("id, title, content, size, fg, bg, created_by, created_at, updated_at")
      .single()

    if (error) {
      return { error: error.message, schemaMissing: missingQrBinSchema(error.message) }
    }
    return { item: mapRow(data as Record<string, unknown>) }
  }

  const created_by = await currentUserId()
  const { data, error } = await tmsDb
    .from("qr_bin_items")
    .insert({
      title,
      content,
      size: input.size,
      fg: input.fg,
      bg: input.bg,
      created_by,
      created_at: now,
      updated_at: now,
    })
    .select("id, title, content, size, fg, bg, created_by, created_at, updated_at")
    .single()

  if (error) {
    return { error: error.message, schemaMissing: missingQrBinSchema(error.message) }
  }
  return { item: mapRow(data as Record<string, unknown>) }
}

export async function deleteQrBinItem(id: string): Promise<{ error?: string; schemaMissing?: boolean }> {
  const { error } = await tmsDb.from("qr_bin_items").delete().eq("id", id)
  if (error) {
    return { error: error.message, schemaMissing: missingQrBinSchema(error.message) }
  }
  return {}
}

export function defaultTitleFromContent(content: string) {
  const value = content.trim()
  if (!value) return "Untitled QR"
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value)
      return url.hostname.replace(/^www\./, "") + (url.pathname !== "/" ? url.pathname : "")
    }
  } catch {
    // fall through
  }
  return value.length > 42 ? `${value.slice(0, 42)}…` : value
}
