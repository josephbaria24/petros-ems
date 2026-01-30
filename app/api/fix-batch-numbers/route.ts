// app/api/fix-batch-numbers/route.ts
import { tmsDb } from "@/lib/supabase-client"
import { NextResponse } from "next/server"

// ✅ GET endpoint to check status
export async function GET() {
  try {
    // Count trainings missing batch_number
    const { count: missingCount, error: missingError } = await tmsDb
      .from("trainings")
      .select("*", { count: "exact", head: true })
      .is("batch_number", null)

    if (missingError) throw missingError

    // Count trainings with batch_number
    const { count: withBatchCount, error: withError } = await tmsDb
      .from("trainings")
      .select("*", { count: "exact", head: true })
      .not("batch_number", "is", null)

    if (withError) throw withError

    const missing = missingCount ?? 0
    const withBatch = withBatchCount ?? 0

    return NextResponse.json({
      status: "ready",
      trainings: {
        withBatchNumber: withBatch,
        missingBatchNumber: missing,
        total: withBatch + missing,
      },
      needsBackfill: missing > 0,
      message: missing > 0 
        ? `${missing} trainings need batch numbers`
        : "All trainings have batch numbers ✅"
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// ✅ POST endpoint to run backfill
export async function POST() {
  try {
    console.log("🔄 Starting batch number backfill...")

    // Get all schedules with batch numbers
    const { data: schedules, error: schedError } = await tmsDb
      .from("schedules")
      .select("id, batch_number")
      .not("batch_number", "is", null)

    if (schedError) throw schedError

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No schedules with batch numbers found",
        schedulesProcessed: 0,
        trainingsUpdated: 0,
      })
    }

    console.log(`📊 Found ${schedules.length} schedules with batch numbers`)

    let updatedCount = 0
    let totalTrainingsUpdated = 0

    for (const schedule of schedules) {
      // Update all trainings for this schedule that are missing batch_number
      const { data: updatedTrainings, error: updateError } = await tmsDb
        .from("trainings")
        .update({ batch_number: schedule.batch_number })
        .eq("schedule_id", schedule.id)
        .is("batch_number", null)
        .select()

      if (!updateError && updatedTrainings) {
        updatedCount++
        totalTrainingsUpdated += updatedTrainings.length
        console.log(`✅ Schedule ${schedule.id}: Updated ${updatedTrainings.length} trainings to batch #${schedule.batch_number}`)
      } else if (updateError) {
        console.error(`❌ Error updating schedule ${schedule.id}:`, updateError)
      }
    }

    console.log("✅ Backfill complete!")
    console.log(`📊 Schedules processed: ${updatedCount}/${schedules.length}`)
    console.log(`📊 Total trainings updated: ${totalTrainingsUpdated}`)

    return NextResponse.json({
      success: true,
      message: `Updated ${totalTrainingsUpdated} trainings across ${updatedCount} schedules`,
      schedulesProcessed: schedules.length,
      trainingsUpdated: totalTrainingsUpdated,
    })
  } catch (error: any) {
    console.error("❌ Backfill error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}