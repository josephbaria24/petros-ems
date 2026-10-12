function safeFileName(name: string) {
  const cleaned = name.replace(/[<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim()
  return cleaned || "Training"
}

export function oshSheetDownloadName(courseName?: string) {
  return `DOLE-OSHC-STO-Prog-Form-${safeFileName(courseName || "Training")}.pdf`
}

const PAGE_COUNT = 3
const PAGE_CSS_W = 760

function replaceControl(node: HTMLElement, text: string) {
  const div = document.createElement("div")
  div.textContent = text
  div.style.whiteSpace = "pre-wrap"
  div.style.overflowWrap = "anywhere"
  div.style.textAlign = "center"
  div.style.fontSize = "11px"
  div.style.lineHeight = "1.45"
  div.style.paddingBottom = "2px"
  div.style.color = "#000"
  node.replaceWith(div)
}

function padCells(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("td, th").forEach((cell) => {
    const wrap = document.createElement("div")
    wrap.style.padding = "4px 2px 8px"
    wrap.style.lineHeight = "1.45"
    wrap.style.overflow = "visible"
    while (cell.firstChild) wrap.appendChild(cell.firstChild)
    cell.appendChild(wrap)
    cell.style.verticalAlign = "top"
    cell.style.padding = "0"
  })
}

function preparePaper(paper: HTMLElement) {
  const clone = paper.cloneNode(true) as HTMLElement
  clone.querySelectorAll<HTMLElement>("[data-export-hide]").forEach((el) => el.remove())
  clone.querySelectorAll("textarea").forEach((field) => {
    replaceControl(field, field.value)
  })
  clone.querySelectorAll<HTMLElement>("button[role='combobox']").forEach((button) => {
    const text = button.innerText.trim()
    replaceControl(button, text === "Name" ? "" : text)
  })
  padCells(clone)
  const note = clone.querySelector<HTMLElement>('[data-osh-block="note"]')
  if (note) {
    note.style.display = "block"
    note.style.lineHeight = "18px"
    note.style.margin = "10px 0 8px"
    note.style.padding = "2px 0 6px"
    note.style.overflow = "visible"
  }
  clone.style.boxShadow = "none"
  clone.style.width = `${PAGE_CSS_W}px`
  clone.style.maxWidth = "none"
  clone.style.padding = "0"
  return clone
}

function block(root: ParentNode, name: string) {
  const el = root.querySelector<HTMLElement>(`[data-osh-block="${name}"]`)
  if (!el) throw new Error("Program sheet is missing a section")
  return el
}

function agendaPage(agenda: HTMLTableElement, indexes: number[]) {
  const table = agenda.cloneNode(true) as HTMLTableElement
  const rows = [...table.tBodies[0].rows]
  rows.forEach((row, index) => {
    if (!indexes.includes(index)) row.remove()
  })
  table.style.marginTop = "0"
  return table
}

function sumHeights(heights: number[], start: number, count: number) {
  let total = 0
  for (let index = start; index < start + count; index++) total += heights[index] || 0
  return total
}

function splitRows(heights: number[], extras: number[], maxH: number) {
  const count = heights.length
  if (count === 0) return [[], [], []]
  let first = Math.min(count - 2, Math.max(1, Math.round(count * 0.28)))
  let second = Math.min(count - first - 1, Math.max(1, Math.round(count * 0.36)))
  while (first > 1 && extras[0] + sumHeights(heights, 0, first) > maxH) first--
  while (second > 1 && extras[1] + sumHeights(heights, first, second) > maxH) second--
  return [
    Array.from({ length: first }, (_, index) => index),
    Array.from({ length: second }, (_, index) => first + index),
    Array.from({ length: count - first - second }, (_, index) => first + second + index),
  ]
}

function pageLabel(page: HTMLElement, number: number) {
  const label = document.createElement("div")
  label.textContent = `Page ${number} of ${PAGE_COUNT}`
  label.style.cssText = "margin-top:10px;text-align:right;font-size:10px;color:#000;"
  page.appendChild(label)
}

export async function downloadOshSheetPdf(filename = oshSheetDownloadName()) {
  const paper = document.querySelector<HTMLElement>("[data-osh-paper]")
  if (!paper) throw new Error("Program sheet is not on the page")

  const host = document.createElement("div")
  host.style.cssText = "position:fixed;left:-12000px;top:0;background:#ffffff;z-index:-1;"
  const measure = preparePaper(paper)
  host.appendChild(measure)
  document.body.appendChild(host)

  try {
    const logos = block(measure, "logos")
    const fields = block(measure, "fields")
    const note = block(measure, "note")
    const agenda = block(measure, "agenda") as HTMLTableElement
    const footer = block(measure, "footer")
    const rowHeights = [...agenda.tBodies[0].rows].map((row) => row.getBoundingClientRect().height)
    const theadH = agenda.tHead?.getBoundingClientRect().height ?? 0
    const introH =
      logos.getBoundingClientRect().height +
      fields.getBoundingClientRect().height +
      note.getBoundingClientRect().height +
      12
    const footerH = footer.getBoundingClientRect().height + 8
    const margin = 28
    const printableW = 612 - margin * 2
    const printableH = 792 - margin * 2
    const maxCssH = printableH * (PAGE_CSS_W / printableW) - 20
    const pages = splitRows(
      rowHeights,
      [introH + theadH + 28, theadH + 28, theadH + footerH + 28],
      maxCssH,
    )

    const shells: HTMLElement[] = []
    for (let number = 1; number <= PAGE_COUNT; number++) {
      const page = document.createElement("div")
      page.style.cssText = `width:${PAGE_CSS_W}px;box-sizing:border-box;background:#ffffff;padding:0 0 8px;color:#000;font-family:Arial,Helvetica,sans-serif;`
      if (number === 1) {
        page.append(logos.cloneNode(true), fields.cloneNode(true), note.cloneNode(true))
      }
      page.append(agendaPage(agenda, pages[number - 1]))
      if (number === PAGE_COUNT) page.append(footer.cloneNode(true))
      pageLabel(page, number)
      shells.push(page)
    }

    host.replaceChildren(...shells)

    const html2canvas = (await import("html2canvas")).default
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "letter" })

    for (let index = 0; index < shells.length; index++) {
      const canvas = await html2canvas(shells[index], {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      })
      const drawW = printableW
      const drawH = (canvas.height / canvas.width) * drawW
      const height = Math.min(drawH, printableH)
      const width = height === drawH ? drawW : (canvas.width / canvas.height) * height
      if (index > 0) pdf.addPage()
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        margin + (printableW - width) / 2,
        margin,
        width,
        height,
      )
    }

    const blob = pdf.output("blob")
    pdf.save(filename)
    return blob
  } finally {
    host.remove()
  }
}
