import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { OshProgram } from "@/lib/osh-program"

export const OSH_PDF_TEMPLATES = {
  cosh: "/templates/reports/Program - COSH (4-day Training).pdf",
  bosh_so2: "/templates/reports/BOSH SO2 (4-Day training) (1).pdf",
} as const

export function oshPdfKind(program: OshProgram): keyof typeof OSH_PDF_TEMPLATES {
  return program.trainingTypes.cosh ? "cosh" : "bosh_so2"
}

const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)

type Box = { x: number; y: number; w?: number; h?: number }
type SessionSlot = { page: number; y: number }

type TemplateLayout = {
  sto: Box
  dates: Box
  platform: Box
  venue: Box
  otherSpecify: Box
  totalDuration: Box
  remarks: Box
  checks: {
    boshPrivate: Box
    boshPublic: Box
    boshSo1: Box
    cosh: Box
    mosh: Box
    other: Box
    online: Box
    liveWebinar: Box
    selfDirected: Box
    classroom: Box
    submissionInitial: Box
    submissionActual: Box
  }
  person: { x: number; w: number }
  accreditation: { x: number; w: number }
  validity: { x: number; w: number }
  sessions: SessionSlot[]
}

const COSH_LAYOUT: TemplateLayout = {
  sto: { x: 128, y: 731, w: 260, h: 13 },
  dates: { x: 128, y: 613, w: 400, h: 12 },
  platform: { x: 172, y: 634, w: 148, h: 12 },
  venue: { x: 356, y: 634, w: 175, h: 12 },
  otherSpecify: { x: 278, y: 686, w: 255, h: 12 },
  totalDuration: { x: 142, y: 93, w: 70, h: 12 },
  remarks: { x: 268, y: 93, w: 270, h: 14 },
  checks: {
    boshPrivate: { x: 132.3, y: 709.4 },
    boshPublic: { x: 264.1, y: 709.4 },
    boshSo1: { x: 391.8, y: 709.4 },
    cosh: { x: 492.5, y: 709.5 },
    mosh: { x: 132.3, y: 688.9 },
    other: { x: 191.2, y: 688.9 },
    online: { x: 132.3, y: 664 },
    liveWebinar: { x: 240.5, y: 670.7 },
    selfDirected: { x: 240.5, y: 658.1 },
    classroom: { x: 329.1, y: 664 },
    submissionInitial: { x: 132.3, y: 598.1 },
    submissionActual: { x: 342.6, y: 597.5 },
  },
  person: { x: 318, w: 72 },
  accreditation: { x: 392, w: 96 },
  validity: { x: 492, w: 70 },
  sessions: [
    { page: 0, y: 456.2 },
    { page: 0, y: 428.2 },
    { page: 0, y: 401.7 },
    { page: 0, y: 374.2 },
    { page: 0, y: 331.3 },
    { page: 0, y: 289.8 },
    { page: 0, y: 262.2 },
    { page: 0, y: 227.6 },
    { page: 0, y: 197.9 },
    { page: 0, y: 161.4 },
    { page: 0, y: 143.7 },
    { page: 1, y: 785 },
    { page: 1, y: 751.6 },
    { page: 1, y: 719 },
    { page: 1, y: 689.4 },
    { page: 1, y: 654.4 },
    { page: 1, y: 573.5 },
    { page: 1, y: 543.2 },
    { page: 1, y: 516.9 },
    { page: 1, y: 490.6 },
    { page: 1, y: 459.9 },
    { page: 1, y: 430.3 },
    { page: 1, y: 398.5 },
    { page: 1, y: 365.6 },
    { page: 1, y: 337.7 },
    { page: 1, y: 308.3 },
    { page: 1, y: 275.5 },
    { page: 1, y: 244.6 },
    { page: 1, y: 210.5 },
    { page: 1, y: 172.8 },
    { page: 1, y: 139 },
  ],
}

const BOSH_LAYOUT: TemplateLayout = {
  sto: { x: 150, y: 641, w: 280, h: 13 },
  dates: { x: 153, y: 475, w: 390, h: 12 },
  platform: { x: 198, y: 500, w: 140, h: 12 },
  venue: { x: 382, y: 500, w: 175, h: 12 },
  otherSpecify: { x: 296, y: 568, w: 270, h: 28 },
  totalDuration: { x: 176, y: 570, w: 70, h: 12 },
  remarks: { x: 318, y: 570, w: 230, h: 14 },
  checks: {
    boshPrivate: { x: 153, y: 616.9 },
    boshPublic: { x: 284.7, y: 617 },
    boshSo1: { x: 412.3, y: 617 },
    cosh: { x: 512.7, y: 617 },
    mosh: { x: 153, y: 585 },
    other: { x: 212, y: 591.6 },
    online: { x: 153, y: 541.2 },
    liveWebinar: { x: 261.1, y: 553.7 },
    selfDirected: { x: 261.1, y: 529.7 },
    classroom: { x: 349.5, y: 541.3 },
    submissionInitial: { x: 153, y: 452.7 },
    submissionActual: { x: 362.9, y: 452.6 },
  },
  person: { x: 346, w: 70 },
  accreditation: { x: 418, w: 88 },
  validity: { x: 510, w: 72 },
  sessions: [
    { page: 0, y: 277 },
    { page: 0, y: 235.1 },
    { page: 0, y: 203.4 },
    { page: 0, y: 171.7 },
    { page: 0, y: 145.8 },
    { page: 0, y: 108.1 },
    { page: 1, y: 644.6 },
    { page: 1, y: 612.9 },
    { page: 1, y: 581.2 },
    { page: 1, y: 549.5 },
    { page: 1, y: 517.8 },
    { page: 1, y: 486.1 },
    { page: 1, y: 454.4 },
    { page: 1, y: 422.7 },
    { page: 1, y: 391 },
    { page: 1, y: 359.3 },
    { page: 1, y: 327.6 },
    { page: 1, y: 295.8 },
    { page: 1, y: 264.1 },
    { page: 1, y: 232.4 },
    { page: 1, y: 200.7 },
    { page: 1, y: 169 },
    { page: 1, y: 137.3 },
    { page: 1, y: 105.6 },
    { page: 2, y: 636.3 },
  ],
}

