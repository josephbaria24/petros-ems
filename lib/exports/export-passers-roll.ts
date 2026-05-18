import JSZip from "jszip"

export type PasserTrainee = {
  id: string
  first_name: string
  last_name: string
  middle_initial?: string | null
  suffix?: string | null
}

export type PassersRollMeta = {
  courseName: string
  batchLabel: string
  releasedOn: Date
}

const PAGE_WIDTH = 850
const PAGE_HEIGHT = 1100
const ROWS_PER_PAGE = 20
const FONT_FAMILY = '"Courier New", Courier, monospace'

function formatPasserName(trainee: PasserTrainee): string {
  const first = (trainee.first_name || "").trim()
  const last = (trainee.last_name || "").trim()
  const mi = trainee.middle_initial?.trim()
    ? `${trainee.middle_initial.trim().charAt(0).toUpperCase()}.`
    : ""
  const suffix = trainee.suffix?.trim() ? ` ${trainee.suffix.trim()}` : ""
  return `${first} ${mi} ${last}`.replace(/\s+/g, " ").trim().toUpperCase() + suffix.toUpperCase()
}

function getRollTitleLine(courseName: string): string {
  const upper = courseName.toUpperCase()
  if (upper.includes("SO2") || upper.includes("SAFETY OFFICER 2")) {
    return "Roll of SO2 Trainee Passers in the"
  }
  return "Roll of Trainee Passers in the"
}

function formatReleasedDate(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "long" }).toUpperCase()
  return `Released on ${month} ${date.getDate()}, ${date.getFullYear()}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function renderPassersPage(
  trainees: PasserTrainee[],
  meta: PassersRollMeta,
  pageIndex: number,
  totalPages: number,
  startSeq: number,
  isLastPage: boolean,
  logo: HTMLImageElement
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  // Watermark logo (centered, no rotation)
  ctx.save()
  ctx.globalAlpha = 0.1
  const logoSize = 1200
  ctx.drawImage(
    logo,
    (PAGE_WIDTH - logoSize) / 2,
    (PAGE_HEIGHT - logoSize) / 2,
    logoSize,
    logoSize
  )
  ctx.restore()

  ctx.fillStyle = "#000000"
  ctx.textBaseline = "top"

  // Header block
  let y = 72
  ctx.font = `16px ${FONT_FAMILY}`
  ctx.fillText(getRollTitleLine(meta.courseName), 72, y)
  y += 28

  ctx.font = `bold 16px ${FONT_FAMILY}`
  const examTitle = meta.courseName.toUpperCase()
  ctx.fillText(examTitle, 72, y)
  y += 28

  ctx.font = `16px ${FONT_FAMILY}`
  ctx.fillText(meta.batchLabel, 72, y)
  y += 28
  ctx.fillText(formatReleasedDate(meta.releasedOn), 72, y)

  // Page number
  ctx.font = `16px ${FONT_FAMILY}`
  const pageLabel = `Page ${pageIndex + 1} of ${totalPages}`
  const pageWidth = ctx.measureText(pageLabel).width
  ctx.fillText(pageLabel, PAGE_WIDTH - 72 - pageWidth, 72)

  // Table headers
  y = 210
  const seqX = 120
  const nameX = 280
  ctx.font = `bold 16px ${FONT_FAMILY}`
  ctx.fillText("Seq. No.", seqX, y)
  ctx.fillText("N a m e", nameX, y)

  y += 36
  ctx.font = `16px ${FONT_FAMILY}`

  trainees.forEach((trainee, idx) => {
    const seq = startSeq + idx
    ctx.fillText(String(seq), seqX, y)
    ctx.fillText(formatPasserName(trainee), nameX, y)
    y += 34
  })

  if (isLastPage) {
    y += 8
    ctx.fillText("---NOTHING FOLLOWS---", nameX, y)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Failed to generate PNG"))
      },
      "image/png",
      1
    )
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

export async function exportPassersRoll(
  trainees: PasserTrainee[],
  meta: PassersRollMeta,
  onProgress?: (current: number, total: number) => void
) {
  const sorted = [...trainees].sort((a, b) => {
    const last = a.last_name.localeCompare(b.last_name)
    if (last !== 0) return last
    return a.first_name.localeCompare(b.first_name)
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE))
  const logo = await loadImage("/logo.png")
  const blobs: { filename: string; blob: Blob }[] = []

  for (let page = 0; page < totalPages; page++) {
    const chunk = sorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE)
    const startSeq = page * ROWS_PER_PAGE + 1
    const isLastPage = page === totalPages - 1
    const blob = await renderPassersPage(chunk, meta, page, totalPages, startSeq, isLastPage, logo)
    blobs.push({ filename: `passers-page-${page + 1}.png`, blob })
    onProgress?.(page + 1, totalPages)
    await new Promise((r) => setTimeout(r, 50))
  }

  const baseName = sanitizeFilename(meta.courseName || "passers-roll")

  if (blobs.length === 1) {
    downloadBlob(blobs[0].blob, `${baseName}.png`)
    return
  }

  const zip = new JSZip()
  blobs.forEach(({ filename, blob }) => zip.file(filename, blob))
  const zipBlob = await zip.generateAsync({ type: "blob" })
  downloadBlob(zipBlob, `${baseName}-passers.zip`)
}

export function formatBatchLabelFromSchedule(schedule: {
  schedule_type?: string
  schedule_ranges?: { start_date: string; end_date: string }[]
  schedule_dates?: { date: string }[]
  batch_number?: number | null
}): string {
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

  const enumerateDays = (start: string, end: string) => {
    const days: Date[] = []
    const s = new Date(start)
    const e = new Date(end)
    const cursor = new Date(s)
    while (cursor <= e) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }

  let dates: Date[] = []
  if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length) {
    dates = schedule.schedule_dates
      .map((d) => new Date(d.date))
      .sort((a, b) => a.getTime() - b.getTime())
  } else if (schedule.schedule_ranges?.length) {
    const range = schedule.schedule_ranges[0]
    dates = enumerateDays(range.start_date, range.end_date)
  }

  if (dates.length === 0) {
    return schedule.batch_number ? `Batch #${schedule.batch_number}` : "Batch TBD"
  }

  const month = monthNames[dates[0].getMonth()]
  const year = dates[0].getFullYear()
  const dayList = dates.map((d) => d.getDate()).join(", ")
  return `Batch ${month} ${dayList}, ${year}`
}
