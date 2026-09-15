export type WorkshopQuestion = {
  id: string
  prompt: string
}

export type WorkshopActivity = {
  id: string
  title: string
  instructions: string
  questions: WorkshopQuestion[]
}

export type WorkshopResponse = {
  id: string
  schedule_id: string
  training_id: string | null
  respondent_name: string | null
  respondent_email: string | null
  answers: Record<string, Record<string, string>>
  created_at: string
  updated_at?: string
}

export function newWorkshopId(prefix = "w") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createBlankQuestion(): WorkshopQuestion {
  return { id: newWorkshopId("q"), prompt: "" }
}

export function createBlankActivity(): WorkshopActivity {
  return {
    id: newWorkshopId("a"),
    title: "",
    instructions: "",
    questions: [createBlankQuestion()],
  }
}

export function parseWorkshopActivities(raw: unknown): WorkshopActivity[] {
  if (!Array.isArray(raw)) return []
  const out: WorkshopActivity[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const questions: WorkshopQuestion[] = []
    if (Array.isArray(row.questions)) {
      for (const q of row.questions) {
        if (!q || typeof q !== "object" || Array.isArray(q)) continue
        const qr = q as Record<string, unknown>
        questions.push({
          id: typeof qr.id === "string" && qr.id ? qr.id : newWorkshopId("q"),
          prompt: typeof qr.prompt === "string" ? qr.prompt : "",
        })
      }
    }
    out.push({
      id: typeof row.id === "string" && row.id ? row.id : newWorkshopId("a"),
      title: typeof row.title === "string" ? row.title : "",
      instructions: typeof row.instructions === "string" ? row.instructions : "",
      questions: questions.length > 0 ? questions : [createBlankQuestion()],
    })
  }
  return out
}

export function parseWorkshopAnswers(raw: unknown): Record<string, Record<string, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, Record<string, string>> = {}
  for (const [activityId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const fields: Record<string, string> = {}
    for (const [qid, answer] of Object.entries(value as Record<string, unknown>)) {
      if (typeof answer === "string") fields[qid] = answer
    }
    out[activityId] = fields
  }
  return out
}

export function countActivityPrompts(activities: WorkshopActivity[]) {
  return activities.reduce((n, a) => n + a.questions.filter((q) => q.prompt.trim()).length, 0)
}

export function buildGuestWorkshopUrl(origin: string, scheduleId: string) {
  const params = new URLSearchParams({ schedule_id: scheduleId })
  return `${origin}/guest-workshop?${params.toString()}`
}

export function missingWorkshopSchema(message: string) {
  return /workshop_activities|workshop_responses|schema cache|column|relation/i.test(message)
}
