import { NextRequest, NextResponse } from "next/server";
import { IncomingForm } from "formidable";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import * as fs from "fs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const config = {
  api: { bodyParser: false }
};
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function toNodeRequest(req: NextRequest): any {
  const stream = new Readable({ read() {} });
  req.arrayBuffer().then(buf => {
    stream.push(Buffer.from(buf));
    stream.push(null);
  });
(stream as any).headers = Object.fromEntries(req.headers);
  return stream;
}

export async function POST(req: NextRequest) {
  return new Promise(async resolve => {
    const form = new IncomingForm({ multiples: false });

    form.parse(toNodeRequest(req), async (err, fields, files) => {
      if (err) return resolve(NextResponse.json({ error: "Upload failed" }, { status: 500 }));

const excelFile = Array.isArray(files.file) ? files.file[0] : files.file;

if (!excelFile) {
  return resolve(
    NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  );
}

      const buffer = await fs.promises.readFile(excelFile.filepath);

      // extract images
      const zip = new AdmZip(buffer);
      const images = zip.getEntries().filter(e => e.entryName.startsWith("xl/media/"));

      const uploadedImageMap: Record<string, string> = {};

      // Upload images to Hostinger
      const client = new ftp.Client();
      await client.access({
        host: process.env.HOSTINGER_SFTP_HOST!,
        user: process.env.HOSTINGER_SFTP_USER!,
        password: process.env.HOSTINGER_SFTP_PASS!,
        port: 21,
        secure: false,
      });

      for (const img of images) {
        const newName = randomUUID() + "." + img.entryName.split(".").pop();
        await client.uploadFrom(bufferToStream(img.getData()), newName);


        uploadedImageMap[img.entryName] = 
          `https://petrosphere.com.ph/uploads/trainees/${newName}`;
      }

      client.close();

      // Read Excel sheet
      const workbook = XLSX.read(buffer);
      const ws = workbook.Sheets["Directory of Participants"];
      const json = XLSX.utils.sheet_to_json(ws, {
        range: 14,
        header: [
          "no", "certNum", "lastName", "firstName", "middleInitial", "suffix",
          "gender", "age", "company", "position", "city", "region", "industry",
          "workers", "companyEmail", "personalEmail", "mobile", "landline",
          "idPictureRef", "mode", "batchNo"
        ],
        defval: ""
      });

      resolve(NextResponse.json({
        rows: json,
        images: uploadedImageMap
      }));
    });
  });
}
