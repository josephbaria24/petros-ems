import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms")

// Helper function to calculate correct status based on dates
function calculateScheduleStatus(
  scheduleType: string,
  scheduleRanges: any[] | null,
  scheduleDates: any[] | null,
  currentStatus: string
): string {
  // Don't auto-update cancelled schedules
  if (currentStatus === 'cancelled') {
    return currentStatus
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (scheduleType === 'regular' && scheduleRanges?.[0]) {
    const start = new Date(scheduleRanges[0].start_date)
    const end = new Date(scheduleRanges[0].end_date)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    // If start date is in the future -> upcoming
    if (now < start) {
      return 'planned'
    }
    // If today is between start and end (inclusive) -> ongoing
    if (now >= start && now <= end) {
      return 'ongoing'
    }
    // If end date has passed -> finished
    if (now > end) {
      return 'finished'
    }
  } 
  
  if (scheduleType === 'staggered' && scheduleDates?.length) {
    const dates = scheduleDates.map((d: any) => {
      const date = new Date(d.date)
      date.setHours(0, 0, 0, 0)
      return date
    })
    
    const firstDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const lastDate = new Date(Math.max(...dates.map(d => d.getTime())))

    // If first date is in the future -> upcoming
    if (now < firstDate) {
      return 'planned'
    }
    // If today is between first and last date (inclusive) -> ongoing
    if (now >= firstDate && now <= lastDate) {
      return 'ongoing'
    }
    // If last date has passed -> finished
    if (now > lastDate) {
      return 'finished'
    }
  }

  // Default fallback
  return currentStatus
}

/**
 * Assign certificate serial numbers for all participants of a finished schedule
 * who don't already have one. Uses courses.serial_number as the authoritative counter.
 */
async function assignCertificateSerials(scheduleId: string): Promise<{ success: boolean; assigned: number }> {
  const { data: schedule } = await supabase
    .from("schedules")
    .select("course_id")
    .eq("id", scheduleId)
    .single()

  if (!schedule?.course_id) return { success: false, assigned: 0 }

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, serial_number, serial_number_pad")
    .eq("id", schedule.course_id)
    .single()

  if (!course) return { success: false, assigned: 0 }

  const { data: trainees } = await supabase
    .from("trainings")
    .select("id, first_name, last_name")
    .eq("schedule_id", scheduleId)
    .is("certificate_number", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (!trainees?.length) return { success: true, assigned: 0 }

  const serialBase = Number(course.serial_number ?? 0)
  const serialPad = Number(course.serial_number_pad ?? 6)
  const newCounter = serialBase + trainees.length

  // Optimistic lock on serial_number
  const { data: lockData } = await supabase
    .from("courses")
    .update({ serial_number: newCounter })
    .eq("id", course.id)
    .eq("serial_number", serialBase)
    .select("id")

  if (!lockData?.length) return { success: false, assigned: 0 }

  let assigned = 0
  for (let i = 0; i < trainees.length; i++) {
    const padded = (serialBase + i + 1).toString().padStart(serialPad, "0")
    const certNumber = `PSI-${course.name}-${padded}`

    const { error } = await supabase
      .from("trainings")
      .update({ certificate_number: certNumber })
      .eq("id", trainees[i].id)
      .is("certificate_number", null)

    if (!error) assigned++
  }

  await supabase.from("certificate_logs").insert({
    action: "batch_assign",
    serial_number: `PSI-${course.name}-${(serialBase + 1).toString().padStart(serialPad, "0")} → PSI-${course.name}-${newCounter.toString().padStart(serialPad, "0")}`,
    details: `Auto-assigned ${assigned} certificate numbers for schedule ${scheduleId} (course: ${course.name}). Alphabetical order.`,
    performed_by: "system/cron",
  })

  console.log(`✅ Assigned ${assigned} certificate numbers for schedule ${scheduleId}`)
  return { success: true, assigned }
}

export async function POST(request: Request) {
  try {
    // Optional: Add authentication header check for security
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET_TOKEN
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all schedules with dates
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        id,
        status,
        schedule_type,
        schedule_ranges (start_date, end_date),
        schedule_dates (date)
      `)

    if (error) {
      console.error('Error fetching schedules:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!schedules) {
      return NextResponse.json({ message: 'No schedules found', updated: 0 })
    }

    const updates: { id: string; status: string; oldStatus: string }[] = []

    for (const schedule of schedules) {
      const oldStatus = schedule.status
      const newStatus = calculateScheduleStatus(
        schedule.schedule_type,
        schedule.schedule_ranges,
        schedule.schedule_dates,
        oldStatus
      )

      // Only update if status changed
      if (newStatus !== oldStatus) {
        updates.push({ id: schedule.id, status: newStatus, oldStatus })
      }
    }

    // Batch update all changed statuses
    const certResults: { scheduleId: string; assigned: number }[] = []
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('schedules')
          .update({ status: update.status })
          .eq('id', update.id)

        if (updateError) {
          console.error(`Error updating schedule ${update.id}:`, updateError)
          continue
        }

        // Assign certificate serial numbers for newly-finished schedules
        if (update.status === 'finished') {
          try {
            const certRes = await assignCertificateSerials(update.id)
            if (certRes.success) {
              certResults.push({ scheduleId: update.id, assigned: certRes.assigned })
            }
          } catch (err) {
            console.error(`Certificate assignment failed for schedule ${update.id}:`, err)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} schedule(s)`,
      updated: updates.length,
      updates,
      certificateAssignments: certResults,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing
export async function GET(request: Request) {
  return POST(request)
}