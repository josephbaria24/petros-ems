import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { tmsServerDb } from "@/lib/supabase-server"
import { formatDurationSeconds } from "@/lib/attendance-status"
import {
  GraphApiError,
  findOnlineMeeting,
  getAzureGraphConfig,
  isAzureGraphConfigured,
  listAttendanceRecords,
  listAttendanceReports,
  organizerCandidatesFromAuthUser,
  parseTeamsJoinContext,
  type GraphAttendanceRecord,
} from "@/lib/microsoft-graph"

export const runtime = "nodejs"

const MANILA_TZ = "Asia/Manila"

type TrainingRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

export type TeamsAttendeeDetail = {
  displayName: string
  email: string
  seconds: number
  durationLabel: string
  joinAt: string | null
  leaveAt: string | null
  matchedTrainee: { id: string; name: string } | null
}

export type TeamsReportDetail = {
  id: string
  meetingStartDateTime: string | null
  meetingEndDateTime: string | null
  totalParticipantCount: number
  attendees: TeamsAttendeeDetail[]
}

async function requireStaffSession(): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) return null
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

function formatInManila(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

function pickMeetingUrl(payments: { online_classroom_url: string | null }[] | null | undefined) {
  for (const p of payments || []) {
    const url = p?.online_classroom_url?.trim()
    if (url) return url
  }
  return null
}

function isTeamsUrl(url: string) {
  const u = url.toLowerCase()
  return u.includes("teams.microsoft") || u.includes("teams.live")
}

function recordEmail(record: GraphAttendanceRecord) {
  return (record.emailAddress || "").trim().toLowerCase()
}

function recordDisplayName(record: GraphAttendanceRecord) {
  return (record.identity?.displayName || record.identity?.user?.displayName || "").trim()
}

function earliestJoin(record: GraphAttendanceRecord) {
  const times = (record.attendanceIntervals || [])
    .map((i) => i.joinDateTime)
    .filter((t): t is string => Boolean(t))
    .sort()
  return times[0] || null
}

function latestLeave(record: GraphAttendanceRecord) {
  const times = (record.attendanceIntervals || [])
    .map((i) => i.leaveDateTime)
    .filter((t): t is string => Boolean(t))
    .sort()
  return times[times.length - 1] || null
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function matchTrainee(email: string, displayName: string, rows: TrainingRow[]) {
  if (email) {
    const byEmail = rows.find((r) => r.email?.trim().toLowerCase() === email)
    if (byEmail) return byEmail
  }
  const display = normalizeName(displayName)
  if (!display) return null
  return (
    rows.find((r) => {
      const first = normalizeName(r.first_name)
      const last = normalizeName(r.last_name)
      const full = `${first} ${last}`
      const rev = `${last} ${first}`
      return display === full || display === rev || display === `${last}, ${first}`
    }) || null
  )
}

export async function POST(request: Request) {
  const user = await requireStaffSession()
  if (!user) {
    return NextResponse.json({ error: "Sign in to view Teams meeting details." }, { status: 401 })
  }
  if (!isAzureGraphConfigured()) {
    return NextResponse.json(
      {
        error:
          "Teams lookup is not configured. Add AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET on the server.",
      },
      { status: 503 }
    )
  }

  let scheduleId = ""
  let joinUrlOverride = ""
  try {
    const body = (await request.json()) as { scheduleId?: string; joinUrl?: string }
    scheduleId = String(body.scheduleId || "").trim()
    joinUrlOverride = String(body.joinUrl || "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }
  if (!scheduleId) {
    return NextResponse.json({ error: "Missing scheduleId." }, { status: 400 })
  }

  const { data: schedule } = await tmsServerDb
    .from("schedules")
    .select("id, online_classroom_url")
    .eq("id", scheduleId)
    .maybeSingle()

  const { data: trainings, error: te } = await tmsServerDb
    .from("trainings")
    .select("id, first_name, last_name, email, payments ( online_classroom_url )")
    .eq("schedule_id", scheduleId)

  if (te) {
    return NextResponse.json({ error: te.message }, { status: 500 })
  }

  const rows = (trainings || []) as (TrainingRow & {
    payments?: { online_classroom_url: string | null }[] | null
  })[]

  let meetingUrl = joinUrlOverride || null
  if (!meetingUrl) {
    const saved = typeof schedule?.online_classroom_url === "string" ? schedule.online_classroom_url.trim() : ""
    if (saved) meetingUrl = saved
  }
  if (!meetingUrl) {
    for (const row of rows) {
      meetingUrl = pickMeetingUrl(row.payments)
      if (meetingUrl) break
    }
  }
  if (!meetingUrl) {
    return NextResponse.json(
      { error: "Paste a Microsoft Teams join URL to load meeting details." },
      { status: 400 }
    )
  }
  if (!isTeamsUrl(meetingUrl)) {
    return NextResponse.json({ error: "That link is not a Microsoft Teams meeting URL." }, { status: 400 })
  }

  const parsed = parseTeamsJoinContext(meetingUrl)
  const { organizerIds } = getAzureGraphConfig()
  const organizers = [
    parsed.oid,
    ...organizerIds,
    ...organizerCandidatesFromAuthUser(user),
  ].filter((id): id is string => Boolean(id))
  if (organizers.length === 0) {
    return NextResponse.json(
      {
        error:
          "This Teams link does not include the organizer (short meet.microsoft.com/meet links). Add the organizer’s Entra Object ID to AZURE_TEAMS_ORGANIZER_IDS, or paste a classic meetup-join URL that contains context.Oid.",
      },
      { status: 400 }
    )
  }

  try {
    const found = await findOnlineMeeting({
      organizerIds: organizers,
      joinUrlCandidates: parsed.joinUrlCandidates,
      joinMeetingId: parsed.joinMeetingId,
    })
    if (!found?.meeting.id) {
      return NextResponse.json(
        {
          error:
            "Microsoft Graph could not find this meeting for the signed-in user. Short Teams links only work if you (or AZURE_TEAMS_ORGANIZER_IDS) are the organizer. Use the organizer’s Entra Object ID, or a classic meetup-join URL.",
        },
        { status: 404 }
      )
    }

    const reports = await listAttendanceReports(found.organizerId, found.meeting.id)
    const reportDetails: TeamsReportDetail[] = []

    for (const report of reports) {
      if (!report.id) continue
      const records = await listAttendanceRecords(found.organizerId, found.meeting.id, report.id)
      const attendees: TeamsAttendeeDetail[] = records
        .map((record) => {
          const seconds = Number(record.totalAttendanceInSeconds) || 0
          const email = recordEmail(record)
          const displayName = recordDisplayName(record) || email || "Unknown"
          const trainee = matchTrainee(email, displayName, rows)
          return {
            displayName,
            email,
            seconds,
            durationLabel: formatDurationSeconds(seconds),
            joinAt: formatInManila(earliestJoin(record)),
            leaveAt: formatInManila(latestLeave(record)),
            matchedTrainee: trainee
              ? { id: trainee.id, name: `${trainee.first_name} ${trainee.last_name}`.trim() }
              : null,
          }
        })
        .sort((a, b) => b.seconds - a.seconds || a.displayName.localeCompare(b.displayName))

      reportDetails.push({
        id: report.id,
        meetingStartDateTime: formatInManila(report.meetingStartDateTime || null),
        meetingEndDateTime: formatInManila(report.meetingEndDateTime || null),
        totalParticipantCount: Number(report.totalParticipantCount) || attendees.length,
        attendees,
      })
    }

    return NextResponse.json({
      ok: true,
      subject: found.meeting.subject || null,
      joinUrl: found.meeting.joinWebUrl || meetingUrl,
      reports: reportDetails,
    })
  } catch (err) {
    const message =
      err instanceof GraphApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Could not load Teams meeting details."
    const status = err instanceof GraphApiError && err.status >= 400 && err.status < 600 ? err.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
