// app/api/send-registration-email/route.ts

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      bookingReference,
      courseName,
      scheduleRange,
      traineeInfo,
      employmentInfo,
      paymentInfo,
    } = body

    // Configure email transporter using your SendLayer SMTP settings
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    // Email HTML content
    const emailHtml = `
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
            }
            .header {
              background-color: #1e3a8a;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 20px;
              border: 1px solid #e5e7eb;
            }
            .section {
              background-color: white;
              padding: 15px;
              margin-bottom: 15px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .section-title {
              font-weight: bold;
              color: #1e3a8a;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .info-label {
              font-weight: 600;
              color: #6b7280;
            }
            .info-value {
              color: #111827;
            }
            .highlight {
              background-color: #dbeafe;
              padding: 15px;
              border-radius: 6px;
              margin: 15px 0;
              text-align: center;
            }
            .reference {
              font-size: 24px;
              font-weight: bold;
              color: #059669;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Training Registration</h1>
              <p>Booking Reference: ${bookingReference}</p>
            </div>
            
            <div class="content">
              <div class="highlight">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Booking Reference</p>
                <div class="reference">${bookingReference}</div>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #9ca3af;">
                  Registration Date: ${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>

              <div class="section">
                <div class="section-title">Training Details</div>
                <div class="info-row">
                  <span class="info-label">Course:</span>
                  <span class="info-value">${courseName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Schedule:</span>
                  <span class="info-value">${scheduleRange}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Trainee Information</div>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${traineeInfo.name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${traineeInfo.email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Phone:</span>
                  <span class="info-value">${traineeInfo.phone}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Gender:</span>
                  <span class="info-value">${traineeInfo.gender}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Age:</span>
                  <span class="info-value">${traineeInfo.age}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Address:</span>
                  <span class="info-value">${traineeInfo.address}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Employment Status:</span>
                  <span class="info-value">${traineeInfo.employmentStatus}</span>
                </div>
              </div>

              ${employmentInfo ? `
                <div class="section">
                  <div class="section-title">Employment Details</div>
                  <div class="info-row">
                    <span class="info-label">Company:</span>
                    <span class="info-value">${employmentInfo.companyName || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Position:</span>
                    <span class="info-value">${employmentInfo.position || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Industry:</span>
                    <span class="info-value">${employmentInfo.industry || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Company Email:</span>
                    <span class="info-value">${employmentInfo.companyEmail || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Location:</span>
                    <span class="info-value">${employmentInfo.city || 'N/A'}, ${employmentInfo.region || 'N/A'}</span>
                  </div>
                </div>
              ` : ''}

              <div class="section">
                <div class="section-title">Payment Information</div>
                <div class="info-row">
                  <span class="info-label">Training Fee:</span>
                  <span class="info-value">₱${paymentInfo.trainingFee.toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Discount:</span>
                  <span class="info-value">-₱${paymentInfo.discount.toLocaleString()}</span>
                </div>
                <div class="info-row" style="border-bottom: none; margin-top: 10px; padding-top: 10px; border-top: 2px solid #e5e7eb;">
                  <span class="info-label" style="font-size: 16px;">Total Amount:</span>
                  <span class="info-value" style="font-size: 18px; font-weight: bold; color: #059669;">₱${paymentInfo.totalAmount.toLocaleString()}</span>
                </div>
                <div class="info-row" style="border-bottom: none;">
                  <span class="info-label">Payment Method:</span>
                  <span class="info-value">${paymentInfo.paymentMethod}</span>
                </div>
                <div class="info-row" style="border-bottom: none;">
                  <span class="info-label">Payment Status:</span>
                  <span class="info-value">${paymentInfo.paymentStatus}</span>
                </div>
              </div>

              <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin-top: 20px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Action Required:</strong> Please review this registration in the admin panel and verify the payment receipt when submitted.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email
      const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: 'training-department@petrosphere.com.ph',
      cc: "sales@petrosphere.com.ph", // ✅ Added CC
      subject: `New Training Registration - ${bookingReference}`,
      html: emailHtml,
    }

    await transporter.sendMail(mailOptions)

    return NextResponse.json({ success: true, message: 'Email sent successfully' })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    )
  }
}