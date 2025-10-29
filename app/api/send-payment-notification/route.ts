import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      traineeEmail,
      traineeName,
      amount,
      sendConfirmation,
      sendClassroom,
      classroomUrl,
    } = await req.json();

    const results = {
      confirmationSent: false,
      classroomSent: false,
      errors: [] as string[],
    };

    // Send confirmation email
    if (sendConfirmation) {
      try {
        const confirmationHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
              }
              .header {
                background-color: #4F46E5;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: white;
                padding: 30px;
                border-radius: 0 0 5px 5px;
              }
              .amount {
                font-size: 24px;
                font-weight: bold;
                color: #4F46E5;
                text-align: center;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Payment Confirmation</h1>
              </div>
              <div class="content">
                <p>Dear ${traineeName},</p>
                <p>We are pleased to confirm that we have received your payment.</p>
                <div class="amount">₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <p>Your payment has been successfully processed and recorded in our system.</p>
                <p>If you have any questions or concerns regarding this payment, please don't hesitate to contact us.</p>
                <p>Thank you for choosing Petrosphere Training Center!</p>
                <p>Best regards,<br><strong>Petrosphere Training Center</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const response = await fetch(`${req.nextUrl.origin}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: traineeEmail,
            subject: "Payment Confirmation - Petrosphere Training Center",
            message: confirmationHtml,
          }),
        });

        if (response.ok) {
          results.confirmationSent = true;
        } else {
          results.errors.push("Failed to send confirmation email");
        }
      } catch (error) {
        console.error("Confirmation email error:", error);
        results.errors.push("Error sending confirmation email");
      }
    }

    // Send classroom URL email
    if (sendClassroom && classroomUrl) {
      try {
        const classroomHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
              }
              .header {
                background-color: #10B981;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: white;
                padding: 30px;
                border-radius: 0 0 5px 5px;
              }
              .button {
                display: inline-block;
                padding: 15px 30px;
                background-color: #10B981;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
              }
              .button-container {
                text-align: center;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Online Classroom Access</h1>
              </div>
              <div class="content">
                <p>Dear ${traineeName},</p>
                <p>Welcome to your online training classroom! Your payment has been confirmed, and you now have access to your course materials.</p>
                <p>Click the button below to access your online classroom:</p>
                <div class="button-container">
                  <a href="${classroomUrl}" class="button">Access Classroom</a>
                </div>
                <p>Alternatively, you can copy and paste this link into your browser:</p>
                <p style="background-color: #f3f4f6; padding: 10px; border-radius: 5px; word-break: break-all;">
                  ${classroomUrl}
                </p>
                <p><strong>Important Notes:</strong></p>
                <ul>
                  <li>Keep this link secure and do not share it with others</li>
                  <li>Make sure you have a stable internet connection</li>
                  <li>Use the latest version of your web browser for the best experience</li>
                </ul>
                <p>If you have any technical difficulties accessing the classroom, please contact our support team.</p>
                <p>Best regards,<br><strong>Petrosphere Training Center</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const response = await fetch(`${req.nextUrl.origin}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: traineeEmail,
            subject: "Online Classroom Access - Petrosphere Training Center",
            message: classroomHtml,
          }),
        });

        if (response.ok) {
          results.classroomSent = true;
        } else {
          results.errors.push("Failed to send classroom URL email");
        }
      } catch (error) {
        console.error("Classroom email error:", error);
        results.errors.push("Error sending classroom URL email");
      }
    }

    // Return results
    if (results.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          ...results,
          message: "Some emails failed to send",
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json(
      {
        success: true,
        ...results,
        message: "All emails sent successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Payment notification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to send payment notifications",
      },
      { status: 500 }
    );
  }
}