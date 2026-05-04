/** Stored on each `trainings.custom_data` record (merged with existing JSON). */
export const EMS_ATTENDANCE_STATUS_KEY = "ems_attendance_status" as const
export const EMS_ATTENDANCE_SOURCE_KEY = "ems_attendance_source" as const
export const EMS_ATTENDANCE_UPDATED_AT_KEY = "ems_attendance_updated_at" as const

export type AttendanceStatusValue = "unmarked" | "present" | "absent" | "late"

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

export function getAttendanceFromCustomData(
  customData: Record<string, unknown> | null | undefined
): AttendanceStatusValue {
  const raw = customData?.[EMS_ATTENDANCE_STATUS_KEY]
  const n = normalizeAttendanceInput(String(raw ?? ""))
  return n === null ? "unmarked" : n === "unmarked" ? "unmarked" : n
}

export function mergeAttendanceIntoCustomData(
  existing: Record<string, unknown> | null | undefined,
  status: AttendanceStatusValue,
  source: "manual" | "bulk" | "excel" | "integration"
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {}
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
