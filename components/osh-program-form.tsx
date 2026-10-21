"use client"

import * as React from "react"
import { Check, ChevronsUpDown, FileDown, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  type OshProgram,
  type OshProgramSession,
} from "@/lib/osh-program"
import { type TrainerPerson } from "@/lib/trainer-repo-people"
import { downloadOshSheetPdf, oshSheetDownloadName } from "@/lib/osh-sheet-pdf"

type OshProgramFormProps = {
  value: OshProgram
  onChange: (next: OshProgram) => void
  readOnly?: boolean
  downloadName?: string
}

function SheetField({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 1,
  className,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  rows?: number
  className?: string
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent px-0.5 py-0.5 text-[11px] leading-snug break-words text-black outline-none [overflow-wrap:anywhere] placeholder:text-neutral-400 focus:bg-[#fff6cc] disabled:cursor-default",
        className
      )}
    />
  )
}

function Box({
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
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-start gap-1.5 text-left leading-tight text-black",
        disabled ? "cursor-default" : "cursor-pointer"
      )}
    >
      <span className="mt-px grid h-3 w-3 shrink-0 place-items-center border border-black bg-white">
        {checked ? <span className="h-2 w-2 bg-black" /> : null}
      </span>
      <span>{label}</span>
    </button>
  )
}

