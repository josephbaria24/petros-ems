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
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('schedules')
          .update({ status: update.status })
          .eq('id', update.id)

        if (updateError) {
          console.error(`Error updating schedule ${update.id}:`, updateError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} schedule(s)`,
      updated: updates.length,
      updates: updates,
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