// app/api/generate-certificate-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";

// Check if we're in a Node.js environment
let createCanvas: any;
let loadImage: any;
let PDFDocument: any;
let fs: any;
let path: any;

try {
  // Dynamically import Node.js modules
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

export async function POST(req: NextRequest) {
  try {
    // Check if modules are loaded
    if (!createCanvas || !loadImage || !PDFDocument) {
      console.error("❌ Required modules not available");
      return NextResponse.json(
        { success: false, error: "Server configuration error: Required modules not available. Please install canvas and pdf-lib." },
        { status: 500 }
      );
    }

    const { trainee, courseName, scheduleRange, givenThisDate } = await req.json();

    console.log("📝 Generating PDF for:", trainee.first_name, trainee.last_name);
    console.log("📚 Course:", courseName);
    console.log("📅 Schedule:", scheduleRange);

    if (!trainee || !courseName) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Determine certificate template
    let templatePath = "";
    let courseType: "boshso1" | "boshso2" = "boshso1";

    if (courseName.includes("BOSH") && courseName.includes("SO1")) {
      templatePath = path.join(
        process.cwd(),
        "public/templates/certificates/BOSHS01-template.png"
      );
      courseType = "boshso1";
    } else if (courseName.includes("BOSH") && courseName.includes("SO2")) {
      templatePath = path.join(
        process.cwd(),
        "public/templates/certificates/BOSHSO2-template.png"
      );
      courseType = "boshso2";
    } else {
      console.error("❌ No template found for course:", courseName);
      return NextResponse.json(
        { success: false, error: "No certificate template found for this course" },
        { status: 404 }
      );
    }

    console.log("📂 Template path:", templatePath);

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      console.error("❌ Template file not found at:", templatePath);
      return NextResponse.json(
        { success: false, error: `Certificate template file not found at: ${templatePath}` },
        { status: 404 }
      );
    }

    console.log("✅ Template file exists");

    // Load certificate template
    let templateImage;
    try {
      templateImage = await loadImage(templatePath);
      console.log("✅ Template image loaded, dimensions:", templateImage.width, "x", templateImage.height);
    } catch (error: any) {
      console.error("❌ Failed to load template image:", error);
      return NextResponse.json(
        { success: false, error: `Failed to load template image: ${error.message}` },
        { status: 500 }
      );
    }

    // Create canvas
    const canvas = createCanvas(templateImage.width, templateImage.height);
    const ctx = canvas.getContext("2d");

    // Draw template
    ctx.drawImage(templateImage, 0, 0);

    // Load and draw trainee photo if available
    if (trainee.picture_2x2_url) {
      try {
        // Fetch image through proxy
        const imageResponse = await fetch(
          `${req.nextUrl.origin}/api/image-proxy?url=${encodeURIComponent(
            trainee.picture_2x2_url
          )}`
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
        // Continue without photo
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

    // Calculate font sizes based on canvas width
    const baseFontSize = canvas.width / 25.7;
    const smallFontSize = canvas.width / 78;
    const tinyFontSize = canvas.width / 77;

    // Format trainee name
    const first = capitalize(trainee.first_name);
    const middle = trainee.middle_initial
      ? capitalize(trainee.middle_initial) + ". "
      : "";
    const last = capitalize(trainee.last_name);
    const fullName = `${first} ${middle}${last}`;

    // Format dates
    const finalGivenDate = givenThisDate || new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Draw text based on certificate type
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";

    if (courseType === "boshso1") {
      // Name
      ctx.font = `bold ${baseFontSize}px Arial`;
      ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389);

      // Training dates and venue
      ctx.font = `italic ${smallFontSize}px Arial`;
      ctx.fillText(scheduleRange, canvas.width * 0.33, canvas.height * 0.694);
      ctx.fillText("Via Zoom Meeting", canvas.width * 0.5, canvas.height * 0.694);
      ctx.fillText(finalGivenDate, canvas.width * 0.45, canvas.height * 0.732);

      // Certificate number
      ctx.font = `${tinyFontSize}px Arial`;
      ctx.textAlign = "right";
      ctx.fillText(
        trainee.certificate_number,
        canvas.width * 0.96,
        canvas.height * 0.2
      );
    } else if (courseType === "boshso2") {
      // Name
      ctx.font = `bold ${baseFontSize}px Arial`;
      ctx.fillText(fullName, canvas.width / 2, canvas.height * 0.389);

      // Training dates and venue
      ctx.font = `italic ${smallFontSize}px Arial`;
      ctx.fillText(scheduleRange, canvas.width * 0.33, canvas.height * 0.66);
      ctx.fillText("Via Zoom Meeting", canvas.width * 0.5, canvas.height * 0.66);
      ctx.fillText(finalGivenDate, canvas.width * 0.43, canvas.height * 0.7);

      // Certificate number
      ctx.font = `${tinyFontSize}px Arial`;
      ctx.textAlign = "right";
      ctx.fillText(
        trainee.certificate_number,
        canvas.width * 0.96,
        canvas.height * 0.2
      );
    }

    // Convert canvas to PNG buffer
    const pngBuffer = canvas.toBuffer("image/png");
    console.log("✅ Canvas converted to PNG, size:", pngBuffer.length, "bytes");

    // Create PDF from PNG
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    console.log("✅ PNG embedded in PDF");

    const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pngImage.width,
      height: pngImage.height,
    });
    console.log("✅ PDF page created");

    // Add metadata
    pdfDoc.setTitle(
      `Certificate - ${trainee.first_name} ${trainee.last_name}`
    );
    pdfDoc.setAuthor("Petrosphere Training Center");
    pdfDoc.setSubject(`${courseName} Certificate of Completion`);
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