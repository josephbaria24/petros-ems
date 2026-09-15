import { NextResponse } from "next/server"
import { tmsServerDb } from "@/lib/supabase-server"
import { missingOshProgramSchema, parseOshProgram, type OshProgram } from "@/lib/osh-program"

function courseNameOf(schedule: { courses?: unknown }) {
  const course = Array.isArray(schedule.courses) ? schedule.courses[0] : schedule.courses
  return (course as { name?: string } | null)?.name || "Training"
}

export async function GET(req: Request) {
  const scheduleId = new URL(req.url).searchParams.get("schedule_id")
  if (!scheduleId) {
    return NextResponse.json({ error: "Missing schedule_id" }, { status: 400 })
  }

  const { data, error } = await tmsServerDb
    .from("schedules")
    .select("id, osh_program, courses ( name )")
    .eq("id", scheduleId)
    .single()

  if (error) {
    const status = missingOshProgramSchema(error.message || "") ? 503 : 404
    return NextResponse.json(
      {
        error: status === 503 ? "schema" : "not_found",
        message:
          status === 503
            ? "Run scripts/add-osh-program.sql in Supabase, then refresh."
            : "Training not found",
      },
      { status }
    )
  }

  const program = parseOshProgram(data?.osh_program)
  if (!program?.published) {
    return NextResponse.json({ error: "not_published" }, { status: 403 })
  }

  return NextResponse.json({
    program,
    courseName: courseNameOf(data as { courses?: unknown }),
  })
}

export async function PATCH(req: Request) {
  let body: { schedule_id?: string; program?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const scheduleId = body.schedule_id
  const incoming = parseOshProgram(body.program)
  if (!scheduleId || !incoming) {
    return NextResponse.json({ error: "Missing schedule_id or program" }, { status: 400 })
  }

  const { data, error } = await tmsServerDb
    .from("schedules")
    .select("id, osh_program")
    .eq("id", scheduleId)
    .single()

  if (error) {
    const status = missingOshProgramSchema(error.message || "") ? 503 : 404
    return NextResponse.json(
      {
        error: status === 503 ? "schema" : "not_found",
        message:
          status === 503
            ? "Run scripts/add-osh-program.sql in Supabase, then refresh."
            : "Training not found",
      },
      { status }
    )
  }

  const current = parseOshProgram(data?.osh_program)
  if (!current?.published) {
    return NextResponse.json({ error: "not_published" }, { status: 403 })
  }

  const next: OshProgram = { ...incoming, published: true }
  const { error: updateError } = await tmsServerDb
    .from("schedules")
    .update({ osh_program: next })
    .eq("id", scheduleId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ program: next })
}
