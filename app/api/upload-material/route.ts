import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Files, Fields } from "formidable";
import { Readable } from "stream";
import * as ftp from "basic-ftp";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import AdmZip from "adm-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

async function uploadRecursive(client: ftp.Client, localDir: string) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullLocalPath = path.join(localDir, entry.name);
    if (entry.isDirectory()) {
      await client.ensureDir(entry.name);
      await client.cd(entry.name);
      await uploadRecursive(client, fullLocalPath);
      await client.cd("..");
    } else {
      await client.uploadFrom(fullLocalPath, entry.name);
    }
  }
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = new IncomingForm({ multiples: false, maxFileSize: 200 * 1024 * 1024 }); // 200MB limit
    const nodeReq = toNodeRequest(req);

    form.parse(nodeReq, async (err, fields: Fields, files: Files) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        return;
      }

      const materialFile = Array.isArray(files.material)
        ? files.material[0]
        : (files.material as any);

      if (!materialFile) {
        resolve(NextResponse.json({ error: "No file uploaded" }, { status: 400 }));
        return;
      }

      const client = new ftp.Client();
      const tempDir = path.join(os.tmpdir(), `material-${randomUUID()}`);

      try {
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!,
          user: process.env.HOSTINGER_SFTP_USER!,
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false,
        });

        client.ftp.verbose = true;

        // Navigate to materials root
        await client.cd("/");
        try {
          await client.cd("materials");
        } catch {
          await client.send("MKD materials");
          await client.cd("materials");
        }

        const originalName = materialFile.originalFilename || "";
        const isZip = originalName.toLowerCase().endsWith(".zip");
        const folderName = randomUUID();
        
        let publicUrl = "";
        let finalFileType = "pdf";

        if (isZip) {
          // Handle Articulate/ZIP
          fs.mkdirSync(tempDir, { recursive: true });
          const zip = new AdmZip(materialFile.filepath);
          zip.extractAllTo(tempDir, true);

          // Create folder on FTP
          await client.ensureDir(folderName);
          await client.cd(folderName);

          // Recursive upload
          await uploadRecursive(client, tempDir);

          // Identify entry point
          const filesInRoot = fs.readdirSync(tempDir);
          const entryPoints = ["index.html", "index_lms.html", "story.html", "launcher.html"];
          const entryFile = entryPoints.find(ep => filesInRoot.includes(ep)) || filesInRoot.find(f => f.endsWith(".html")) || "index.html";

          publicUrl = `https://petrosphere.com.ph/uploads/trainees/materials/${folderName}/${entryFile}`;
          finalFileType = "articulate";

          // Cleanup temp
          fs.rmSync(tempDir, { recursive: true, force: true });
        } else {
          // Handle Single PDF/File
          const ext = originalName.split(".").pop()?.toLowerCase() || "pdf";
          const newFileName = `${folderName}.${ext}`;
          await client.uploadFrom(materialFile.filepath, newFileName);
          publicUrl = `https://petrosphere.com.ph/uploads/trainees/materials/${newFileName}`;
          finalFileType = ext === "pdf" ? "pdf" : "other";
        }

        client.close();
        resolve(NextResponse.json({ url: publicUrl, fileType: finalFileType }));
      } catch (uploadErr: any) {
        client.close();
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        resolve(NextResponse.json({ error: uploadErr.message }, { status: 500 }));
      }
    });
  });
}

