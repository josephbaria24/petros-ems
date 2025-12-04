// app/api/send-booking-summary/route.ts
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const {
      to,
      bookingReference,
      courseName,
      scheduleRange,
      traineeInfo,
      employmentInfo,
      paymentInfo,
    } = await req.json();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Generate payment instructions based on method
    let paymentInstructions = "";
    if (paymentInfo.paymentMethod === "BPI") {
      paymentInstructions = `
        <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
          <p style="font-weight: 600; color: #111827; margin-bottom: 0.5rem;">BPI Bank Deposit/Transfer Instructions:</p>
          <p style="margin: 0.25rem 0;">Make your payment via deposit at any nearest BPI branches or via bank transfer with the following details:</p>
          <div style="margin-top: 0.75rem; padding: 0.75rem; background-color: white; border-radius: 0.375rem; border: 1px solid #e5e7eb;">
            <p style="margin: 0.25rem 0;"><strong>Account Name:</strong> PETROSPHERE INCORPORATED</p>
            <p style="margin: 0.25rem 0;"><strong>Account Number:</strong> 3481 0038 99</p>
          </div>
        </div>
      `;
    } else if (paymentInfo.paymentMethod === "GCASH") {
      paymentInstructions = `
        <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
          <p style="font-weight: 600; color: #111827; margin-bottom: 0.5rem;">GCash Payment Instructions:</p>
          <ol style="margin-left: 1.25rem; margin-top: 0.5rem;">
            <li>Login in your GCash App and tap Bank Transfer.</li>
            <li>Select BPI from the list of banks.</li>
            <li>Enter the corresponding training fee and the following details:</li>
            <div style="margin: 0.75rem 0; padding: 0.75rem; background-color: white; border-radius: 0.375rem; border: 1px solid #e5e7eb;">
              <p style="margin: 0.25rem 0;"><strong>Account Name:</strong> PETROSPHERE INCORPORATED</p>
              <p style="margin: 0.25rem 0;"><strong>Account Number:</strong> 3481 0038 99</p>
            </div>
            <li>Tap send money, review the details, then tap confirm to complete your transaction.</li>
            <li>Download receipt and keep it for your records.</li>
          </ol>
          <p style="margin-top: 0.75rem; font-size: 0.875rem; color: #4b5563;">If you have questions, feel free to contact us at 0917 708 7994.</p>
        </div>
      `;
    } else if (paymentInfo.paymentMethod === "COUNTER") {
      paymentInstructions = `
        <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
          <p style="font-weight: 600; color: #111827; margin-bottom: 0.5rem;">Pay Over the Counter:</p>
          <p style="margin: 0.25rem 0;">To process your payment, drop by the office at:</p>
          <div style="margin-top: 0.75rem; padding: 0.75rem; background-color: white; border-radius: 0.375rem; border: 1px solid #e5e7eb;">
            <p style="margin: 0.25rem 0;">Unit 305 3F, Trigold Business Park,</p>
            <p style="margin: 0.25rem 0;">Barangay San Pedro National Highway,</p>
            <p style="margin: 0.25rem 0;">Puerto Princesa City, 5300 Palawan, Philippines</p>
          </div>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Training Registration Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 2rem; text-align: center;">
            <img src="https://petrosphere.com.ph/trans-logo-dark.png" alt="Petrosphere" style="max-width: 200px; height: auto; margin-bottom: 1rem;">
            <h1 style="color: #ffffff; margin: 0; font-size: 1.5rem;">Registration Confirmed!</h1>
            <p style="color: #cbd5e1; margin: 0.5rem 0 0 0;">Thank you for registering with us</p>
          </div>

          <!-- Content -->
          <div style="padding: 2rem;">
            <!-- Success Message -->
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.5rem;">
              <p style="margin: 0; color: #065f46; font-weight: 600;">Your training registration has been successfully submitted!</p>
            </div>

            <!-- Greeting -->
            <p style="color: #374151; line-height: 1.6;">Dear ${traineeInfo.name},</p>
            <p style="color: #374151; line-height: 1.6;">
              We are pleased to confirm your registration for the training program. Please keep this email for your records.
            </p>

            <!-- Booking Reference -->
            <div style="background-color: #fef3c7; border: 2px dashed #f59e0b; padding: 1rem; margin: 1.5rem 0; text-align: center; border-radius: 0.5rem;">
              <p style="margin: 0 0 0.5rem 0; color: #92400e; font-size: 0.875rem; font-weight: 600;">BOOKING REFERENCE</p>
              <p style="margin: 0; color: #b45309; font-size: 1.75rem; font-weight: bold; letter-spacing: 0.05em;">${bookingReference}</p>
              <p style="margin: 0.5rem 0 0 0; color: #92400e; font-size: 0.75rem;">Please save this reference number for future inquiries</p>
            </div>

            <!-- Training Details -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #1e3a8a; margin: 0 0 1rem 0; font-size: 1.125rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">Training Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600; width: 35%;">Course:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${courseName}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Schedule:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${scheduleRange}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Booking Date:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${new Date().toLocaleDateString()}</td>
                </tr>
              </table>
            </div>

            <!-- Attendee Details -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #1e3a8a; margin: 0 0 1rem 0; font-size: 1.125rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">Attendee Information</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600; width: 35%;">Name:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.name}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Email:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.email}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Phone:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.phone}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Gender:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.gender}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Age:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.age}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Address:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.address}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Employment Status:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${traineeInfo.employmentStatus}</td>
                </tr>
              </table>
            </div>

            ${employmentInfo ? `
            <!-- Employment Details -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #1e3a8a; margin: 0 0 1rem 0; font-size: 1.125rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">Employment Information</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600; width: 35%;">Company:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${employmentInfo.companyName || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Position:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${employmentInfo.position || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Industry:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${employmentInfo.industry || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Company Email:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${employmentInfo.companyEmail || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Location:</td>
                  <td style="padding: 0.5rem 0; color: #111827;">${employmentInfo.city || 'N/A'}, ${employmentInfo.region || 'N/A'}</td>
                </tr>
              </table>
            </div>
            ` : ''}

            <!-- Payment Details -->
            <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h2 style="color: #1e3a8a; margin: 0 0 1rem 0; font-size: 1.125rem; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">Payment Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600; width: 50%;">Training Fee:</td>
                  <td style="padding: 0.5rem 0; color: #111827; text-align: right;">₱${paymentInfo.trainingFee.toLocaleString()}</td>
                </tr>
                ${paymentInfo.discount > 0 ? `
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Discount:</td>
                  <td style="padding: 0.5rem 0; color: #10b981; text-align: right;">-₱${paymentInfo.discount.toLocaleString()}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 0.75rem 0; color: #111827; font-weight: 700; font-size: 1.125rem;">Total Amount:</td>
                  <td style="padding: 0.75rem 0; color: #111827; font-weight: 700; font-size: 1.125rem; text-align: right;">₱${paymentInfo.totalAmount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Payment Method:</td>
                  <td style="padding: 0.5rem 0; color: #111827; text-align: right;">${paymentInfo.paymentMethod === 'BPI' ? 'BPI Bank Transfer' : paymentInfo.paymentMethod === 'GCASH' ? 'GCash' : 'Over the Counter'}</td>
                </tr>
                <tr>
                  <td style="padding: 0.5rem 0; color: #6b7280; font-weight: 600;">Payment Status:</td>
                  <td style="padding: 0.5rem 0; text-align: right;">
                    <span style="background-color: ${paymentInfo.paymentStatus === 'Pending' ? '#fef3c7' : '#dbeafe'}; color: ${paymentInfo.paymentStatus === 'Pending' ? '#92400e' : '#1e3a8a'}; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600;">
                      ${paymentInfo.paymentStatus}
                    </span>
                  </td>
                </tr>
              </table>

              ${paymentInstructions}
            </div>

            <!-- Next Steps -->
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.5rem;">
              <h3 style="color: #1e3a8a; margin: 0 0 0.75rem 0; font-size: 1rem;">📋 Next Steps:</h3>
              <ol style="margin: 0; padding-left: 1.25rem; color: #374151; line-height: 1.6;">
                <li>Complete your payment using the instructions above</li>
                <li>Keep your booking reference <strong>${bookingReference}</strong> for future inquiries</li>
                <li>You will receive a confirmation once your payment is verified</li>
                <li>Arrive at the venue 15 minutes before the training starts</li>
              </ol>
            </div>

            <!-- Contact Information -->
            <div style="background-color: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
              <h3 style="color: #111827; margin: 0 0 0.75rem 0; font-size: 1rem;">📞 Need Help?</h3>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Phone:</strong> (048) 433 0601
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Email:</strong> info@petrosphere.com.ph
              </p>
              <p style="margin: 0.25rem 0; color: #4b5563; font-size: 0.875rem;">
                <strong>Address:</strong> Unit 305 3F, Trigold Business Park, Barangay San Pedro National Highway, Puerto Princesa City, 5300 Palawan, Philippines
              </p>
            </div>

            <!-- Closing -->
            <p style="color: #374151; line-height: 1.6;">
              We look forward to seeing you at the training!
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
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Petrosphere Training'}" <${process.env.SMTP_USER}>`,
      to,
      subject: `Training Registration Confirmed - ${bookingReference}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Booking summary email error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}