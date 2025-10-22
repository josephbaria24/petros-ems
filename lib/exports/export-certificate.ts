// lib/exports/exportCertificates.ts
import { supabase } from "@/lib/supabase-client"

export async function exportCertificates(scheduleId: string, scheduleRange: string): Promise<void> {
  try {
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedules")
      .select("id, course_id, schedule_type")
      .eq("id", scheduleId)
      .single()

    if (!scheduleData || scheduleError) {
      throw new Error("Failed to fetch schedule information.")
    }

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, name, serial_number")
      .eq("id", scheduleData.course_id)
      .single()

    if (!courseData || courseError) {
      throw new Error("Failed to fetch course information.")
    }

    let formattedDateRange = scheduleRange
    let givenThisDate = ""

    if (scheduleData.schedule_type === 'regular') {
      const { data: rangeData } = await supabase
        .from("schedule_ranges")
        .select("start_date, end_date")
        .eq("schedule_id", scheduleId)
        .single()

      if (rangeData) {
        const start = new Date(rangeData.start_date)
        const end = new Date(rangeData.end_date)
        formattedDateRange = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} & ${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`
        givenThisDate = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
    } else {
      const { data: datesData } = await supabase
        .from("schedule_dates")
        .select("date")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true })

      if (datesData && datesData.length > 0) {
        const dates = datesData.map(d => new Date(d.date))
        formattedDateRange = dates.map(d => d.getDate()).join(' & ') + `, ${dates[0].getFullYear()}`
        givenThisDate = dates[dates.length - 1].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
    }

    const courseName = courseData.name
    const courseSerial = courseData.serial_number || "0000" // fallback
    const coursePrefix = courseName.replace(/\s+/g, "").toUpperCase() // remove spaces for SerialNo

    let templatePath = ""

    if (courseName.includes("BOSH") && courseName.includes("SO1")) {
      templatePath = "/templates/certificates/BOSHS01-template.png"
    } else {
      alert("No certificate template found for this course.")
      return
    }

    const { data: traineesData } = await supabase
      .from("trainings")
      .select("id, first_name, last_name, middle_initial, certificate_number, picture_2x2_url")
      .eq("schedule_id", scheduleId)
      .order("last_name", { ascending: true })

    const traineesWithCerts = traineesData?.filter(t => t.certificate_number) || []

    if (traineesWithCerts.length === 0) {
      alert("No trainees have certificate numbers assigned yet.")
      return
    }

    alert(`Generating ${traineesWithCerts.length} certificate(s)...`)

    for (const trainee of traineesWithCerts) {
      const serialNumber = `PSI-${coursePrefix}-${courseSerial}${trainee.certificate_number}`
      await generateCertificate(trainee, templatePath, formattedDateRange, givenThisDate, serialNumber)
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    alert("All certificates downloaded successfully!")
  } catch (error: any) {
    console.error("❌ Certificate generation error:", error)
    alert(`Failed to download certificates: ${error.message}`)
  }
}

async function generateCertificate(
  trainee: any,
  templatePath: string,
  heldOnDate: string,
  givenThisDate: string,
  serialNumber: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject("Failed to create canvas context")

    const templateImg = new Image()
    templateImg.crossOrigin = "anonymous"

    templateImg.onload = async () => {
      canvas.width = templateImg.width
      canvas.height = templateImg.height
      ctx.drawImage(templateImg, 0, 0)

      if (trainee.picture_2x2_url) {
        const pictureImg = new Image()
        pictureImg.crossOrigin = "anonymous"
        await new Promise<void>((res, rej) => {
          pictureImg.onload = () => {
            const x = canvas.width * 0.845
            const y = canvas.height * 0.044
            const size = canvas.width * 0.105
            ctx.drawImage(pictureImg, x, y, size, size)
            res()
          }
          pictureImg.onerror = () => res() // continue without image
          pictureImg.src = trainee.picture_2x2_url
        })
      }

      const baseFontSize = canvas.width / 25.7
      const smallFontSize = canvas.width / 78
      const tinyFontSize = canvas.width / 77

      ctx.textAlign = 'center'
      ctx.fillStyle = '#000'

      ctx.font = `bold ${baseFontSize}px Arial`
      const fullName = `${trainee.first_name} ${trainee.middle_initial ? trainee.middle_initial + '. ' : ''}${trainee.last_name}`
      ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389)

      ctx.font = `${smallFontSize}px Arial`
      ctx.fillText(heldOnDate, canvas.width * 0.330, canvas.height * 0.688)
      ctx.fillText("Via Zoom Meeting", canvas.width * 0.500, canvas.height * 0.694)
      ctx.fillText(givenThisDate, canvas.width * 0.466, canvas.height * 0.732)

      ctx.font = `${tinyFontSize}px Arial`
      ctx.textAlign = 'right'
      ctx.fillText(`${serialNumber}`, canvas.width * 0.965, canvas.height * 0.200)

      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Certificate_${serialNumber}_${trainee.last_name}_${trainee.first_name}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          resolve()
        } else {
          reject("Failed to create blob")
        }
      }, 'image/png', 1.0)
    }

    templateImg.onerror = () => reject(new Error("Failed to load certificate template."))
    templateImg.src = templatePath
  })
}
