import { NextRequest, NextResponse } from "next/server"
import { tmsServerDb } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/** Earliest session day for this schedule (for sorting & display). */
function getSessionStartTime(s: {
  created_at: string
  schedule_dates?: { date: string }[] | null
  schedule_ranges?: { start_date: string }[] | null
}): number {
  const fromDates = (s.schedule_dates ?? []).map((d) => new Date(d.date).getTime())
  const fromRanges = (s.schedule_ranges ?? []).map((r) => new Date(r.start_date).getTime())
  const candidates = [...fromDates, ...fromRanges].filter((n) => !Number.isNaN(n))
  if (candidates.length) return Math.min(...candidates)
  return new Date(s.created_at).getTime()
}

function formatEventDate(s: {
  created_at: string
  schedule_dates?: { date: string }[] | null
  schedule_ranges?: { start_date: string }[] | null
}): string {
  const fromDates = (s.schedule_dates ?? []).map((d) => new Date(d.date).getTime())
  const fromRanges = (s.schedule_ranges ?? []).map((r) => new Date(r.start_date).getTime())
  const candidates = [...fromDates, ...fromRanges].filter((n) => !Number.isNaN(n))
  const t = candidates.length ? Math.min(...candidates) : new Date(s.created_at).getTime()
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function normalizeDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Collapse casing/whitespace variants so the chart does not show duplicate slices for the same gender. */
function normalizeGenderForChart(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().replace(/\s+/g, " ")
  if (!s) return "Unspecified"
  const lower = s.toLowerCase()
  if (lower === "female" || lower === "f" || lower === "woman") return "Female"
  if (lower === "male" || lower === "m" || lower === "man") return "Male"
  if (lower === "unspecified" || lower === "unknown" || lower === "n/a" || lower === "prefer not to say")
    return "Unspecified"
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function getScheduleBounds(s: {
  schedule_dates?: { date: string }[] | null
  schedule_ranges?: { start_date: string; end_date: string }[] | null
}): { start: Date; end: Date } | null {
  const times: number[] = []
  for (const d of s.schedule_dates ?? []) {
    const t = new Date(d.date).getTime()
    if (!Number.isNaN(t)) times.push(t)
  }
  for (const r of s.schedule_ranges ?? []) {
    const a = new Date(r.start_date).getTime()
    const b = new Date(r.end_date).getTime()
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      times.push(a, b)
    }
  }
  if (times.length === 0) return null
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) }
}

/** Ongoing today, or any session falls in the current calendar month, or DB status is ongoing. */
function isOngoingOrThisMonth(
  now: Date,
  s: {
    created_at: string
    status?: string | null
    schedule_dates?: { date: string }[] | null
    schedule_ranges?: { start_date: string; end_date: string }[] | null
  }
): boolean {
  const st = (s.status || "").toLowerCase()
  if (st === "cancelled") return false
  if (st === "ongoing") return true

  const y = now.getFullYear()
  const m = now.getMonth()
  const monthStart = new Date(y, m, 1)
  const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999)

  for (const d of s.schedule_dates ?? []) {
    const day = new Date(d.date)
    if (day.getFullYear() === y && day.getMonth() === m) return true
  }

  for (const r of s.schedule_ranges ?? []) {
    const rs = new Date(r.start_date)
    const re = new Date(r.end_date)
    re.setHours(23, 59, 59, 999)
    if (rs <= monthEnd && re >= monthStart) return true
  }

  const bounds = getScheduleBounds(s)
  if (!bounds) return false
  const today = normalizeDay(now)
  const start = normalizeDay(bounds.start)
  const end = normalizeDay(bounds.end)
  return today >= start && today <= end
}

