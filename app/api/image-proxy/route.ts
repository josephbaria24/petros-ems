import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing URL" }, { status: 400 })
  }

  try {
    const response = await fetch(url)
    const contentType = response.headers.get("Content-Type") || "image/jpeg"
    const buffer = await response.arrayBuffer()

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*", // 👈️ critical for canvas
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err) {
    console.error("Image Proxy Error:", err)
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 })
  }
}
