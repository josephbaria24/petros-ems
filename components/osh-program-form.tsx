"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  type OshProgram,
  type OshProgramSession,
} from "@/lib/osh-program"

type OshProgramFormProps = {
  value: OshProgram
  onChange: (next: OshProgram) => void
  readOnly?: boolean
}

function Tick({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-start gap-2 text-sm", disabled && "cursor-default")}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  )
}

function CellInput({
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  return (
    <Input
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1",
        className
      )}
    />
  )
}

export function OshProgramForm({ value, onChange, readOnly }: OshProgramFormProps) {
  const patch = (partial: Partial<OshProgram>) => onChange({ ...value, ...partial })
  const patchType = (key: keyof OshProgram["trainingTypes"], next: boolean) =>
    patch({ trainingTypes: { ...value.trainingTypes, [key]: next } })
  const patchDelivery = (key: keyof OshProgram["delivery"], next: boolean) =>
    patch({ delivery: { ...value.delivery, [key]: next } })

  const updateSession = (id: string, partial: Partial<OshProgramSession>) =>
    patch({
      sessions: value.sessions.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    })

  const addSession = (afterId?: string) => {
    const next: OshProgramSession = {
      id: crypto.randomUUID?.() || `s-${Date.now()}`,
      day: value.sessions.at(-1)?.day || "Day 1",
      time: "",
      duration: "",
      topic: "",
      resourcePerson: "",
      accreditation: "",
      validity: "",
    }
    if (!afterId) {
      patch({ sessions: [...value.sessions, next] })
      return
    }
    const idx = value.sessions.findIndex((s) => s.id === afterId)
    const copy = [...value.sessions]
    copy.splice(idx + 1, 0, next)
    patch({ sessions: copy })
  }

  return (
    <div
      id="osh-program-sheet"
      className="overflow-hidden rounded-lg border bg-white text-[#111] shadow-sm dark:bg-card dark:text-foreground"
    >
      <div className="border-b bg-[#f7f7f7] px-4 py-3 dark:bg-muted/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Department of Labor and Employment
            </p>
            <h2 className="text-lg font-bold leading-tight">Mandatory OSH Training Program</h2>
            <p className="text-xs text-muted-foreground">Occupational Safety and Health Center</p>
          </div>
          <div className="text-right text-[11px] leading-snug text-muted-foreground">
            <div>DOLE-OSHC-STO-PROG</div>
            <div>Rev. No.: 01</div>
            <div>Effective: May 18, 2022</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name of STO
            </span>
            <Input
              value={value.stoName}
              disabled={readOnly}
              onChange={(e) => patch({ stoName: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date/s of Training
            </span>
            <Input
              value={value.dates}
              disabled={readOnly}
              onChange={(e) => patch({ dates: e.target.value })}
              placeholder="e.g. September 15–18, 2026"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Type of Training
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Tick checked={value.trainingTypes.boshPrivate} disabled={readOnly} onChange={(v) => patchType("boshPrivate", v)} label="BOSH (Private Sector)" />
            <Tick checked={value.trainingTypes.boshPublic} disabled={readOnly} onChange={(v) => patchType("boshPublic", v)} label="BOSH (Public Sector)" />
            <Tick checked={value.trainingTypes.boshSo1} disabled={readOnly} onChange={(v) => patchType("boshSo1", v)} label="BOSH for SO1" />
            <Tick checked={value.trainingTypes.cosh} disabled={readOnly} onChange={(v) => patchType("cosh", v)} label="COSH" />
            <Tick checked={value.trainingTypes.mosh} disabled={readOnly} onChange={(v) => patchType("mosh", v)} label="MOSH" />
            <div className="flex flex-wrap items-center gap-2">
              <Tick checked={value.trainingTypes.other} disabled={readOnly} onChange={(v) => patchType("other", v)} label="Other (specify):" />
              <Input
                value={value.otherSpecify}
                disabled={readOnly}
                onChange={(e) => patch({ otherSpecify: e.target.value })}
                className="h-8 max-w-xs"
                placeholder="Specify"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Training Delivery
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Tick checked={value.delivery.online} disabled={readOnly} onChange={(v) => patchDelivery("online", v)} label="Online Training" />
            <Tick checked={value.delivery.liveWebinar} disabled={readOnly} onChange={(v) => patchDelivery("liveWebinar", v)} label="Live Webinar" />
            <Tick checked={value.delivery.selfDirected} disabled={readOnly} onChange={(v) => patchDelivery("selfDirected", v)} label="Self-Directed" />
            <Tick checked={value.delivery.classroom} disabled={readOnly} onChange={(v) => patchDelivery("classroom", v)} label="Classroom-based (face-to-face)" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Platform
            </span>
            <Input
              value={value.platform}
              disabled={readOnly}
              onChange={(e) => patch({ platform: e.target.value })}
              placeholder="Instructor-Led Training / Online-Led"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Venue
            </span>
            <Input
              value={value.venue}
              disabled={readOnly}
              onChange={(e) => patch({ venue: e.target.value })}
              placeholder="Zoom Meetings / training room"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Submission Type
          </p>
          <div className="flex flex-wrap gap-4">
            <Tick
              checked={value.submissionInitial}
              disabled={readOnly}
              onChange={(v) => patch({ submissionInitial: v })}
              label="Initial Program (for Request to Conduct)"
            />
            <Tick
              checked={value.submissionActual}
              disabled={readOnly}
              onChange={(v) => patch({ submissionActual: v })}
              label="Actual Program (for Post Training Report)"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-20 px-2 py-2 font-semibold">Day</th>
                <th className="w-28 px-2 py-2 font-semibold">Time</th>
                <th className="w-32 px-2 py-2 font-semibold">Duration</th>
                <th className="px-2 py-2 font-semibold">Topic</th>
                <th className="w-40 px-2 py-2 font-semibold">Resource Person</th>
                <th className="w-36 px-2 py-2 font-semibold">Accreditation</th>
                <th className="w-28 px-2 py-2 font-semibold">Validity</th>
                  {!readOnly ? <th className="w-10 print:hidden" data-export-hide="true" /> : null}
              </tr>
            </thead>
            <tbody>
              {value.sessions.map((s) => (
                <tr key={s.id} className="border-t align-top">
                  <td className="p-1">
                    <CellInput value={s.day} disabled={readOnly} onChange={(v) => updateSession(s.id, { day: v })} />
                  </td>
                  <td className="p-1">
                    <CellInput value={s.time} disabled={readOnly} onChange={(v) => updateSession(s.id, { time: v })} />
                  </td>
                  <td className="p-1">
                    <CellInput value={s.duration} disabled={readOnly} onChange={(v) => updateSession(s.id, { duration: v })} />
                  </td>
                  <td className="p-1">
                    <Textarea
                      value={s.topic}
                      disabled={readOnly}
                      onChange={(e) => updateSession(s.id, { topic: e.target.value })}
                      className="min-h-[40px] border-0 bg-transparent px-1 py-1 text-xs shadow-none focus-visible:ring-1"
                    />
                  </td>
                  <td className="p-1">
                    <CellInput value={s.resourcePerson} disabled={readOnly} onChange={(v) => updateSession(s.id, { resourcePerson: v })} />
                  </td>
                  <td className="p-1">
                    <CellInput value={s.accreditation} disabled={readOnly} onChange={(v) => updateSession(s.id, { accreditation: v })} />
                  </td>
                  <td className="p-1">
                    <CellInput value={s.validity} disabled={readOnly} onChange={(v) => updateSession(s.id, { validity: v })} placeholder="mm/dd/yyyy" />
                  </td>
                  {!readOnly ? (
                    <td className="p-1 print:hidden" data-export-hide="true">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={value.sessions.length <= 1}
                        onClick={() =>
                          patch({ sessions: value.sessions.filter((x) => x.id !== s.id) })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly ? (
          <Button type="button" size="sm" variant="outline" className="gap-1.5 print:hidden" data-export-hide="true" onClick={() => addSession()}>
            <Plus className="h-3.5 w-3.5" />
            Add topic row
          </Button>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total duration (without lunch break)
            </span>
            <Input
              value={value.totalDuration}
              disabled={readOnly}
              onChange={(e) => patch({ totalDuration: e.target.value })}
              placeholder="40 hours"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Other remarks
            </span>
            <Input
              value={value.remarks}
              disabled={readOnly}
              onChange={(e) => patch({ remarks: e.target.value })}
            />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The official COSH / BOSH PDF agenda stays as printed. Tick the boxes here, fill dates, venue, resource
          persons and accreditation, then use Show preview to see the actual form before export.
        </p>
      </div>
    </div>
  )
}
