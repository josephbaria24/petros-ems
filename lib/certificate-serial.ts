// lib/certificate-serial.ts
import { tmsDb } from "@/lib/supabase-client"

/**
 * Generates a certificate serial number using courses.serial_number as the
 * authoritative, ever-increasing counter. The counter is incremented atomically
 * so numbers are never reused — even if participants are later deleted.
 *
 * Format: PSI-{COURSE_NAME}-{PADDED_NUMBER}
 */
export async function generateCertificateSerial(
  courseId: string,
  _courseName: string
): Promise<string | null> {
  try {
    const { data: course, error: courseError } = await tmsDb
      .from("courses")
      .select("name, serial_number, serial_number_pad")
      .eq("id", courseId)
      .single()

    if (courseError || !course) {
      console.error("Failed to fetch course:", courseError)
      return null
    }

    const serialBase = Number(course.serial_number ?? 0)
    const nextSerial = serialBase + 1
    const paddingWidth = Number(course.serial_number_pad ?? 6)

    // Optimistic lock: only increment if no one else did since we read
    const { data: lockData, error: upErr } = await tmsDb
      .from("courses")
      .update({ serial_number: nextSerial })
      .eq("id", courseId)
      .eq("serial_number", serialBase)
      .select("id")

    if (upErr || !lockData?.length) {
      console.error("Serial counter conflict — retry needed", upErr)
      return null
    }

    const padded = nextSerial.toString().padStart(paddingWidth, "0")
    const serialNumber = `PSI-${course.name}-${padded}`
    return serialNumber
  } catch (error) {
    console.error("Error generating certificate serial:", error)
    return null
  }
}

/**
 * Assign certificate serial to a single trainee.
 * Skips if the trainee already has a certificate_number (permanent — never overwritten).
 */
export async function assignCertificateSerial(
  traineeId: string,
  courseId: string,
  courseName: string
): Promise<string | null> {
  try {
    const { data: trainee } = await tmsDb
      .from("trainings")
      .select("certificate_number")
      .eq("id", traineeId)
      .single()

    if (trainee?.certificate_number) {
      return trainee.certificate_number
    }

    const serialNumber = await generateCertificateSerial(courseId, courseName)
    if (!serialNumber) return null

    const { error } = await tmsDb
      .from("trainings")
      .update({ certificate_number: serialNumber })
      .eq("id", traineeId)
      .is("certificate_number", null) // safety guard

    if (error) {
      console.error("Failed to assign serial to trainee:", error)
      return null
    }

    return serialNumber
  } catch (error) {
    console.error("Error assigning certificate serial:", error)
    return null
  }
}

/**
 * Batch assign certificate serials to multiple trainees.
 * Uses courses.serial_number as the authoritative counter — never count-based.
 * Trainees who already have a certificate_number are skipped entirely.
 */
export async function batchAssignCertificateSerials(
  trainees: Array<{ id: string; certificate_number?: string | null }>,
  courseId: string,
  _courseName: string
): Promise<void> {
  try {
    const needingSerials = trainees.filter((t) => !t.certificate_number)
    if (needingSerials.length === 0) return

    const { data: course, error: courseError } = await tmsDb
      .from("courses")
      .select("name, serial_number, serial_number_pad")
      .eq("id", courseId)
      .single()

    if (courseError || !course) {
      console.error("Failed to fetch course:", courseError)
      return
    }

    const serialBase = Number(course.serial_number ?? 0)
    const serialPad = Number(course.serial_number_pad ?? 6)
    const newCounter = serialBase + needingSerials.length

    // Atomically claim the range
    const { data: lockData, error: upErr } = await tmsDb
      .from("courses")
      .update({ serial_number: newCounter })
      .eq("id", courseId)
      .eq("serial_number", serialBase)
      .select("id")

    if (upErr || !lockData?.length) {
      console.error("Serial counter conflict — retry needed", upErr)
      return
    }

    for (let i = 0; i < needingSerials.length; i++) {
      const padded = (serialBase + i + 1).toString().padStart(serialPad, "0")
      const certNumber = `PSI-${course.name}-${padded}`

      const { error } = await tmsDb
        .from("trainings")
        .update({ certificate_number: certNumber })
        .eq("id", needingSerials[i].id)
        .is("certificate_number", null)

      if (error) {
        console.error(`Failed to assign ${certNumber} to ${needingSerials[i].id}:`, error)
      }
    }
  } catch (error) {
    console.error("Error in batch assignment:", error)
  }
}

/**
 * Preview the next available serial number for a course (read-only, does not increment).
 */
export async function getNextSerialNumber(
  courseId: string,
  _courseName: string
): Promise<string> {
  try {
    const { data: course } = await tmsDb
      .from("courses")
      .select("name, serial_number, serial_number_pad")
      .eq("id", courseId)
      .single()

    if (!course) return "PSI-COURSE-000001"

    const nextSerial = (Number(course.serial_number ?? 0)) + 1
    const paddingWidth = Number(course.serial_number_pad ?? 6)
    const padded = nextSerial.toString().padStart(paddingWidth, "0")

    return `PSI-${course.name}-${padded}`
  } catch {
    return "PSI-COURSE-000001"
  }
}
