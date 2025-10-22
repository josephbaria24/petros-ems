import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase-client"

export async function exportTraineeExcel(scheduleId: string, scheduleRange: string): Promise<void> {
  try {
    const templateResponse = await fetch('/templates/participant-directory-template.xlsx')
    if (!templateResponse.ok) throw new Error('Failed to load Excel template')

    const templateBuffer = await templateResponse.arrayBuffer()
    const workbook = XLSX.read(templateBuffer, { type: 'array' })

    const directorySheet = workbook.Sheets['Directory of Participants']
    const trainingDbSheet = workbook.Sheets['Training Database']

    if (!directorySheet || !trainingDbSheet)
      throw new Error('Missing required Excel sheets.')

    // Get schedule and course info
    const { data: scheduleData } = await supabase
      .from("schedules")
      .select("id, course_id, status, schedule_type")
      .eq("id", scheduleId)
      .single()

    const { data: courseData } = await supabase
      .from("courses")
      .select("id, name")
      .eq("id", scheduleData?.course_id)
      .single()

    // Determine schedule date range
    let trainingDates = scheduleRange

    if (scheduleData?.schedule_type === 'regular') {
      const { data: rangeData } = await supabase
        .from("schedule_ranges")
        .select("start_date, end_date")
        .eq("schedule_id", scheduleId)
        .single()

      if (rangeData) {
        const start = new Date(rangeData.start_date)
        const end = new Date(rangeData.end_date)
        trainingDates = `${start.toLocaleDateString('en-US')} - ${end.toLocaleDateString('en-US')}`
      }
    } else if (scheduleData?.schedule_type === 'staggered') {
      const { data: datesData } = await supabase
        .from("schedule_dates")
        .select("date")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true })

      if (datesData && datesData.length > 0) {
        trainingDates = datesData.map(d => new Date(d.date).toLocaleDateString('en-US')).join(', ')
      }
    }

    // Fetch trainees
    const { data: trainees } = await supabase
      .from("trainings")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("last_name", { ascending: true })

    if (!trainees || trainees.length === 0)
      throw new Error("No trainee data found.")

    // HEADER rows: rows 9-12 (0-based index: 8-11)
    directorySheet[XLSX.utils.encode_cell({ r: 8, c: 2 })] = { v: 'PETROSPHERE INCORPORATED', t: 's' }     // OSHC/OSHNET
    directorySheet[XLSX.utils.encode_cell({ r: 9, c: 2 })] = { v: courseData?.name, t: 's' }                // Training Title
    directorySheet[XLSX.utils.encode_cell({ r: 10, c: 2 })] = { v: trainingDates, t: 's' }                  // Date
    directorySheet[XLSX.utils.encode_cell({ r: 11, c: 2 })] = { v: 'Online', t: 's' }                       // Venue

    // Participant rows start from row 14 (index 13)
    const startRow = 13
    trainees.forEach((t, i) => {
      const r = startRow + i
      const cells = [
        i + 1, t.certificate_number || '', t.last_name, t.first_name, t.middle_initial || '',
        t.suffix || '', t.gender || '', t.age || '', t.company_name || '',
        t.company_position || '', t.company_city || '', t.company_region || '',
        t.company_industry || '', t.total_workers || '', t.company_email || '',
        t.email || '', t.phone_number || '', t.company_landline || '',
        t.picture_2x2_url || '', 'Online Training', `#${t.schedule_id?.slice(-4) || ''}`
      ]

      cells.forEach((val, j) => {
        directorySheet[XLSX.utils.encode_cell({ r, c: j })] = {
          v: val,
          t: typeof val === 'number' ? 'n' : 's'
        }
      })
    })

    // Fill Training Database sheet (starting at row 11 — index 10)
    const maleCount = trainees.filter(t => t.gender?.toLowerCase() === 'male').length
    const femaleCount = trainees.filter(t => t.gender?.toLowerCase() === 'female').length
    const r = 10
    const cells = [
      1, courseData?.name, trainingDates, `#${scheduleId?.slice(-4) || ''}`,
      trainees.length, maleCount, femaleCount, '', '', '', '', '', 'Online Training'
    ]

    cells.forEach((val, c) => {
      trainingDbSheet[XLSX.utils.encode_cell({ r, c })] = {
        v: val,
        t: typeof val === 'number' ? 'n' : 's'
      }
    })

    // Save Excel file
    XLSX.writeFile(workbook, `Participant_Directory_${courseData?.name?.replaceAll(" ", "_")}.xlsx`)
    alert("Excel file downloaded successfully!")
  } catch (error: any) {
    console.error("❌ Excel Export Error:", error)
    alert(`Failed to export Excel: ${error.message}`)
  }
}





