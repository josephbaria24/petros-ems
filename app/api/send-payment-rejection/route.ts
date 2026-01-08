// app/api/send-payment-rejection/route.ts
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { traineeEmail, traineeName } = await req.json();

    if (!traineeEmail || !traineeName) {
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
        <title>Payment Verification Required</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 2rem; text-align: center;">
            <img src="https://petrosphere.com.ph/trans-logo-dark.png" alt="Petrosphere" style="max-width: 200px; height: auto; margin-bottom: 1rem;">
            <h1 style="color: #ffffff; margin: 0; font-size: 1.5rem;">Payment Verification Required</h1>
            <p style="color: #cbd5e1; margin: 0.5rem 0 0 0;">Action needed on your payment receipt</p>
          </div>

          <!-- Content -->
          <div style="padding: 2rem;">
            <!-- Warning Message -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.5rem;">
              <p style="margin: 0; color: #92400e; font-weight: 600;">⚠ Your receipt could not be verified</p>
            </div>

            <!-- Greeting -->
            <p style="color: #374151; line-height: 1.6;">Dear ${traineeName},</p>
            <p style="color: #374151; line-height: 1.6;">
              Thank you for submitting your payment receipt. Unfortunately, we were unable to verify your payment with the receipt you provided.
            </p>

            <!-- Common Issues -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #1e3a8a; margin: 0 0 1rem 0; font-size: 1.125rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">Common Issues</h2>
              <ul style="margin: 0; padding-left: 1.25rem; color: #374151; line-height: 1.8;">
                <li>Receipt image is blurry or unclear</li>
                <li>Important details are cut off or missing</li>
                <li>Transaction amount doesn't match the training fee</li>
                <li>Receipt is from a different transaction</li>
                <li>Date or reference number is not visible</li>
              </ul>
            </div>

            <!-- What to Do Next -->
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.5rem;">
              <h3 style="color: #1e3a8a; margin: 0 0 0.75rem 0; font-size: 1rem;">📋 What to Do Next:</h3>
              <ol style="margin: 0; padding-left: 1.25rem; color: #374151; line-height: 1.8;">
                <li>Take a clear photo of your receipt</li>
                <li>Ensure all details are visible and legible</li>
                <li>Make sure the amount, date, and reference number are clear</li>
                <li>Upload the new receipt using the link below</li>
              </ol>
            </div>

            <!-- Upload CTA -->
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/upload-receipt" 
                 style="display: inline-block; padding: 0.75rem 2rem; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600;">
                Upload New Receipt
              </a>
            </div>

            <!-- Tips for Good Receipt Photo -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h3 style="color: #1e3a8a; margin: 0 0 0.75rem 0; font-size: 1rem;">📸 Tips for a Clear Receipt Photo:</h3>
              <ul style="margin: 0; padding-left: 1.25rem; color: #4b5563; line-height: 1.6; font-size: 0.875rem;">
                <li>Use good lighting - avoid shadows</li>
                <li>Place receipt on a flat surface</li>
                <li>Take photo straight on, not at an angle</li>
                <li>Make sure entire receipt is in frame</li>
                <li>Focus should be clear and sharp</li>
                <li>Check the photo before uploading</li>
              </ul>
            </div>

            <!-- Contact Information -->
            <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
              <h3 style="color: #111827; margin: 0 0 0.75rem 0; font-size: 1rem;">📞 Need Help?</h3>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                If you're having trouble uploading your receipt, please contact us:
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Phone:</strong> Globe/TM 0917-708-7994
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Email:</strong> training-department@petrosphere.com.ph
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Office Hours:</strong> Monday - Friday, 8:00 AM - 5:00 PM
              </p>
            </div>

            <!-- Closing -->
            <p style="color: #374151; line-height: 1.6;">
              We appreciate your patience and cooperation. Once we verify your new receipt, we'll send you a confirmation email right away.
            </p>
            <p style="color: #374151; line-height: 1.6; margin-bottom: 0;">
              Best regards,<br>
              <strong>Petrosphere Incorporated</strong>
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
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Petrosphere Training'}" <${process.env.SMTP_USER}>`,
      to: traineeEmail,
      //cc: "sales@petrosphere.com.ph, training-department@petrosphere.com.ph",
      cc: "jlb@petrosphere.com.ph",
      subject: `Payment Verification Required - Please Upload Clear Receipt`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ 
      success: true,
      message: "Payment rejection email sent successfully" 
    });

  } catch (error: unknown) {
    console.error("Payment rejection email error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}