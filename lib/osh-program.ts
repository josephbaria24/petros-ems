import { format, parseISO } from "date-fns"

export type OshProgramKind = "cosh" | "bosh_so2" | "bosh_so1" | "mosh" | "generic"

export type OshProgramSession = {
  id: string
  day: string
  time: string
  duration: string
  topic: string
  resourcePerson: string
  accreditation: string
  validity: string
}

export type OshProgram = {
  stoName: string
  trainingTypes: {
    boshPrivate: boolean
    boshPublic: boolean
    boshSo1: boolean
    cosh: boolean
    mosh: boolean
    other: boolean
  }
  otherSpecify: string
  delivery: {
    online: boolean
    liveWebinar: boolean
    selfDirected: boolean
    classroom: boolean
  }
  platform: string
  venue: string
  dates: string
  submissionInitial: boolean
  submissionActual: boolean
  sessions: OshProgramSession[]
  totalDuration: string
  remarks: string
  published: boolean
}

function sid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function row(
  day: string,
  time: string,
  duration: string,
  topic: string,
  resourcePerson = "",
): OshProgramSession {
  return {
    id: sid("s"),
    day,
    time,
    duration,
    topic,
    resourcePerson,
    accreditation: "",
    validity: "",
  }
}

export function emptyOshProgram(): OshProgram {
  return {
    stoName: "PETROSPHERE INCORPORATED",
    trainingTypes: {
      boshPrivate: false,
      boshPublic: false,
      boshSo1: false,
      cosh: false,
      mosh: false,
      other: false,
    },
    otherSpecify: "",
    delivery: {
      online: false,
      liveWebinar: false,
      selfDirected: false,
      classroom: false,
    },
    platform: "",
    venue: "",
    dates: "",
    submissionInitial: false,
    submissionActual: true,
    sessions: [row("Day 1", "", "", "", "")],
    totalDuration: "",
    remarks: "",
    published: false,
  }
}

export function detectOshKind(courseName: string): OshProgramKind | null {
  const key = courseName.toLowerCase().replace(/[^a-z0-9]+/g, "")
  if (!key) return null
  if (/cosh|constructionosh|constructionsafety/.test(key)) return "cosh"
  if (/boshso1|safetyofficer1|boshforso1/.test(key)) return "bosh_so1"
  if (/boshso2|safetyofficer2|boshforso2/.test(key)) return "bosh_so2"
  if (/mosh/.test(key)) return "mosh"
  if (/bosh/.test(key)) return "bosh_so2"
  if (/occupationalsafety|industrialsafety|hirac/.test(key)) return "generic"
  if (/\bosh\b/.test(courseName.toLowerCase())) return "bosh_so2"
  return /occupational|safety officer|osh training/.test(courseName.toLowerCase()) ? "generic" : null
}

export function formatOshScheduleDates(schedule: {
  schedule_type?: string | null
  schedule_ranges?: { start_date?: string; end_date?: string }[] | null
  schedule_dates?: { date?: string }[] | null
}): string {
  const formatDay = (value: string) => {
    try {
      return format(parseISO(value.slice(0, 10)), "MMMM d, yyyy")
    } catch {
      return value
    }
  }

  const range = schedule.schedule_ranges?.[0]
  if (schedule.schedule_type !== "staggered" && range?.start_date) {
    const start = range.start_date
    const end = range.end_date || range.start_date
    try {
      const s = parseISO(start.slice(0, 10))
      const e = parseISO(end.slice(0, 10))
      if (s.getTime() === e.getTime()) return format(s, "MMMM d, yyyy")
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${format(s, "MMMM d")}–${format(e, "d, yyyy")}`
      }
      return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`
    } catch {
      return start
    }
  }

  if (schedule.schedule_dates?.length) {
    const dates = [...schedule.schedule_dates]
      .map((d) => d.date)
      .filter(Boolean)
      .sort() as string[]
    if (!dates.length) return ""
    if (dates.length === 1) return formatDay(dates[0])
    if (dates.length <= 4) {
      return dates.map((d) => format(parseISO(d.slice(0, 10)), "MMM d, yyyy")).join(", ")
    }
    return `${formatDay(dates[0])} – ${formatDay(dates[dates.length - 1])}`
  }

  return ""
}

