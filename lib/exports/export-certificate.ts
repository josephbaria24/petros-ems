// lib/exports/exportCertificates.ts
import { supabase } from "@/lib/supabase-client"

export async function exportCertificates(
  scheduleId: string,
  scheduleRange: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {

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
        
        // Calculate days difference
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff > 1) {
          // Multi-day training: show start date - end date in mm/dd/yyyy format
          const startFormatted = `${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getDate().toString().padStart(2, '0')}/${start.getFullYear()}`
          const endFormatted = `${(end.getMonth() + 1).toString().padStart(2, '0')}/${end.getDate().toString().padStart(2, '0')}/${end.getFullYear()}`
          formattedDateRange = `${startFormatted} - ${endFormatted}`
        } else {
          // Single day training: use original format
          formattedDateRange = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} & ${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`
        }
        
        // Given this date is always today's date
        const today = new Date()
        givenThisDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
    } else {
      const { data: datesData } = await supabase
        .from("schedule_dates")
        .select("date")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true })

      if (datesData && datesData.length > 0) {
        const dates = datesData.map(d => new Date(d.date))
        
        // Group dates by month
        const datesByMonth: { [key: string]: number[] } = {}
        dates.forEach(date => {
          const monthYear = `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`
          if (!datesByMonth[monthYear]) {
            datesByMonth[monthYear] = []
          }
          datesByMonth[monthYear].push(date.getDate())
        })
        
        // Format: "Month Day,Day & Month Day, Year"
        const entries = Object.entries(datesByMonth)
        const formattedParts = entries.map(([monthYear, days], index) => {
          const daysStr = days.join(',')
          const [month, year] = monthYear.split(' ')
          
          // Only add year to the last month group
          if (index === entries.length - 1) {
            return `${month}. ${daysStr}, ${year}`
          } else {
            return `${month}. ${daysStr}`
          }
        })
        
        formattedDateRange = formattedParts.join(' & ')
        
        // Given this date is always today's date
        const today = new Date()
        givenThisDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
    }

    const courseName = courseData.name
    const courseSerial = courseData.serial_number || "0000" // fallback
    const coursePrefix = courseName.replace(/\s+/g, "").toUpperCase() // remove spaces for SerialNo

    let templatePath = ""
    let courseType: "boshso1" | "boshso2" = "boshso1"

    if (courseName.includes("BOSH") && courseName.includes("SO1")) {
      templatePath = "/templates/certificates/BOSHS01-template.png"
      courseType = "boshso1"
    } else if (courseName.includes("BOSH") && courseName.includes("SO2")) {
      templatePath = "/templates/certificates/BOSHSO2-template.png"
      courseType = "boshso2"
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

    for (let i = 0; i < traineesWithCerts.length; i++) {
      const trainee = traineesWithCerts[i]
      const serialNumber = trainee.certificate_number
      await generateCertificate(trainee, templatePath, formattedDateRange, givenThisDate, serialNumber, courseType)
      onProgress?.(i + 1, traineesWithCerts.length)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
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
  serialNumber: string,
  courseType: "boshso1" | "boshso2"
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
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = `/api/image-proxy?url=${encodeURIComponent(trainee.picture_2x2_url)}`

        await new Promise<void>((resolveImg) => {
          img.onload = () => {
            const size = canvas.width * 0.097
            const x = canvas.width * 0.848
            const y = canvas.height * 0.048
            ctx.drawImage(img, x, y, size, size)
            resolveImg()
          }

          img.onerror = () => {
            console.warn("⚠️ Failed to load 2x2 image for:", trainee.certificate_number)
            resolveImg() // continue even if failed
          }
        })
      }
      
      function capitalize(word: string | null | undefined): string {
        if (!word) return "";
        return word
          .toLowerCase()
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      
      const baseFontSize = canvas.width / 25.7
      const smallFontSize = canvas.width / 78
      const tinyFontSize = canvas.width / 77

      ctx.textAlign = 'center'
      ctx.fillStyle = '#000'

      ctx.font = `bold ${baseFontSize}px Arial`
      const first = capitalize(trainee.first_name)
      const middle = trainee.middle_initial ? capitalize(trainee.middle_initial) + ". " : ""
      const last = capitalize(trainee.last_name)
      const fullName = `${first} ${middle}${last}`
      
      if (courseType === "boshso1") {
        // 💡 BOSH SO1 positioning
        ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389)
        ctx.font = `italic ${smallFontSize}px Arial`
        ctx.fillText(heldOnDate, canvas.width * 0.330, canvas.height * 0.694)
        ctx.fillText("Via Zoom Meeting", canvas.width * 0.500, canvas.height * 0.694)
        ctx.fillText(givenThisDate, canvas.width * 0.450, canvas.height * 0.732)
        ctx.font = `${tinyFontSize}px Arial`
        ctx.textAlign = 'right'
        ctx.fillText(`${serialNumber}`, canvas.width * 0.960, canvas.height * 0.200)
      } else if (courseType === "boshso2") {
        // 💡 BOSH SO2 positioning (slightly lower)
        ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389)
        ctx.font = `italic ${smallFontSize}px Arial`
        ctx.fillText(heldOnDate, canvas.width * 0.330, canvas.height * 0.660)
        ctx.fillText("Via Zoom Meeting", canvas.width * 0.500, canvas.height * 0.660)
        ctx.fillText(givenThisDate, canvas.width * 0.430, canvas.height * 0.700)
        ctx.font = `${tinyFontSize}px Arial`
        ctx.textAlign = 'right'
        ctx.fillText(`${serialNumber}`, canvas.width * 0.960, canvas.height * 0.200)
      }
      
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