// app/api/generate-certificate-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb } from "pdf-lib";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms");


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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      trainee, 
      courseName, 
      courseTitle,  
      courseId, 
      templateType = "completion",
      layoutOverride,
    } = body;

    console.log("📝 PDF Generation Request:");
    console.log("  - Trainee:", trainee?.first_name, trainee?.last_name);
    console.log("  - Course Name:", courseName);
    console.log("  - Course Title:", courseTitle);
    console.log("  - Template Type:", templateType);
    console.log("  - Course ID:", courseId);
    console.log("  - Schedule ID:", trainee?.schedule_id);

    if (!trainee || !courseName) {
      console.error("❌ Missing required parameters");
      return NextResponse.json(
        { success: false, error: "Missing required parameters (trainee or courseName)" },
        { status: 400 }
      );
    }

    // Fetch certificate template
    let template: CertificateTemplate | null = null;
    
    if (courseId) {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("course_id", courseId)
        .eq("template_type", templateType)
        .maybeSingle();

      if (error) {
        console.error("❌ Error fetching template:", error);
        return NextResponse.json(
          { success: false, error: `Template fetch error: ${error.message}` },
          { status: 500 }
        );
      } else if (data) {
        template = data as CertificateTemplate;
        console.log("✅ Found custom template:", template.template_type);
      }
    }

    if (!template) {
      console.error("❌ No template found for courseId:", courseId, "templateType:", templateType);
      return NextResponse.json(
        { success: false, error: `No certificate template found for this course (${courseId}) and type (${templateType})` },
        { status: 404 }
      );
    }

    // Determine if this is an ID template
    const isIDTemplate = templateType === "excellence";

    
// ✅ Always use today's date for givenThisDate
const today = new Date();
const computedGivenDate = today.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
let computedScheduleRange = "";