export function isOshCourse(courseName: string) {
  return detectOshKind(courseName) !== null
}

const COSH_SESSIONS: Omit<OshProgramSession, "id">[] = [
  { day: "Day 1", time: "7:30-8:45", duration: "1 hour 15 minutes", topic: "Opening Ceremony, Invocation, House Rules, Pre-Test", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 1", time: "8:45-9:45", duration: "1 hour", topic: "Importance of Safety & Health", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "10:00-11:00", duration: "1 hour", topic: "Unsafe Acts and Conditions", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "11:00-12:00", duration: "1 hour", topic: "Construction Site Premises (morning)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "1:00-1:45", duration: "45 minutes", topic: "Construction Site Premises (continuation)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "1:45-2:45", duration: "1 hour", topic: "Excavation Safety", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "3:00-4:00", duration: "1 hour", topic: "Tools and Equipment", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "4:00-6:00", duration: "2 hours", topic: "Construction Machinery (Mobile Equipment Safety)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "7:00-7:15", duration: "15 minutes", topic: "Opening Prayer, Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 2", time: "7:15-9:00", duration: "1 hour 45 minutes", topic: "Construction Machinery (Crane Safety)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "9:00-10:00", duration: "1 hour", topic: "Fall Protection", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "10:00-11:30", duration: "1 hour 30 minutes", topic: "Temporary Structures", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "12:30-1:45", duration: "1 hour 15 minutes", topic: "Workshop on Temporary Structures", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "1:45-3:30", duration: "1 hour 45 minutes", topic: "Environmental Safety", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "3:30-5:00", duration: "1 hour 30 minutes", topic: "Occupational Health & COVID-19 Prevention Measures", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "5:00-6:00", duration: "1 hour", topic: "Personal Protective Equipment", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "7:00-7:15", duration: "15 minutes", topic: "Opening Prayer, Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 3", time: "7:15-8:15", duration: "1 hour", topic: "Demolition Safety", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "8:15-9:15", duration: "1 hour", topic: "Routine Site Safety Inspection", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "9:15-1:00", duration: "3 hours 45 minutes", topic: "Workshop: Site Visit/Inspection Activity", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "2:00-4:30", duration: "2 hours 30 minutes", topic: "Presentation of Inspection Workshop", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "4:45-6:00", duration: "1 hour 15 minutes", topic: "Job Hazard Analysis", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "7:00-7:15", duration: "15 minutes", topic: "Opening Prayer, Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 4", time: "7:15-8:15", duration: "1 hour", topic: "Accident Investigation", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "8:15-9:15", duration: "1 hour", topic: "Role of Safety Officers", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "9:15-10:15", duration: "1 hour", topic: "Toolbox Meeting", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "10:15-11:00", duration: "45 minutes", topic: "Workplace Emergency Preparedness", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "11:15-12:00", duration: "45 minutes", topic: "Employees Compensation Program", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "1:00-3:00", duration: "2 hours", topic: "DO 252-25", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "3:15-4:30", duration: "1 hour 15 minutes", topic: "OSH Programming", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "4:30-5:30", duration: "1 hour", topic: "Re-entry Plan, Post Test, Evaluation and Awarding Ceremony", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
]

const BOSH_SO2_SESSIONS: Omit<OshProgramSession, "id">[] = [
  { day: "Day 1", time: "7:00-8:00", duration: "1 hour", topic: "Opening Ceremony, Invocation, House Rules, Pre-Test", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 1", time: "8:00-9:30", duration: "1 hour 30 minutes", topic: "BOSH Framework", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "9:45-11:00", duration: "1 hour 15 minutes", topic: "Importance of OSH", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "11:00-12:00", duration: "1 hour", topic: "Safety Hazard Identification (morning)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "1:00-2:30", duration: "1 hour 30 minutes", topic: "Safety Hazard Identification (continuation)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "2:45-4:00", duration: "1 hour 15 minutes", topic: "Health Hazard Identification", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "4:00-6:00", duration: "2 hours", topic: "Hazards Identification Workshop", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "7:00-7:30", duration: "30 minutes", topic: "Opening Prayer, Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 2", time: "7:30-9:00", duration: "1 hour 30 minutes", topic: "Work Environment Measurement", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "9:00-11:45", duration: "2 hours 45 minutes", topic: "Medical Surveillance", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "1:00-2:30", duration: "1 hour 30 minutes", topic: "Risk Assessment (with workshop)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "2:30-4:15", duration: "1 hour 45 minutes", topic: "Control Measures of Health Hazards", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "4:15-5:00", duration: "45 minutes", topic: "Control Measures of Safety Hazards", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "7:00-7:30", duration: "30 minutes", topic: "Opening Prayer, Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 3", time: "7:30-9:30", duration: "2 hours", topic: "Control Measures Workshop", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "9:30-12:15", duration: "2 hours 45 minutes", topic: "Accident Investigation", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "1:15-4:00", duration: "2 hours 45 minutes", topic: "Integrating Activity: OSH Inspection workshop", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 3", time: "4:00-6:00", duration: "2 hours", topic: "Communicating OSH (Training of Trainers)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "7:00-7:30", duration: "30 minutes", topic: "Opening Prayer, Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 4", time: "7:30-9:15", duration: "1 hour 45 minutes", topic: "Workplace Emergency Preparedness", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "9:30-11:00", duration: "1 hour 30 minutes", topic: "Employees Compensation Program", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "11:00-12:00", duration: "1 hour", topic: "DO 252-25 (morning)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "1:00-2:30", duration: "1 hour 30 minutes", topic: "DO 252-25 (continuation)", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "2:30-4:00", duration: "1 hour 30 minutes", topic: "OSH Program Development", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 4", time: "4:00-6:00", duration: "2 hours", topic: "Commitments Setting, Re-entry Plan, Post Test, Evaluation and Awarding Ceremony", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
]

const BOSH_SO1_SESSIONS: Omit<OshProgramSession, "id">[] = [
  { day: "Day 1", time: "7:30-8:15", duration: "45 minutes", topic: "Opening Ceremony, House Rules, Pre-Test", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 1", time: "8:15-9:15", duration: "1 hour", topic: "OSH Situationer / Importance of OSH", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "9:15-10:15", duration: "1 hour", topic: "Unsafe Acts and Unsafe Conditions", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "10:30-11:30", duration: "1 hour", topic: "Housekeeping", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "11:30-12:30", duration: "1 hour", topic: "Materials Handling and Storage", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "1:30-2:30", duration: "1 hour", topic: "Fire Safety", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 1", time: "2:30-3:30", duration: "1 hour", topic: "Electrical Safety", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "7:30-8:00", duration: "30 minutes", topic: "Recap", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
  { day: "Day 2", time: "8:00-9:00", duration: "1 hour", topic: "Machine Safety", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "9:00-10:00", duration: "1 hour", topic: "Personal Protective Equipment", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "10:15-11:15", duration: "1 hour", topic: "Role of Safety Officer 1", resourcePerson: "", accreditation: "", validity: "" },
  { day: "Day 2", time: "11:15-12:15", duration: "1 hour", topic: "Re-entry Plan, Post-Test, Evaluation, Awarding", resourcePerson: "Training Facilitator", accreditation: "", validity: "" },
]

function withIds(rows: Omit<OshProgramSession, "id">[]): OshProgramSession[] {
  return rows.map((r) => ({ ...r, id: sid("s") }))
}

export function defaultOshProgram(kind: OshProgramKind, opts?: {
  dates?: string
  venue?: string
  eventType?: string
}): OshProgram {
  const base = emptyOshProgram()
  const et = (opts?.eventType || "").toLowerCase()
  const isOnline = et.includes("online") || et.includes("webinar") || et.includes("hybrid")
  const isF2f = et.includes("face")

  base.dates = opts?.dates || ""
  base.venue = opts?.venue || (isOnline ? "Zoom Meetings" : "")
  base.platform = isOnline ? "Online-Led" : isF2f ? "Instructor-Led Training" : ""
  base.delivery.online = isOnline
  base.delivery.liveWebinar = isOnline
  base.delivery.classroom = isF2f
  if (!isOnline && !isF2f) {
    base.delivery.classroom = true
    base.platform = "Instructor-Led Training"
  }

  if (kind === "cosh") {
    base.trainingTypes.cosh = true
    base.sessions = withIds(COSH_SESSIONS)
    base.totalDuration = "40 hours"
  } else if (kind === "bosh_so2") {
    base.trainingTypes.boshPrivate = true
    base.trainingTypes.other = true
    base.otherSpecify = "Basic Occupational Safety and Health for Safety Officer 2"
    base.sessions = withIds(BOSH_SO2_SESSIONS)
    base.totalDuration = "40 hours"
  } else if (kind === "bosh_so1") {
    base.trainingTypes.boshSo1 = true
    base.sessions = withIds(BOSH_SO1_SESSIONS)
    base.totalDuration = "10 hours"
  } else if (kind === "mosh") {
    base.trainingTypes.mosh = true
    base.sessions = [row("Day 1", "", "", "", "")]
    base.totalDuration = ""
  } else {
    base.trainingTypes.other = true
    base.sessions = [row("Day 1", "", "", "", "")]
  }
  return base
}

export function parseOshProgram(raw: unknown): OshProgram | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const base = emptyOshProgram()
  if (typeof row.stoName === "string") base.stoName = row.stoName
  if (row.trainingTypes && typeof row.trainingTypes === "object") {
    const t = row.trainingTypes as Record<string, unknown>
    base.trainingTypes.boshPrivate = Boolean(t.boshPrivate)
    base.trainingTypes.boshPublic = Boolean(t.boshPublic)
    base.trainingTypes.boshSo1 = Boolean(t.boshSo1)
    base.trainingTypes.cosh = Boolean(t.cosh)
    base.trainingTypes.mosh = Boolean(t.mosh)
    base.trainingTypes.other = Boolean(t.other)
  }
  if (typeof row.otherSpecify === "string") base.otherSpecify = row.otherSpecify
  if (row.delivery && typeof row.delivery === "object") {
    const d = row.delivery as Record<string, unknown>
    base.delivery.online = Boolean(d.online)
    base.delivery.liveWebinar = Boolean(d.liveWebinar)
    base.delivery.selfDirected = Boolean(d.selfDirected)
    base.delivery.classroom = Boolean(d.classroom)
  }
  if (typeof row.platform === "string") base.platform = row.platform
  if (typeof row.venue === "string") base.venue = row.venue
  if (typeof row.dates === "string") base.dates = row.dates
  base.submissionInitial = Boolean(row.submissionInitial)
  base.submissionActual = row.submissionActual === undefined ? true : Boolean(row.submissionActual)
  if (Array.isArray(row.sessions)) {
    base.sessions = row.sessions
      .filter((s) => s && typeof s === "object")
      .map((s) => {
        const x = s as Record<string, unknown>
        return {
          id: typeof x.id === "string" && x.id ? x.id : sid("s"),
          day: String(x.day || ""),
          time: String(x.time || ""),
          duration: String(x.duration || ""),
          topic: String(x.topic || ""),
          resourcePerson: String(x.resourcePerson || ""),
          accreditation: String(x.accreditation || ""),
          validity: String(x.validity || ""),
        }
      })
    if (base.sessions.length === 0) base.sessions = [row("Day 1", "", "", "", "")]
  }
  if (typeof row.totalDuration === "string") base.totalDuration = row.totalDuration
  if (typeof row.remarks === "string") base.remarks = row.remarks
  base.published = Boolean(row.published)
  return base
}

export function missingOshProgramSchema(message: string) {
  return /osh_program|schema cache|column/i.test(message)
}

export function buildGuestProgramUrl(origin: string, scheduleId: string) {
  return `${origin}/guest-program?schedule_id=${encodeURIComponent(scheduleId)}`
}
