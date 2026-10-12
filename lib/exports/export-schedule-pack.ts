import { addDays, format, parseISO } from "date-fns"
import JSZip from "jszip"
import { tmsDb } from "@/lib/supabase-client"
import { pickCanonicalExam, type ExamKind, type ExamMode } from "@/lib/exam"
import {
  defaultOshProgram,
  detectOshKind,
  formatOshScheduleDates,
  parseOshProgram,
} from "@/lib/osh-program"
import { oshProgramPdfBlob } from "@/lib/osh-program-pdf"
import { parseAttendanceSnapshots, snapshotsForDay } from "@/components/attendance-snapshots-dialog"
import { buildExamSummaryPdfBlob } from "@/components/exam-result-summary-dialog"
import { exportTraineeExcel } from "@/lib/exports/export-excel"

type SchedulePackInput = {
  scheduleId: string
  courseName: string
  scheduleRange: string
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "schedule"
}

function trainingDayKeys(schedule: {
  schedule_type?: string | null
  schedule_ranges?: { start_date?: string; end_date?: string }[] | null
  schedule_dates?: { date?: string }[] | null
}) {
  const dates = (schedule.schedule_dates || [])
    .map((d) => (d.date || "").slice(0, 10))
    .filter(Boolean)
    .sort()

  if (schedule.schedule_type === "staggered" && dates.length) return dates

  const range = schedule.schedule_ranges?.[0]
  if (range?.start_date) {
    const keys: string[] = []
    let cursor = parseISO(range.start_date.slice(0, 10))
    const end = parseISO((range.end_date || range.start_date).slice(0, 10))
    while (cursor.getTime() <= end.getTime()) {
      keys.push(format(cursor, "yyyy-MM-dd"))
      cursor = addDays(cursor, 1)
    }
    if (keys.length) return keys
  }

  return dates
}

function extensionFor(blob: Blob, url: string) {
  if (blob.type.includes("png") || /\.png($|\?)/i.test(url)) return "png"
  if (blob.type.includes("webp") || /\.webp($|\?)/i.test(url)) return "webp"
  if (blob.type.includes("gif") || /\.gif($|\?)/i.test(url)) return "gif"
  return "jpg"
}

