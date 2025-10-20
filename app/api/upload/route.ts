import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Files, Fields } from "formidable";
import { Readable } from "stream";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto"; // ✅ Added for unique filenames

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

      const imageFile = Array.isArray(files.image)
        ? files.image[0]
        : (files.image as any);

      if (!imageFile) {
        resolve(
          NextResponse.json({ error: "No image uploaded" }, { status: 400 })
        );
        return;
      }

      const client = new ftp.Client();
      client.ftp.verbose = true; // Optional: logs FTP steps

      try {
        // Connect using your FTP credentials
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!, // e.g. ftp.petrosphere.com.ph
          user: process.env.HOSTINGER_SFTP_USER!, // e.g. u747590433.petros
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false, // plain FTP
        });

        // ✅ Generate unique filename
        const extension = imageFile.originalFilename
          ?.split(".")
          ?.pop()
          ?.toLowerCase();
        const newFileName = `${randomUUID()}.${extension}`;

        // ✅ Upload with new unique name
        await client.uploadFrom(imageFile.filepath, newFileName);
        client.close();

        // ✅ Return the public URL for this file
        const publicUrl = `https://petrosphere.com.ph/uploads/trainees/${newFileName}`;
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
