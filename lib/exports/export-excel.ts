// lib/exports/export-excel.ts (Enhanced with detailed logging)
import { tmsDb } from "@/lib/supabase-client"

export async function exportTraineeExcel(
  scheduleId: string, 
  scheduleRange: string
): Promise<void> {
  try {
    console.log("\n" + "=".repeat(60))
    console.log("📊 STARTING EXCEL EXPORT")
    console.log("=".repeat(60))
    console.log(`Schedule ID: ${scheduleId}`)
    console.log(`Schedule Range: ${scheduleRange}`)
    
    // Get schedule and course info first
    const { data: scheduleData, error: scheduleError } = await tmsDb
      .from("schedules")
      .select("id, course_id, status, schedule_type, event_type, branch")
      .eq("id", scheduleId)
      .single()

    if (scheduleError || !scheduleData) {
      console.error("❌ Schedule not found:", scheduleError)
      throw new Error("Schedule not found")
    }

    console.log(`✅ Schedule found: ${scheduleData.schedule_type} - ${scheduleData.status}`)
    console.log(`   Event Type: ${scheduleData.event_type}`)
    console.log(`   Branch: ${scheduleData.branch}`)

    const { data: courseData, error: courseError } = await tmsDb
      .from("courses")
      .select("id, name")
      .eq("id", scheduleData.course_id)
      .single()

    if (courseError || !courseData) {
      console.error("❌ Course not found:", courseError)
      throw new Error("Course not found")
    }

    console.log(`✅ Course: ${courseData.name}`)

    // Fetch trainees with ALL fields including picture_2x2_url
    console.log("\n📥 Fetching trainees from database...")
    const { data: trainees, error: traineesError } = await tmsDb
      .from("trainings")
      .select("*") // Get ALL fields
      .eq("schedule_id", scheduleId)
      .order("last_name", { ascending: true })

    if (traineesError) {
      console.error("❌ Error fetching trainees:", traineesError)
      throw new Error(`Failed to fetch trainees: ${traineesError.message}`)
    }

    if (!trainees || trainees.length === 0) {
      console.error("❌ No trainees found")
      throw new Error("No trainee data found.")
    }

    console.log(`✅ Fetched ${trainees.length} trainees`)

    // DETAILED IMAGE ANALYSIS
    console.log("\n" + "=".repeat(60))
    console.log("📸 IMAGE ANALYSIS")
    console.log("=".repeat(60))
    
    const traineesWithImages = trainees.filter(t => t.picture_2x2_url)
    const traineesWithoutImages = trainees.filter(t => !t.picture_2x2_url)
    
    console.log(`Total trainees: ${trainees.length}`)
    console.log(`With images: ${traineesWithImages.length}`)
    console.log(`Without images: ${traineesWithoutImages.length}`)
    console.log(`Percentage with images: ${Math.round((traineesWithImages.length / trainees.length) * 100)}%`)

    if (traineesWithImages.length > 0) {
      console.log("\n📋 Sample trainees with images:")
      traineesWithImages.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.first_name} ${t.last_name}`)
        console.log(`     URL: ${t.picture_2x2_url}`)
        console.log(`     URL Length: ${t.picture_2x2_url.length} chars`)
        console.log(`     URL Valid: ${t.picture_2x2_url.startsWith('http')}`)
      })
    } else {
      console.warn("⚠️  NO TRAINEES HAVE IMAGE URLS!")
    }

    if (traineesWithoutImages.length > 0 && traineesWithoutImages.length <= 5) {
      console.log("\n📋 Trainees WITHOUT images:")
      traineesWithoutImages.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.first_name} ${t.last_name}`)
      })
    }

    // Remove duplicates
    const uniqueTrainees = trainees.filter((trainee, index, self) =>
      index === self.findIndex((t) => 
        t.first_name === trainee.first_name && 
        t.last_name === trainee.last_name
      )
    )

    const duplicatesRemoved = trainees.length - uniqueTrainees.length
    if (duplicatesRemoved > 0) {
      console.log(`\n🔄 Removed ${duplicatesRemoved} duplicate(s)`)
      console.log(`Final count: ${uniqueTrainees.length} unique trainees`)
    }

    // Check if any images were lost during deduplication
    const uniqueWithImages = uniqueTrainees.filter(t => t.picture_2x2_url).length
    if (uniqueWithImages !== traineesWithImages.length) {
      console.warn(`⚠️  Lost ${traineesWithImages.length - uniqueWithImages} images during deduplication!`)
    }

    // Determine schedule date range
    let trainingDates = scheduleRange

    if (scheduleData.schedule_type === 'regular') {
      const { data: rangeData } = await tmsDb
        .from("schedule_ranges")
        .select("start_date, end_date")
        .eq("schedule_id", scheduleId)
        .single()

      if (rangeData) {
        const start = new Date(rangeData.start_date)
        const end = new Date(rangeData.end_date)
        
        const startMonth = start.toLocaleDateString('en-US', { month: 'long' })
        const startDay = start.getDate()
        const endMonth = end.toLocaleDateString('en-US', { month: 'long' })
        const endDay = end.getDate()
        const year = start.getFullYear()
        
        if (startMonth === endMonth) {
          if (startDay === endDay) {
            trainingDates = `${startMonth} ${startDay}, ${year}`
          } else {
            trainingDates = `${startMonth} ${startDay} - ${endDay}, ${year}`
          }
        } else {
          trainingDates = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
        }
      }
    } else if (scheduleData.schedule_type === 'staggered') {
      const { data: datesData } = await tmsDb
        .from("schedule_dates")
        .select("date")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true })

      if (datesData && datesData.length > 0) {
        trainingDates = datesData.map(d => 
          new Date(d.date).toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })
        ).join(', ')
      }
    }

    console.log(`\n📅 Training dates: ${trainingDates}`)

    // Prepare payload for Python API
    const payload = {
      trainees: uniqueTrainees,
      courseName: courseData.name,
      trainingDates,
      scheduleId,
    }

    console.log("\n" + "=".repeat(60))
    console.log("🚀 CALLING PYTHON API")
    console.log("=".repeat(60))
    console.log(`Endpoint: /api/export-excel-python`)
    console.log(`Current window.location.origin: ${window.location.origin}`)
    console.log(`Current window.location.href: ${window.location.href}`)
    console.log(`Trainees in payload: ${payload.trainees.length}`)
    console.log(`Trainees with images in payload: ${payload.trainees.filter(t => t.picture_2x2_url).length}`)
    
    // Log first trainee to verify data structure
    if (payload.trainees.length > 0) {
      const firstTrainee = payload.trainees[0]
      console.log("\n📋 First trainee structure:")
      console.log(`  Name: ${firstTrainee.first_name} ${firstTrainee.last_name}`)
      console.log(`  Has picture_2x2_url: ${!!firstTrainee.picture_2x2_url}`)
      if (firstTrainee.picture_2x2_url) {
        console.log(`  Picture URL: ${firstTrainee.picture_2x2_url.substring(0, 80)}...`)
      }
      console.log(`  All fields: ${Object.keys(firstTrainee).join(', ')}`)
    }

    // Call the Python API
    console.log("\n⏳ Sending request to Python service...")
    const startTime = Date.now()
    
    const response = await fetch('/api/export-excel-python', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  Request completed in ${duration}ms`)

    if (!response.ok) {
      const error = await response.json()
      console.error("❌ Python API error:", error)
      throw new Error(error.error || 'Failed to generate Excel file')
    }

    console.log("✅ Python API returned success")

    // Download the file
    console.log("\n📥 Downloading Excel file...")
    const blob = await response.blob()
    console.log(`📦 File size: ${(blob.size / 1024).toFixed(2)} KB`)
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Originals${scheduleId.slice(-4)}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    console.log("\n" + "=".repeat(60))
    console.log("✅ EXCEL EXPORT COMPLETED SUCCESSFULLY")
    console.log("=".repeat(60))
    console.log(`File: Originals${scheduleId.slice(-4)}.xlsx`)
    console.log(`Trainees: ${uniqueTrainees.length}`)
    console.log(`Images: ${uniqueWithImages}`)
    console.log("=".repeat(60) + "\n")

    alert(`Excel file downloaded successfully!\n\nTrainees: ${uniqueTrainees.length}\nWith images: ${uniqueWithImages}`)

  } catch (error: any) {
    console.error("\n" + "=".repeat(60))
    console.error("❌ EXCEL EXPORT FAILED")
    console.error("=".repeat(60))
    console.error("Error:", error)
    console.error("Stack:", error.stack)
    console.error("=".repeat(60) + "\n")
    alert(`Failed to export Excel: ${error.message}`)
  }
}