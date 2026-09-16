import { NextResponse } from "next/server"
import { tmsServerDb } from "@/lib/supabase-server"
import { listTrainerPeople } from "@/lib/trainer-repo-people"

export async function GET() {
  const { data, error } = await tmsServerDb.from("trainer_repo_rows").select("id, data")

  if (error) {
    return NextResponse.json({ error: error.message, trainers: [] }, { status: 500 })
  }

  return NextResponse.json({ trainers: listTrainerPeople(data || []) })
}