async function fetchImage(url: string) {
  const proxied = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`)
  if (proxied.ok) return proxied.blob()
  const direct = await fetch(url)
  if (!direct.ok) throw new Error("Could not download an attendance photo")
  return direct.blob()
}

async function resolveExamSlots(scheduleId: string, courseId: string | null) {
  type ExamRow = { id: string; kind: ExamKind; mode: ExamMode; schedule_id?: string | null; course_id?: string | null }
  let exams: ExamRow[] = []

  const bySchedule = await tmsDb
    .from("exams")
    .select("id, schedule_id, course_id, kind, mode")
    .eq("schedule_id", scheduleId)
  if (!bySchedule.error) exams = (bySchedule.data || []) as ExamRow[]

  if (!exams.length && courseId) {
    const byCourse = await tmsDb
      .from("exams")
      .select("id, schedule_id, course_id, kind, mode")
      .eq("course_id", courseId)
    if (!byCourse.error) exams = (byCourse.data || []) as ExamRow[]
  }

  const ids = exams.map((exam) => exam.id)
  const counts: Record<string, number> = {}
  if (ids.length) {
    const { data: questions } = await tmsDb
      .from("exam_questions")
      .select("id, exam_id")
      .in("exam_id", ids)
    for (const row of questions || []) {
      counts[row.exam_id] = (counts[row.exam_id] || 0) + 1
    }
  }

  const pretest = pickCanonicalExam(exams, "pretest", counts)
  const posttest = pickCanonicalExam(exams, "posttest", counts)
  return {
    pretestExamId: pretest?.id || null,
    posttestExamId: posttest?.id || null,
    pretestQuestionCount: pretest ? counts[pretest.id] || 0 : 0,
    posttestQuestionCount: posttest ? counts[posttest.id] || 0 : 0,
  }
}

export async function exportSchedulePack({
  scheduleId,
  courseName,
  scheduleRange,
}: SchedulePackInput) {
  const notes: string[] = []
  const zip = new JSZip()
  const attendances = zip.folder("Attendances")
  zip.folder("Recordings")

  const { data: schedule, error } = await tmsDb
    .from("schedules")
    .select(
      `
      id,
      course_id,
      event_type,
      branch,
      schedule_type,
      osh_program,
      attendance_snapshots,
      courses ( name ),
      schedule_ranges ( start_date, end_date ),
      schedule_dates ( date )
    `
    )
    .eq("id", scheduleId)
    .single()

  if (error || !schedule) {
    throw new Error(error?.message || "Schedule not found")
  }

  const course = (Array.isArray(schedule.courses) ? schedule.courses[0] : schedule.courses) as
    | { name?: string }
    | null
  const resolvedCourse = (course?.name || courseName || "Training").trim()
  const days = trainingDayKeys(schedule)
  const snapshots = parseAttendanceSnapshots(schedule.attendance_snapshots)
  const extraDays = snapshots
    .map((item) => item.day)
    .filter((day): day is string => !!day && !days.includes(day))
    .sort()
  const orderedDays = [...days, ...extraDays.filter((day, index, all) => all.indexOf(day) === index)]
  const dayPlan = orderedDays.length ? orderedDays : snapshots.length ? ["all"] : []

  if (attendances) {
    for (let index = 0; index < dayPlan.length; index++) {
      const dayKey = dayPlan[index]
      const fallback = index === 0 ? dayKey : undefined
      const photos = dayKey === "all" ? snapshots : snapshotsForDay(snapshots, dayKey, fallback)
      for (let photoIndex = 0; photoIndex < photos.length; photoIndex++) {
        const photo = photos[photoIndex]
        try {
          const blob = await fetchImage(photo.url)
          const ext = extensionFor(blob, photo.url)
          const label = photoIndex === 0 ? `Day ${index + 1}` : `Day ${index + 1} (${photoIndex + 1})`
          attendances.file(`${label}.${ext}`, blob)
        } catch (photoError) {
          console.error(photoError)
          notes.push(`Attendance photo for Day ${index + 1} could not be added.`)
        }
      }
    }
  }

  try {
    const excel = await exportTraineeExcel(scheduleId, scheduleRange, { download: false })
    if (excel) zip.file("Directory of Participants.xlsx", excel)
    else notes.push("Participant directory was not included.")
  } catch (excelError) {
    console.error(excelError)
    notes.push(excelError instanceof Error ? excelError.message : "Participant directory was not included.")
  }

  try {
    const saved = parseOshProgram(schedule.osh_program)
    const program =
      saved ||
      defaultOshProgram(detectOshKind(resolvedCourse) || "generic", {
        dates: formatOshScheduleDates(schedule),
        venue: schedule.branch || "",
        eventType: schedule.event_type || "",
      })
    const pdf = await oshProgramPdfBlob(program)
    zip.file(`DOLE-OSHC-STO-Prog-Form-${safeFileName(resolvedCourse)}.pdf`, pdf)
  } catch (programError) {
    console.error(programError)
    notes.push("Training program PDF was not included.")
  }

  try {
    const exams = await resolveExamSlots(scheduleId, schedule.course_id || null)
    const summary = await buildExamSummaryPdfBlob({
      scheduleId,
      courseName: resolvedCourse,
      ...exams,
    })
    zip.file("Exam Results Summary.pdf", summary)
  } catch (summaryError) {
    console.error(summaryError)
    notes.push("Exam results summary was not included.")
  }

  const packed = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(packed)
  const link = document.createElement("a")
  link.href = url
  link.download = `${safeFileName(resolvedCourse)}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  return notes
}
