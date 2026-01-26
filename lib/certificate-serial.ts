// lib/certificate-serial.ts
import { tmsDb } from "@/lib/supabase-client"

/**
 * Generates a certificate serial number in format: PSI-{COURSE_CODE}-{PADDED_NUMBER}
 * The number is based on the COUNT of trainees in that course
 * Example: PSI-BOSHSO1-001264
 */
export async function generateCertificateSerial(
  courseId: string,
  courseName: string
): Promise<string | null> {
  try {
    // Get course details for padding width
    const { data: course, error: courseError } = await tmsDb
      .from("courses")
      .select("serial_number_pad, name")
      .eq("id", courseId)
      .single()

    if (courseError || !course) {
      console.error("Failed to fetch course:", courseError)
      return null
    }

    // Count total trainees for this course who have certificate numbers
    const { count, error: countError } = await tmsDb
      .from("trainings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .not("certificate_number", "is", null)

    if (countError) {
      console.error("Failed to count trainees:", countError)
      return null
    }

    // Next serial number is count + 1
    const nextSerial = (count || 0) + 1

    // Extract course code from course name
    const courseCode = extractCourseCode(courseName)

    // Get padding width (default to 6 if null)
    const paddingWidth = course.serial_number_pad || 6

    // Pad the number with zeros
    const paddedNumber = nextSerial.toString().padStart(paddingWidth, "0")

    // Generate final serial: PSI-{COURSE_CODE}-{PADDED_NUMBER}
    const serialNumber = `PSI-${courseCode}-${paddedNumber}`

    console.log(`✅ Generated serial number: ${serialNumber} (trainee #${nextSerial} for this course)`)
    return serialNumber
  } catch (error) {
    console.error("Error generating certificate serial:", error)
    return null
  }
}

/**
 * Extracts course code from course name
 * Removes spaces and keeps only alphanumeric characters
 */
function extractCourseCode(courseName: string): string {
  // Remove common words and clean up
  const cleanedName = courseName
    .toUpperCase()
    .replace(/TRAINING|COURSE|SAFETY|PROGRAM/gi, "")
    .trim()

  // Extract alphanumeric only and remove spaces
  const code = cleanedName.replace(/[^A-Z0-9]/g, "")

  // Limit to reasonable length (e.g., 10 characters)
  return code.substring(0, 10) || "COURSE"
}

/**
 * Batch generate certificate serials for multiple trainees
 * Returns a map of trainee IDs to serial numbers
 */
export async function batchGenerateCertificateSerials(
  courseId: string,
  courseName: string,
  traineeIds: string[]
): Promise<Map<string, string>> {
  const serialMap = new Map<string, string>()

  try {
    // Get course details for padding width
    const { data: course, error: courseError } = await tmsDb
      .from("courses")
      .select("serial_number_pad")
      .eq("id", courseId)
      .single()

    if (courseError || !course) {
      console.error("Failed to fetch course:", courseError)
      return serialMap
    }

    // Count existing trainees with certificate numbers
    const { count, error: countError } = await tmsDb
      .from("trainings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .not("certificate_number", "is", null)

    if (countError) {
      console.error("Failed to count trainees:", countError)
      return serialMap
    }

    const courseCode = extractCourseCode(courseName)
    let currentSerial = count || 0
    const paddingWidth = course.serial_number_pad || 6

    // Generate serials for all trainees
    for (const traineeId of traineeIds) {
      currentSerial++
      const paddedNumber = currentSerial.toString().padStart(paddingWidth, "0")
      const serialNumber = `PSI-${courseCode}-${paddedNumber}`
      serialMap.set(traineeId, serialNumber)
    }

    console.log(`✅ Generated ${serialMap.size} serial numbers for batch`)
    console.log(`   Starting from #${(count || 0) + 1}, ending at #${currentSerial}`)
    return serialMap
  } catch (error) {
    console.error("Error in batch serial generation:", error)
    return serialMap
  }
}

/**
 * Assign certificate serial to a trainee
 */
export async function assignCertificateSerial(
  traineeId: string,
  courseId: string,
  courseName: string
): Promise<string | null> {
  try {
    // Check if trainee already has a certificate number
    const { data: trainee } = await tmsDb
      .from("trainings")
      .select("certificate_number")
      .eq("id", traineeId)
      .single()

    if (trainee?.certificate_number) {
      console.log(`Trainee already has serial: ${trainee.certificate_number}`)
      return trainee.certificate_number
    }

    // Generate new serial based on trainee count
    const serialNumber = await generateCertificateSerial(courseId, courseName)

    if (!serialNumber) {
      return null
    }

    // Assign to trainee
    const { error } = await tmsDb
      .from("trainings")
      .update({ certificate_number: serialNumber })
      .eq("id", traineeId)

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
 * Batch assign certificate serials to multiple trainees
 * This ensures sequential numbering even when assigning in batch
 */
export async function batchAssignCertificateSerials(
  trainees: Array<{ id: string; certificate_number?: string }>,
  courseId: string,
  courseName: string
): Promise<void> {
  try {
    // Filter trainees who don't have certificate numbers
    const traineesNeedingSerials = trainees.filter(
      (t) => !t.certificate_number
    )

    if (traineesNeedingSerials.length === 0) {
      console.log("All trainees already have certificate numbers")
      return
    }

    console.log(
      `Generating serials for ${traineesNeedingSerials.length} trainees based on course trainee count`
    )

    // Generate all serials based on current trainee count
    const serialMap = await batchGenerateCertificateSerials(
      courseId,
      courseName,
      traineesNeedingSerials.map((t) => t.id)
    )

    // Update all trainees in batch
    for (const [traineeId, serialNumber] of serialMap.entries()) {
      const { error } = await tmsDb
        .from("trainings")
        .update({ certificate_number: serialNumber })
        .eq("id", traineeId)

      if (error) {
        console.error(
          `Failed to assign serial ${serialNumber} to trainee ${traineeId}:`,
          error
        )
      } else {
        console.log(`✅ Assigned ${serialNumber} to trainee ${traineeId}`)
      }
    }

    console.log("✅ Batch assignment complete")
  } catch (error) {
    console.error("Error in batch assignment:", error)
  }
}

/**
 * Get the next available serial number for a course (for preview/display purposes)
 */
export async function getNextSerialNumber(
  courseId: string,
  courseName: string
): Promise<string> {
  try {
    const { count } = await tmsDb
      .from("trainings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .not("certificate_number", "is", null)

    const { data: course } = await tmsDb
      .from("courses")
      .select("serial_number_pad")
      .eq("id", courseId)
      .single()

    const nextSerial = (count || 0) + 1
    const paddingWidth = course?.serial_number_pad || 6
    const courseCode = extractCourseCode(courseName)
    const paddedNumber = nextSerial.toString().padStart(paddingWidth, "0")

    return `PSI-${courseCode}-${paddedNumber}`
  } catch (error) {
    return "PSI-COURSE-000001"
  }
}