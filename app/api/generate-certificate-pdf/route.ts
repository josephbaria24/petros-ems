// app/api/generate-certificate-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Check if we're in a Node.js environment
let createCanvas: any;
let loadImage: any;
let PDFDocument: any;
let fs: any;
let path: any;

try {
  const canvas = require("canvas");
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  
  const pdfLib = require("pdf-lib");
  PDFDocument = pdfLib.PDFDocument;
  
  fs = require("fs");
  path = require("path");
} catch (error) {
  console.error("❌ Failed to load required modules:", error);
}

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

export async function POST(req: NextRequest) {
  try {
    if (!createCanvas || !loadImage || !PDFDocument) {
      console.error("❌ Required modules not available");
      return NextResponse.json(
        { success: false, error: "Server configuration error: Required modules not available." },
        { status: 500 }
      );
    }

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

    // Fallback to old template system if no custom template found
    if (!template) {
      console.log("⚠️ No custom template found, using legacy templates");
      return generateLegacyCertificate(req, trainee, courseName, scheduleRange, givenThisDate);
    }

    console.log("📂 Using template image:", template.image_url.substring(0, 100) + "...");

    // Fetch template image - handle both base64 data URIs and regular URLs
    let templateImage;
    try {
      if (template.image_url.startsWith('data:')) {
        // Handle base64 data URI
        console.log("📷 Loading base64 data URI image");
        const base64Data = template.image_url.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        templateImage = await loadImage(imageBuffer);
      } else {
        // Handle regular URL
        console.log("📷 Fetching image from URL");
        const imageResponse = await fetch(
          `${req.nextUrl.origin}/api/image-proxy?url=${encodeURIComponent(template.image_url)}`
        );

        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch template image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        templateImage = await loadImage(Buffer.from(imageBuffer));
      }
      console.log("✅ Template image loaded, dimensions:", templateImage.width, "x", templateImage.height);
    } catch (error: any) {
      console.error("❌ Failed to load template image:", error);
      return NextResponse.json(
        { success: false, error: `Failed to load template image: ${error.message}` },
        { status: 500 }
      );
    }


    
const CANVAS_WIDTH = templateImage.width
const CANVAS_HEIGHT = templateImage.height
const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT)

const ctx = canvas.getContext("2d")

    // Draw template
    ctx.drawImage(templateImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)


    // Load and draw trainee photo if available
    if (trainee.picture_2x2_url) {
      try {
        const imageResponse = await fetch(
          `${req.nextUrl.origin}/api/image-proxy?url=${encodeURIComponent(trainee.picture_2x2_url)}`
        );

        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const img = await loadImage(Buffer.from(imageBuffer));

          // Position photo in top-right corner (adjust as needed)
          const PHOTO_SIZE = 0.12 * CANVAS_HEIGHT;   // adjust to what your UI uses
          const PHOTO_X = 0.85 * CANVAS_WIDTH;
          const PHOTO_Y = 0.05 * CANVAS_HEIGHT;

          ctx.drawImage(img, PHOTO_X, PHOTO_Y, PHOTO_SIZE, PHOTO_SIZE)

        }
      } catch (error) {
        console.warn("Failed to load trainee photo:", error);
      }
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

    // Placeholder replacements
    const replacements: Record<string, string> = {
      "{{trainee_name}}": fullName,
      "{{course_name}}": courseName,
      "{{completion_date}}": finalGivenDate,
      "{{certificate_number}}": trainee.certificate_number || "",
      "{{batch_number}}": trainee.batch_number || "",
      "{{training_provider}}": "Petrosphere Inc.",
      "{{schedule_range}}": scheduleRange || "",
      "{{held_on}}": scheduleRange || "",
      "{{trainee_picture}}": "",  // picture is drawn separately
      "{{given_this}}": finalGivenDate,
      
    };


template.fields.forEach((field) => {
  let displayText = field.value

  Object.entries(replacements).forEach(([key, val]) => {
    displayText = displayText.replace(key, val)
  })

  // Convert percent → actual pixels
  const x = field.x * CANVAS_WIDTH
  const y = field.y * CANVAS_HEIGHT
  const fontSize = field.fontSize * CANVAS_HEIGHT

  ctx.font = `${field.fontWeight === "bold" ? "bold " : ""}${fontSize}px Arial`
  ctx.fillStyle = field.color
  ctx.textAlign = field.align

  ctx.fillText(displayText, x, y)
})

    // Convert canvas to PNG buffer
    const pngBuffer = canvas.toBuffer("image/png");
    console.log("✅ Canvas converted to PNG, size:", pngBuffer.length, "bytes");

    // Create PDF from PNG
// Embed in PDF using same 842×595 size
const pdfDoc = await PDFDocument.create()
const pngImage = await pdfDoc.embedPng(pngBuffer)

    console.log("✅ PNG embedded in PDF");

    const page = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT])

    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    })
    console.log("✅ PDF page created");

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

    // Return PDF as response
    return new NextResponse(pdfBytes, {
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

// Legacy certificate generation for backward compatibility
async function generateLegacyCertificate(
  req: NextRequest,
  trainee: any,
  courseName: string,
  scheduleRange: string,
  givenThisDate: string
) {
  let templatePath = "";
  let courseType: "boshso1" | "boshso2" = "boshso1";

  if (courseName.includes("BOSH") && courseName.includes("SO1")) {
    templatePath = path.join(process.cwd(), "public/templates/certificates/BOSHS01-template.png");
    courseType = "boshso1";
  } else if (courseName.includes("BOSH") && courseName.includes("SO2")) {
    templatePath = path.join(process.cwd(), "public/templates/certificates/BOSHSO2-template.png");
    courseType = "boshso2";
  } else {
    return NextResponse.json(
      { success: false, error: "No certificate template found for this course" },
      { status: 404 }
    );
  }

  if (!fs.existsSync(templatePath)) {
    return NextResponse.json(
      { success: false, error: `Certificate template file not found` },
      { status: 404 }
    );
  }

  const templateImage = await loadImage(templatePath);
  const canvas = createCanvas(templateImage.width, templateImage.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(templateImage, 0, 0);

  // Load trainee photo
  if (trainee.picture_2x2_url) {
    try {
      const imageResponse = await fetch(
        `${req.nextUrl.origin}/api/image-proxy?url=${encodeURIComponent(trainee.picture_2x2_url)}`
      );

      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const img = await loadImage(Buffer.from(imageBuffer));

        const size = canvas.width * 0.097;
        const x = canvas.width * 0.848;
        const y = canvas.height * 0.048;

        ctx.drawImage(img, x, y, size, size);
      }
    } catch (error) {
      console.warn("Failed to load trainee photo:", error);
    }
  }

  function capitalize(word: string | null | undefined): string {
    if (!word) return "";
    return word.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  const baseFontSize = canvas.width / 25.7;
  const smallFontSize = canvas.width / 78;
  const tinyFontSize = canvas.width / 77;

  const first = capitalize(trainee.first_name);
  const middle = trainee.middle_initial ? capitalize(trainee.middle_initial) + ". " : "";
  const last = capitalize(trainee.last_name);
  const fullName = `${first} ${middle}${last}`;

  const finalGivenDate = givenThisDate || new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#000";

  if (courseType === "boshso1") {
    ctx.font = `bold ${baseFontSize}px Arial`;
    ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389);

    ctx.font = `italic ${smallFontSize}px Arial`;
    ctx.fillText(scheduleRange, canvas.width * 0.33, canvas.height * 0.694);
    ctx.fillText("Via Zoom Meeting", canvas.width * 0.5, canvas.height * 0.694);
    ctx.fillText(finalGivenDate, canvas.width * 0.45, canvas.height * 0.732);

    ctx.font = `${tinyFontSize}px Arial`;
    ctx.textAlign = "right";
    ctx.fillText(trainee.certificate_number, canvas.width * 0.96, canvas.height * 0.2);
  } else if (courseType === "boshso2") {
    ctx.font = `bold ${baseFontSize}px Arial`;
    ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389);

    ctx.font = `italic ${smallFontSize}px Arial`;
    ctx.fillText(scheduleRange, canvas.width * 0.33, canvas.height * 0.66);
    ctx.fillText("Via Zoom Meeting", canvas.width * 0.5, canvas.height * 0.66);
    ctx.fillText(finalGivenDate, canvas.width * 0.43, canvas.height * 0.7);

    ctx.font = `${tinyFontSize}px Arial`;
    ctx.textAlign = "right";
    ctx.fillText(trainee.certificate_number, canvas.width * 0.96, canvas.height * 0.2);
  }

  const pngBuffer = canvas.toBuffer("image/png");
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
  page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });

  pdfDoc.setTitle(`Certificate - ${trainee.first_name} ${trainee.last_name}`);
  pdfDoc.setAuthor("Petrosphere Training Center");
  pdfDoc.setSubject(`${courseName} Certificate of Completion`);

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Certificate_${trainee.certificate_number}_${trainee.last_name}_${trainee.first_name}.pdf"`,
    },
  });
}