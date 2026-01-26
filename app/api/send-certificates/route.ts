// app/api/send-certificates/route.ts - UPDATED VERSION
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms");

function formatScheduleRange(dates: Date[]): string {
  if (!dates.length) return "";

  const start = dates[0];
  const end = dates[dates.length - 1];

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  const fullMonth = start.toLocaleString("en-US", { month: "long" });
  const shortStartMonth = start.toLocaleString("en-US", { month: "short" });
  const shortEndMonth = end.toLocaleString("en-US", { month: "short" });

  if (sameMonth) {
    return `${fullMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  } else if (sameYear) {
    return `${shortStartMonth}. ${start.getDate()} – ${shortEndMonth}. ${end.getDate()}, ${start.getFullYear()}`;
  } else {
    return `${shortStartMonth}. ${start.getDate()}, ${start.getFullYear()} – ${shortEndMonth}. ${end.getDate()}, ${end.getFullYear()}`;
  }
}

// Default email generator (fallback)
function generateCertificateEmailHTML(
  trainee: any,
  courseName: string,
  courseTitle: string,
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
            <strong>Course:</strong> ${courseTitle}<br>
            <strong>Training Dates:</strong> ${scheduleRange}<br>
            <strong>Certificate Number:</strong> ${trainee.certificate_number}
          </div>
          <p>Your official certificate is attached as a PDF.</p>
          <p><strong>Note:</strong> Keep this certificate for your professional records.</p>
          <p>Thank you for choosing Petrosphere Incorporated!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Petrosphere Incorporated. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ✅ NEW: Personalize email with trainee data
function personalizeEmail(template: string, trainee: any, certificateNumber: string): string {
  return template
    .replace(/\{\{first_name\}\}/g, trainee.first_name || "")
    .replace(/\{\{last_name\}\}/g, trainee.last_name || "")
    .replace(/\{\{full_name\}\}/g, `${trainee.first_name} ${trainee.last_name}`)
    .replace(/\{\{certificate_number\}\}/g, certificateNumber || "");
}

export async function POST(req: NextRequest) {
  console.log("📨 /api/send-certificates endpoint hit");

  try {
    // ✅ UPDATED: Accept custom email subject and message
    const { 
      scheduleId, 
      templateType = "completion", 
      courseTitle: providedCourseTitle,
      selectedTraineeIds,
      customEmailSubject,  // ✅ NEW
      customEmailMessage   // ✅ NEW
    } = await req.json();
    
    console.log("✅ Custom email subject:", customEmailSubject);
    console.log("✅ Custom email message length:", customEmailMessage?.length);

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: "Schedule ID is required" },
        { status: 400 }
      );
    }

    // Fetch schedule and course info
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
      .select("id, name, title, serial_number, serial_number_pad")
      .eq("id", scheduleData.course_id)
      .single();

    if (courseError || !courseData) {
      console.error("❌ Course fetch failed:", courseError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch course information" },
        { status: 404 }
      );
    }

    const serialBase = Number(courseData.serial_number ?? 1);
    const serialPad = Number(courseData.serial_number_pad ?? 5);
    const courseTitle = providedCourseTitle || courseData.title || courseData.name;

    const computedGivenDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    let computedScheduleRange = "";

    if (scheduleData.schedule_type === "regular") {
      const { data: rangeData } = await supabase
        .from("schedule_ranges")
        .select("start_date, end_date")
        .eq("schedule_id", scheduleId)
        .single();

      if (rangeData) {
        const start = new Date(rangeData.start_date);
        const end = new Date(rangeData.end_date);
        computedScheduleRange = formatScheduleRange([start, end]);
      }
    } else {
      const { data: datesData } = await supabase
        .from("schedule_dates")
        .select("date")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true });

      if (datesData && datesData.length > 0) {
        const dates = datesData.map((d) => new Date(d.date));
        const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
        computedScheduleRange = formatScheduleRange(sortedDates);
      }
    }

    // Fetch trainees
    let query = supabase
      .from("trainings")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (selectedTraineeIds && selectedTraineeIds.length > 0) {
      query = query.in("id", selectedTraineeIds);
    }

    const { data: traineesData, error: traineesError } = await query;

    if (traineesError || !traineesData?.length) {
      return NextResponse.json(
        { success: false, error: "No trainees found" },
        { status: 404 }
      );
    }

    traineesData.sort((a, b) => {
      const aName = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
      const bName = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
      return aName.localeCompare(bName);
    });

    // Assign certificate numbers
    const updatedTrainees = traineesData.map((trainee, index) => {
      const serial = serialBase + index + 1;
      const padded = serial.toString().padStart(serialPad, "0");
      const certificate_number = `PSI-${courseData.name}-${padded}`;
      return { ...trainee, certificate_number };
    });

    const lastSerialUsed = serialBase + updatedTrainees.length;
    await supabase
      .from("courses")
      .update({ serial_number: lastSerialUsed })
      .eq("id", courseData.id);

    console.log(`👥 Sending to ${updatedTrainees.length} trainees`);

    // Create SSE stream
    const encoder = new TextEncoder();
    let successCount = 0;
    let failCount = 0;

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              current: 0,
              total: updatedTrainees.length,
              successCount: 0,
              failCount: 0,
              message: `Starting to send ${updatedTrainees.length} certificate(s)...`,
            })}\n\n`
          )
        );

        for (let i = 0; i < updatedTrainees.length; i++) {
          const trainee = updatedTrainees[i];

          try {
            console.log(`📤 Generating certificate for: ${trainee.first_name} ${trainee.last_name}`);

            // Generate PDF
            const pdfResponse = await fetch(
              `${req.nextUrl.origin}/api/generate-certificate-pdf`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  trainee,
                  courseName: courseData.name,
                  courseTitle: courseTitle,
                  courseId: courseData.id,
                  givenThisDate: computedGivenDate,
                  scheduleRange: computedScheduleRange,
                  templateType,
                }),
              }
            );

            if (!pdfResponse.ok) {
              const errTxt = await pdfResponse.text();
              throw new Error(`PDF generation failed: ${errTxt.substring(0, 300)}`);
            }

            const pdfBlob = await pdfResponse.blob();
            const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
            const pdfBase64 = pdfBuffer.toString("base64");

            // ✅ UPDATED: Use custom email or default
            let emailSubject = customEmailSubject;
            let emailMessage = customEmailMessage;

            if (!emailSubject || !emailMessage) {
              // Fallback to default
              emailSubject = `Your ${courseData.name} Certificate - Petrosphere Incorporated`;
              emailMessage = generateCertificateEmailHTML(
                trainee,
                courseData.name,
                courseTitle,
                computedScheduleRange
              );
            } else {
              // ✅ Personalize custom message
              emailMessage = personalizeEmail(emailMessage, trainee, trainee.certificate_number);
            }

            // Send email
            const emailResponse = await fetch(`${req.nextUrl.origin}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: trainee.email,
                subject: emailSubject,
                message: emailMessage,
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

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  current: i + 1,
                  total: updatedTrainees.length,
                  successCount,
                  failCount,
                  message: `Sent ${successCount} of ${updatedTrainees.length}...`,
                  lastSent: `${trainee.first_name} ${trainee.last_name}`,
                })}\n\n`
              )
            );
          } catch (err: any) {
            failCount++;
            console.error(`❌ Failed for ${trainee.first_name} ${trainee.last_name}:`, err);

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  current: i + 1,
                  total: updatedTrainees.length,
                  successCount,
                  failCount,
                  message: `Sent ${successCount} of ${updatedTrainees.length}... (${failCount} failed)`,
                  lastError: `${trainee.first_name} ${trainee.last_name}: ${err.message}`,
                })}\n\n`
              )
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "complete",
              successCount,
              failCount,
              total: updatedTrainees.length,
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
      { success: false, error: err.message || "Unhandled server error", stack: err.stack },
      { status: 500 }
    );
  }
}