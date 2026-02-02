// app/api/export-excel-python/route.ts
import { NextRequest, NextResponse } from "next/server"

// ✅ ADD THIS - Increase timeout
export const maxDuration = 300 // 5 minutes (requires Vercel Pro or self-hosted)
export const dynamic = 'force-dynamic' // Prevent caching

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trainees, courseName, trainingDates, scheduleId, eventType, branch, batchNumber } = body

    if (!trainees || !courseName || !scheduleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const NEXT_PUBLIC_RENDER_SERVICE_URL =
      process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"
    
    const proxyUrl = `${req.nextUrl.origin}/api/image-proxy`

    console.log(`Calling Render service: ${NEXT_PUBLIC_RENDER_SERVICE_URL}`)
    console.log(`Using proxy URL: ${proxyUrl}`)
    console.log(`Processing ${trainees.length} trainees`)

    // ✅ ADD TIMEOUT TO FETCH
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 290000) // 290 seconds

    try {
      const response = await fetch(`${NEXT_PUBLIC_RENDER_SERVICE_URL}/export-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainees,
          courseName,
          trainingDates,
          scheduleId,
          proxyUrl,
          eventType,
          branch,
          batchNumber,
        }),
        signal: controller.signal, // ✅ ADD THIS
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Render service error:", errorText)
        throw new Error(`Render service error: ${response.status}`)
      }

      const fileBuffer = await response.arrayBuffer()

      return new NextResponse(fileBuffer, {
  status: 200,
  headers: {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="Originals${
      batchNumber ? `_Batch${batchNumber}` : scheduleId.slice(-4)
    }.xlsx"`,
  },
})
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout - processing took too long')
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error("Excel Export Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate Excel file" },
      { status: 500 }
    )
  }
}