// const handleDownloadExcel = async () => {
//     try {
//       // Fetch the Excel template
//       const templateResponse = await fetch('/templates/participant-directory-template.xlsx')
//       if (!templateResponse.ok) {
//         throw new Error('Failed to load Excel template')
//       }
      
//       const templateBuffer = await templateResponse.arrayBuffer()
//       const workbook = XLSX.read(templateBuffer, { type: 'array' })
      
//       // Get both worksheets
//       const directorySheet = workbook.Sheets['Directory of Participants']
//       const trainingDbSheet = workbook.Sheets['Training Database']
      
//       if (!directorySheet || !trainingDbSheet) {
//         throw new Error('Template sheets not found. Please ensure sheets are named "Directory of Participants" and "Training Database"')
//       }

//       // Fetch schedule and trainee data
//       const { data: scheduleData, error: scheduleError } = await supabase
//         .from("schedules")
//         .select(`
//           id,
//           course_id,
//           status,
//           schedule_type
//         `)
//         .eq("id", scheduleId)
//         .single()

//       if (scheduleError || !scheduleData) {
//         console.error("❌ Error fetching schedule:", scheduleError)
//         alert("Failed to get course information. Please try again.")
//         return
//       }

//       // Fetch course information separately
//       const { data: courseData, error: courseError } = await supabase
//         .from("courses")
//         .select("id, name")
//         .eq("id", scheduleData.course_id)
//         .single()

//       if (courseError || !courseData) {
//         console.error("❌ Error fetching course:", courseError)
//         alert("Failed to get course information. Please try again.")
//         return
//       }

//       // Fetch schedule dates to construct the date range
//       let trainingDates = scheduleRange
//       if (scheduleData.schedule_type === 'regular') {
//         const { data: rangeData } = await supabase
//           .from("schedule_ranges")
//           .select("start_date, end_date")
//           .eq("schedule_id", scheduleId)
//           .single()

//         if (rangeData) {
//           const startDate = new Date(rangeData.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
//           const endDate = new Date(rangeData.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
//           trainingDates = `${startDate} - ${endDate}`
//         }
//       } else if (scheduleData.schedule_type === 'staggered') {
//         const { data: datesData } = await supabase
//           .from("schedule_dates")
//           .select("date")
//           .eq("schedule_id", scheduleId)
//           .order("date", { ascending: true })

//         if (datesData && datesData.length > 0) {
//           const formattedDates = datesData.map(d => 
//             new Date(d.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
//           )
//           trainingDates = formattedDates.join(', ')
//         }
//       }

//       const { data, error } = await supabase
//         .from("trainings")
//         .select(`
//           id,
//           first_name,
//           last_name,
//           middle_initial,
//           suffix,
//           gender,
//           age,
//           company_name,
//           company_position,
//           company_city,
//           company_region,
//           company_industry,
//           total_workers,
//           company_email,
//           email,
//           phone_number,
//           company_landline,
//           picture_2x2_url,
//           schedule_id,
//           certificate_number
//         `)
//         .eq("schedule_id", scheduleId)
//         .order("last_name", { ascending: true })

//       if (error) {
//         console.error("❌ Error fetching all trainees for export:", error)
//         alert("Failed to download trainee list. Please try again.")
//         return
//       }

//       if (!data || data.length === 0) {
//         alert("No data found to export.")
//         return
//       }

//       // Fill Directory of Participants sheet
//       // Based on the template, data starts at row 14 (Excel row 14, index 13)
//       const startRow = 13 // Row 14 in Excel (0-indexed, so 13)
      
//       // Also fill in the header information (rows 9-12)
//       // Row 9 (index 8): OSHC/OSHNET/STO NAME in column C
//       directorySheet[XLSX.utils.encode_cell({ r: 8, c: 2 })] = { 
//         v: 'PETROSPHE INCORPORATED', 
//         t: 's' 
//       }
      
//       // Row 10 (index 9): Training Title in column C
//       directorySheet[XLSX.utils.encode_cell({ r: 9, c: 2 })] = { 
//         v: courseData.name, 
//         t: 's' 
//       }
      
//       // Row 11 (index 10): Date in column C
//       directorySheet[XLSX.utils.encode_cell({ r: 10, c: 2 })] = { 
//         v: trainingDates, 
//         t: 's' 
//       }
      
//       // Row 12 (index 11): Venue in column C
//       directorySheet[XLSX.utils.encode_cell({ r: 11, c: 2 })] = { 
//         v: 'Online', 
//         t: 's' 
//       }
      
//       // Fill participant data starting from row 14
//       data.forEach((trainee, index) => {
//         const rowNumber = startRow + index
        
