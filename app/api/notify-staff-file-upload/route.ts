import { NextRequest, NextResponse } from "next/server"
import { notifyStaffFileUpload, type NotifyStaffFileUploadParams } from "@/lib/notify-staff-file-upload"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyStaffFileUploadParams

    if (!body.source || !body.traineeName || !body.bookingReference) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await notifyStaffFileUpload(body)

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("notify-staff-file-upload API error:", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
