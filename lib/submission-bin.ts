export type SubmissionBinKind = "reentry_plan" | "other"

export type SubmissionBinItem = {
  id: string
  schedule_id: string
  training_id: string | null
  kind: SubmissionBinKind
  title: string | null
  respondent_name: string | null
  respondent_email: string | null
  file_url: string
  file_name: string | null
  file_type: string | null
  created_at: string
}

export function missingSubmissionBinSchema(message: string) {
  return /relation|does not exist|schema cache|Could not find.*submission_bin/i.test(message)
}

export function submissionBinKindLabel(kind: string | null | undefined) {
  return kind === "other" ? "Other" : "Re-entry plan"
}

export function buildGuestSubmissionBinUrl(origin: string, scheduleId: string) {
  const params = new URLSearchParams({ schedule_id: scheduleId })
  return `${origin}/guest-submission-bin?${params.toString()}`
}
