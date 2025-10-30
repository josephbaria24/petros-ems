import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ Force Node.js runtime so modules like 'fs', 'canvas', and 'pdf-lib' work properly
export const runtime = "nodejs";

// ✅ Optional: Disable caching for stability
export const dynamic = "force-dynamic";

// ✅ Initialize Supabase with required env vars
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("📨 /api/send-certificates endpoint hit");

  try {
    const { scheduleId } = await req.json();
    console.log("✅ Received scheduleId:", scheduleId);

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    // 🧩 1. Fetch schedule and course info
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedules")
      .select("id, course_id, schedule_type")
      .eq("id", scheduleId)
      .single();

    if (scheduleError || !scheduleData) {
      console.error("❌ Schedule fetch failed:", scheduleError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch schedule information" },
        { status: 404 }
      );
    }

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, name")
      .eq("id", scheduleData.course_id)
      .single();

    if (courseError || !courseData) {
      console.error("❌ Course fetch failed:", courseError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch course information" },
        { status: 404 }
      );
    }

    // 🗓️ 2. Build schedule date range
    let scheduleRange = "";
    let givenThisDate = "";
    const today = new Date();
    givenThisDate = today.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    if (scheduleData.schedule_type === "regular") {
      const { data: rangeData } = await supabase
        .from("schedule_ranges")
        .select("start_date, end_date")
        .eq("schedule_id", scheduleId)
        .single();

      if (rangeData) {
        const start = new Date(rangeData.start_date);
        const end = new Date(rangeData.end_date);
        const daysDiff =
          Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 1) {
          scheduleRange = `${(start.getMonth() + 1)
            .toString()
            .padStart(2, "0")}/${start
            .getDate()
            .toString()
            .padStart(2, "0")}/${start.getFullYear()} - ${(end.getMonth() + 1)
            .toString()
            .padStart(2, "0")}/${end
            .getDate()
            .toString()
            .padStart(2, "0")}/${end.getFullYear()}`;
        } else {
          scheduleRange = `${start.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })} & ${end.toLocaleDateString("en-US", {
            day: "numeric",
            year: "numeric",
          })}`;
        }
      }
    } else {
      const { data: datesData } = await supabase
        .from("schedule_dates")
        .select("date")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true });

      if (datesData && datesData.length > 0) {
        const dates = datesData.map((d) => new Date(d.date));
        const datesByMonth: Record<string, number[]> = {};

        dates.forEach((date) => {
          const monthYear = `${date.toLocaleDateString("en-US", {
            month: "short",
          })} ${date.getFullYear()}`;
          if (!datesByMonth[monthYear]) datesByMonth[monthYear] = [];
          datesByMonth[monthYear].push(date.getDate());
        });

        const formattedParts = Object.entries(datesByMonth).map(
          ([monthYear, days], idx, arr) => {
            const [month, year] = monthYear.split(" ");
            return idx === arr.length - 1
              ? `${month}. ${days.join(",")}, ${year}`
              : `${month}. ${days.join(",")}`;
          }
        );

        scheduleRange = formattedParts.join(" & ");
      }
    }

    // 👥 3. Fetch trainees with cert + email
    const { data: traineesData, error: traineesError } = await supabase
      .from("trainings")
      .select(
        "id, first_name, last_name, middle_initial, email, certificate_number, picture_2x2_url"
      )
      .eq("schedule_id", scheduleId)
      .not("certificate_number", "is", null)
      .not("email", "is", null)
      .order("last_name", { ascending: true });

    if (traineesError || !traineesData?.length) {
      console.error("❌ No trainees found or query failed:", traineesError);
      return NextResponse.json(
        {
          success: false,
          error: "No trainees with certificate numbers and email addresses found",
        },
        { status: 404 }
      );
    }

    console.log(`👥 Found ${traineesData.length} trainees`);

    // 📧 4. Create SSE stream for real-time progress
    const encoder = new TextEncoder();
    let successCount = 0;
    let failCount = 0;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial progress
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              current: 0,
              total: traineesData.length,
              successCount: 0,
              failCount: 0,
              message: `Starting to send ${traineesData.length} certificate(s)...`,
            })}\n\n`
          )
        );

        // Process each trainee
        for (let i = 0; i < traineesData.length; i++) {
          const trainee = traineesData[i];
          
          try {
            console.log(`📤 Generating certificate for: ${trainee.first_name} ${trainee.last_name}`);

            // Generate certificate PDF
            const pdfResponse = await fetch(
              `${req.nextUrl.origin}/api/generate-certificate-pdf`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  trainee,
                  courseName: courseData.name,
                  scheduleRange,
                  givenThisDate,
                }),
              }
            );

            console.log(`📄 PDF Response status: ${pdfResponse.status}`);

            if (!pdfResponse.ok) {
              const errTxt = await pdfResponse.text();
              throw new Error(`PDF generation failed: ${errTxt.substring(0, 300)}`);
            }

            const contentType = pdfResponse.headers.get("content-type");
            if (!contentType?.includes("application/pdf")) {
              const badResp = await pdfResponse.text();
              throw new Error(
                `Invalid content-type: ${contentType}. Got: ${badResp.substring(0, 200)}`
              );
            }

            const pdfBlob = await pdfResponse.blob();
            const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
            const pdfBase64 = pdfBuffer.toString("base64");
            console.log(`✅ PDF ready, ${pdfBuffer.length} bytes`);

            // Send email
            const emailResponse = await fetch(`${req.nextUrl.origin}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: trainee.email,
                subject: `Your ${courseData.name} Certificate - Petrosphere Training Center`,
                message: generateCertificateEmailHTML(
                  trainee,
                  courseData.name,
                  scheduleRange
                ),
                attachments: [
                  {
                    filename: `Certificate_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf`,
                    content: pdfBase64,
                    encoding: "base64",
                  },
                ],
              }),
            });

            if (!emailResponse.ok) {
              const errTxt = await emailResponse.text();
              throw new Error(`Email send failed: ${errTxt.substring(0, 300)}`);
            }

            successCount++;
            console.log(`✅ Email sent to ${trainee.email}`);

            // Send progress update
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  current: i + 1,
                  total: traineesData.length,
                  successCount,
                  failCount,
                  message: `Sent ${successCount} of ${traineesData.length}...`,
                  lastSent: `${trainee.first_name} ${trainee.last_name}`,
                })}\n\n`
              )
            );
          } catch (err: any) {
            failCount++;
            console.error(`❌ Failed for ${trainee.first_name} ${trainee.last_name}:`, err);

            // Send error update
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  current: i + 1,
                  total: traineesData.length,
                  successCount,
                  failCount,
                  message: `Sent ${successCount} of ${traineesData.length}... (${failCount} failed)`,
                  lastError: `${trainee.first_name} ${trainee.last_name}: ${err.message}`,
                })}\n\n`
              )
            );
          }
        }

        // Send completion message
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "complete",
              successCount,
              failCount,
              total: traineesData.length,
              message: `Completed! ${successCount} sent, ${failCount} failed`,
            })}\n\n`
          )
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("🔥 Send certificates route crashed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Unhandled server error in send-certificates",
        stack: err.stack,
      },
      { status: 500 }
    );
  }
}

function generateCertificateEmailHTML(
  trainee: any,
  courseName: string,
  scheduleRange: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: #4F46E5; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 5px 5px; }
        .certificate-info { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 3px; }
        .certificate-info strong { color: #92400E; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>🎓 Certificate of Completion</h1></div>
        <div class="content">
          <p>Dear ${trainee.first_name} ${trainee.last_name},</p>
          <p>Congratulations on successfully completing your training!</p>
          <div class="certificate-info">
            <strong>Course:</strong> ${courseName}<br>
            <strong>Training Dates:</strong> ${scheduleRange}<br>
            <strong>Certificate Number:</strong> ${trainee.certificate_number}
          </div>
          <p>Your official certificate is attached as a PDF.</p>
          <p><strong>Note:</strong> Keep this certificate for your professional records.</p>
          <p>Thank you for choosing Petrosphere Training Center!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Petrosphere Training Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}