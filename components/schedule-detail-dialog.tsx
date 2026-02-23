// components/schedule-detail-dialog.tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { tmsDb } from "@/lib/supabase-client"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Loader2, Calendar, MapPin, User, Users, Info } from "lucide-react"

interface Trainee {
    id: string
    first_name: string
    last_name: string
    email: string
    status: string
}

interface ScheduleDetails {
    id: string
    course_name: string
    batch_number: number
    event_type: string
    branch: string
    status: string
    trainer_name: string
    day_trainers: Record<string, string>
    schedule_type: string
    schedule_ranges: { start_date: string; end_date: string }[]
    schedule_dates: { date: string }[]
}

interface ScheduleDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    scheduleId: string | null
}

export function ScheduleDetailDialog({
    open,
    onOpenChange,
    scheduleId,
}: ScheduleDetailDialogProps) {
    const [loading, setLoading] = React.useState(false)
    const [details, setDetails] = React.useState<ScheduleDetails | null>(null)
    const [trainees, setTrainees] = React.useState<Trainee[]>([])

    React.useEffect(() => {
        if (open && scheduleId) {
            fetchDetails()
        }
    }, [open, scheduleId])

    const fetchDetails = async () => {
        setLoading(true)
        try {
            // Fetch Schedule Info
            const { data: scheduleData, error: scheduleError } = await tmsDb
                .from("schedules")
                .select(`
          id,
          batch_number,
          event_type,
          branch,
          status,
          trainer_name,
          day_trainers,
          schedule_type,
          courses (name),
          schedule_ranges (start_date, end_date),
          schedule_dates (date)
        `)
                .eq("id", scheduleId)
                .single()

            if (scheduleError) throw scheduleError

            setDetails({
                ...scheduleData,
                course_name: (scheduleData.courses as any)?.name || "Unknown Course",
            } as any)

            // Fetch Trainees
            const { data: traineeData, error: traineeError } = await tmsDb
                .from("trainings")
                .select("id, first_name, last_name, email, status")
                .eq("schedule_id", scheduleId)
                .order("last_name", { ascending: true })

            if (traineeError) throw traineeError
            setTrainees(traineeData || [])
        } catch (error) {
            console.error("Error fetching schedule details:", error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusStyle = (status: string) => {
        const styles: Record<string, string> = {
            planned: "bg-yellow-100 text-yellow-800 border-yellow-300",
            ongoing: "bg-orange-100 text-orange-800 border-orange-300",
            confirmed: "bg-blue-100 text-blue-800 border-blue-300",
            cancelled: "bg-red-100 text-red-800 border-red-300",
            finished: "bg-emerald-100 text-emerald-800 border-emerald-300",
        }
        return styles[status.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-300"
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-6">
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-bold">
                                {details?.course_name || "Schedule Details"}
                            </DialogTitle>
                            <DialogDescription>
                                Batch #{details?.batch_number || "—"} • {details?.event_type || "—"}
                            </DialogDescription>
                        </div>
                        {details?.status && (
                            <Badge className={`${getStatusStyle(details.status)} border px-3 py-1 text-sm capitalize`}>
                                {details.status}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground font-medium">Fetching details...</p>
                    </div>
                ) : (
                    <div className="space-y-6 pt-4">
                        {/* Quick Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-4 rounded-lg border">
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Schedule Dates</h4>
                                        <p className="text-sm border-b border-dashed inline-block pb-0.5">
                                            {details?.schedule_type === "regular" && details.schedule_ranges?.[0] ? (
                                                `${format(new Date(details.schedule_ranges[0].start_date), "PP")} - ${format(new Date(details.schedule_ranges[0].end_date), "PP")}`
                                            ) : details?.schedule_dates?.length ? (
                                                details.schedule_dates.length === 1
                                                    ? format(new Date(details.schedule_dates[0].date), "PP")
                                                    : `${details.schedule_dates.length} Days (Staggered)`
                                            ) : "No dates set"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Location / Branch</h4>
                                        <p className="text-sm capitalize font-medium">{details?.branch || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <User className="h-5 w-5 text-muted-foreground shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Trainer(s)</h4>
                                        {details?.day_trainers && Object.keys(details.day_trainers).length > 0 ? (
                                            <div className="grid gap-1.5 mt-2">
                                                {Object.entries(details.day_trainers).sort().map(([date, name]) => (
                                                    <div key={date} className="flex justify-between text-xs bg-background/50 p-2 rounded border border-border/50">
                                                        <span className="font-medium text-muted-foreground">{format(new Date(date), "MMM dd, yyyy")}</span>
                                                        <span className="font-bold">{name || "—"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium">{details?.trainer_name || "No trainer assigned"}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Trainee List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    <h3 className="font-bold">Registered Participants</h3>
                                </div>
                                <Badge variant="outline" className="bg-muted px-2 py-0.5">
                                    {trainees.length} {trainees.length === 1 ? "Trainee" : "Trainees"}
                                </Badge>
                            </div>

                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[250px] font-bold">Name</TableHead>
                                            <TableHead className="font-bold">Email</TableHead>
                                            <TableHead className="w-[120px] font-bold">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {trainees.length > 0 ? (
                                            trainees.map((trainee) => (
                                                <TableRow key={trainee.id}>
                                                    <TableCell className="font-medium">
                                                        {trainee.last_name}, {trainee.first_name}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm uppercase">
                                                        {trainee.email || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0">
                                                            {trainee.status || "Pending"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                    No trainees registered yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-blue-50/50 p-2 rounded border border-blue-100">
                            <Info className="h-3.5 w-3.5 text-blue-500" />
                            <span>To edit this schedule or manage certificates, use the action menu in the table.</span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
