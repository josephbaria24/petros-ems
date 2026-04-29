//app/api/send-email/route.ts
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { to, subject, message, attachments } = await req.json();

  if (!to || typeof to !== "string") {
    return NextResponse.json(
      { success: false, error: "Missing or invalid 'to' recipient" },
      { status: 400 }
    );
  }

  if (!subject || typeof subject !== "string") {
    return NextResponse.json(
      { success: false, error: "Missing or invalid 'subject'" },
      { status: 400 }
    );
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT);
  const smtpUser = process.env.SMTP_USER;

  if (!smtpHost || !Number.isFinite(smtpPort) || !smtpUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing SMTP configuration (SMTP_HOST/SMTP_PORT/SMTP_USER).",
      },
      { status: 500 }
    );
  }

  // If port is 465, SMTP over implicit TLS is typical.
  // If your provider uses STARTTLS on 587/25, secure should be false.
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : smtpPort === 465;

  const isValidEmail = (email: string) => {
    // Lightweight validation; avoids rejecting legitimate but exotic addresses.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: process.env.SMTP_PASS,
    },
    // Some providers use self-signed certs; not ideal, but better diagnostics.
    tls: { rejectUnauthorized: false },
  });

  try {
    const fromName = process.env.SMTP_FROM_NAME || "Petrosphere Training";

    const smtpFromEmailRaw = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM_EMAIL_ADDRESS
    const smtpFromEmail =
      typeof smtpFromEmailRaw === "string" && smtpFromEmailRaw.trim()
        ? smtpFromEmailRaw.trim().replace(/[<>]/g, "")
        : smtpUser

    if (!isValidEmail(String(smtpFromEmail))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid SMTP sender email. Set SMTP_FROM_EMAIL to a valid email address authorized in your SMTP provider.",
          debug: {
            smtpFromEmail,
          },
        },
        { status: 500 }
      )
    }

    const from = `"${fromName}" <${smtpFromEmail}>`;

    const estimatedAttachmentBytes = Array.isArray(attachments)
      ? attachments.reduce((sum, a: any) => {
          const content = a?.content;
          // For base64 strings: bytes ~= len * 3 / 4 (rough estimate)
          if (typeof content === "string") return sum + Math.floor((content.length * 3) / 4);
          return sum;
        }, 0)
      : 0;

    console.log("📨 /api/send-email attempt", {
      to,
      subject,
      from,
      smtpHost,
      smtpPort,
      secure,
      attachmentsCount: Array.isArray(attachments) ? attachments.length : 0,
      estimatedAttachmentBytes,
      messageLength: typeof message === "string" ? message.length : null,
    });

    const mailOptions: any = {
      from,
      to,
     //cc: "sales@petrosphere.com.ph, training@petrosphere.com.ph",
      //cc: "jlb@petrosphere.com.ph",
      subject,
      html: message,
    };

    // ✅ Add attachments if provided (backward compatible - optional)
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments.map((attachment: any) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: attachment.encoding || "base64",
      }));
    }

    // Validate SMTP connectivity/auth first for better diagnostics.
    await transporter.verify();

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    console.error("Email send error:", {
      to,
      subject,
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM_EMAIL_ADDRESS || process.env.SMTP_USER,
      attachmentsCount: Array.isArray(attachments) ? attachments.length : 0,
      code: error?.code,
      responseCode: error?.responseCode,
      response: error?.response,
      command: error?.command,
      message: errorMessage,
      name: error?.name,
    })

    // Diagnostic fallback: if message fails during DATA and has attachments,
    // try sending once without attachments to determine if payload size/content is the issue.
    if (
      Array.isArray(attachments) &&
      attachments.length > 0 &&
      error?.command === "DATA"
    ) {
      try {
        const fallbackMailOptions = {
          from: `"${process.env.SMTP_FROM_NAME || "Petrosphere Training"}" <${
            process.env.SMTP_FROM_EMAIL ||
            process.env.SMTP_FROM_EMAIL_ADDRESS ||
            process.env.SMTP_USER
          }>`,
          to,
          subject: `[NO ATTACHMENT TEST] ${subject}`,
          html: message,
        };

        await transporter.sendMail(fallbackMailOptions);
        console.error("SMTP diagnostic: send succeeded without attachments.");

        return NextResponse.json(
          {
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
          },
          { status: 500 }
        );
      } catch (fallbackError: any) {
        console.error("SMTP diagnostic: send without attachments also failed.", {
          code: fallbackError?.code,
          responseCode: fallbackError?.responseCode,
          response: fallbackError?.response,
          command: fallbackError?.command,
          message: fallbackError?.message,
        });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: {
          code: error?.code,
          responseCode: error?.responseCode,
          response: error?.response,
          command: error?.command,
        },
      },
      { status: 500 }
    );
  }
}