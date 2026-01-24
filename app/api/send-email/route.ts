//app/api/send-email/route.ts
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { to, subject, message, attachments } = await req.json();

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const mailOptions: any = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
      cc: "sales@petrosphere.com.ph, training@petrosphere.com.ph",
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

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Email send error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}