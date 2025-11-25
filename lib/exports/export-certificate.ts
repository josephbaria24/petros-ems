// lib/exports/export-certificate.ts
import { supabase } from "@/lib/supabase-client"

// CRITICAL: Must match the server-side generation exactly
const CANVAS_WIDTH = 842
const CANVAS_HEIGHT = 595

export async function exportCertificatesNew(
  scheduleId: string,
  templateType: string,
  courseName: string,
  scheduleRange: string,
  trainees: any[],
  courseId: string,
  onProgress?: (current: number, total: number) => void
) {
  const { data: template, error: tplErr } = await supabase
    .from("certificate_templates")
    .select("*")
    .eq("course_id", courseId)
    .eq("template_type", templateType)
    .maybeSingle()

  if (tplErr || !template) throw new Error("No certificate template found.")

  const templateImg = await loadImage(template.image_url)

  const total = trainees.length
  let current = 0

  for (const trainee of trainees) {
    current++

    await generateSingleCertificate(
      trainee,
      templateImg,
      template.fields,
      courseName,
      scheduleRange
    )

    onProgress?.(current, total)
    await new Promise((r) => setTimeout(r, 150))
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = (error) => {
      console.error("Failed to load image:", url, error)
      reject(error)
    }
    
    // Handle both base64 data URIs and regular URLs
    if (url.startsWith('data:')) {
      img.src = url
    } else {
      // IMPORTANT: Always use image-proxy for external URLs to handle CORS
      img.src = `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  })
}

async function generateSingleCertificate(
  trainee: any,
  templateImg: HTMLImageElement,
  fields: any[],
  courseName: string,
  scheduleRange: string
) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // Use exact same dimensions as server
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT

  // Draw background template at full canvas size
  ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Calculate scale factors (matching server-side logic)
  const scaleX = CANVAS_WIDTH / 842
  const scaleY = CANVAS_HEIGHT / 595

  // Draw trainee photo - MUST MATCH SERVER EXACTLY
  if (trainee.picture_2x2_url) {
    try {
      console.log("Loading trainee photo:", trainee.picture_2x2_url)
      
      // CRITICAL FIX: Use image-proxy to handle CORS properly
      const img = await loadImage(trainee.picture_2x2_url)
      
      console.log("Trainee photo loaded successfully")
      
      // Use exact same positioning as server (from generate-certificate-pdf/route.ts)
      const size = canvas.width * 0.097
      const x = canvas.width * 0.848
      const y = canvas.height * 0.048
      
      console.log(`Drawing trainee photo at: x=${x}, y=${y}, size=${size}`)
      
      ctx.drawImage(img, x, y, size, size)
    } catch (error) {
      console.warn("Failed to load trainee photo:", trainee.picture_2x2_url, error)
      // Continue generating certificate without photo
    }
  }

  // Helper function to capitalize names (matching server)
  function capitalize(word: string | null | undefined): string {
    if (!word) return ""
    return word
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }

  // Build full name exactly as server does
  const first = capitalize(trainee.first_name)
  const middle = trainee.middle_initial ? capitalize(trainee.middle_initial) + ". " : ""
  const last = capitalize(trainee.last_name)
  const fullName = `${first} ${middle}${last}`

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  // Build replacements object (matching server)
  const replacements: Record<string, string> = {
    "{{trainee_name}}": fullName,
    "{{course_name}}": courseName,
    "{{completion_date}}": today,
    "{{certificate_number}}": trainee.certificate_number || "",
    "{{batch_number}}": trainee.batch_number?.toString() || "",
    "{{training_provider}}": "Petrosphere Inc.",
    "{{schedule_range}}": scheduleRange || "",
  }

  // Draw text fields - EXACT SAME LOGIC AS SERVER
  fields.forEach((field) => {
    let displayText = field.value

    // Replace placeholders
    Object.entries(replacements).forEach(([key, val]) => {
      displayText = displayText.replace(key, val)
    })

    // Apply scaling to position and font size
    const x = field.x * scaleX
    const y = field.y * scaleY
    const fontSize = field.fontSize * scaleY

    // Set font properties
    ctx.font = `${field.fontWeight === "bold" ? "bold " : ""}${fontSize}px Arial`
    ctx.fillStyle = field.color
    ctx.textAlign = field.align

    // Draw text
    ctx.fillText(displayText, x, y)
  })

  await downloadCanvas(canvas, trainee)
}

async function downloadCanvas(canvas: HTMLCanvasElement, trainee: any) {
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("Failed to create blob from canvas")
        return resolve()
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")

      // Use same filename format as server
      const certNum = trainee.certificate_number || "NO_CERT"
      const lastName = trainee.last_name || "UNKNOWN"
      const firstName = trainee.first_name || "UNKNOWN"
      
      a.href = url
      a.download = `Certificate_${certNum}_${lastName}_${firstName}.png`

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      URL.revokeObjectURL(url)
      resolve()
    }, "image/png")
  })
}