function isCurrentlyOngoing(
  now: Date,
  s: {
    status?: string | null
    schedule_dates?: { date: string }[] | null
    schedule_ranges?: { start_date: string; end_date: string }[] | null
  }
): boolean {
  const st = (s.status || "").toLowerCase()
  if (st === "ongoing") return true
  const bounds = getScheduleBounds(s)
  if (!bounds) return false
  const today = normalizeDay(now)
  const start = normalizeDay(bounds.start)
  const end = normalizeDay(bounds.end)
  return today >= start && today <= end
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const from = url.searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString()
    const to = url.searchParams.get("to") || new Date().toISOString()
    const currentYear = new Date().getFullYear()

    const [
      trainingsRes,
      coursesRes,
      schedulesRes,
      paymentsRes,
      settingsRes,
      ycRes,
      recentSchedulesRes,
    ] = await Promise.all([
      tmsServerDb
        .from("trainings")
        .select("id, created_at, gender, age, employment_status, status, schedule_id, course_id, training_status, company_name, courses(name)")
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(50000),
      tmsServerDb.from("courses").select("id, name"),
      tmsServerDb
        .from("schedules")
        .select("id, course_id, created_at, branch, status, courses(name)")
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .limit(10000),
      tmsServerDb
        .from("payments")
        .select("amount_paid, payment_date, trainings(courses(name))")
        .gte("payment_date", from)
        .lte("payment_date", to)
        .limit(50000),
      tmsServerDb
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "monthly_revenue_target")
        .maybeSingle(),
      tmsServerDb
        .from("trainings")
        .select("created_at")
        .gte("created_at", `${currentYear - 1}-01-01T00:00:00Z`)
        .lte("created_at", `${currentYear}-12-31T23:59:59Z`)
        .limit(50000),
      tmsServerDb
        .from("schedules")
        .select(
          `
          id,
          course_id,
          created_at,
          branch,
          status,
          courses ( name ),
          schedule_dates ( date ),
          schedule_ranges ( start_date, end_date )
        `
        )
        .order("created_at", { ascending: false })
        .limit(800),
    ])

    if (trainingsRes.error) throw trainingsRes.error
    if (coursesRes.error) throw coursesRes.error
    if (schedulesRes.error) throw schedulesRes.error
    if (paymentsRes.error) throw paymentsRes.error
    if (recentSchedulesRes.error) throw recentSchedulesRes.error

    const trainings = trainingsRes.data || []
    const courses = coursesRes.data || []
    const schedules = schedulesRes.data || []
    const payments = paymentsRes.data || []
    const monthlyTarget = Number(settingsRes.data?.setting_value?.amount || 1000000)
    const ycTrainings = ycRes.data || []

    const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0)

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    // Enrollment trend
    const me = new Array(12).fill(0)
    trainings.forEach(t => { me[new Date(t.created_at).getMonth()]++ })
    const enrollmentTrend = months.map((m, i) => ({ month: m, enrollments: me[i] }))

    // Revenue by month
    const mr = new Array(12).fill(0)
    payments.forEach(p => { mr[new Date(p.payment_date).getMonth()] += Number(p.amount_paid) || 0 })
    const revenueData = months.map((m, i) => ({ month: m, revenue: Math.round(mr[i]), target: monthlyTarget }))

    // Course popularity & participants per course (same counts, different slices)
    const cc: Record<string, number> = {}
    trainings.forEach(t => {
      const name = (t.courses as any)?.name || "Other"
      cc[name] = (cc[name] || 0) + 1
    })
    const byCourseParticipants = Object.entries(cc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
    const coursePopularity = byCourseParticipants.slice(0, 7)
    const participantsPerCourse = byCourseParticipants.slice(0, 8)

    // Revenue per course (payments in range, grouped by training's course)
    const rev: Record<string, number> = {}
    payments.forEach((p: any) => {
      const tr = p.trainings
      const training = Array.isArray(tr) ? tr[0] : tr
      const name = training?.courses?.name || "Other"
      rev[name] = (rev[name] || 0) + (Number(p.amount_paid) || 0)
    })
    const revenuePerCourse = Object.entries(rev)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    // Payment status
    const ps: Record<string, number> = {}
    trainings.forEach(t => {
      const s = (t.status || "unknown").toLowerCase()
      const cat = s.includes("pending") ? "Pending" : s.includes("partial") ? "Partial" : s.includes("completed") ? "Completed" : s.includes("declined") ? "Declined" : "Other"
      ps[cat] = (ps[cat] || 0) + 1
    })
    const paymentStatus = Object.entries(ps).map(([name, value]) => ({ name, value }))

    // Gender (normalize so "Female"/"female", "MALE"/"male", stray spaces, etc. aggregate to one slice each)
    const gc: Record<string, number> = {}
    trainings.forEach(t => {
      const key = normalizeGenderForChart(t.gender)
      gc[key] = (gc[key] || 0) + 1
    })
    const genderDistribution = Object.entries(gc).map(([name, value]) => ({ name, value }))

    // Age
    const ar: Record<string, number> = { "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "56+": 0 }
    trainings.forEach(t => {
      const a = t.age
      if (!a) return
      if (a <= 25) ar["18-25"]++
      else if (a <= 35) ar["26-35"]++
      else if (a <= 45) ar["36-45"]++
      else if (a <= 55) ar["46-55"]++
      else ar["56+"]++
    })
    const ageDistribution = Object.entries(ar).map(([range, count]) => ({ range, count }))

    // Year comparison (full year data, not date-filtered)
    const cy = new Array(12).fill(0)
    const py = new Array(12).fill(0)
    ycTrainings.forEach(t => {
      const d = new Date(t.created_at)
      if (d.getFullYear() === currentYear) cy[d.getMonth()]++
      else py[d.getMonth()]++
    })
    const yearComparison = months.map((m, i) => ({ month: m, currentYear: cy[i], previousYear: py[i] }))

    // Employment status
    const es: Record<string, number> = {}
    trainings.forEach(t => { es[t.employment_status || "Unknown"] = (es[t.employment_status || "Unknown"] || 0) + 1 })
    const employmentStatus = Object.entries(es).map(([name, value]) => ({ name, value }))

    // Company distribution (top 10)
    const coc: Record<string, number> = {}
    trainings.forEach(t => {
      const name = t.company_name || "Individual"
      coc[name] = (coc[name] || 0) + 1
    })
    const companyDistribution = Object.entries(coc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    // Recent training events: ongoing OR sessions in the current calendar month; one row per course; full pax counts
    const now = new Date()
    const recentPool = (recentSchedulesRes.data || []).filter((s) => isOngoingOrThisMonth(now, s))
    const sortedByEvent = [...recentPool].sort((a, b) => {
      const oa = isCurrentlyOngoing(now, a) ? 0 : 1
      const ob = isCurrentlyOngoing(now, b) ? 0 : 1
      if (oa !== ob) return oa - ob
      return getSessionStartTime(a) - getSessionStartTime(b)
    })
    const seenCourse = new Set<string>()
    const pickedSchedules: typeof recentPool = []
    for (const s of sortedByEvent) {
      const dedupeKey = s.course_id ? String(s.course_id) : `schedule:${s.id}`
      if (seenCourse.has(dedupeKey)) continue
      seenCourse.add(dedupeKey)
      pickedSchedules.push(s)
      if (pickedSchedules.length >= 5) break
    }

    const pickedIds = pickedSchedules.map((s) => s.id)
    const countBySchedule: Record<string, number> = {}
    if (pickedIds.length > 0) {
      const { data: rows } = await tmsServerDb
        .from("trainings")
        .select("schedule_id")
        .in("schedule_id", pickedIds)
      for (const row of rows || []) {
        const sid = row.schedule_id as string
        if (sid) countBySchedule[sid] = (countBySchedule[sid] || 0) + 1
      }
    }

    const recentEvents = pickedSchedules.map((e) => ({
      course: (e.courses as { name?: string })?.name || "Unnamed",
      date: formatEventDate(e),
      participants: countBySchedule[e.id] || 0,
      status: e.status || "planned",
    }))

    return NextResponse.json({
      stats: {
        participants: trainings.length,
        activeCourses: courses.length,
        scheduledEvents: schedules.length,
        totalRevenue,
      },
      enrollmentTrend,
      revenueData,
      coursePopularity,
      paymentStatus,
      genderDistribution,
      ageDistribution,
      yearComparison,
      employmentStatus,
      revenuePerCourse,
      participantsPerCourse,
      companyDistribution,
      recentEvents,
      monthlyTarget,
      currentYear,
    })
  } catch (error: any) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
