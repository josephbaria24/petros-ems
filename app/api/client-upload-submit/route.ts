import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { notifyStaffFileUpload } from "@/lib/notify-staff-file-upload"

export async function POST(req: NextRequest) {
  try {
    const { courseId, blockId, referenceNumber, uploadedFiles, blockLabels } = await req.json()

    if (!referenceNumber) {
      return NextResponse.json({ error: "Missing booking reference" }, { status: 400 })
    }

    const ref = String(referenceNumber).trim().toUpperCase()

    const { data: booking, error: bookingError } = await supabaseServer
      .schema("tms")
      .from("booking_summary")
      .select("training_id")
      .eq("reference_number", ref)
      .single()

    if (bookingError || !booking?.training_id) {
      return NextResponse.json(
        { error: "Booking reference not found. Please check and try again." },
        { status: 404 }
      )
    }

    const { data: training, error: trainingError } = await supabaseServer
      .schema("tms")
      .from("trainings")
      .select(`
        id,
        first_name,
        last_name,
        custom_data,
        course_id,
        courses (name)
      `)
      .eq("id", booking.training_id)
      .single()

    if (trainingError || !training) {
      return NextResponse.json(
        { error: "Training record not found for this booking reference." },
        { status: 404 }
      )
    }

    const customData = (training.custom_data as Record<string, unknown>) || {}
    const uploadKey = `__custom_upload_${blockId}`

    const fileEntries = Object.entries(uploadedFiles as Record<string, string>).map(([bId, url]) => ({
      blockId: bId,
      label: (blockLabels as Record<string, string>)?.[bId] || bId,
      url,
    }))

    customData[uploadKey] = {
      submitted_at: new Date().toISOString(),
      files: fileEntries,
    }

    const { error: updateError } = await supabaseServer
      .schema("tms")
      .from("trainings")
      .update({ custom_data: customData })
      .eq("id", training.id)

    if (updateError) {
      throw updateError
    }

    const courseRow = training.courses as { name?: string } | { name?: string }[] | null
    const courseName = Array.isArray(courseRow) ? courseRow[0]?.name : courseRow?.name

    try {
      await notifyStaffFileUpload({
        source: "email_upload_bin",
        traineeName: `${training.first_name} ${training.last_name}`,
        bookingReference: ref,
        courseName: courseName || undefined,
        files: fileEntries.map((f) => ({ label: f.label, url: f.url })),
        extraNotes: courseId ? `Course ID: ${courseId}` : undefined,
      })
    } catch (notifyErr) {
      console.error("Staff upload notification failed:", notifyErr)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Client upload submit error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
