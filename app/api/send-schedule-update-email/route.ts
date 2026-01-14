// app/api/send-schedule-update-email/route.ts
import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const { trainees, courseName, dateText, branch, eventType } = await req.json()

    if (!trainees || trainees.length === 0) {
      return NextResponse.json({ success: false, message: "No trainees found." }, { status: 400 })
    }

    // Setup Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    // Send email individually to each trainee
    for (const trainee of trainees) {
      const name = `${trainee.first_name} ${trainee.last_name}`

      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Training Schedule Update</h2>
          <p>Hello <strong>${name}</strong>,</p>

          <p>
            This is to inform you that your training schedule has been updated.
          </p>

          <p>
            <strong>Course:</strong> ${courseName}<br />
            <strong>New Schedule:</strong> ${dateText}<br />
            <strong>Type:</strong> ${eventType}<br />
            <strong>Branch:</strong> ${branch ? branch.toUpperCase() : "Online"}
          </p>

          <p>
            If you have any questions, feel free to email us training@petrosphere.com.ph
          </p>

          <p>Thank you,<br />Training Support Team</p>
        </div>
      `

      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
        to: trainee.email,
        //cc: "sales@petrosphere.com.ph, training@petrosphere.com.ph",
        cc: "jlb@petrosphere.com.ph",
        subject: `📅 Updated Training Schedule – ${courseName}`,
        html: htmlMessage,
      })
    }

    return NextResponse.json({
      success: true,
      sent: trainees.length,
      message: "Emails sent successfully.",
    })
  } catch (err) {
    console.error("Schedule email error:", err)
    return NextResponse.json(
      { success: false, error: "Email sending failed." },
      { status: 500 }
    )
  }
}