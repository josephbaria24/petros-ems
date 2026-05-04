import { eachDayOfInterval, format, parseISO } from "date-fns"

/** Stored on each `trainings.custom_data` record (merged with existing JSON). */
export const EMS_ATTENDANCE_STATUS_KEY = "ems_attendance_status" as const
export const EMS_ATTENDANCE_BY_DAY_KEY = "ems_attendance_by_day" as const
export const EMS_ATTENDANCE_SOURCE_KEY = "ems_attendance_source" as const
export const EMS_ATTENDANCE_UPDATED_AT_KEY = "ems_attendance_updated_at" as const

export type AttendanceStatusValue = "unmarked" | "present" | "absent" | "late"

export type ScheduleMetaForDays = {
  schedule_type: string
  schedule_ranges: { start_date: string; end_date: string }[]
  schedule_dates: { date: string }[]
}

/** Sorted `yyyy-MM-dd` keys for each calendar day of this schedule (regular range or staggered dates). */
export function getTrainingDayKeys(meta: ScheduleMetaForDays | null): string[] {
  if (!meta) return []
  if (meta.schedule_type === "regular" && meta.schedule_ranges?.[0]) {
    const { start_date, end_date } = meta.schedule_ranges[0]
    const start = parseISO(start_date.slice(0, 10))
    const end = parseISO(end_date.slice(0, 10))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
    return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"))
  }
  if (meta.schedule_type === "staggered" && meta.schedule_dates?.length) {
    const keys = new Set<string>()
    for (const row of meta.schedule_dates) {
      const raw = row.date?.slice(0, 10)
      if (!raw) continue
      const d = parseISO(raw)
      if (!Number.isNaN(d.getTime())) keys.add(format(d, "yyyy-MM-dd"))
    }
    return [...keys].sort()
  }
  return []
}

function readByDayMap(customData: Record<string, unknown> | null | undefined): Record<string, string> {
  const raw = customData?.[EMS_ATTENDANCE_BY_DAY_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v
  }
  return out
}

