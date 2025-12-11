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

        // Try to create receipts directory if it doesn't exist
        try {
          await client.ensureDir("receipts");
          console.log("Receipts directory ensured");
        } catch (dirError) {
          console.log("Could not ensure receipts directory, uploading to root");
        }

        // Try to upload to receipts folder first, fallback to root if fails
        let uploadPath = `receipts/${newFileName}`;
        let publicUrl = `https://petrosphere.com.ph/uploads/trainees/receipts/${newFileName}`;

        try {
          await client.uploadFrom(receiptFile.filepath, uploadPath);
          console.log(`Uploaded to ${uploadPath}`);
        } catch (uploadError) {
          console.log("Failed to upload to receipts folder, trying root directory");
          // Fallback: upload to root with receipts_ prefix
          uploadPath = `receipts_${newFileName}`;
          publicUrl = `https://petrosphere.com.ph/uploads/trainees/receipts/receipts_${newFileName}`;
          await client.uploadFrom(receiptFile.filepath, uploadPath);
          console.log(`Uploaded to root as ${uploadPath}`);
        }

        client.close();

        resolve(NextResponse.json({ url: publicUrl }, { status: 200 }));
      } catch (uploadErr: any) {
        console.error("FTP upload error:", uploadErr);
        resolve(
          NextResponse.json({ error: uploadErr.message }, { status: 500 })
        );
      }
    });
  });
}