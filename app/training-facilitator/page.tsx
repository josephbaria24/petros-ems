"use client"

import * as React from "react"
import Image from "next/image"
import { tmsDb } from "@/lib/supabase-client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import QRCode from "qrcode"
import { toPublicManualUrl } from "@/lib/manual-public-url"
import { ArrowLeft, ExternalLink, Loader2, Pencil, QrCode, Search, Upload, X } from "lucide-react"

type Training = {
  courseId: string
  courseName: string
  schedules: number
}

type Material = {
  id: string
  course_id: string
  kind: string
  title: string
  file_name: string | null
  file_url: string
  uploaded_at: string | null
}

const KIT = [
  { key: "manual", label: "Training Manual", hint: "Module or facilitator guide" },
  { key: "activity", label: "Activity Forms", hint: "Exercises, worksheets, and activity sheets" },
  { key: "ppt", label: "Presentation", hint: "Slides used during the session" },
  { key: "handout", label: "Handouts", hint: "Participant copies and references" },
  { key: "form", label: "Session Forms", hint: "Attendance, evaluation, or sign-off forms" },
  { key: "other", label: "Other", hint: "Any extra file needed to facilitate" },
]

const FACILITATOR_ART: { test: (key: string) => boolean; src: string; bg: string }[] = [
  { test: (key) => /emsnciiassess|emsassess|nciiassess/.test(key), src: "/facilitators/EMS-NC-II-Assessment.png", bg: "#C44512" },
  { test: (key) => key === "ems" || /emsncii|emergencymedical|ncii/.test(key), src: "/facilitators/EMS-NC-II.png", bg: "#C44010" },
  { test: (key) => /boshso2|bosh.*so2|safetyofficer2/.test(key), src: "/facilitators/BOSH-SO2.png", bg: "#6A3CB8" },
  { test: (key) => /boshso1|bosh.*so1|safetyofficer1/.test(key), src: "/facilitators/BOSH-SO1.png", bg: "#0A4A88" },
  { test: (key) => /cosh|construction/.test(key), src: "/facilitators/COSH.png", bg: "#0C4A92" },
  { test: (key) => /hirac|hazard|riskassess/.test(key), src: "/facilitators/HIRAC.png", bg: "#C02078" },
  { test: (key) => /industrialhygiene|hygiene|respirat|chemical/.test(key), src: "/facilitators/Industrial-Hygiene.png", bg: "#0A789C" },
  { test: (key) => /foodsafety|haccp|food/.test(key), src: "/facilitators/Food-Safety.png", bg: "#1B5BD8" },
  { test: (key) => /bfft|firefight|fire/.test(key), src: "/facilitators/BFFT.png", bg: "#6B35C0" },
  { test: (key) => /bfat|firstaid/.test(key), src: "/facilitators/BFAT.png", bg: "#127A5C" },
  { test: (key) => /acls|advancedcardiac|advancedcardiovascular|defibril/.test(key), src: "/facilitators/ACLS.png", bg: "#0B5A4A" },
  { test: (key) => /bls|basiclifesupport|cpr|resuscitat/.test(key), src: "/facilitators/BLS.png", bg: "#0A5346" },
  { test: (key) => /bosh|occupationalsafety|safetyofficer/.test(key), src: "/facilitators/BOSH-SO1.png", bg: "#0A4A88" },
  { test: (key) => /inspect|audit|risk/.test(key), src: "/facilitators/HIRAC.png", bg: "#C02078" },
  { test: (key) => /medical|paramedic|trauma/.test(key), src: "/facilitators/EMS-NC-II.png", bg: "#C44010" },
  { test: (key) => /safety/.test(key), src: "/facilitators/BOSH-SO1.png", bg: "#0A4A88" },
]

const FALLBACK_ART = { src: "/facilitators/BOSH-SO1.png", bg: "#0A4A88" }

function artFor(name: string) {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const match = FACILITATOR_ART.find((item) => item.test(key))
  return match ? { src: match.src, bg: match.bg } : FALLBACK_ART
}

