"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false },
  )
}

// existing (one shared instance)
export const supabase = createClient()

// ✅ schema-scoped helpers
export const tmsDb = supabase.schema("tms")
