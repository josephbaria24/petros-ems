import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin access
)

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
      .not('status', 'in', '("cancelled")')

    if (error) {
      console.error('Error fetching schedules:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!schedules) {
      return NextResponse.json({ message: 'No schedules found', updated: 0 })
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const updates: { id: string; status: string; oldStatus: string }[] = []

    for (const schedule of schedules) {
      let newStatus = schedule.status
      const oldStatus = schedule.status

      if (schedule.schedule_type === 'regular' && schedule.schedule_ranges?.[0]) {
        const start = new Date(schedule.schedule_ranges[0].start_date)
        const end = new Date(schedule.schedule_ranges[0].end_date)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)

        if (now > end) {
          newStatus = 'finished'
        } else if (now >= start && now <= end) {
          newStatus = 'ongoing'
        }
      } else if (schedule.schedule_type === 'staggered' && schedule.schedule_dates?.length) {
        const dates = schedule.schedule_dates.map((d: any) => new Date(d.date))
        const firstDate = new Date(Math.min(...dates.map(d => d.getTime())))
        const lastDate = new Date(Math.max(...dates.map(d => d.getTime())))
        firstDate.setHours(0, 0, 0, 0)
        lastDate.setHours(23, 59, 59, 999)

        if (now > lastDate) {
          newStatus = 'finished'
        } else if (now >= firstDate && now <= lastDate) {
          newStatus = 'ongoing'
        }
      }

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