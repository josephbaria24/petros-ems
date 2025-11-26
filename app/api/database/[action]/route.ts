// app/api/database/[action]/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params
    const renderUrl = process.env.RENDER_SERVICE_URL || process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"

    console.log(`=== DATABASE MANAGEMENT GET REQUEST ===`)
    console.log(`Action: ${action}`)
    console.log(`Render URL: ${renderUrl}`)

    // Only allow GET for stats and backup
    if (!["stats", "backup"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action for GET request" },
        { status: 400 }
      )
    }

    const fullUrl = `${renderUrl}/database/${action}`
    console.log(`Full URL: ${fullUrl}`)

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    console.log(`Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Render service error for ${action}:`, errorText)
      return NextResponse.json(
        { 
          error: `Render service error: ${response.status}`,
          details: errorText,
          url: fullUrl
        },
        { status: 500 }
      )
    }

    const data = await response.json()
    console.log(`Response data:`, data)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Database management error:", error)
    console.error("Error stack:", error.stack)
    return NextResponse.json(
      { 
        error: error.message || "Failed to perform database operation",
        details: error.stack,
        type: error.name
      },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params
    const renderUrl = process.env.RENDER_SERVICE_URL || process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"

    console.log(`=== DATABASE MANAGEMENT POST REQUEST ===`)
    console.log(`Action: ${action}`)
    console.log(`Render URL: ${renderUrl}`)
    console.log(`Environment variables:`)
    console.log(`  RENDER_SERVICE_URL: ${process.env.RENDER_SERVICE_URL}`)
    console.log(`  NEXT_PUBLIC_RENDER_SERVICE_URL: ${process.env.NEXT_PUBLIC_RENDER_SERVICE_URL}`)

    // Only allow POST for reset and delete-all-records
    if (!["reset", "delete-all-records"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action for POST request" },
        { status: 400 }
      )
    }

    const fullUrl = `${renderUrl}/database/${action}`
    console.log(`Full URL: ${fullUrl}`)

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    console.log(`Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Render service error for ${action}:`, errorText)
      return NextResponse.json(
        { 
          error: `Render service error: ${response.status}`,
          details: errorText,
          url: fullUrl
        },
        { status: 500 }
      )
    }

    const data = await response.json()
    console.log(`Response data:`, data)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Database management error:", error)
    console.error("Error stack:", error.stack)
    return NextResponse.json(
      { 
        error: error.message || "Failed to perform database operation",
        details: error.stack,
        type: error.name
      },
      { status: 500 }
    )
  }
}