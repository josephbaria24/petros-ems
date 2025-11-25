// app/api/export-excel-python/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trainees, courseName, trainingDates, scheduleId, eventType, branch } = body

    if (!trainees || !courseName || !scheduleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Render service URL (from environment)
    const RENDER_SERVICE_URL =
      process.env.RENDER_SERVICE_URL || "http://localhost:8000"
    
    // Full proxy URL (your Next.js domain → image-proxy route)
    const proxyUrl = `${req.nextUrl.origin}/api/image-proxy`

    console.log(`Calling Render service: ${RENDER_SERVICE_URL}`)
    console.log(`Using proxy URL: ${proxyUrl}`)
    console.log(`Processing ${trainees.length} trainees`)

    // Call Render Python backend
    const response = await fetch(`${RENDER_SERVICE_URL}/export-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainees,
        courseName,
        trainingDates,
        scheduleId,
        proxyUrl,
        eventType,  // Pass event_type
        branch,  // Pass branch
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Render service error:", errorText)
      throw new Error(`Render service error: ${response.status}`)
    }

    // Receive the Excel file
    const fileBuffer = await response.arrayBuffer()

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Originals${scheduleId.slice(
          -4
        )}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error("Excel Export Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate Excel file" },
      { status: 500 }
    )
  }
}