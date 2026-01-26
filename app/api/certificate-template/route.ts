// app/api/certificate-template/route.ts
import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get("courseId")
    const templateType = searchParams.get("templateType") || "participation"

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 })
    }

    console.log(`Fetching ${templateType} template for course ID: ${courseId}`)

    // Get template from database
    const { data, error } = await supabaseServer
      .schema("tms")
      .from("certificate_templates")
      .select("*")
      .eq("course_id", courseId)
      .eq("template_type", templateType)
      .maybeSingle()

    // maybeSingle() returns null if not found, which is not an error
    if (error) {
      console.error("Database error:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      )
    }

    console.log("Template data:", data)

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error("Error fetching template:", error)
    return NextResponse.json(
      { error: "Failed to fetch template", details: error.message },
      { status: 500 }
    )
  }
}


export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get("courseId")
    const templateType = searchParams.get("templateType")

    if (!courseId || !templateType) {
      return NextResponse.json(
        { error: "Missing courseId or templateType" },
        { status: 400 }
      )
    }

    // Fetch existing template to get image_url
    const { data: template, error: getError } = await supabaseServer
      .schema("tms")
      .from("certificate_templates")
      .select("id, image_url")
      .eq("course_id", courseId)
      .eq("template_type", templateType)
      .maybeSingle()

    if (getError) {
      return NextResponse.json(
        { error: "Failed to fetch template", details: getError.message },
        { status: 500 }
      )
    }

    if (!template) {
      return NextResponse.json({ success: true }) // Nothing to delete
    }

    // Extract storage path from public URL
    const imageUrl = template.image_url
    const storagePath = imageUrl.split("/trainee-photos/")[1]

    // Delete image from storage
    if (storagePath) {
      await supabaseServer.storage
        .from("trainee-photos")
        .remove([storagePath])
    }

    // Delete database row
    const { error: deleteError } = await supabaseServer
      .schema("tms")
      .from("certificate_templates")
      .delete()
      .eq("id", template.id)

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete template", details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Unexpected error", details: error.message },
      { status: 500 }
    )
  }
}




export async function POST(req: Request) {
  try {
    const { courseId, imageUrl, fields, templateType = "participation" } = await req.json()

    console.log("Saving template:", { 
      courseId, 
      templateType,
      imageUrl: imageUrl?.substring(0, 50), 
      fieldsCount: fields?.length 
    })

    if (!courseId || !imageUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if template exists for this course and type
    const { data: existing, error: selectError } = await supabaseServer
      .schema("tms")
      .from("certificate_templates")
      .select("id")
      .eq("course_id", courseId)
      .eq("template_type", templateType)
      .maybeSingle()

    if (selectError) {
      console.error("Select error:", selectError)
      return NextResponse.json(
        { error: "Database error", details: selectError.message },
        { status: 500 }
      )
    }

    if (existing) {
      console.log("Updating existing template ID:", existing.id)
      
      const { error } = await supabaseServer
        .schema("tms")
        .from("certificate_templates")
        .update({
          image_url: imageUrl,
          fields: fields,
          updated_at: new Date().toISOString()
        })
        .eq("course_id", courseId)
        .eq("template_type", templateType)

      if (error) {
        console.error("Update error:", error)
        return NextResponse.json(
          { error: "Failed to update template", details: error.message },
          { status: 500 }
        )
      }
    } else {
      console.log("Creating new template")
      
      const { error } = await supabaseServer
        .schema("tms")
        .from("certificate_templates")
        .insert({
          course_id: courseId,
          image_url: imageUrl,
          fields: fields,
          template_type: templateType
        })

      if (error) {
        console.error("Insert error:", error)
        return NextResponse.json(
          { error: "Failed to create template", details: error.message },
          { status: 500 }
        )
      }
    }

    console.log("Template saved successfully")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error saving template:", error)
    return NextResponse.json(
      { error: "Failed to save template", details: error.message },
      { status: 500 }
    )
  }
}