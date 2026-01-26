import type { SupabaseClient } from "@supabase/supabase-js"

export const schemaDb = (client: SupabaseClient, schema: string) => client.schema(schema)