export function normalizeAttendanceInput(
  raw: string | null | undefined
): AttendanceStatusValue | null {
  if (!raw || typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  if (v === "present" || v === "p" || v === "yes" || v === "1") return "present"
  if (v === "absent" || v === "a" || v === "no" || v === "0") return "absent"
  if (v === "late" || v === "l" || v === "tardy") return "late"
  if (v === "unmarked" || v === "" || v === "—" || v === "-") return "unmarked"
  return null
}

/** Legacy single status for whole schedule (used when per-day map is absent). */
export function getAttendanceFromCustomData(
  customData: Record<string, unknown> | null | undefined
): AttendanceStatusValue {
  const raw = customData?.[EMS_ATTENDANCE_STATUS_KEY]
  const n = normalizeAttendanceInput(String(raw ?? ""))
  return n === null ? "unmarked" : n === "unmarked" ? "unmarked" : n
}

/** Status for one calendar day; falls back to legacy single status for all days if no per-day data. */
export function getAttendanceForDay(
  customData: Record<string, unknown> | null | undefined,
  dayKey: string
): AttendanceStatusValue {
  const byDay = readByDayMap(customData)
  if (Object.keys(byDay).length > 0) {
    const n = normalizeAttendanceInput(byDay[dayKey] ?? "")
    return n === null || n === "unmarked" ? "unmarked" : n
  }
  return getAttendanceFromCustomData(customData)
}

function cloneCustom(
  existing: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {}
}

function stripLegacyAttendanceKeys(base: Record<string, unknown>) {
  delete base[EMS_ATTENDANCE_STATUS_KEY]
  delete base[EMS_ATTENDANCE_SOURCE_KEY]
}

/** Update one day. Pass full `dayKeys` so legacy → per-day migration can run once. */
export function mergeAttendanceForDay(
  existing: Record<string, unknown> | null | undefined,
  dayKeys: string[],
  dayKey: string,
  status: AttendanceStatusValue,
  source: "manual" | "bulk" | "excel" | "integration"
): Record<string, unknown> {
  const base = cloneCustom(existing)
  let byDay = { ...readByDayMap(base) }
  if (Object.keys(byDay).length === 0) {
    const leg = normalizeAttendanceInput(String(base[EMS_ATTENDANCE_STATUS_KEY] ?? ""))
    if (leg && leg !== "unmarked") {
      for (const d of dayKeys) byDay[d] = leg
    }
  }

  if (status === "unmarked") {
    delete byDay[dayKey]
  } else {
    byDay[dayKey] = status
  }

  if (Object.keys(byDay).length === 0) {
    delete base[EMS_ATTENDANCE_BY_DAY_KEY]
    stripLegacyAttendanceKeys(base)
    delete base[EMS_ATTENDANCE_UPDATED_AT_KEY]
    return base
  }

  stripLegacyAttendanceKeys(base)
  base[EMS_ATTENDANCE_BY_DAY_KEY] = byDay
  base[EMS_ATTENDANCE_SOURCE_KEY] = source
  base[EMS_ATTENDANCE_UPDATED_AT_KEY] = new Date().toISOString()
  return base
}

/** Set the same status for every training day (and clear legacy single key). */
export function mergeAttendanceAllDays(
  existing: Record<string, unknown> | null | undefined,
  dayKeys: string[],
  status: AttendanceStatusValue,
  source: "manual" | "bulk" | "excel" | "integration"
): Record<string, unknown> {
  const base = cloneCustom(existing)
  if (dayKeys.length === 0) {
    return mergeAttendanceIntoCustomDataLegacy(base, status, source)
  }
  if (status === "unmarked") {
    delete base[EMS_ATTENDANCE_BY_DAY_KEY]
    stripLegacyAttendanceKeys(base)
    return base
  }
  const byDay: Record<string, string> = {}
  for (const d of dayKeys) byDay[d] = status
  stripLegacyAttendanceKeys(base)
  base[EMS_ATTENDANCE_BY_DAY_KEY] = byDay
  base[EMS_ATTENDANCE_SOURCE_KEY] = source
  base[EMS_ATTENDANCE_UPDATED_AT_KEY] = new Date().toISOString()
  return base
}

/** Legacy: single status for whole course (when schedule has no day list). */
function mergeAttendanceIntoCustomDataLegacy(
  base: Record<string, unknown>,
  status: AttendanceStatusValue,
  source: "manual" | "bulk" | "excel" | "integration"
): Record<string, unknown> {
  delete base[EMS_ATTENDANCE_BY_DAY_KEY]
  if (status === "unmarked") {
    delete base[EMS_ATTENDANCE_STATUS_KEY]
    delete base[EMS_ATTENDANCE_SOURCE_KEY]
    delete base[EMS_ATTENDANCE_UPDATED_AT_KEY]
    return base
  }
  base[EMS_ATTENDANCE_STATUS_KEY] = status
  base[EMS_ATTENDANCE_SOURCE_KEY] = source
  base[EMS_ATTENDANCE_UPDATED_AT_KEY] = new Date().toISOString()
  return base
}

export function mergeAttendanceIntoCustomData(
  existing: Record<string, unknown> | null | undefined,
  status: AttendanceStatusValue,
  source: "manual" | "bulk" | "excel" | "integration"
): Record<string, unknown> {
  const base = cloneCustom(existing)
  return mergeAttendanceIntoCustomDataLegacy(base, status, source)
}

/** Counts each trainee × day cell (or one legacy cell per trainee if no days). */
export function countAttendanceSlots(
  rows: { custom_data: Record<string, unknown> | null }[],
  dayKeys: string[]
): { present: number; absent: number; late: number; unmarked: number; total: number } {
  let present = 0,
    absent = 0,
    late = 0,
    unmarked = 0
  const useDays = dayKeys.length > 0
  for (const r of rows) {
    if (useDays) {
      for (const d of dayKeys) {
        const s = getAttendanceForDay(r.custom_data, d)
        if (s === "present") present++
        else if (s === "absent") absent++
        else if (s === "late") late++
        else unmarked++
      }
    } else {
      const s = getAttendanceFromCustomData(r.custom_data)
      if (s === "present") present++
      else if (s === "absent") absent++
      else if (s === "late") late++
      else unmarked++
    }
  }
  const total = useDays ? rows.length * dayKeys.length : rows.length
  return { present, absent, late, unmarked, total }
}
