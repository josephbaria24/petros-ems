//app\api\upload\route.ts
import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Files, Fields } from "formidable";
import { Readable } from "stream";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;  // optional

// Convert NextRequest → Node Request
function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() {} });

  req.arrayBuffer().then((buffer) => {
    readable.push(Buffer.from(buffer));
    readable.push(null);
  });

  (readable as any).headers = Object.fromEntries(req.headers);
  (readable as any).method = req.method;
  (readable as any).url = req.url;

  return readable;
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = new IncomingForm({ multiples: false });
    const nodeReq = toNodeRequest(req);

    form.parse(nodeReq, async (err, fields: Fields, files: Files) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        return;
      }

      const imageFile = Array.isArray(files.image)
        ? files.image[0]
        : (files.image as any);

      if (!imageFile) {
        resolve(NextResponse.json({ error: "No image uploaded" }, { status: 400 }));
        return;
      }

      const client = new ftp.Client();

      try {
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!,
          user: process.env.HOSTINGER_SFTP_USER!,
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false,
        });

        // Generate unique filename
        const ext = imageFile.originalFilename?.split(".").pop()?.toLowerCase();
        const newFileName = `${randomUUID()}.${ext}`;

        // Upload
        await client.uploadFrom(imageFile.filepath, newFileName);
        client.close();

        const publicUrl = `https://petrosphere.com.ph/uploads/trainees/${newFileName}`;

        resolve(NextResponse.json({ url: publicUrl }));
      } catch (uploadErr: any) {
        resolve(NextResponse.json({ error: uploadErr.message }, { status: 500 }));
      }
    });
  });
}
