import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId")
    const blockId = req.nextUrl.searchParams.get("blockId")

    if (!courseId || !blockId) {
      return NextResponse.json({ error: "Missing courseId or blockId" }, { status: 400 })
    }

    const { data: course, error } = await supabaseServer
      .schema("tms")
      .from("courses")
      .select("name, email_template_config")
      .eq("id", courseId)
      .single()

    if (error || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const emailConfig = course.email_template_config as any[] | null
    if (!emailConfig) {
      return NextResponse.json({ error: "No email configuration found" }, { status: 404 })
    }

    const block = emailConfig.find((b: any) => b.id === blockId && b.type === 'custom_upload_link')
    if (!block) {
      return NextResponse.json({ error: "Upload page not found" }, { status: 404 })
    }

    return NextResponse.json({
      config: {
        blockId: block.id,
        title: block.uploadPageTitle || 'Upload Files',
        description: block.uploadPageDescription || 'Please upload the required files below',
        blocks: block.uploadPageBlocks || [],
      },
      courseName: course.name,
    })
  } catch (err: any) {
    console.error("Error fetching upload config:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