function ResourcePersonSelect({
  value,
  trainers,
  disabled,
  onSelectTrainer,
  onCustomName,
}: {
  value: string
  trainers: TrainerPerson[]
  disabled?: boolean
  onSelectTrainer: (trainer: TrainerPerson) => void
  onCustomName: (name: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const applyCustom = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const match = trainers.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (match) onSelectTrainer(match)
    else onCustomName(trimmed)
    setOpen(false)
    setQuery("")
  }

  if (disabled) {
    return <SheetField value={value} disabled onChange={() => undefined} />
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-6 w-full justify-between whitespace-normal rounded-none px-0.5 py-0.5 text-center text-[11px] font-normal text-black shadow-none hover:bg-[#fff6cc]"
        >
          <span className={cn("min-w-0 flex-1 break-words [overflow-wrap:anywhere]", !value && "text-neutral-400")}>{value || "Name"}</span>
          <ChevronsUpDown data-export-hide="true" className="ml-1 h-3 w-3 shrink-0 opacity-50 print:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search trainer..."
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                e.preventDefault()
                applyCustom(query)
              }
            }}
          />
          <CommandList onWheel={(e) => e.stopPropagation()}>
            <CommandEmpty>
              <div className="space-y-2 p-2 text-left text-xs text-muted-foreground">
                <p>No trainer found in the repository.</p>
                <Input
                  placeholder="Type a name and press Enter"
                  className="h-8 text-xs"
                  defaultValue={query}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      applyCustom((e.target as HTMLInputElement).value)
                    }
                  }}
                />
              </div>
            </CommandEmpty>
            <CommandGroup heading="Trainer repository">
              {trainers.map((trainer) => (
                <CommandItem
                  key={trainer.id}
                  value={`${trainer.name} ${trainer.accreditation} ${trainer.validity}`}
                  onSelect={() => {
                    onSelectTrainer(trainer)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === trainer.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{trainer.name}</span>
                    {(trainer.accreditation || trainer.validity) && (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {[trainer.accreditation, trainer.validity].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function OshProgramForm({ value, onChange, readOnly, downloadName }: OshProgramFormProps) {
  const [trainers, setTrainers] = React.useState<TrainerPerson[]>([])
  const [downloading, setDownloading] = React.useState(false)
  const [pendingRemoveId, setPendingRemoveId] = React.useState<string | null>(null)
  const valueRef = React.useRef(value)
  valueRef.current = value

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/osh-program/trainers")
        const payload = (await res.json().catch(() => ({}))) as { trainers?: TrainerPerson[] }
        if (!cancelled && res.ok && Array.isArray(payload.trainers)) {
          setTrainers(payload.trainers)
        }
      } catch {
        // Keep the text fields usable if the repository is unavailable.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

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

  const confirmRemove = () => {
    const id = pendingRemoveId
    setPendingRemoveId(null)
    if (!id) return
    const current = valueRef.current
    const index = current.sessions.findIndex((session) => session.id === id)
    if (index < 0 || current.sessions.length <= 1) return
    const removed = current.sessions[index]
    onChange({ ...current, sessions: current.sessions.filter((session) => session.id !== id) })
    toast("Topic row removed", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          const latest = valueRef.current
          if (latest.sessions.some((session) => session.id === removed.id)) return
          const next = [...latest.sessions]
          next.splice(Math.min(index, next.length), 0, removed)
          onChange({ ...latest, sessions: next })
        },
      },
    })
  }

  const pendingSession = value.sessions.find((session) => session.id === pendingRemoveId)
  const cell = "border border-black px-1.5 py-1 align-middle break-words [overflow-wrap:anywhere]"
  const label = "w-[132px] bg-white font-semibold"
  const head = "border border-black bg-[#f3f3f3] px-1 py-1 text-center align-middle text-[10px] font-semibold leading-tight"

  const downloadSheet = async () => {
    setDownloading(true)
    try {
      await downloadOshSheetPdf(downloadName || oshSheetDownloadName())
    } catch (error) {
      toast.error("Could not download the sheet", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div id="osh-program-sheet" className="overflow-x-auto rounded-lg bg-[#5f6368] p-3">
      <div className="mx-auto mb-2 flex w-full max-w-[980px] justify-end print:hidden" data-export-hide="true">
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5 bg-[#1A1D66] hover:bg-[#141654] sm:w-auto"
          disabled={downloading}
          onClick={() => void downloadSheet()}
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          Download sheet
        </Button>
      </div>
      <div
        data-osh-paper="true"
        className="mx-auto w-[980px] max-w-none bg-white px-5 py-4 text-black shadow-md"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <table data-osh-block="logos" className="w-full border-collapse text-[11px] leading-tight">
          <tbody>
            <tr>
              <td className="w-[58px] border border-black p-1 text-center align-middle">
                <img src="/templates/reports/osh-logo-0.png" alt="DOLE" className="mx-auto h-11 w-auto" />
              </td>
              <td className="border border-black px-2 py-1 align-middle text-[12px] font-bold leading-tight">
                Department of Labor and Employment
                <br />
                Occupational Safety and Health Center
              </td>
              <td className="w-[58px] border border-black p-1 text-center align-middle">
                <img src="/templates/reports/osh-logo-1.png" alt="OSHC" className="mx-auto h-10 w-auto" />
              </td>
              <td className="border border-black px-2 py-1 text-center align-middle text-[13px] font-bold leading-tight tracking-wide">
                MANDATORY OSH
                <br />
                TRAINING PROGRAM
              </td>
              <td className="w-[118px] border border-black px-1.5 py-1 align-middle text-[9px] leading-tight">
                <div className="font-semibold">DOLE-OSHC-STO-PROG</div>
                <div>Rev. No.: 01</div>
                <div>Effective: May 18, 2022</div>
              </td>
            </tr>
          </tbody>
        </table>

        <table data-osh-block="fields" className="w-full border-collapse text-[11px] leading-tight">
          <tbody>
            <tr>
              <td className={cn(cell, label)}>Name of STO:</td>
              <td className={cell} colSpan={3}>
                <SheetField value={value.stoName} disabled={readOnly} onChange={(v) => patch({ stoName: v })} />
              </td>
            </tr>
            <tr>
              <td className={cn(cell, label)} rowSpan={2}>Type of Training:</td>
              <td className={cell} colSpan={3}>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <Box checked={value.trainingTypes.boshPrivate} disabled={readOnly} onChange={(v) => patchType("boshPrivate", v)} label="BOSH (Private Sector)" />
                  <Box checked={value.trainingTypes.boshPublic} disabled={readOnly} onChange={(v) => patchType("boshPublic", v)} label="BOSH (Public Sector)" />
                  <Box checked={value.trainingTypes.boshSo1} disabled={readOnly} onChange={(v) => patchType("boshSo1", v)} label="BOSH for SO1" />
                  <Box checked={value.trainingTypes.cosh} disabled={readOnly} onChange={(v) => patchType("cosh", v)} label="COSH" />
                </div>
              </td>
            </tr>
            <tr>
              <td className={cn(cell, "w-[18%]")}>
                <Box checked={value.trainingTypes.mosh} disabled={readOnly} onChange={(v) => patchType("mosh", v)} label="MOSH" />
              </td>
              <td className={cell} colSpan={2}>
                <div className="flex items-start gap-2">
                  <Box checked={value.trainingTypes.other} disabled={readOnly} onChange={(v) => patchType("other", v)} label="Other (specify):" />
                  <div className="min-w-0 flex-1">
                    <SheetField
                      value={value.otherSpecify}
                      disabled={readOnly}
                      rows={2}
                      onChange={(v) => patch({ otherSpecify: v })}
                    />
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className={cn(cell, label)} rowSpan={2}>Training Delivery:</td>
              <td className={cell}>
                <Box checked={value.delivery.online} disabled={readOnly} onChange={(v) => patchDelivery("online", v)} label="Online Training:" />
              </td>
              <td className={cell}>
                <div className="space-y-1">
                  <Box checked={value.delivery.liveWebinar} disabled={readOnly} onChange={(v) => patchDelivery("liveWebinar", v)} label="Live Webinar" />
                  <Box checked={value.delivery.selfDirected} disabled={readOnly} onChange={(v) => patchDelivery("selfDirected", v)} label="Self-Directed" />
                </div>
              </td>
              <td className={cell}>
                <Box checked={value.delivery.classroom} disabled={readOnly} onChange={(v) => patchDelivery("classroom", v)} label="Classroom-based (face-to-face) Training" />
              </td>
            </tr>
            <tr>
              <td className={cell} colSpan={2}>
                <div className="flex items-start gap-1">
                  <span className="shrink-0 pt-0.5 font-semibold">Platform:</span>
                  <SheetField value={value.platform} disabled={readOnly} onChange={(v) => patch({ platform: v })} placeholder="Online-Led" />
                </div>
              </td>
              <td className={cell}>
                <div className="flex items-start gap-1">
                  <span className="shrink-0 pt-0.5 font-semibold">Venue:</span>
                  <SheetField value={value.venue} disabled={readOnly} onChange={(v) => patch({ venue: v })} placeholder="Zoom Meetings" />
                </div>
              </td>
            </tr>
            <tr>
              <td className={cn(cell, label)}>Date/s of Training:</td>
              <td className={cell} colSpan={3}>
                <SheetField value={value.dates} disabled={readOnly} onChange={(v) => patch({ dates: v })} placeholder="September 15-18, 2026" />
              </td>
            </tr>
            <tr>
              <td className={cn(cell, label)}>Submission Type:</td>
              <td className={cell} colSpan={3}>
                <div className="flex flex-wrap gap-x-8 gap-y-1">
                  <Box checked={value.submissionInitial} disabled={readOnly} onChange={(v) => patch({ submissionInitial: v })} label="Initial Program (for Request to Conduct)" />
                  <Box checked={value.submissionActual} disabled={readOnly} onChange={(v) => patch({ submissionActual: v })} label="Actual Program (for Post Training Report)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <p data-osh-block="note" className="mt-1.5 text-[10px] italic">(Use additional sheet/s if necessary)</p>

        <table data-osh-block="agenda" className="mt-0.5 w-full table-fixed border-collapse text-[11px] leading-tight">
          <thead>
            <tr>
              <th className={cn(head, "w-[11%]")} rowSpan={3}>
                Date
                <div className="font-normal">(mm/dd/yy)</div>
              </th>
              <th className={cn(head, "w-[12%]")} rowSpan={3}>
                Time
                <div className="font-normal">(Schedule)</div>
              </th>
              <th className={cn(head, "w-[13%]")} rowSpan={3}>
                Duration
                <div className="font-normal">(Duration of each topic in hours and minutes)</div>
              </th>
              <th className={cn(head, "w-[22%]")} rowSpan={3}>
                Topic
                <div className="font-normal">(No need to include sub-topics, but indicate workshops)</div>
              </th>
              <th className={cn(head, "font-semibold")} colSpan={3}>
                Resource Person
              </th>
            </tr>
            <tr>
              <th className={cn(head, "w-[16%]")}>
                Name
                <div className="font-normal">(Last Name, First Name M.I.)</div>
              </th>
              <th className={cn(head, "w-[14%]")}>
                Accreditation Type and Number
                <div className="font-normal">(Accreditation Type: Number)</div>
              </th>
              <th className={cn(head, "w-[12%]")}>
                Validity of Accreditation
                <div className="font-normal">(mm/dd/yyyy)</div>
              </th>
            </tr>
            <tr>
              <th className={cn(head, "text-[9px] font-normal italic")} colSpan={3}>
                Note: Accredited resource persons are not required for workshops.
              </th>
            </tr>
          </thead>
          <tbody>
            {value.sessions.map((s) => {
              const facilitator = /^training facilitator$/i.test(s.resourcePerson.trim())
              const removeRow = !readOnly ? (
                <button
                  type="button"
                  data-export-hide="true"
                  className="absolute top-1/2 -right-4 -translate-y-1/2 text-neutral-400 hover:text-red-600 print:hidden"
                  disabled={value.sessions.length <= 1}
                  onClick={() => setPendingRemoveId(s.id)}
                  aria-label="Remove row"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null
              return (
              <tr key={s.id}>
                <td className={cell}>
                  <SheetField value={s.day} disabled={readOnly} className="text-center" onChange={(v) => updateSession(s.id, { day: v })} />
                </td>
                <td className={cell}>
                  <SheetField value={s.time} disabled={readOnly} className="text-center" onChange={(v) => updateSession(s.id, { time: v })} />
                </td>
                <td className={cell}>
                  <SheetField value={s.duration} disabled={readOnly} rows={2} className="text-center" onChange={(v) => updateSession(s.id, { duration: v })} />
                </td>
                <td className={cell}>
                  <SheetField value={s.topic} disabled={readOnly} rows={2} className="text-center font-semibold" onChange={(v) => updateSession(s.id, { topic: v })} />
                </td>
                {facilitator ? (
                  <td className={cn(cell, "relative text-center")} colSpan={3}>
                    Training Facilitator
                    {removeRow}
                  </td>
                ) : (
                  <>
                    <td className={cell}>
                      <ResourcePersonSelect
                        value={s.resourcePerson}
                        trainers={trainers}
                        disabled={readOnly}
                        onSelectTrainer={(trainer) =>
                          updateSession(s.id, {
                            resourcePerson: trainer.name,
                            accreditation: trainer.accreditation,
                            validity: trainer.validity,
                          })
                        }
                        onCustomName={(name) => updateSession(s.id, { resourcePerson: name })}
                      />
                    </td>
                    <td className={cell}>
                      <SheetField value={s.accreditation} disabled={readOnly} rows={2} className="text-center" onChange={(v) => updateSession(s.id, { accreditation: v })} />
                    </td>
                    <td className={cn(cell, "relative")}>
                      <SheetField value={s.validity} disabled={readOnly} className="text-center" onChange={(v) => updateSession(s.id, { validity: v })} />
                      {removeRow}
                    </td>
                  </>
                )}
              </tr>
              )
            })}
          </tbody>
        </table>

        {!readOnly ? (
          <Button type="button" size="sm" variant="outline" className="mt-2 gap-1.5 print:hidden" data-export-hide="true" onClick={() => addSession()}>
            <Plus className="h-3.5 w-3.5" />
            Add topic row
          </Button>
        ) : null}

        <table data-osh-block="footer" className="mt-2 w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td className={cn(cell, "w-[18%] font-semibold")}>
                Total Duration
                <div className="font-normal text-[9px]">(without lunch break)</div>
              </td>
              <td className={cn(cell, "w-[22%]")}>
                <SheetField value={value.totalDuration} disabled={readOnly} onChange={(v) => patch({ totalDuration: v })} placeholder="40 hours" />
              </td>
              <td className={cn(cell, "w-[16%] font-semibold")}>Other Remarks</td>
              <td className={cell}>
                <SheetField value={value.remarks} disabled={readOnly} rows={2} onChange={(v) => patch({ remarks: v })} />
              </td>
            </tr>
          </tbody>
        </table>
        <AlertDialog open={pendingRemoveId !== null} onOpenChange={(open) => { if (!open) setPendingRemoveId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this topic row?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingSession?.topic
                  ? `"${pendingSession.topic}" will be removed from the agenda.`
                  : "This row will be removed from the agenda."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemove}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="mt-2 text-[10px] text-neutral-600 print:hidden" data-export-hide="true">
          Click a yellow cell to edit it. Long text stays inside that cell and the row grows, so the next field does not move over it.
          Choosing a trainer fills accreditation and validity.
        </p>
      </div>
    </div>
  )
}
