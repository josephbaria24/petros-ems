// app/api/generate-certificate-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms");

const DEBUG_PDF_LOGS = process.env.DEBUG_PDF_LOGS === "true";
const logPdf = (...args: any[]) => {
  if (DEBUG_PDF_LOGS) console.log(...args);
};


function formatScheduleRange(dates: Date[]): string {
  if (!dates.length) return "";

  const start = dates[0];
  const end = dates[dates.length - 1];

  // ✅ FIX: Check if it's a single day
  const isSingleDay = dates.length === 1 || 
    (start.getDate() === end.getDate() && 
     start.getMonth() === end.getMonth() && 
     start.getFullYear() === end.getFullYear());

  if (isSingleDay) {
    // Single day format: "January 30, 2026"
    return start.toLocaleString("en-US", { 
      month: "long", 
      day: "numeric", 
      year: "numeric" 
    });
  }

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

function formatStaggeredDates(dates: Date[]): string {
  if (!dates.length) return "";
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  const parts: string[] = [];
  let currentMonthStr = "";
  let currentYear = -1;

  for (const d of sorted) {
    const m = d.toLocaleString("en-US", { month: "long" });
    const day = d.getDate();
    const y = d.getFullYear();

    if (m !== currentMonthStr || y !== currentYear) {
      parts.push(`${m} ${day}`);
      currentMonthStr = m;
      currentYear = y;
    } else {
      parts[parts.length - 1] += `, ${day}`;
    }
  }

  return parts.join(", ") + ", " + sorted[sorted.length - 1].getFullYear();
}


interface TextField {
  id: string;
  label: string;
  value: string;
  x: number;
  y: number;
  fontSize: number;
  boxWidth?: number;
  boxHeight?: number;
  fontWeight: "normal" | "bold" | "extrabold";
  fontStyle: "normal" | "italic";
  fontFamily: "Helvetica" | "Montserrat" | "Poppins";
  color: string;
  align: "left" | "center" | "right";
  lineHeight?: number;
}

interface CertificateTemplate {
  id: string;
  course_id: string;
  template_type: string;
  image_url: string;
  fields: TextField[];
  back_image_url?: string;
  back_fields?: any;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

function capitalize(word: string | null | undefined): string {
  if (!word) return "";
  return word
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Server-side cache for template images to avoid redundant fetches
const imageCache = new Map<string, ArrayBuffer>();

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
    const { 
      trainee, 
      courseName, 
      courseTitle,  
      courseId, 
      templateType = "completion",
      layoutOverride,
      precomputed,
      side = "both",  // 'front' | 'back' | 'both' — controls which pages are included for ID cards
    } = body;

    logPdf(`🚀 Processing ${templateType} for [${trainee?.id}] ${trainee?.last_name}`);
    if (precomputed) logPdf("📦 Using precomputed data for optimization");

    if (!trainee || (!courseName && !precomputed?.courseName)) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // 1. Fetch certificate template (Check precomputed first)
    let template: CertificateTemplate | null = precomputed?.template || null;
    
    // ✅ Robust fallback: If courseId is missing from top-level, check trainee.course_id
    const effectiveCourseId = courseId || trainee?.course_id;

    if (!template && effectiveCourseId) {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("course_id", effectiveCourseId)
        .eq("template_type", templateType)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ success: false, error: `Template fetch error: ${error.message}` }, { status: 500 });
      } else if (data) {
        template = data as CertificateTemplate;
      }
    }

    if (!template) {
      return NextResponse.json({ success: false, error: `No certificate template found` }, { status: 404 });
    }

    // Determine if this is an ID template
    const isIDTemplate = templateType === "excellence";

    // 2. Determine schedule range and completion date
    let computedScheduleRange = precomputed?.scheduleRange || "";
    let completionDate = new Date(); // Fallback to today
    
    if (trainee.schedule_id) {
      try {
        const { data: schedule, error: scheduleError } = await supabase
          .from("schedules")
          .select("schedule_type")
          .eq("id", trainee.schedule_id)
          .single();

        if (schedule && !scheduleError) {
          if (schedule.schedule_type === "regular") {
            const { data: rangeData } = await supabase
              .from("schedule_ranges")
              .select("start_date, end_date")
              .eq("schedule_id", trainee.schedule_id)
              .single();

            if (rangeData) {
              const start = new Date(rangeData.start_date);
              const end = new Date(rangeData.end_date);
              if (!computedScheduleRange) {
                computedScheduleRange = formatScheduleRange([start, end]);
              }
              completionDate = end;
            }
          } else if (schedule.schedule_type === "staggered") {
            const { data: datesData } = await supabase
              .from("schedule_dates")
              .select("date")
              .eq("schedule_id", trainee.schedule_id)
              .order("date", { ascending: true });

            if (datesData?.length) {
              const dates = datesData.map(d => new Date(d.date));
              const start = dates[0];
              
              // ✅ DISGUISE: Start Date to (Start Date + N-1 days)
              const disguisedEnd = new Date(start);
              disguisedEnd.setDate(start.getDate() + (dates.length - 1));
              
              computedScheduleRange = formatScheduleRange([start, disguisedEnd]);
              completionDate = disguisedEnd;
            }
          }
        }
      } catch (e) {
        console.warn("⚠️ Error fetching schedule dates:", e);
      }
    }

    const computedGivenDate = completionDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // 3. Fetch template image (Using Cache)
    let imageBytes: ArrayBuffer;
    try {
      if (imageCache.has(template.image_url)) {
        imageBytes = imageCache.get(template.image_url)!;
      } else if (template.image_url.startsWith('data:')) {
        const base64Data = template.image_url.split(',')[1];
        imageBytes = Buffer.from(base64Data, 'base64').buffer;
        imageCache.set(template.image_url, imageBytes);
      } else {
        const imageResponse = await fetch(template.image_url);
        if (!imageResponse.ok) throw new Error(`Fetch failed: ${imageResponse.statusText}`);
        imageBytes = await imageResponse.arrayBuffer();
        imageCache.set(template.image_url, imageBytes);
      }
    } catch (error: any) {
      return NextResponse.json({ success: false, error: `Failed to load template image: ${error.message}` }, { status: 500 });
    }

    // 5. Fetch back template image (if ID and exists)
    let backImageBytes: ArrayBuffer | null = null;
    if (isIDTemplate && template.back_image_url) {
      try {
        if (imageCache.has(template.back_image_url)) {
          backImageBytes = imageCache.get(template.back_image_url)!;
        } else if (template.back_image_url.startsWith('data:')) {
          const base64Data = template.back_image_url.split(',')[1];
          backImageBytes = Buffer.from(base64Data, 'base64').buffer;
          imageCache.set(template.back_image_url, backImageBytes);
        } else {
          const backImageResponse = await fetch(template.back_image_url);
          if (backImageResponse.ok) {
            backImageBytes = await backImageResponse.arrayBuffer();
            imageCache.set(template.back_image_url, backImageBytes);
          }
        }
      } catch (error) {
        console.warn("⚠️ Failed to load back template image:", error);
      }
    }

    // 6. Embed template images
    const pdfDoc = await PDFDocument.create();
    const imageType = template.image_url.toLowerCase();
    let templateImage;
    if (imageType.includes('png') || imageType.includes('data:image/png')) {
      templateImage = await pdfDoc.embedPng(imageBytes);
    } else {
      templateImage = await pdfDoc.embedJpg(imageBytes);
    }

    let backTemplateImage;
    if (backImageBytes) {
      const backImageType = template.back_image_url!.toLowerCase();
      if (backImageType.includes('png') || backImageType.includes('data:image/png')) {
        backTemplateImage = await pdfDoc.embedPng(backImageBytes);
      } else {
        backTemplateImage = await pdfDoc.embedJpg(backImageBytes);
      }
    }

    const CANVAS_WIDTH = isIDTemplate ? 1350 : 842;
    const CANVAS_HEIGHT = isIDTemplate ? 850 : 595;

    // 7. Layout overrides (Check precomputed first)
    let offsetX = 0;
    let offsetY = 0;
    let fieldOverrides: Record<string, any> = {};

    if (precomputed?.layout) {
      offsetX = precomputed.layout.offsetX ?? 0;
      offsetY = precomputed.layout.offsetY ?? 0;
      fieldOverrides = precomputed.layout.fieldOverrides ?? {};
    } else if (layoutOverride && typeof layoutOverride === "object") {
      offsetX = layoutOverride.offsetX ?? 0;
      offsetY = layoutOverride.offsetY ?? 0;
      fieldOverrides = layoutOverride.fieldOverrides ?? {};
    } else {
      try {
        const { data: overrideRow } = await supabase
          .from("certificate_layout_overrides")
          .select("offset_x, offset_y, field_overrides")
          .eq("training_id", trainee.id)
          .eq("template_type", templateType)
          .maybeSingle();

        if (overrideRow) {
          offsetX = Number(overrideRow.offset_x ?? 0);
          offsetY = Number(overrideRow.offset_y ?? 0);
          fieldOverrides = (overrideRow.field_overrides as any) || {};
        }
      } catch (e) {
        console.warn("⚠️ Unexpected error while loading layout overrides:", e);
      }
    }

    logPdf("📐 Canvas dimensions:", CANVAS_WIDTH, "x", CANVAS_HEIGHT);

    // Determine which sides to include (only relevant for ID cards)
    const includeFront = !isIDTemplate || side === "front" || side === "both";
    const includeBack = !isIDTemplate || (side === "back" || side === "both");

    // Add page for Front
    let frontPage: any = null;
    if (includeFront) {
      frontPage = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT]);
      frontPage.drawImage(templateImage, {
        x: 0,
        y: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      });
    }

    let backPage: any = null;
    if (includeBack && backTemplateImage) {
      // Add page for Back
      backPage = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT]);
      backPage.drawImage(backTemplateImage, {
        x: 0,
        y: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      });
    }

    // Load trainee photo (only on front page)
    if (trainee.picture_2x2_url && frontPage) {
      // Try to get photo position from template fields ({{trainee_picture}}), fallback to defaults
      const photoField = template.fields.find((f) =>
        f.value && f.value.includes("{{trainee_picture}}")
      );

      try {
        const photoResponse = await fetch(trainee.picture_2x2_url);
        if (photoResponse.ok) {
          const photoBytes = await photoResponse.arrayBuffer();
          
          let traineeImage;
          if (trainee.picture_2x2_url.toLowerCase().includes('png')) {
            traineeImage = await pdfDoc.embedPng(photoBytes);
          } else {
            traineeImage = await pdfDoc.embedJpg(photoBytes);
          }

          // Different photo positioning for ID vs certificate
          if (isIDTemplate) {
            const defaultSize = 240;
            const baseW = photoField && typeof photoField.boxWidth === "number"
              ? photoField.boxWidth * CANVAS_WIDTH
              : photoField && typeof photoField.fontSize === "number"
                ? photoField.fontSize * CANVAS_HEIGHT
                : defaultSize;
            const baseH = photoField && typeof photoField.boxHeight === "number"
              ? photoField.boxHeight * CANVAS_HEIGHT
              : photoField && typeof photoField.fontSize === "number"
                ? photoField.fontSize * CANVAS_HEIGHT
                : defaultSize;

            const fo = photoField ? (fieldOverrides[photoField.id] || {}) : {}
            const photoW = typeof fo.boxWidth === "number" ? fo.boxWidth * CANVAS_WIDTH : baseW
            const photoH = typeof fo.boxHeight === "number" ? fo.boxHeight * CANVAS_HEIGHT : baseH

            // If designer placed a {{trainee_picture}} field, use its position; otherwise fallback
            let photoX = 228;
            let photoYTop = 351;
            if (photoField) {
              let normX = photoField.x + offsetX;
              let normY = photoField.y + offsetY;
              if (typeof fo.x === "number") normX = fo.x;
              if (typeof fo.y === "number") normY = fo.y;
              photoX = normX * CANVAS_WIDTH;
              photoYTop = normY * CANVAS_HEIGHT;
            }

            frontPage.drawImage(traineeImage, {
              x: photoX,
              y: CANVAS_HEIGHT - photoYTop - photoH,
              width: photoW,
              height: photoH,
            });
            logPdf("📷 ID photo placed at:", photoX, CANVAS_HEIGHT - photoYTop - photoH);
          } else {
            const defaultSize = 0.12 * CANVAS_HEIGHT;
            const baseW = photoField && typeof photoField.boxWidth === "number"
              ? photoField.boxWidth * CANVAS_WIDTH
              : photoField && typeof photoField.fontSize === "number"
                ? photoField.fontSize * CANVAS_HEIGHT
                : defaultSize;
            const baseH = photoField && typeof photoField.boxHeight === "number"
              ? photoField.boxHeight * CANVAS_HEIGHT
              : photoField && typeof photoField.fontSize === "number"
                ? photoField.fontSize * CANVAS_HEIGHT
                : defaultSize;

            const fo = photoField ? (fieldOverrides[photoField.id] || {}) : {}
            const photoW = typeof fo.boxWidth === "number" ? fo.boxWidth * CANVAS_WIDTH : baseW
            const photoH = typeof fo.boxHeight === "number" ? fo.boxHeight * CANVAS_HEIGHT : baseH

            // For certificates, also allow override via {{trainee_picture}} field
            let photoX = 0.85 * CANVAS_WIDTH + offsetX * CANVAS_WIDTH;
            let photoYTop = 0.05 * CANVAS_HEIGHT + offsetY * CANVAS_HEIGHT;
            if (photoField) {
              let normX = photoField.x + offsetX;
              let normY = photoField.y + offsetY;
              if (typeof fo.x === "number") normX = fo.x;
              if (typeof fo.y === "number") normY = fo.y;
              photoX = normX * CANVAS_WIDTH;
              photoYTop = normY * CANVAS_HEIGHT;
            }

            frontPage.drawImage(traineeImage, {
              x: photoX,
              y: CANVAS_HEIGHT - photoYTop - photoH,
              width: photoW,
              height: photoH,
            });
            logPdf("📷 Certificate photo placed at:", photoX, CANVAS_HEIGHT - photoYTop - photoH);
          }
        }
      } catch (error) {
        console.warn("⚠️ Failed to load trainee photo:", error);
      }
    }

    // Prepare replacement values
    const first = capitalize(trainee.first_name);
    const middle = trainee.middle_initial ? capitalize(trainee.middle_initial) + ". " : "";
    const last = capitalize(trainee.last_name);
    const rawSuffix = trainee.suffix?.trim();
    const suffix = rawSuffix ? " " + (rawSuffix.endsWith(".") ? rawSuffix : rawSuffix + ".") : "";
    const fullName = `${first} ${middle}${last}${suffix}`;



    // ✅ FIX: Use courseTitle if provided, otherwise fall back to courseName
    const finalCourseTitle = courseTitle || courseName;

    logPdf("🔄 Placeholder replacements:");
    logPdf("  - {{trainee_name}}:", fullName);
    logPdf("  - {{course_name}}:", courseName);
    logPdf("  - {{course_title}}:", finalCourseTitle);
    logPdf("  - {{completion_date}}:", computedGivenDate);
    logPdf("  - {{certificate_number}}:", trainee.certificate_number);

    const replacements: Record<string, string> = {
      "{{trainee_name}}": fullName,
      "{{course_name}}": courseName,
      "{{course_title}}": finalCourseTitle,
      "{{completion_date}}": computedGivenDate,  // still used in some templates
      "{{certificate_number}}": trainee.certificate_number || "",
      "{{batch_number}}": trainee.batch_number?.toString() || "",
      "{{training_provider}}": "Petrosphere Inc.",
      "{{schedule_range}}": computedScheduleRange  || "",
      "{{held_on}}": computedScheduleRange || "",
      "{{trainee_picture}}": "",
      "{{given_this}}": computedGivenDate,
    };


    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont('Helvetica');
    const helveticaBold = await pdfDoc.embedFont('Helvetica-Bold');
    const helveticaOblique = await pdfDoc.embedFont('Helvetica-Oblique');
    const helveticaBoldOblique = await pdfDoc.embedFont('Helvetica-BoldOblique');

    const drawFields = (pageToDraw: any, fields: TextField[], isBackSide: boolean = false) => {
      logPdf(`✍️ Drawing ${fields.length} text fields for ${isBackSide ? 'Back' : 'Front'}`);
      fields.forEach((field, index) => {
        const fo = fieldOverrides[field.id] || {};
        let displayText = field.value || "";

        // Replace all placeholders
        Object.entries(replacements).forEach(([key, val]) => {
          displayText = displayText.replace(new RegExp(key, 'g'), val);
        });

        // base position with global offset
        let normX = field.x + offsetX;
        let normY = field.y + offsetY;

        // per-field absolute overrides (normalized 0–1)
        if (typeof fo.x === "number") normX = fo.x;
        if (typeof fo.y === "number") normY = fo.y;

        const x = normX * CANVAS_WIDTH;
        const y = normY * CANVAS_HEIGHT;

        const baseFontSizeNorm = field.fontSize;
        const fontSizeNorm = typeof fo.fontSize === "number" ? fo.fontSize : baseFontSizeNorm;
        const fontSize = fontSizeNorm * CANVAS_HEIGHT;
        const lineHeight = (field.lineHeight || 1.2) * fontSize;

        const colorHex = typeof fo.color === "string" ? fo.color : field.color;
        const color = hexToRgb(colorHex || "#000000");
        
        let selectedFont = helveticaFont;
        
        if (field.fontFamily === "Helvetica") {
          if (field.fontWeight === "bold" || field.fontWeight === "extrabold") {
            selectedFont = field.fontStyle === "italic" ? helveticaBoldOblique : helveticaBold;
          } else {
            selectedFont = field.fontStyle === "italic" ? helveticaOblique : helveticaFont;
          }
        }

        const lines = displayText.split('\n');
        
        let currentY = CANVAS_HEIGHT - y;

        lines.forEach((line) => {
          const textWidth = selectedFont.widthOfTextAtSize(line, fontSize);
          
          let finalX = x;
          if (field.align === "center") {
            finalX = x - textWidth / 2;
          } else if (field.align === "right") {
            finalX = x - textWidth;
          }

          pageToDraw.drawText(line, {
            x: finalX,
            y: currentY,
            size: fontSize,
            font: selectedFont,
            color: rgb(color.r, color.g, color.b),
          });

          // Move to next line
          currentY -= lineHeight;
        });

        logPdf(`  Field ${index + 1}: "${field.label}" (${lines.length} line${lines.length > 1 ? 's' : ''})`);
      });
    };

    // Draw front fields
    if (frontPage) {
      drawFields(frontPage, template.fields, false);
    }

    // Draw back fields if back side is present
    if (backPage && template.back_fields) {
      drawFields(backPage, (template.back_fields as any[]).map(f => f as TextField), true);
    }

    // Add metadata
    pdfDoc.setTitle(`${isIDTemplate ? 'ID Card' : 'Certificate'} - ${trainee.first_name} ${trainee.last_name}`);
    pdfDoc.setAuthor("Petrosphere Incorporated");
    pdfDoc.setSubject(`${courseName} ${isIDTemplate ? 'ID Card' : 'Certificate of ' + template.template_type}`);
    pdfDoc.setCreator("Petrosphere Training Management System");
    pdfDoc.setProducer("Petrosphere Training Management System");
    pdfDoc.setCreationDate(new Date());

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    logPdf("✅ PDF generated successfully, size:", pdfBytes.length, "bytes");

    const fileName = isIDTemplate 
      ? `ID_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf`
      : `Certificate_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error during PDF generation";
    const errorStack = error.stack || "No stack trace available";
    
    console.error("❌ PDF GENERATION CRITICAL ERROR:", errorMsg);
    console.error("📊 Context:", {
      traineeId: body?.trainee?.id,
      templateType: body?.templateType,
      courseId: body?.courseId || body?.trainee?.course_id
    });
    console.error("🥞 Stack Trace:", errorStack);

    return new Response(JSON.stringify({
      success: false,
      error: errorMsg,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}