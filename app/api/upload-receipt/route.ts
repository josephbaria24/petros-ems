//app/api/upload-receipt/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Files, Fields } from "formidable";
import { Readable } from "stream";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper: convert NextRequest -> Node-style Readable with headers
function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() {} });
  req
    .arrayBuffer()
    .then((buffer) => {
      readable.push(Buffer.from(buffer));
      readable.push(null);
    })
    .catch((err) => readable.destroy(err));
  (readable as any).headers = Object.fromEntries(req.headers);
  (readable as any).method = req.method;
  (readable as any).url = req.url;
  return readable;
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = new IncomingForm({ multiples: false });
    const nodeReq = toNodeRequest(req);

    form.parse(nodeReq, async (err: any, fields: Fields, files: Files) => {
      if (err) {
        console.error("Form parse error:", err);
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        return;
      }

      const receiptFile = Array.isArray(files.receipt)
        ? files.receipt[0]
        : (files.receipt as any);

      if (!receiptFile) {
        resolve(
          NextResponse.json({ error: "No receipt uploaded" }, { status: 400 })
        );
        return;
      }

      const client = new ftp.Client();
      client.ftp.verbose = true;

      try {
        // Connect using your FTP credentials
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!,
          user: process.env.HOSTINGER_SFTP_USER!,
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false,
        });

        // Generate unique filename for receipt
        const extension = receiptFile.originalFilename
          ?.split(".")
          ?.pop()
          ?.toLowerCase();
        const newFileName = `receipt_${randomUUID()}.${extension}`;

        // Ensure receipts directory exists and navigate into it
        try {
          await client.ensureDir("receipts");
          console.log("✅ Receipts directory ensured, now inside receipts/");
          
          // Now we're inside receipts/, so just use the filename
          await client.uploadFrom(receiptFile.filepath, newFileName);
          console.log(`✅ Uploaded to receipts/${newFileName}`);
          
          const publicUrl = `https://petrosphere.com.ph/uploads/trainees/receipts/${newFileName}`;
          client.close();
          
          resolve(NextResponse.json({ url: publicUrl }, { status: 200 }));
          
        } catch (uploadError: any) {
          console.error("❌ Failed to upload to receipts folder:", uploadError);
          
          // Fallback: go back to root and upload with receipts_ prefix
          try {
            await client.cd("/");
            const fallbackFileName = `receipts_${newFileName}`;
            await client.uploadFrom(receiptFile.filepath, fallbackFileName);
            console.log(`✅ Uploaded to root as ${fallbackFileName}`);
            
            const fallbackUrl = `https://petrosphere.com.ph/uploads/trainees/${fallbackFileName}`;
            client.close();
            
            resolve(NextResponse.json({ url: fallbackUrl }, { status: 200 }));
          } catch (fallbackError: any) {
            console.error("❌ Fallback upload also failed:", fallbackError);
            client.close();
            resolve(
              NextResponse.json({ error: "Failed to upload file to server" }, { status: 500 })
            );
          }
        }
      } catch (connError: any) {
        console.error("❌ FTP connection error:", connError);
        client.close();
        resolve(
          NextResponse.json({ error: connError.message }, { status: 500 })
        );
      }
    });
  });
}