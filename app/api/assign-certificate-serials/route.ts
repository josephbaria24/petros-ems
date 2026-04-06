import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms")

/**
 * POST /api/assign-certificate-serials
 *
 * Body: { scheduleId: string, force?: boolean, reassign?: boolean }
 *
 * Modes:
 *  - Default: assigns to participants with NO certificate_number only.
 *  - reassign=true: overwrites ALL participants' certificate numbers
 *    using the current courses.serial_number as the base (for re-sync).
 *  - force=true: skips the "finished" status check.
 *
 * Participants are always sorted alphabetically (last_name, first_name).
 * courses.serial_number is atomically incremented.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const scheduleId: string | undefined = body.scheduleId
    const force: boolean = body.force === true
    const reassign: boolean = body.reassign === true

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: "scheduleId is required" },
        { status: 400 }
      )
    }

    // 1. Load schedule + course
    const { data: schedule, error: schedErr } = await supabase
      .from("schedules")
      .select("id, status, course_id")
      .eq("id", scheduleId)
      .single()

    if (schedErr || !schedule) {
      return NextResponse.json(
        { success: false, error: "Schedule not found" },
        { status: 404 }
      )
    }

    if (!force && !reassign && schedule.status !== "finished") {
      return NextResponse.json(
        { success: false, error: `Schedule is "${schedule.status}", not "finished"` },
        { status: 400 }
      )
    }

    const courseId = schedule.course_id
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, name, serial_number, serial_number_pad")
      .eq("id", courseId)
      .single()

    if (courseErr || !course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      )
    }

    // 2. Fetch participants sorted alphabetically
    let query = supabase
      .from("trainings")
      .select("id, first_name, last_name, certificate_number")
      .eq("schedule_id", scheduleId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    // In default mode, only fetch those without a certificate_number
    if (!reassign) {
      query = query.is("certificate_number", null)
    }

    const { data: trainees, error: trainErr } = await query

    if (trainErr) {
      return NextResponse.json(
        { success: false, error: trainErr.message },
        { status: 500 }
      )
    }

    // In reassign mode, we re-number everyone; in default mode, only nulls
    const toAssign = reassign
      ? trainees ?? []
      : (trainees ?? []).filter((t) => !t.certificate_number)

    if (toAssign.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All participants already have certificate numbers",
        assigned: 0,
      })
    }

    // 3. Read current serial counter and atomically claim a range
    const serialBase = Number(course.serial_number ?? 0)
    const serialPad = Number(course.serial_number_pad ?? 6)
    const newCounter = serialBase + toAssign.length

    // Optimistic lock: only update if serial_number hasn't changed since we read it
    const { data: counterData, error: counterErr } = await supabase
      .from("courses")
      .update({ serial_number: newCounter })
      .eq("id", courseId)
      .eq("serial_number", serialBase)
      .select("id")

    if (counterErr) {
      return NextResponse.json(
        { success: false, error: `Counter update failed: ${counterErr.message}` },
        { status: 500 }
      )
    }

    if (!counterData || counterData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Concurrent assignment detected — please retry",
        },
        { status: 409 }
      )
    }

    // 4. Build serial numbers and persist to trainings
    const assignments: { id: string; certificate_number: string }[] = []
    const errors: string[] = []

    for (let i = 0; i < toAssign.length; i++) {
      const serial = serialBase + i + 1
      const padded = serial.toString().padStart(serialPad, "0")
      const certNumber = `PSI-${course.name}-${padded}`

      const { error: upErr } = await supabase
        .from("trainings")
        .update({ certificate_number: certNumber })
        .eq("id", toAssign[i].id)

      if (upErr) {
        errors.push(`${toAssign[i].id}: ${upErr.message}`)
      } else {
        assignments.push({ id: toAssign[i].id, certificate_number: certNumber })
      }
    }

    // 5. Log the operation
    const action = reassign ? "batch_reassign" : "batch_assign"
    await supabase.from("certificate_logs").insert({
      action,
      serial_number: `PSI-${course.name}-${(serialBase + 1).toString().padStart(serialPad, "0")} → PSI-${course.name}-${newCounter.toString().padStart(serialPad, "0")}`,
      details: `${reassign ? "Reassigned" : "Assigned"} ${assignments.length} certificate numbers for schedule ${scheduleId} (course: ${course.name}). Alphabetical order.`,
      performed_by: "system",
    })

    return NextResponse.json({
      success: true,
      assigned: assignments.length,
      reassigned: reassign,
      errors: errors.length > 0 ? errors : undefined,
      range: {
        from: serialBase + 1,
        to: newCounter,
        format: `PSI-${course.name}-{padded}`,
      },
    })
  } catch (err: any) {
    console.error("assign-certificate-serials error:", err)
    return NextResponse.json(
      { success: false, error: err.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
