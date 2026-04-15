import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    const { courseId, blockId, referenceNumber, uploadedFiles, blockLabels } = await req.json()

    if (!referenceNumber) {
      return NextResponse.json({ error: "Missing booking reference" }, { status: 400 })
    }

    const { data: training, error: trainingError } = await supabaseServer
      .schema("tms")
      .from("trainings")
      .select("id, custom_data")
      .eq("booking_reference", referenceNumber)
      .single()

    if (trainingError || !training) {
      return NextResponse.json(
        { error: "Booking reference not found. Please check and try again." },
        { status: 404 }
      )
    }

    const customData = (training.custom_data as Record<string, any>) || {}
    const uploadKey = `__custom_upload_${blockId}`

    customData[uploadKey] = {
      submitted_at: new Date().toISOString(),
      files: Object.entries(uploadedFiles).map(([bId, url]) => ({
        blockId: bId,
        label: blockLabels?.[bId] || bId,
        url,
      })),
    }

    const { error: updateError } = await supabaseServer
      .schema("tms")
      .from("trainings")
      .update({ custom_data: customData })
      .eq("id", training.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Client upload submit error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