function FacilitatorArt({ name, className }: { name: string; className?: string }) {
  const art = artFor(name)
  return (
    <div className={`relative overflow-hidden ${className || ""}`} style={{ backgroundColor: art.bg }}>
      <Image src={art.src} alt="" fill className="pointer-events-none object-contain p-3" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 384px" />
    </div>
  )
}

async function downloadManualQr(label: string, publicUrl: string) {
  const qrSize = 720
  const qrCanvas = document.createElement("canvas")
  await QRCode.toCanvas(qrCanvas, publicUrl, {
    width: qrSize,
    margin: 1,
    color: { dark: "#1A1D66", light: "#ffffff" },
  })

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not draw QR")

  const width = 860
  const height = 1120
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = "#1A1D66"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#FFCC00"
  ctx.fillRect(0, 0, width, 18)
  ctx.fillRect(0, height - 18, width, 18)

  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.font = "bold 28px Arial, sans-serif"
  ctx.fillText("PETROSPHERE", width / 2, 62)
  ctx.font = "16px Arial, sans-serif"
  ctx.fillStyle = "#FFCC00"
  ctx.fillText("TRAINING MANUAL", width / 2, 92)

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(70, 120, qrSize, qrSize)
  ctx.drawImage(qrCanvas, 70, 120)

  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 26px Arial, sans-serif"
  const words = label.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > 760) {
      if (current) lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  lines.slice(0, 3).forEach((line, index) => ctx.fillText(line, width / 2, 890 + index * 34))

  ctx.font = "14px Arial, sans-serif"
  ctx.fillStyle = "#FFCC00"
  ctx.fillText(publicUrl.length > 72 ? `${publicUrl.slice(0, 69)}...` : publicUrl, width / 2, 1048)

  const link = document.createElement("a")
  link.href = canvas.toDataURL("image/png")
  link.download = `QR-${label.replace(/[^a-z0-9]+/gi, "-")}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function TrainingFacilitatorPage() {
  const [trainings, setTrainings] = React.useState<Training[]>([])
  const [materials, setMaterials] = React.useState<Material[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [storageReady, setStorageReady] = React.useState(true)
  const [uploading, setUploading] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draftTitle, setDraftTitle] = React.useState("")
  const [manualLink, setManualLink] = React.useState("")

  const selected = trainings.find((item) => item.courseId === selectedId) || null
  const filtered = trainings.filter((item) => item.courseName.toLowerCase().includes(query.trim().toLowerCase()))
  const selectedFiles = materials.filter((file) => file.course_id === selectedId)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: schedules, error: scheduleError }, { data: courses }, { data: files, error: fileError }] = await Promise.all([
        tmsDb.from("schedules").select("id, course_id, status"),
        tmsDb.from("courses").select("id, name"),
        tmsDb.from("facilitator_materials").select("*").order("uploaded_at", { ascending: false }),
      ])

      if (scheduleError) throw scheduleError
      setStorageReady(!fileError)
      setMaterials(fileError ? [] : files || [])

      const courseName = new Map((courses || []).map((course) => [course.id, course.name || "Training"]))
      const counts = new Map<string, number>()
      for (const schedule of schedules || []) {
        if (!schedule.course_id) continue
        if ((schedule.status || "").toLowerCase() === "cancelled") continue
        counts.set(schedule.course_id, (counts.get(schedule.course_id) || 0) + 1)
      }

      const listedIds = new Set(counts.keys())
      for (const file of files || []) {
        if (file.course_id && !listedIds.has(file.course_id)) counts.set(file.course_id, 0)
      }

      setTrainings(
        Array.from(counts.entries())
          .map(([courseId, schedulesCount]) => ({
            courseId,
            courseName: courseName.get(courseId) || "Training",
            schedules: schedulesCount,
          }))
          .sort((a, b) => a.courseName.localeCompare(b.courseName))
      )
    } catch (error) {
      console.error(error)
      toast.error("Could not load facilitation materials.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const uploadFile = async (courseId: string, kind: string, file: File, courseName: string) => {
    setUploading(`${courseId}:${kind}`)
    try {
      const body = new FormData()
      const isManual = kind === "manual"
      body.append(isManual ? "material" : "image", file)
      const response = await fetch(isManual ? "/api/upload-training-manual" : "/api/upload", { method: "POST", body })
      const payload = await response.json()
      if (!response.ok || !payload.url) throw new Error(payload.error || "Upload failed")
      const publicUrl = isManual ? toPublicManualUrl(payload.url, payload.entryFile) : payload.url

      const label = KIT.find((item) => item.key === kind)?.label || "File"
      const { data, error } = await tmsDb
        .from("facilitator_materials")
        .insert({
          course_id: courseId,
          kind,
          title: file.name.replace(/\.[^.]+$/, "") || label,
          file_name: file.name,
          file_url: publicUrl,
        })
        .select("*")
        .single()

      if (error || !data) throw error || new Error("Could not save file")
      setMaterials((prev) => [data, ...prev])
      if (isManual) {
        await downloadManualQr(courseName, publicUrl)
        toast.success("Manual uploaded. QR uses the public Petrosphere link.")
      } else {
        toast.success("Material added")
      }
    } catch (error) {
      console.error(error)
      toast.error("Could not upload that file. Run scripts/add-facilitator-files.sql if this is the first upload.")
    } finally {
      setUploading(null)
    }
  }

  const saveTitle = async (material: Material) => {
    const title = draftTitle.trim()
    if (!title) return
    const { data, error } = await tmsDb
      .from("facilitator_materials")
      .update({ title })
      .eq("id", material.id)
      .select("*")
      .single()
    if (error || !data) {
      toast.error("Could not update that file.")
      return
    }
    setMaterials((prev) => prev.map((item) => (item.id === material.id ? data : item)))
    setEditingId(null)
  }

  const attachManualLink = async (courseId: string, courseName: string) => {
    const publicUrl = toPublicManualUrl(manualLink)
    if (!publicUrl) return
    if (!publicUrl.toLowerCase().includes(".html")) {
      toast.error("Use the public manual page, including the .html file. Hostinger folder links are only the file manager path.")
      return
    }
    const { data, error } = await tmsDb
      .from("facilitator_materials")
      .insert({
        course_id: courseId,
        kind: "manual",
        title: courseName,
        file_name: publicUrl.split("/").pop() || "Training Manual",
        file_url: publicUrl,
      })
      .select("*")
      .single()
    if (error || !data) {
      toast.error("Could not save that manual link.")
      return
    }
    setMaterials((prev) => [data, ...prev])
    setManualLink("")
    await downloadManualQr(courseName, publicUrl)
    toast.success("QR uses the public Petrosphere link.")
  }

  const removeFile = async (material: Material) => {
    const { error } = await tmsDb.from("facilitator_materials").delete().eq("id", material.id)
    if (error) {
      toast.error("Could not remove file.")
      return
    }
    setMaterials((prev) => prev.filter((item) => item.id !== material.id))
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8a8c9a]">Trainings</p>
          <h1 className="text-2xl font-semibold text-[#1c1e28] dark:text-white">Facilitator Materials</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6b6e7c]">
            Open a training to manage the manuals, activity forms, presentations, and other files needed to facilitate it.
          </p>
        </div>
        {!selected && (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8c9a]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search training" className="pl-9" />
          </div>
        )}
      </div>

      {!storageReady && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          File storage is not set up yet. Run <span className="font-semibold">scripts/add-facilitator-files.sql</span> in Supabase, then refresh.
        </div>
      )}

      {selected ? (
        <section className="rounded-2xl border border-[#e6e7ee] bg-white p-5 dark:border-[#2a2c36] dark:bg-[#1b1d26]">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mb-4 inline-flex items-center text-sm font-medium text-[#1A1D66] dark:text-[#daae02]"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All trainings
          </button>
          <div
            className="mb-5 grid overflow-hidden rounded-2xl text-white md:grid-cols-[240px_1fr]"
            style={{ backgroundColor: artFor(selected.courseName).bg }}
          >
            <FacilitatorArt name={selected.courseName} className="h-44 md:h-full md:min-h-[176px]" />
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Facilitation kit</p>
              <h2 className="mt-2 text-2xl font-semibold">{selected.courseName}</h2>
              <p className="mt-1 text-sm text-white/80">
                {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} · {selected.schedules} schedule{selected.schedules === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {KIT.map((slot) => {
              const saved = selectedFiles.filter((file) => file.kind === slot.key)
              const busy = uploading === `${selected.courseId}:${slot.key}`
              return (
                <div key={slot.key} className="rounded-xl border border-[#e6e7ee] p-3 dark:border-[#2a2c36]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1c1e28] dark:text-white">{slot.label}</p>
                      <p className="text-xs text-[#8a8c9a]">{slot.hint}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${saved.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      {saved.length ? `${saved.length} file${saved.length === 1 ? "" : "s"}` : "Needed"}
                    </span>
                  </div>
                  {saved.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {saved.map((file) => (
                        <li key={file.id} className="rounded-lg bg-[#f4f5f8] px-2.5 py-2 text-xs dark:bg-[#242733]">
                          {editingId === file.id ? (
                            <div className="flex gap-2">
                              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="h-8" />
                              <Button type="button" size="sm" onClick={() => void saveTitle(file)}>Save</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[#3c3e4a] dark:text-[#d7d8e0]">{file.title || file.file_name}</span>
                              {slot.key === "manual" && (
                                <button
                                  type="button"
                                  aria-label="Download QR"
                                  onClick={() => void downloadManualQr(file.title || selected.courseName, toPublicManualUrl(file.file_url))}
                                  className="text-[#1A1D66] dark:text-[#daae02]"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <a href={toPublicManualUrl(file.file_url)} target="_blank" rel="noreferrer" className="text-[#1A1D66] dark:text-[#daae02]" aria-label="Open file">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                              <button
                                type="button"
                                aria-label="Edit file name"
                                onClick={() => {
                                  setEditingId(file.id)
                                  setDraftTitle(file.title || file.file_name || "")
                                }}
                                className="text-[#5c5e6c]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => void removeFile(file)} className="text-red-700" aria-label="Remove file">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {slot.key === "manual" && (
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={manualLink}
                        onChange={(event) => setManualLink(event.target.value)}
                        placeholder="Paste Hostinger or public manual link"
                        className="h-8"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => void attachManualLink(selected.courseId, selected.courseName)}>
                        Link
                      </Button>
                    </div>
                  )}
                  <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-[#d7d9e2] px-2.5 py-1.5 text-xs font-medium hover:bg-[#f4f5f8] dark:border-[#3a3d4a] dark:hover:bg-[#242733]">
                    {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    Upload new
                    <input
                      type="file"
                      className="hidden"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void uploadFile(selected.courseId, slot.key, file, selected.courseName)
                        event.target.value = ""
                      }}
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </section>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-[#8a8c9a]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading trainings
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#8a8c9a]">No trainings yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const count = materials.filter((file) => file.course_id === item.courseId).length
            const ready = KIT.filter((slot) => materials.some((file) => file.course_id === item.courseId && file.kind === slot.key)).length
            return (
              <button
                key={item.courseId}
                type="button"
                onClick={() => setSelectedId(item.courseId)}
                className="overflow-hidden rounded-2xl border border-[#e6e7ee] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#2a2c36] dark:bg-[#1b1d26]"
              >
                <FacilitatorArt name={item.courseName} className="h-44" />
                <div className="px-4 py-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight text-[#1c1e28] dark:text-white">{item.courseName}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#6b6e7c]">
                    <span>{item.schedules} schedule{item.schedules === 1 ? "" : "s"}</span>
                    <span>{ready}/{KIT.length} materials · {count} file{count === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
