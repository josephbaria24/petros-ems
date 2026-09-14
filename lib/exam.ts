import * as XLSX from "xlsx"

export type ExamKind = "pretest" | "posttest"
export type ExamMode = "external" | "internal"
export type ExamQuestionType = "multiple_choice" | "identification" | "solving"

export type ExamChoiceOption = {
  key: "A" | "B" | "C" | "D"
  text: string
}

export type ExamQuestionDraft = {
  /** Client-only id until saved */
  clientId: string
  id?: string
  question_type: ExamQuestionType
  question_text: string
  options: ExamChoiceOption[]
  /** MC: letter(s); identification/solving: accepted answer strings */
  answers: string[]
  points: number
}

export type ExamRecord = {
  id: string
  schedule_id: string
  course_id: string | null
  kind: ExamKind
  mode: ExamMode
  title: string | null
  external_url: string | null
  is_published: boolean
}

export const EXAM_TEMPLATE_HEADERS = ["Type", "Question", "A", "B", "C", "D", "Answer"] as const

export const EXAM_TYPE_LABELS: Record<ExamQuestionType, string> = {
  multiple_choice: "Multiple choice",
  identification: "Identification",
  solving: "Solving",
}

export function newClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyMcOptions(): ExamChoiceOption[] {
  return [
    { key: "A", text: "" },
    { key: "B", text: "" },
    { key: "C", text: "" },
    { key: "D", text: "" },
  ]
}

export function createBlankQuestion(type: ExamQuestionType = "multiple_choice"): ExamQuestionDraft {
  return {
    clientId: newClientId(),
    question_type: type,
    question_text: "",
    options: type === "multiple_choice" ? emptyMcOptions() : [],
    answers: type === "multiple_choice" ? ["A"] : [],
    points: 1,
  }
}

export function normalizeQuestionType(raw: string): ExamQuestionType | null {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (v === "multiple_choice" || v === "multiplechoice" || v === "mc" || v === "mcq") {
    return "multiple_choice"
  }
  if (v === "identification" || v === "identify" || v === "id") return "identification"
  if (v === "solving" || v === "solve" || v === "computation" || v === "problem") return "solving"
  return null
}

