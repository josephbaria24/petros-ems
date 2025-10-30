// app/api/test-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const results: any = {
    environment: process.env.NODE_ENV,
    modules: {},
    errors: [],
  };

  // Test canvas
  try {
    const canvas = require("canvas");
    results.modules.canvas = "✅ Loaded successfully";
    results.modules.canvasVersion = canvas.version || "unknown";
  } catch (error: any) {
    results.modules.canvas = "❌ Failed to load";
    results.errors.push(`Canvas error: ${error.message}`);
  }

  // Test pdf-lib
  try {
    const pdfLib = require("pdf-lib");
    results.modules.pdfLib = "✅ Loaded successfully";
  } catch (error: any) {
    results.modules.pdfLib = "❌ Failed to load";
    results.errors.push(`PDF-lib error: ${error.message}`);
  }

  // Test fs
  try {
    const fs = require("fs");
    results.modules.fs = "✅ Loaded successfully";
  } catch (error: any) {
    results.modules.fs = "❌ Failed to load";
    results.errors.push(`FS error: ${error.message}`);
  }

  // Test path
  try {
    const path = require("path");
    results.modules.path = "✅ Loaded successfully";
    results.cwd = process.cwd();
  } catch (error: any) {
    results.modules.path = "❌ Failed to load";
    results.errors.push(`Path error: ${error.message}`);
  }

  // Check template files
  try {
    const fs = require("fs");
    const path = require("path");
    
    const template1 = path.join(process.cwd(), "public/templates/certificates/BOSHS01-template.png");
    const template2 = path.join(process.cwd(), "public/templates/certificates/BOSHSO2-template.png");
    
    results.templates = {
      BOSHS01: fs.existsSync(template1) ? "✅ Found" : "❌ Not found",
      BOSHSO2: fs.existsSync(template2) ? "✅ Found" : "❌ Not found",
      paths: {
        BOSHS01: template1,
        BOSHSO2: template2,
      }
    };
  } catch (error: any) {
    results.templates = "❌ Could not check templates";
    results.errors.push(`Template check error: ${error.message}`);
  }

  return NextResponse.json(results, {
    status: results.errors.length > 0 ? 500 : 200,
  });
}