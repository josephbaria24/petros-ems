import nodemailer from "nodemailer"

export const STAFF_UPLOAD_RECIPIENTS = [
  "sales@petrosphere.com.ph",
  "training@petrosphere.com.ph",
] as const

export type StaffUploadSource = "registration" | "receipt_upload" | "email_upload_bin"

export type StaffUploadFile = {
  label: string
  url: string
}

export type NotifyStaffFileUploadParams = {
  source: StaffUploadSource
  traineeName: string
  bookingReference: string
  courseName?: string
  files: StaffUploadFile[]
  extraNotes?: string
}

const SOURCE_LABELS: Record<StaffUploadSource, string> = {
  registration: "Guest Registration",
  receipt_upload: "Payment Receipt Upload",
  email_upload_bin: "Email Upload Page",
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  })
}

function resolveFromAddress() {
  const fromName = process.env.SMTP_FROM_NAME || "Petrosphere Training"
  const fromEmail =
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER
  return `"${fromName}" <${fromEmail}>`
}

/**
 * Emails sales and training when a participant uploads file(s).
 * Failures are logged; callers should not block the upload on email errors.
 */
export async function notifyStaffFileUpload(
  params: NotifyStaffFileUploadParams
): Promise<{ ok: boolean; error?: string }> {
  const files = params.files.filter((f) => f.url?.trim())
  if (files.length === 0) {
    return { ok: true }
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("notifyStaffFileUpload: SMTP not configured, skipping")
    return { ok: false, error: "SMTP not configured" }
  }

  const sourceLabel = SOURCE_LABELS[params.source]
  const ref = params.bookingReference.trim().toUpperCase()
  const subject = `[${sourceLabel}] File upload — ${ref}`

  const filesHtml = files
    .map(
      (f) =>
        `<li style="margin-bottom:8px;"><strong>${escapeHtml(f.label)}:</strong> <a href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer">View file</a></li>`
    )
    .join("")

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;margin:0;padding:0;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e3a8a;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">New participant file upload</h1>
      <p style="margin:8px 0 0 0;font-size:13px;opacity:0.9;">${escapeHtml(sourceLabel)}</p>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Booking ref</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(ref)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Trainee</td><td style="padding:6px 0;">${escapeHtml(params.traineeName)}</td></tr>
        ${params.courseName ? `<tr><td style="padding:6px 0;color:#6b7280;">Course</td><td style="padding:6px 0;">${escapeHtml(params.courseName)}</td></tr>` : ""}
      </table>
      <p style="font-weight:600;margin:0 0 8px 0;">Uploaded file(s)</p>
      <ul style="margin:0;padding-left:20px;">${filesHtml}</ul>
      ${params.extraNotes ? `<p style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:6px;font-size:14px;color:#92400e;">${escapeHtml(params.extraNotes)}</p>` : ""}
      <p style="margin-top:20px;font-size:12px;color:#6b7280;">This is an automated notification from Petrosphere TMS.</p>
    </div>
  </div>
</body>
</html>`

  try {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: resolveFromAddress(),
      to: STAFF_UPLOAD_RECIPIENTS.join(", "),
      subject,
      html,
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("notifyStaffFileUpload failed:", message)
    return { ok: false, error: message }
  }
}
