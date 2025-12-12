// app/api/send-receipt-confirmation/route.ts
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { to, name, referenceNumber } = await req.json();

    // Validate required fields
    if (!to || !name || !referenceNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt Received</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 2rem; text-align: center;">
            <img src="https://petrosphere.com.ph/trans-logo-dark.png" alt="Petrosphere" style="max-width: 200px; height: auto; margin-bottom: 1rem;">
            <h1 style="color: #ffffff; margin: 0; font-size: 1.5rem;">Receipt Received!</h1>
            <p style="color: #cbd5e1; margin: 0.5rem 0 0 0;">Thank you for submitting your payment proof</p>
          </div>

          <!-- Content -->
          <div style="padding: 2rem;">
            <!-- Success Message -->
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.5rem;">
              <p style="margin: 0; color: #065f46; font-weight: 600;">✓ Your receipt has been successfully uploaded!</p>
            </div>

            <!-- Greeting -->
            <p style="color: #374151; line-height: 1.6;">Dear ${name},</p>
            <p style="color: #374151; line-height: 1.6;">
              We have received your payment receipt for booking reference <strong>${referenceNumber}</strong>.
            </p>

            <!-- Reference Number Box -->
            <div style="background-color: #fef3c7; border: 2px dashed #f59e0b; padding: 1rem; margin: 1.5rem 0; text-align: center; border-radius: 0.5rem;">
              <p style="margin: 0 0 0.5rem 0; color: #92400e; font-size: 0.875rem; font-weight: 600;">YOUR BOOKING REFERENCE</p>
              <p style="margin: 0; color: #b45309; font-size: 1.5rem; font-weight: bold; letter-spacing: 0.05em;">${referenceNumber}</p>
            </div>

            <!-- What Happens Next -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #1e3a8a; margin: 0 0 1rem 0; font-size: 1.125rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">What Happens Next?</h2>
              <ol style="margin: 0; padding-left: 1.25rem; color: #374151; line-height: 1.8;">
                <li>Our team will review and verify your payment receipt</li>
                <li>Verification typically takes 1-2 business days</li>
                <li>You will receive a confirmation email once your payment is approved</li>
                <li>If there are any issues with your receipt, we will contact you</li>
              </ol>
            </div>

            <!-- Important Notes -->
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.5rem;">
              <h3 style="color: #1e3a8a; margin: 0 0 0.75rem 0; font-size: 1rem;">📋 Important Notes:</h3>
              <ul style="margin: 0; padding-left: 1.25rem; color: #374151; line-height: 1.6;">
                <li>Keep your booking reference <strong>${referenceNumber}</strong> for tracking</li>
                <li>Check your email regularly for payment confirmation</li>
                <li>Contact us if you don't receive confirmation within 2 business days</li>
              </ul>
            </div>

            <!-- Contact Information -->
            <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
              <h3 style="color: #111827; margin: 0 0 0.75rem 0; font-size: 1rem;">📞 Need Help?</h3>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Phone:</strong> Globe/TM 0917-708-7994
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Email:</strong> info@petrosphere.com.ph
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Office Hours:</strong> Monday - Friday, 8:00 AM - 5:00 PM
              </p>
            </div>

            <!-- Check Status CTA -->
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/upload-receipt" 
                 style="display: inline-block; padding: 0.75rem 2rem; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600;">
                Check Your Booking Status
              </a>
            </div>

            <!-- Closing -->
            <p style="color: #374151; line-height: 1.6;">
              Thank you for choosing Petrosphere for your training needs. We look forward to seeing you!
            </p>
            <p style="color: #374151; line-height: 1.6; margin-bottom: 0;">
              Best regards,<br>
              <strong>Petrosphere Training Team</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 1.5rem; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">
              This is an automated message. Please do not reply to this email.
            </p>
            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.75rem;">
              © ${new Date().getFullYear()} Petrosphere Inc. All rights reserved.
            </p>
            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.75rem;">
              Unit 305 3F, Trigold Business Park, Barangay San Pedro National Highway,<br>
              Puerto Princesa City, 5300 Palawan, Philippines
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Petrosphere Training'}" <${process.env.SMTP_USER}>`,
      to,
      subject: `Receipt Received - ${referenceNumber}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true,
      message: "Receipt confirmation email sent successfully" 
    });

  } catch (error: unknown) {
    console.error("Receipt confirmation email error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}