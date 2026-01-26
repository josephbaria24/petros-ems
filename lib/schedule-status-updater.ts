// lib/schedule-status-updater.ts
import { tmsDb } from '@/lib/supabase-client'

export async function recalculateScheduleStatus(scheduleId: string) {
  const supabase = tmsDb

  try {
    // Fetch the specific schedule
    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(`
        id,
        status,
        schedule_type,
        schedule_ranges (start_date, end_date),
        schedule_dates (date)
      `)
      .eq('id', scheduleId)
      .single()

    if (error || !schedule) {
      console.error('Error fetching schedule:', error)
      return
    }

    // Don't update cancelled schedules
    if (schedule.status === 'cancelled') {
      return
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    let newStatus = schedule.status

    if (schedule.schedule_type === 'regular' && schedule.schedule_ranges?.[0]) {
      const start = new Date(schedule.schedule_ranges[0].start_date + 'T00:00:00')
      const end = new Date(schedule.schedule_ranges[0].end_date + 'T00:00:00')
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)

      if (now < start) {
        newStatus = 'planned'  // Changed from 'upcoming'
      } else if (now >= start && now <= end) {
        newStatus = 'ongoing'
      } else if (now > end) {
        newStatus = 'finished'
      }
    } else if (schedule.schedule_type === 'staggered' && schedule.schedule_dates?.length) {
      const dates = schedule.schedule_dates.map((d: any) => {
        const date = new Date(d.date + 'T00:00:00')
        date.setHours(0, 0, 0, 0)
        return date
      })
      
      const firstDate = new Date(Math.min(...dates.map(d => d.getTime())))
      const lastDate = new Date(Math.max(...dates.map(d => d.getTime())))

      if (now < firstDate) {
        newStatus = 'planned'  // Changed from 'upcoming'
      } else if (now >= firstDate && now <= lastDate) {
        newStatus = 'ongoing'
      } else if (now > lastDate) {
        newStatus = 'finished'
      }
    }

    // Update if status changed
    if (newStatus !== schedule.status) {
      const { error: updateError } = await supabase
        .from('schedules')
        .update({ status: newStatus })
        .eq('id', scheduleId)

      if (updateError) {
        console.error('Error updating schedule status:', updateError)
      } else {
        console.log(`Schedule ${scheduleId} status updated: ${schedule.status} → ${newStatus}`)
      }
    }
  } catch (error) {
    console.error('Error in recalculateScheduleStatus:', error)
  }
}