//         // Column mapping based on your template image
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 0 })] = { v: index + 1, t: 'n' } // A: No.
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 1 })] = { v: trainee.certificate_number || '', t: 's' } // B: Certificate Number
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 2 })] = { v: trainee.last_name, t: 's' } // C: Last Name
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 3 })] = { v: trainee.first_name, t: 's' } // D: First Name
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 4 })] = { v: trainee.middle_initial || '', t: 's' } // E: Middle Name
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 5 })] = { v: trainee.suffix || '', t: 's' } // F: Suffix
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 6 })] = { v: trainee.gender || '', t: 's' } // G: Sex
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 7 })] = { v: trainee.age || '', t: trainee.age ? 'n' : 's' } // H: Age
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 8 })] = { v: trainee.company_name || '', t: 's' } // I: Company
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 9 })] = { v: trainee.company_position || '', t: 's' } // J: Position
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 10 })] = { v: trainee.company_city || '', t: 's' } // K: Company Address (City)
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 11 })] = { v: trainee.company_region || '', t: 's' } // L: Company Address (Region)
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 12 })] = { v: trainee.company_industry || '', t: 's' } // M: Industry
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 13 })] = { v: trainee.total_workers || '', t: trainee.total_workers ? 'n' : 's' } // N: Total No. of Workers
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 14 })] = { v: trainee.company_email || '', t: 's' } // O: Company Email
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 15 })] = { v: trainee.email || '', t: 's' } // P: Personal Email
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 16 })] = { v: trainee.phone_number || '', t: 's' } // Q: Mobile No.
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 17 })] = { v: trainee.company_landline || '', t: 's' } // R: Company Landline
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 18 })] = { v: trainee.picture_2x2_url || '', t: 's' } // S: ID PICTURE (URL)
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 19 })] = { v: 'Online Training', t: 's' } // T: Mode of Training
//         directorySheet[XLSX.utils.encode_cell({ r: rowNumber, c: 20 })] = { v: `#${trainee.schedule_id?.slice(-4) || ''}`, t: 's' } // U: Batch No.
//       })

//       // Update the range for Directory sheet
//       const directoryRange = XLSX.utils.decode_range(directorySheet['!ref'] || 'A1')
//       directoryRange.e.r = Math.max(directoryRange.e.r, startRow + data.length - 1)
//       directorySheet['!ref'] = XLSX.utils.encode_range(directoryRange)

//       // Fill Training Database sheet (assuming data starts at row 11 based on your first image)
//       const trainingDbStartRow = 10 // Row 11 in Excel (0-indexed, so 10)
      
//       // Count male/female from the data
//       const maleCount = data.filter(t => t.gender?.toLowerCase() === 'male').length
//       const femaleCount = data.filter(t => t.gender?.toLowerCase() === 'female').length
//       const totalParticipants = data.length
      
//       // Fill one row in Training Database sheet
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 0 })] = { v: 1, t: 'n' } // A: No.
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 1 })] = { v: courseData.name, t: 's' } // B: Training Title
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 2 })] = { v: trainingDates, t: 's' } // C: Training Dates
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 3 })] = { v: `#${scheduleId?.slice(-4) || ''}`, t: 's' } // D: Batch Number
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 4 })] = { v: totalParticipants, t: 'n' } // E: Total Participants
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 5 })] = { v: maleCount, t: 'n' } // F: Male
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 6 })] = { v: femaleCount, t: 'n' } // G: Female
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 7 })] = { v: '', t: 's' } // H: Company
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 8 })] = { v: '', t: 's' } // I: Street
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 9 })] = { v: '', t: 's' } // J: City/Municipality
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 10 })] = { v: '', t: 's' } // K: Province
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 11 })] = { v: '', t: 's' } // L: Region
//       trainingDbSheet[XLSX.utils.encode_cell({ r: trainingDbStartRow, c: 12 })] = { v: 'Online Training', t: 's' } // M: Mode of Training

//       // Update the range for Training Database sheet
//       const trainingDbRange = XLSX.utils.decode_range(trainingDbSheet['!ref'] || 'A1')
//       trainingDbRange.e.r = Math.max(trainingDbRange.e.r, trainingDbStartRow)
//       trainingDbSheet['!ref'] = XLSX.utils.encode_range(trainingDbRange)

//       // Write the file
//       XLSX.writeFile(workbook, `Participant_Directory_${courseName.replaceAll(" ", "_")}.xlsx`)
      
//       alert('Excel file downloaded successfully!')
      
//     } catch (error) {
//       console.error("❌ Error processing Excel template:", error)
//       alert(`Failed to process Excel template. ${error instanceof Error ? error.message : 'Please try again.'}`)
//     }
//   }