// ✅ Dynamically build scheduleRange based on schedule_type
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
         computedScheduleRange = formatScheduleRange([start, end]);
          console.log("📅 scheduleRange (regular):", computedScheduleRange);

        }
      } else if (schedule.schedule_type === "staggered") {
        const { data: datesData } = await supabase
          .from("schedule_dates")
          .select("date")
          .eq("schedule_id", trainee.schedule_id)
          .order("date", { ascending: true });

        if (datesData && datesData.length > 0) {
          const sorted = datesData.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime());
          computedScheduleRange = formatScheduleRange(sorted);
          console.log("📅 scheduleRange (staggered):", computedScheduleRange);
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ Error fetching schedule dates:", error);
  }
}

    // Fetch template image
    let imageBytes: ArrayBuffer;
    try {
      if (template.image_url.startsWith('data:')) {
        const base64Data = template.image_url.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBytes = bytes.buffer;
      } else {
        const imageResponse = await fetch(template.image_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch template image: ${imageResponse.statusText}`);
        }
        imageBytes = await imageResponse.arrayBuffer();
      }
      console.log("✅ Template image loaded, size:", imageBytes.byteLength, "bytes");
    } catch (error: any) {
      console.error("❌ Failed to load template image:", error);
      return NextResponse.json(
        { success: false, error: `Failed to load template image: ${error.message}` },
        { status: 500 }
      );
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed the template image
    let templateImage;
    const imageType = template.image_url.toLowerCase();
    
    if (imageType.includes('png') || imageType.includes('data:image/png')) {
      templateImage = await pdfDoc.embedPng(imageBytes);
    } else if (imageType.includes('jpg') || imageType.includes('jpeg') || imageType.includes('data:image/jpeg')) {
      templateImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      try {
        templateImage = await pdfDoc.embedPng(imageBytes);
      } catch {
        templateImage = await pdfDoc.embedJpg(imageBytes);
      }
    }

    // Set canvas dimensions based on template type
    // Use the same canonical sizes as the template editor
    const CANVAS_WIDTH = isIDTemplate ? 1350 : 842;
    const CANVAS_HEIGHT = isIDTemplate ? 850 : 595;

    // ✅ NEW: Per-trainee layout overrides (global X/Y offsets + per-field overrides)
    let offsetX = 0;
    let offsetY = 0;
    let fieldOverrides: Record<string, any> = {};

    // If a caller provides an explicit override (for live preview), use it.
    if (layoutOverride && typeof layoutOverride === "object") {
      offsetX = typeof layoutOverride.offsetX === "number" ? layoutOverride.offsetX : 0;
      offsetY = typeof layoutOverride.offsetY === "number" ? layoutOverride.offsetY : 0;
      fieldOverrides =
        layoutOverride.fieldOverrides && typeof layoutOverride.fieldOverrides === "object"
          ? layoutOverride.fieldOverrides
          : {};
    } else {
      // Otherwise, load from DB
      try {
        const { data: overrideRow, error: overrideError } = await supabase
          .from("certificate_layout_overrides")
          .select("offset_x, offset_y, field_overrides")
          .eq("training_id", trainee.id)
          .eq("template_type", templateType)
          .maybeSingle();

        if (overrideError) {
          console.warn("⚠️ Error fetching layout override:", overrideError);
        } else if (overrideRow) {
          offsetX = Number((overrideRow as any).offset_x ?? 0);
          offsetY = Number((overrideRow as any).offset_y ?? 0);
          fieldOverrides = ((overrideRow as any).field_overrides as any) || {};
        }
      } catch (e) {
        console.warn("⚠️ Unexpected error while loading layout overrides:", e);
      }
    }

    console.log("📐 Canvas dimensions:", CANVAS_WIDTH, "x", CANVAS_HEIGHT);

    // Add page with template dimensions
    const page = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT]);
    
    // Draw template image
    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });

    // Load trainee photo
    if (trainee.picture_2x2_url) {
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

            page.drawImage(traineeImage, {
              x: photoX,
              y: CANVAS_HEIGHT - photoYTop - photoH,
              width: photoW,
              height: photoH,
            });
            console.log("📷 ID photo placed at:", photoX, CANVAS_HEIGHT - photoYTop - photoH);
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

            page.drawImage(traineeImage, {
              x: photoX,
              y: CANVAS_HEIGHT - photoYTop - photoH,
              width: photoW,
              height: photoH,
            });
            console.log("📷 Certificate photo placed at:", photoX, CANVAS_HEIGHT - photoYTop - photoH);
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
    const fullName = `${first} ${middle}${last}`;



    // ✅ FIX: Use courseTitle if provided, otherwise fall back to courseName
    const finalCourseTitle = courseTitle || courseName;

    console.log("🔄 Placeholder replacements:");
    console.log("  - {{trainee_name}}:", fullName);
    console.log("  - {{course_name}}:", courseName);
    console.log("  - {{course_title}}:", finalCourseTitle);
    console.log("  - {{completion_date}}:", computedGivenDate);
    console.log("  - {{certificate_number}}:", trainee.certificate_number);

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

    // Draw text fields
    console.log("✍️ Drawing", template.fields.length, "text fields");
    template.fields.forEach((field, index) => {
      const fo = fieldOverrides[field.id] || {};
      let displayText = field.value;

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
      const color = hexToRgb(colorHex);
      
      let selectedFont = helveticaFont;
      
      if (field.fontFamily === "Helvetica") {
        if (field.fontWeight === "bold" || field.fontWeight === "extrabold") {
          selectedFont = field.fontStyle === "italic" ? helveticaBoldOblique : helveticaBold;
        } else {
          selectedFont = field.fontStyle === "italic" ? helveticaOblique : helveticaFont;
        }
      }

      // ✅ FIXED: Split text by newlines and respect alignment
      const lines = displayText.split('\n');
      let currentY = CANVAS_HEIGHT - y;

      lines.forEach((line) => {
        const textWidth = selectedFont.widthOfTextAtSize(line, fontSize);
        
        let finalX = x;
        
        // ✅ KEY FIX: Left-aligned text stays anchored to x position
        // Only center and right alignments adjust based on text width
        if (field.align === "center") {
          finalX = x - textWidth / 2;
        } else if (field.align === "right") {
          finalX = x - textWidth;
        }
        // For "left" alignment: finalX = x (no adjustment needed)

        page.drawText(line, {
          x: finalX,
          y: currentY,
          size: fontSize,
          font: selectedFont,
          color: rgb(color.r, color.g, color.b),
        });

        // Move to next line
        currentY -= lineHeight;
      });

      console.log(`  Field ${index + 1}: "${field.label}" (${lines.length} line${lines.length > 1 ? 's' : ''})`);
    });

    // Add metadata
    pdfDoc.setTitle(`${isIDTemplate ? 'ID Card' : 'Certificate'} - ${trainee.first_name} ${trainee.last_name}`);
    pdfDoc.setAuthor("Petrosphere Incorporated");
    pdfDoc.setSubject(`${courseName} ${isIDTemplate ? 'ID Card' : 'Certificate of ' + template.template_type}`);
    pdfDoc.setCreator("Petrosphere Training Management System");
    pdfDoc.setProducer("Petrosphere Training Management System");
    pdfDoc.setCreationDate(new Date());

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log("✅ PDF generated successfully, size:", pdfBytes.length, "bytes");

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
    console.error("❌ PDF generation error:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}