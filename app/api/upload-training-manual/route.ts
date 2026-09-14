import { NextRequest, NextResponse } from "next/server"
import { IncomingForm, Files, Fields } from "formidable"
import { Readable } from "stream"
import * as ftp from "basic-ftp"
import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import AdmZip from "adm-zip"
import { toPublicManualUrl } from "@/lib/manual-public-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() {} })
  req.arrayBuffer().then((buffer) => {
    readable.push(Buffer.from(buffer))
    readable.push(null)
  })
  ;(readable as any).headers = Object.fromEntries(req.headers)
  ;(readable as any).method = req.method
  ;(readable as any).url = req.url
  return readable
}

async function uploadRecursive(client: ftp.Client, localDir: string) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullLocalPath = path.join(localDir, entry.name)
    if (entry.isDirectory()) {
      await client.ensureDir(entry.name)
      await client.cd(entry.name)
      await uploadRecursive(client, fullLocalPath)
      await client.cd("..")
    } else {
      await client.uploadFrom(fullLocalPath, entry.name)
    }
  }
}

function folderNameFrom(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "").trim()
  return base || `manual-${randomUUID().slice(0, 8)}`
}

function findHtmlEntry(dir: string) {
  const files = fs.readdirSync(dir)
  const html = files.filter((file) => file.toLowerCase().endsWith(".html"))
  return html.find((file) => /manual/i.test(file)) || html[0] || null
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = new IncomingForm({ multiples: false, maxFileSize: 500 * 1024 * 1024 })
    form.parse(toNodeRequest(req), async (err, _fields: Fields, files: Files) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }))
        return
      }

      const materialFile = Array.isArray(files.material) ? files.material[0] : (files.material as any)
      if (!materialFile) {
        resolve(NextResponse.json({ error: "No file uploaded" }, { status: 400 }))
        return
      }

      const client = new ftp.Client()
      const tempDir = path.join(os.tmpdir(), `manual-${randomUUID()}`)
      const originalName = materialFile.originalFilename || "training-manual"
      const ext = originalName.split(".").pop()?.toLowerCase() || ""
      const folderName = folderNameFrom(originalName)

      try {
        await client.access({
          host: process.env.HOSTINGER_SFTP_HOST!,
          user: process.env.HOSTINGER_SFTP_USER!,
          password: process.env.HOSTINGER_SFTP_PASS!,
          port: 21,
          secure: false,
        })

        // FTP home is /public_html/uploads/trainees. Manuals live beside uploads.
        await client.cd("/")
        await client.cd("../..")
        try {
          await client.cd("training-manuals")
        } catch {
          await client.ensureDir("training-manuals")
          await client.cd("training-manuals")
        }
        await client.ensureDir(folderName)
        await client.cd(folderName)

        let entryFile = originalName
        if (ext === "zip") {
          fs.mkdirSync(tempDir, { recursive: true })
          const zip = new AdmZip(materialFile.filepath)
          zip.extractAllTo(tempDir, true)
          const html = findHtmlEntry(tempDir)
          if (!html) {
            throw new Error("Zip has no HTML manual page. Include the .html file at the top of the folder.")
          }
          entryFile = html
          await uploadRecursive(client, tempDir)
        } else {
          entryFile = originalName
          await client.uploadFrom(materialFile.filepath, originalName)
        }

        client.close()
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })

        const url = toPublicManualUrl(`training-manuals/${folderName}/${entryFile}`)
        resolve(NextResponse.json({ url, folderName, entryFile }))
      } catch (uploadErr: any) {
        client.close()
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
        resolve(NextResponse.json({ error: uploadErr.message }, { status: 500 }))
      }
    })
  })
}
