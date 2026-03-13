// app/api/certificate-layout-overrides/route.ts
import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

// GET ?trainingId=...&templateType=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const trainingId = searchParams.get("trainingId")
    const templateType = searchParams.get("templateType")

    if (!trainingId || !templateType) {
      return NextResponse.json(
        { error: "Missing trainingId or templateType" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .schema("tms")
      .from("certificate_layout_overrides")
      .select("training_id, template_type, offset_x, offset_y, field_overrides")
      .eq("training_id", trainingId)
      .eq("template_type", templateType)
      .maybeSingle()

    if (error) {
      console.error("Error fetching layout override:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ override: data })
  } catch (error: any) {
    console.error("Unexpected error in GET /certificate-layout-overrides:", error)
    return NextResponse.json(
      { error: "Unexpected error", details: error.message },
      { status: 500 }
    )
  }
}

// POST body: { trainingId, templateType, offsetX, offsetY }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trainingId, templateType, offsetX, offsetY, fieldOverrides } = body || {}

    if (!trainingId || !templateType) {
      return NextResponse.json(
        { error: "Missing trainingId or templateType" },
        { status: 400 }
      )
    }

    const payload = {
      training_id: trainingId,
      template_type: templateType,
      offset_x: typeof offsetX === "number" ? offsetX : 0,
      offset_y: typeof offsetY === "number" ? offsetY : 0,
      field_overrides: fieldOverrides ?? {},
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseServer
      .schema("tms")
      .from("certificate_layout_overrides")
      .upsert(payload, {
        onConflict: "training_id,template_type",
      })
      .select("training_id, template_type, offset_x, offset_y, field_overrides")
      .maybeSingle()

    if (error) {
      console.error("Error saving layout override:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ override: data })
  } catch (error: any) {
    console.error("Unexpected error in POST /certificate-layout-overrides:", error)
    return NextResponse.json(
      { error: "Unexpected error", details: error.message },
      { status: 500 }
    )
  }
}

