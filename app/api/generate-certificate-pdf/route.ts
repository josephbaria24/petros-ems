// app/api/generate-certificate-pdf/route.ts
export const runtime = "edge"; // Changed from nodejs to edge

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb } from "pdf-lib";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TextField {
  id: string;
  label: string;
  value: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
}

interface CertificateTemplate {
  id: string;
  course_id: string;
  template_type: string;
  image_url: string;
  fields: TextField[];
}

// Helper to convert hex color to RGB
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

// Helper function to capitalize names
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
    const { trainee, courseName, scheduleRange, givenThisDate, courseId, templateType = "completion" } = await req.json();

    console.log("📝 Generating PDF for:", trainee.first_name, trainee.last_name);
    console.log("📚 Course:", courseName);
    console.log("🎓 Template Type:", templateType);

    if (!trainee || !courseName) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Fetch certificate template from database
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
      } else if (data) {
        template = data as CertificateTemplate;
        console.log("✅ Found custom template:", template.template_type);
      }
    }

    if (!template) {
      return NextResponse.json(
        { success: false, error: "No certificate template found for this course and type" },
        { status: 404 }
      );
    }

    console.log("📂 Using template image:", template.image_url.substring(0, 100) + "...");

    // Fetch template image
    let imageBytes: ArrayBuffer;
    try {
      if (template.image_url.startsWith('data:')) {
        // Handle base64 data URI
        console.log("📷 Loading base64 data URI image");
        const base64Data = template.image_url.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBytes = bytes.buffer;
      } else {
        // Handle regular URL - fetch directly without proxy
        console.log("📷 Fetching image from URL");
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
      // Default to PNG
      try {
        templateImage = await pdfDoc.embedPng(imageBytes);
      } catch {
        templateImage = await pdfDoc.embedJpg(imageBytes);
      }
    }

    const CANVAS_WIDTH = templateImage.width;
    const CANVAS_HEIGHT = templateImage.height;

    // Add page with template dimensions
    const page = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT]);
    
    // Draw template image
    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });

    // Load trainee photo if available
    if (trainee.picture_2x2_url) {
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

          const PHOTO_SIZE = 0.12 * CANVAS_HEIGHT;
          const PHOTO_X = 0.85 * CANVAS_WIDTH;
          const PHOTO_Y = 0.05 * CANVAS_HEIGHT;

          page.drawImage(traineeImage, {
            x: PHOTO_X,
            y: CANVAS_HEIGHT - PHOTO_Y - PHOTO_SIZE, // PDF coordinates are bottom-up
            width: PHOTO_SIZE,
            height: PHOTO_SIZE,
          });
        }
      } catch (error) {
        console.warn("Failed to load trainee photo:", error);
      }
    }

    // Prepare replacement values
    const first = capitalize(trainee.first_name);
    const middle = trainee.middle_initial ? capitalize(trainee.middle_initial) + ". " : "";
    const last = capitalize(trainee.last_name);
    const fullName = `${first} ${middle}${last}`;

    const finalGivenDate = givenThisDate || new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const replacements: Record<string, string> = {
      "{{trainee_name}}": fullName,
      "{{course_name}}": courseName,
      "{{completion_date}}": finalGivenDate,
      "{{certificate_number}}": trainee.certificate_number || "",
      "{{batch_number}}": trainee.batch_number || "",
      "{{training_provider}}": "Petrosphere Inc.",
      "{{schedule_range}}": scheduleRange || "",
      "{{held_on}}": scheduleRange || "",
      "{{trainee_picture}}": "",
      "{{given_this}}": finalGivenDate,
    };

    // Embed standard font
    const font = await pdfDoc.embedFont('Helvetica');
    const boldFont = await pdfDoc.embedFont('Helvetica-Bold');

    // Draw text fields
    template.fields.forEach((field) => {
      let displayText = field.value;

      Object.entries(replacements).forEach(([key, val]) => {
        displayText = displayText.replace(key, val);
      });

      const x = field.x * CANVAS_WIDTH;
      const y = field.y * CANVAS_HEIGHT;
      const fontSize = field.fontSize * CANVAS_HEIGHT;

      const color = hexToRgb(field.color);
      const selectedFont = field.fontWeight === "bold" ? boldFont : font;

      // Calculate text width for alignment
      const textWidth = selectedFont.widthOfTextAtSize(displayText, fontSize);
      
      let finalX = x;
      if (field.align === "center") {
        finalX = x - textWidth / 2;
      } else if (field.align === "right") {
        finalX = x - textWidth;
      }

      page.drawText(displayText, {
        x: finalX,
        y: CANVAS_HEIGHT - y, // PDF coordinates are bottom-up
        size: fontSize,
        font: selectedFont,
        color: rgb(color.r, color.g, color.b),
      });
    });

    // Add metadata
    pdfDoc.setTitle(`Certificate - ${trainee.first_name} ${trainee.last_name}`);
    pdfDoc.setAuthor("Petrosphere Training Center");
    pdfDoc.setSubject(`${courseName} Certificate of ${template.template_type}`);
    pdfDoc.setCreator("Petrosphere Training Management System");
    pdfDoc.setProducer("Petrosphere Training Management System");
    pdfDoc.setCreationDate(new Date());

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log("✅ PDF saved, size:", pdfBytes.length, "bytes");

    // Return PDF as response - Convert Uint8Array to Buffer for NextResponse
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Certificate_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("❌ PDF generation error:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate PDF certificate",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}