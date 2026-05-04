//app/api/send-email/route.ts
import { NextResponse } from "next/server"
import { sendSmtpMail } from "@/lib/send-smtp-mail"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: Request) {
  const { to, subject, message, attachments } = await req.json()

  const result = await sendSmtpMail({
    to,
    subject,
    message,
    attachments,
  })

  if (!result.success) {
    const clientError =
      result.error.startsWith("Missing or invalid 'to'") ||
      result.error.startsWith("Missing or invalid 'subject'")
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        ...(result.details ? { details: result.details } : {}),
      },
      { status: clientError ? 400 : 500 }
    )
  }

  return NextResponse.json({ success: true })
}