export function parseAnswerCell(raw: string, type: ExamQuestionType): string[] {
  const parts = String(raw || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
  if (type === "multiple_choice") {
    return parts
      .map((p) => p.toUpperCase().replace(/[^A-D]/g, ""))
      .filter((p) => p === "A" || p === "B" || p === "C" || p === "D")
      .slice(0, 1)
  }
  return parts
}

export function answersToCell(answers: string[]): string {
  return answers.map((a) => a.trim()).filter(Boolean).join(" | ")
}

export function downloadExamExcelTemplate() {
  const rows = [
    [...EXAM_TEMPLATE_HEADERS],
    [
      "multiple_choice",
      "What is the capital of the Philippines?",
      "Cebu",
      "Manila",
      "Davao",
      "Quezon City",
      "B",
    ],
    ["identification", "Who wrote Noli Me Tangere?", "", "", "", "", "Jose Rizal|Dr. Jose Rizal"],
    ["solving", "Solve for x: 2x + 4 = 10", "", "", "", "", "3 | three | Three"],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Exam Questions")
  XLSX.writeFile(wb, "tms-exam-questions-template.xlsx")
}

function headerIndex(headers: string[], aliases: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  for (const alias of aliases) {
    const i = normalized.indexOf(alias.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

export function parseExamExcelFile(file: ArrayBuffer): {
  questions: ExamQuestionDraft[]
  errors: string[]
} {
  const wb = XLSX.read(file, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { questions: [], errors: ["Workbook has no sheets"] }
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  })
  if (!rows.length) return { questions: [], errors: ["No data rows found"] }

  // Also support positional headers if keys are missing
  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as (string | number)[][]
  const headerRow = (aoa[0] || []).map((c) => String(c ?? ""))
  const typeIdx = headerIndex(headerRow, ["type", "question_type", "question type"])
  const qIdx = headerIndex(headerRow, ["question", "question_text", "question text"])
  const aIdx = headerIndex(headerRow, ["a"])
  const bIdx = headerIndex(headerRow, ["b"])
  const cIdx = headerIndex(headerRow, ["c"])
  const dIdx = headerIndex(headerRow, ["d"])
  const ansIdx = headerIndex(headerRow, ["answer", "answers", "correct", "correct answer"])

  const questions: ExamQuestionDraft[] = []
  const errors: string[] = []

  const usePositional = typeIdx >= 0 && qIdx >= 0 && ansIdx >= 0

  const dataRows = usePositional ? aoa.slice(1) : null

  if (dataRows) {
    dataRows.forEach((row, i) => {
      const rowNum = i + 2
      const typeRaw = String(row[typeIdx] ?? "").trim()
      const question = String(row[qIdx] ?? "").trim()
      if (!typeRaw && !question) return
      const type = normalizeQuestionType(typeRaw)
      if (!type) {
        errors.push(`Row ${rowNum}: unknown Type "${typeRaw}"`)
        return
      }
      if (!question) {
        errors.push(`Row ${rowNum}: Question is required`)
        return
      }
      const answerRaw = String(row[ansIdx] ?? "")
      const answers = parseAnswerCell(answerRaw, type)
      if (!answers.length) {
        errors.push(`Row ${rowNum}: Answer is required`)
        return
      }
      const options =
        type === "multiple_choice"
          ? ([
              { key: "A" as const, text: String(row[aIdx] ?? "").trim() },
              { key: "B" as const, text: String(row[bIdx] ?? "").trim() },
              { key: "C" as const, text: String(row[cIdx] ?? "").trim() },
              { key: "D" as const, text: String(row[dIdx] ?? "").trim() },
            ] as ExamChoiceOption[])
          : []
      if (type === "multiple_choice" && options.every((o) => !o.text)) {
        errors.push(`Row ${rowNum}: multiple_choice needs at least one choice in A–D`)
        return
      }
      questions.push({
        clientId: newClientId(),
        question_type: type,
        question_text: question,
        options,
        answers,
        points: 1,
      })
    })
  } else {
    rows.forEach((row, i) => {
      const rowNum = i + 2
      const typeRaw = String(row.Type ?? row.type ?? row.question_type ?? "").trim()
      const question = String(row.Question ?? row.question ?? "").trim()
      if (!typeRaw && !question) return
      const type = normalizeQuestionType(typeRaw)
      if (!type) {
        errors.push(`Row ${rowNum}: unknown Type "${typeRaw}"`)
        return
      }
      if (!question) {
        errors.push(`Row ${rowNum}: Question is required`)
        return
      }
      const answerRaw = String(row.Answer ?? row.answer ?? "")
      const answers = parseAnswerCell(answerRaw, type)
      if (!answers.length) {
        errors.push(`Row ${rowNum}: Answer is required`)
        return
      }
      const options =
        type === "multiple_choice"
          ? emptyMcOptions().map((o) => ({
              ...o,
              text: String(row[o.key] ?? row[o.key.toLowerCase()] ?? "").trim(),
            }))
          : []
      questions.push({
        clientId: newClientId(),
        question_type: type,
        question_text: question,
        options,
        answers,
        points: 1,
      })
    })
  }

  return { questions, errors }
}

export function exportQuestionsToExcel(questions: ExamQuestionDraft[], filename: string) {
  const rows: string[][] = [[...EXAM_TEMPLATE_HEADERS]]
  for (const q of questions) {
    const opt = Object.fromEntries(q.options.map((o) => [o.key, o.text])) as Record<string, string>
    rows.push([
      q.question_type,
      q.question_text,
      opt.A || "",
      opt.B || "",
      opt.C || "",
      opt.D || "",
      answersToCell(q.answers),
    ])
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Exam Questions")
  XLSX.writeFile(wb, filename)
}

export function normalizeTextAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function gradeAnswer(question: ExamQuestionDraft, raw: string): boolean {
  const given = String(raw || "").trim()
  if (!given) return false
  if (question.question_type === "multiple_choice") {
    const letter = given.toUpperCase().replace(/[^A-D]/g, "")
    return question.answers.map((a) => a.toUpperCase()).includes(letter)
  }
  const normalized = normalizeTextAnswer(given)
  return question.answers.some((a) => normalizeTextAnswer(a) === normalized)
}

export function mapDbQuestion(row: {
  id: string
  question_type: string
  question_text: string
  options: unknown
  answers: unknown
  points?: number | null
  sort_order?: number | null
}): ExamQuestionDraft {
  const type = normalizeQuestionType(row.question_type) || "multiple_choice"
  const optionsRaw = Array.isArray(row.options) ? row.options : []
  const options: ExamChoiceOption[] =
    type === "multiple_choice"
      ? emptyMcOptions().map((base) => {
          const found = optionsRaw.find(
            (o) =>
              o &&
              typeof o === "object" &&
              String((o as { key?: string }).key || "").toUpperCase() === base.key
          ) as { text?: string } | undefined
          return { key: base.key, text: found?.text ? String(found.text) : "" }
        })
      : []
  const answers = Array.isArray(row.answers)
    ? row.answers.map((a) => String(a)).filter(Boolean)
    : []
  return {
    clientId: row.id,
    id: row.id,
    question_type: type,
    question_text: row.question_text || "",
    options,
    answers:
      type === "multiple_choice"
        ? answers.length
          ? [answers[0].toUpperCase().replace(/[^A-D]/g, "") || "A"]
          : ["A"]
        : answers,
    points: typeof row.points === "number" ? row.points : 1,
  }
}