const templateCache = new Map<string, ArrayBuffer>()

function ascii(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .trim()
}

function cover(page: PDFPage, box: Box, h = box.h || 11) {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.w || 10,
    height: h,
    color: WHITE,
    borderWidth: 0,
  })
}

function fitSize(font: PDFFont, text: string, size: number, maxWidth: number) {
  let s = size
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.25
  return s
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number, maxLines: number) {
  const words = ascii(text).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    if (lines.length >= maxLines) return lines
    current = word
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines
}

function writeField(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: Box,
  size = 8,
  maxLines = 2,
) {
  const clean = ascii(text)
  if (!clean || !box.w) return
  cover(page, box, box.h || 12)
  const lines = wrapText(font, clean, size, box.w, maxLines)
  lines.forEach((line, i) => {
    const used = fitSize(font, line, size, box.w as number)
    page.drawText(line, {
      x: box.x + 1,
      y: box.y + 3 - i * (used + 1),
      size: used,
      font,
      color: BLACK,
    })
  })
}

function writeCell(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  w: number,
) {
  const clean = ascii(text)
  cover(page, { x, y: y - 2, w, h: 16 })
  if (!clean) return
  const lines = wrapText(font, clean, 7, w - 2, 2)
  lines.forEach((line, i) => {
    const used = fitSize(font, line, 7, w - 2)
    page.drawText(line, {
      x: x + 1,
      y: y - i * (used + 1),
      size: used,
      font,
      color: BLACK,
    })
  })
}

function drawCheck(page: PDFPage, box: Box, checked: boolean) {
  cover(page, { x: box.x, y: box.y - 0.8, w: 9, h: 10 })
  page.drawRectangle({
    x: box.x + 0.4,
    y: box.y + 0.2,
    width: 7.4,
    height: 7.4,
    borderColor: BLACK,
    borderWidth: 0.65,
    color: WHITE,
  })
  if (checked) {
    page.drawRectangle({
      x: box.x + 1.5,
      y: box.y + 1.3,
      width: 5.2,
      height: 5.2,
      color: BLACK,
    })
  }
}

async function templateBytes(kind: keyof typeof OSH_PDF_TEMPLATES) {
  const url = OSH_PDF_TEMPLATES[kind]
  const cached = templateCache.get(url)
  if (cached) return cached.slice(0)
  const res = await fetch(encodeURI(url))
  if (!res.ok) throw new Error("Could not load the official program PDF")
  const bytes = await res.arrayBuffer()
  templateCache.set(url, bytes)
  return bytes.slice(0)
}

export async function fillOshProgramPdf(program: OshProgram): Promise<Uint8Array> {
  const kind = oshPdfKind(program)
  const layout = kind === "cosh" ? COSH_LAYOUT : BOSH_LAYOUT
  const pdf = await PDFDocument.load(await templateBytes(kind), { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()

  const headerPage = pages[0]
  writeField(headerPage, font, program.stoName, layout.sto, 9, 1)
  writeField(headerPage, font, program.dates, layout.dates, 9, 1)
  writeField(headerPage, font, program.platform, layout.platform, 8, 1)
  writeField(headerPage, font, program.venue, layout.venue, 8, 1)
  writeField(headerPage, font, program.otherSpecify, layout.otherSpecify, 7, kind === "bosh_so2" ? 2 : 1)

  const c = layout.checks
  drawCheck(headerPage, c.boshPrivate, program.trainingTypes.boshPrivate)
  drawCheck(headerPage, c.boshPublic, program.trainingTypes.boshPublic)
  drawCheck(headerPage, c.boshSo1, program.trainingTypes.boshSo1)
  drawCheck(headerPage, c.cosh, program.trainingTypes.cosh)
  drawCheck(headerPage, c.mosh, program.trainingTypes.mosh)
  drawCheck(headerPage, c.other, program.trainingTypes.other)
  drawCheck(headerPage, c.online, program.delivery.online)
  drawCheck(headerPage, c.liveWebinar, program.delivery.liveWebinar)
  drawCheck(headerPage, c.selfDirected, program.delivery.selfDirected)
  drawCheck(headerPage, c.classroom, program.delivery.classroom)
  drawCheck(headerPage, c.submissionInitial, program.submissionInitial)
  drawCheck(headerPage, c.submissionActual, program.submissionActual)

  layout.sessions.forEach((slot, i) => {
    const session = program.sessions[i]
    const page = pages[slot.page]
    if (!session || !page) return
    writeCell(page, font, session.resourcePerson, layout.person.x, slot.y, layout.person.w)
    writeCell(page, font, session.accreditation, layout.accreditation.x, slot.y, layout.accreditation.w)
    writeCell(page, font, session.validity, layout.validity.x, slot.y, layout.validity.w)
  })

  const footerPage = kind === "cosh" ? pages[1] : pages[2]
  if (footerPage) {
    writeField(footerPage, font, program.totalDuration, layout.totalDuration, 8, 1)
    writeField(footerPage, font, program.remarks, layout.remarks, 8, 1)
  }

  return pdf.save()
}

export async function oshProgramPdfBlob(program: OshProgram) {
  const bytes = await fillOshProgramPdf(program)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: "application/pdf" })
}

export async function downloadOshProgramPdf(program: OshProgram, filename: string) {
  const blob = await oshProgramPdfBlob(program)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
