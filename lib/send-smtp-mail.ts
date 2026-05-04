import nodemailer from "nodemailer"

export type SmtpAttachment = {
  filename: string
  content: string
  encoding?: string
}

export type SendSmtpMailInput = {
  to: string
  subject: string
  message: string
  attachments?: SmtpAttachment[]
}

export type SendSmtpMailResult =
  | { success: true }
  | { success: false; error: string; details?: Record<string, unknown> }

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Picks the mailbox address used in the From header. Supports:
 * - bare email, `Name <email@domain.com>`, accidental brackets stripped wrong.
 * Does NOT treat SMTP auth usernames like `apikey` as email (those need SMTP_FROM_EMAIL).
 */
function extractEnvelopeEmail(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const t = raw.trim()
  const angle = t.match(/<([^>]+@[^>]+)>/)
  if (angle?.[1] && isValidEmail(angle[1])) return angle[1].trim()
  const stripped = t.replace(/[<>]/g, "").trim()
  if (isValidEmail(stripped)) return stripped
  const loose = t.match(/([^\s<>,]+@[^\s<>,]+\.[^\s<>,]+)/)
  if (loose?.[1] && isValidEmail(loose[1])) return loose[1].trim()
  return null
}

function resolveEnvelopeFromEmail(): { email: string } | { error: string; details?: Record<string, unknown> } {
  const candidates = [
    process.env.SMTP_FROM_EMAIL,
    process.env.SMTP_FROM_EMAIL_ADDRESS,
    process.env.SMTP_FROM,
    process.env.MAIL_FROM,
  ]
  for (const c of candidates) {
    const e = extractEnvelopeEmail(c)
    if (e) return { email: e }
  }
  const fromUser = extractEnvelopeEmail(process.env.SMTP_USER)
  if (fromUser) return { email: fromUser }

  const userPreview = process.env.SMTP_USER?.includes("@")
    ? process.env.SMTP_USER
    : "(not an email — likely an API key or login id)"

  return {
    error:
      "Invalid SMTP sender email. Set SMTP_FROM_EMAIL (or SMTP_FROM / MAIL_FROM) to a verified sender address. " +
      "On hosted SMTP, SMTP_USER is often not an email (e.g. SendGrid uses `apikey`); the From address must still be a real mailbox your provider allows.",
    details: { smtpUserHint: userPreview },
  }
}

/**
 * Sends mail via configured SMTP. Used by /api/send-email and in-process by
 * /api/send-certificates so large PDF attachments are not re-POSTed as JSON
 * (Vercel serverless request body limit ~4.5MB).
 */
export async function sendSmtpMail(input: SendSmtpMailInput): Promise<SendSmtpMailResult> {
  const { to, subject, message, attachments } = input

  if (!to || typeof to !== "string") {
    return { success: false, error: "Missing or invalid 'to' recipient" }
  }
  if (!subject || typeof subject !== "string") {
    return { success: false, error: "Missing or invalid 'subject'" }
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT)
  const smtpUser = process.env.SMTP_USER

  if (!smtpHost || !Number.isFinite(smtpPort) || !smtpUser) {
    return {
      success: false,
      error: "Missing SMTP configuration (SMTP_HOST/SMTP_PORT/SMTP_USER).",
    }
  }

  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : smtpPort === 465

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  })

  const fromName = process.env.SMTP_FROM_NAME || "Petrosphere Training"
  const resolved = resolveEnvelopeFromEmail()
  if ("error" in resolved) {
    return { success: false, error: resolved.error, details: resolved.details }
  }
  const smtpFromEmail = resolved.email

  const from = `"${fromName}" <${smtpFromEmail}>`

  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to,
    subject,
    html: message,
  }

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: (a.encoding || "base64") as string,
    }))
  }

  try {
    await transporter.verify()
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (
      Array.isArray(attachments) &&
      attachments.length > 0 &&
      error?.command === "DATA"
    ) {
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${smtpFromEmail}>`,
          to,
          subject: `[NO ATTACHMENT TEST] ${subject}`,
          html: message,
        })
        return {
          success: false,
          error:
            "SMTP rejected the message payload with attachments. Retry with smaller/fewer attachments or verify provider limits/policies.",
          details: {
            code: error?.code,
            responseCode: error?.responseCode,
            response: error?.response,
            command: error?.command,
            diagnostic: "no-attachment-send-succeeded",
          },
        }
      } catch {
        // fall through
      }
    }

    return {
      success: false,
      error: errorMessage,
      details: {
        code: error?.code,
        responseCode: error?.responseCode,
        response: error?.response,
        command: error?.command,
      },
    }
  }
}
