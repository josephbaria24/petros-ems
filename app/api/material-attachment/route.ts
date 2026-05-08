import { NextResponse } from "next/server"
import { tmsServerDb } from "@/lib/supabase-server"

export const runtime = "nodejs"

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim()
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split(".").pop()?.toLowerCase()
    if (!ext || ext.length > 6) return ""
    return ext
  } catch {
    return ""
  }
}

function defaultExtByType(fileType: string) {
  if (fileType === "pdf") return "pdf"
  if (fileType === "image") return "jpg"
  if (fileType === "zip") return "zip"
  if (fileType === "articulate") return "html"
  return "bin"
}

export async function POST(req: Request) {
  try {
    const { materialId } = await req.json()
    if (!materialId) {
      return NextResponse.json({ error: "materialId is required" }, { status: 400 })
    }

    const { data: material, error } = await tmsServerDb
      .from("course_materials")
      .select("id, title, file_url, file_type, is_active")
      .eq("id", materialId)
      .single()

    if (error || !material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 })
    }

    if (!material.is_active) {
      return NextResponse.json({ error: "Material is inactive" }, { status: 400 })
    }

    const fileRes = await fetch(material.file_url)
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to download material file" }, { status: 400 })
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const ext = extensionFromUrl(material.file_url) || defaultExtByType(material.file_type || "")
    const baseName = sanitizeFilename(material.title || "course-material")
    const filename = baseName.toLowerCase().endsWith(`.${ext}`) ? baseName : `${baseName}.${ext}`

    return NextResponse.json({
      filename,
      content: buffer.toString("base64"),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to prepare attachment" }, { status: 500 })
  }
}
