// app/api/image-proxy/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  
  if (!url) {
    console.error("❌ Image proxy: Missing URL parameter")
    return NextResponse.json({ error: "Missing URL" }, { status: 400 })
  }

  try {
    console.log(`🔍 Image proxy: Fetching ${url}`)
    
    // Special handling for Hostinger URLs
    const isHostingerUrl = url.includes('petrosphere.com.ph')
    
    // Build headers conditionally
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
    }
    
    if (isHostingerUrl) {
      headers['Referer'] = 'https://petrosphere.com.ph/'
    }
    
    const response = await fetch(url, {
      headers,
      // Increased timeout for slow servers
      signal: AbortSignal.timeout(30000),
    })
    
    if (!response.ok) {
      console.error(`❌ Image proxy: Failed with status ${response.status}`)
      console.error(`   URL: ${url}`)
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} - ${response.statusText}` }, 
        { status: response.status }
      )
    }

    const contentType = response.headers.get("Content-Type") || "image/jpeg"
    const buffer = await response.arrayBuffer()
    
    console.log(`✅ Image proxy: Success - ${contentType}, ${buffer.byteLength} bytes`)

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    })
  } catch (err: any) {
    console.error("❌ Image Proxy Error:", err.message)
    console.error(`   URL: ${url}`)
    return NextResponse.json(
      { error: `Failed to fetch image: ${err.message}` }, 
      { status: 500 }
    )
  }
}