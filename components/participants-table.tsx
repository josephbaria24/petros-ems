// components/participants-table.tsx - PART 1 OF 3
// Copy this entire file first

"use client"

import { supabase } from "@/lib/supabase-client"
import * as React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { ArrowUpDown, FileText, FolderOpen, ClipboardCheck, MoreVertical, Eye, Edit, Trash2, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { type PostgrestSingleResponse } from "@supabase/supabase-js"
import { toast } from "sonner"
import ParticipantDirectoryDialog from "@/components/trainee-directory-dialog"
import { EditScheduleDialog } from "@/components/edit-schedule-dialog"

type Participant = {
  id: string
  course: string
  branch: string
  schedule: string
  status: string
  type: string
  submissionCount: number
  sortDate?: Date | null
  scheduleMonth?: string
}

interface ParticipantsTableProps {
  status: "all" | "planned" | "ongoing" | "confirmed" | "cancelled" | "finished"
  refreshTrigger?: number
}

export function ParticipantsTable({ status, refreshTrigger }: ParticipantsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [data, setData] = React.useState<Participant[]>([])
  const [loading, setLoading] = React.useState(true)
  const [globalFilter, setGlobalFilter] = React.useState("")
  
  // Alert dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [selectedParticipant, setSelectedParticipant] = React.useState<Participant | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const [directoryOpen, setDirectoryOpen] = React.useState(false)
  const [directoryScheduleId, setDirectoryScheduleId] = React.useState<string | null>(null)
  const [directoryCourseName, setDirectoryCourseName] = React.useState("")
  const [directoryRange, setDirectoryRange] = React.useState("")

  const handleView = (participant: Participant) => {
    setSelectedParticipant(participant)
    setViewDialogOpen(true)
    toast.info("Viewing schedule details", {
      description: `${participant.course} - ${participant.branch}`,
    })
  }

  const handleCopyRegistrationLink = (participant: Participant) => {
    // Build the registration link with schedule_id (matching the registration page parameter)
    const baseUrl = window.location.origin
    const registrationUrl = `${baseUrl}/guest-training-registration?schedule_id=${participant.id}`
    
    // Copy to clipboard
    navigator.clipboard.writeText(registrationUrl).then(() => {
      toast.success("Registration link copied!", {
        description: "Share this link to allow trainees to register",
      })
    }).catch((err) => {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy link", {
        description: "Please try again",
      })
    })
  }

  function formatScheduleDateRange(start: string, end: string) {
    const s = new Date(start)
    const e = new Date(end)

    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()

    const fullMonth = s.toLocaleString("en-US", { month: "long" })
    const shortMonth = s.toLocaleString("en-US", { month: "short" })
    const endShortMonth = e.toLocaleString("en-US", { month: "short" })

    if (s.toDateString() === e.toDateString()) {
      // Single date
      return `${fullMonth} ${s.getDate()}, ${s.getFullYear()}`
    }

    if (sameMonth) {
      // Example: November 21–25, 2025
      return `${fullMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
    }

    // Example: Nov. 29, 2025 – Dec. 2, 2025
    return `${shortMonth}. ${s.getDate()}, ${s.getFullYear()} – ${endShortMonth}. ${e.getDate()}, ${e.getFullYear()}`
  }

  function getScheduleMonth(date: Date): string {
    return date.toLocaleString("en-US", { month: "long", year: "numeric" })
  }

  const handleEdit = (participant: Participant) => {
    setSelectedParticipant(participant)
    setEditDialogOpen(true)
  }

  const handleDeleteClick = (participant: Participant) => {
    setSelectedParticipant(participant)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedParticipant) return

    setIsDeleting(true)
    const toastId = toast.loading("Deleting schedule...", {
      description: "Removing all related records...",
    })

    try {
      // Delete related records first (in order of dependencies)
      // 1. Delete trainings
      const { error: trainingsError } = await supabase
        .from("trainings")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (trainingsError) {
        toast.error("Failed to delete trainings", {
          id: toastId,
          description: trainingsError.message,
        })
        setIsDeleting(false)
        return
      }

      // 2. Delete schedule_dates
      const { error: datesError } = await supabase
        .from("schedule_dates")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (datesError) {
        toast.error("Failed to delete schedule dates", {
          id: toastId,
          description: datesError.message,
        })
        setIsDeleting(false)
        return
      }

      // 3. Delete schedule_ranges
      const { error: rangesError } = await supabase
        .from("schedule_ranges")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (rangesError) {
        toast.error("Failed to delete schedule ranges", {
          id: toastId,
          description: rangesError.message,
        })
        setIsDeleting(false)
        return
      }

      // 4. Finally delete the schedule
      const { error: scheduleError } = await supabase
        .from("schedules")
        .delete()
        .eq("id", selectedParticipant.id)

      if (scheduleError) {
        toast.error("Failed to delete schedule", {
          id: toastId,
          description: scheduleError.message,
        })
      } else {
        toast.success("Schedule deleted successfully", {
          id: toastId,
          description: `${selectedParticipant.course} schedule has been removed.`,
        })
        // Refresh data
        setData((prevData) => prevData.filter((item) => item.id !== selectedParticipant.id))
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Unexpected error", {
        id: toastId,
        description: "An error occurred while deleting",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setSelectedParticipant(null)
    }
  }

  const fetchTrainings = React.useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from("schedules")
      .select(`
        id,
        branch,
        event_type,
        schedule_type,
        status,
        courses (
          name
        ),
        schedule_ranges (
          start_date,
          end_date
        ),
        schedule_dates (
          date
        ),
        trainings (
          id,
          training_type
        )
      `)
      .order("created_at", { ascending: false })

    // Only filter by status if not "all"
    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error }: PostgrestSingleResponse<any[]> = await query

    if (error) {
      console.error("Supabase fetch error:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      setData([])
    } else {
      console.log("Fetched schedules data:", data)
      const now = new Date()
      const mapped: Participant[] = (data ?? [])
        .map((schedule) => {
          const courseName = schedule.courses?.name ?? "Unknown Course"
          const branch = schedule.branch ?? "N/A"
          const firstTraining = schedule.trainings?.[0]
          const type = firstTraining?.training_type ?? schedule.event_type ?? "Public"
          const scheduleStatus = schedule.status ?? "planned"

          let scheduleDisplay = ""
          let sortDate: Date | null = null
          let scheduleMonth: string | undefined = undefined
          
          if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.length) {
            const range = schedule.schedule_ranges[0]
            scheduleDisplay = formatScheduleDateRange(range.start_date, range.end_date)
            sortDate = new Date(range.start_date)
            scheduleMonth = getScheduleMonth(sortDate)
          } else if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length) {
            scheduleDisplay = schedule.schedule_dates
              .map((d: { date: string }) =>
                formatScheduleDateRange(d.date, d.date)
              )
              .join(", ")
            sortDate = new Date(schedule.schedule_dates[0].date)
            scheduleMonth = getScheduleMonth(sortDate)
          }

          return {
            id: schedule.id,
            course: courseName,
            branch,
            schedule: scheduleDisplay,
            status: scheduleStatus,
            type,
            submissionCount: schedule.trainings?.length ?? 0,
            sortDate,
            scheduleMonth,
          }
        })
        .sort((a, b) => {
          if (!a.sortDate && !b.sortDate) return 0
          if (!a.sortDate) return 1
          if (!b.sortDate) return -1
          
          const aFuture = a.sortDate >= now
          const bFuture = b.sortDate >= now
          
          // Both future: sort ascending (nearest first)
          if (aFuture && bFuture) return a.sortDate.getTime() - b.sortDate.getTime()
          // Both past: sort descending (most recent first)
          if (!aFuture && !bFuture) return b.sortDate.getTime() - a.sortDate.getTime()
          // One future, one past: future comes first
          return aFuture ? -1 : 1
        })

      setData(mapped)
    }

    setLoading(false)
  }, [status])

  React.useEffect(() => {
    fetchTrainings()
  }, [status, refreshTrigger, fetchTrainings])

  const columns: ColumnDef<Participant>[] = [
    {
      accessorKey: "course",
      header: "Course",
      cell: ({ row }) => {
        const submissionCount = row.original.submissionCount
        return (
          <div className="space-y-2">
            <div className="font-medium text-card-foreground">{row.getValue("course")}</div>
            <div className="flex gap-2">
              <Link
                href={`/submissions?scheduleId=${row.original.id}&from=${status}`}
                className="flex items-center gap-1 text-xs hover:bg-muted rounded-md px-2 py-1.5 cursor-pointer"
              >
                <FileText className="h-3 w-3" />
                Submission
                {submissionCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                    {submissionCount}
                  </Badge>
                )}
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs hover:bg-muted cursor-pointer"
                onClick={() => {
                  setDirectoryScheduleId(row.original.id)
                  setDirectoryCourseName(row.original.course)
                  setDirectoryRange(row.original.schedule)
                  setDirectoryOpen(true)
                }}
              >
                <FolderOpen className="h-3 w-3" />
                Directory
              </Button>

              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs hover:bg-muted cursor-pointer">
                <ClipboardCheck className="h-3 w-3" />
                Exam Result
              </Button>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: ({ row }) => <div className="text-card-foreground">{row.getValue("branch")}</div>,
    },
    {
      accessorKey: "schedule",
      header: "Schedule",
      cell: ({ row }) => <div className="text-card-foreground">{row.getValue("schedule")}</div>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusValue = row.getValue("status") as string
        
        // Color-coded badges based on status
        const statusStyles = {
          planned: "bg-yellow-100 text-yellow-800 border-yellow-300",
          ongoing: "bg-orange-100 text-orange-800 border-orange-300",
          confirmed: "bg-blue-100 text-blue-800 border-blue-300",
          cancelled: "bg-red-100 text-red-800 border-red-300",
          finished: "bg-gray-100 text-gray-800 border-gray-300"
        }
        
        const style = statusStyles[statusValue as keyof typeof statusStyles] || "bg-gray-100 text-gray-800 border-gray-300"
        
        return (
          <Badge className={`${style} border`}>
            {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string
        return (
          <Badge variant="outline" className="bg-muted">
            {type}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const participant = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleView(participant)} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(participant)} className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyRegistrationLink(participant)} className="cursor-pointer">
                <Link2 className="mr-2 h-4 w-4" />
                Copy Registration Link
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteClick(participant)} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase()
      
      // Search in course, branch, schedule (including month names), status, and type
      const course = String(row.getValue("course")).toLowerCase()
      const branch = String(row.getValue("branch")).toLowerCase()
      const schedule = String(row.getValue("schedule")).toLowerCase()
      const status = String(row.getValue("status")).toLowerCase()
      const type = String(row.getValue("type")).toLowerCase()
      
      return course.includes(search) || 
             branch.includes(search) || 
             schedule.includes(search) ||
             status.includes(search) ||
             type.includes(search)
    },
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  // Get unique months from data for the filter
  const uniqueMonths = React.useMemo(() => {
    const months = data
      .map(d => d.scheduleMonth)
      .filter((month): month is string => month !== undefined)
    return Array.from(new Set(months)).sort((a, b) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime() // Most recent first
    })
  }, [data])

  if (loading) {
    return <Card className="p-6">Loading {status === "all" ? "all" : status} schedules...</Card>
  }

  return (
    <>
      <Card className="p-3 border-0 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <Input
            placeholder="Search courses, branches, schedules, status, or types..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-2">
            <Select
              value={(table.getColumn("course")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("course")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {Array.from(new Set(data.map(d => d.course)))
                  .filter(course => course && course.trim() !== "")
                  .sort()
                  .map((course) => (
                    <SelectItem key={course} value={course}>{course}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("branch")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("branch")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {Array.from(new Set(data.map(d => d.branch)))
                  .filter(branch => branch && branch.trim() !== "")
                  .sort()
                  .map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="finished">Finished</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={(table.getColumn("type")?.getFilterValue() as string) ?? "all"}
              onValueChange={(value) => table.getColumn("type")?.setFilterValue(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="In-house">In-house</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-border">
          <Table>
            <TableHeader className="font-bold bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} event(s) total</div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* View Dialog */}
      <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Details</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-4">
                <div>
                  <span className="font-semibold">Course:</span> {selectedParticipant?.course}
                </div>
                <div>
                  <span className="font-semibold">Branch:</span> {selectedParticipant?.branch}
                </div>
                <div>
                  <span className="font-semibold">Schedule:</span> {selectedParticipant?.schedule}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> {selectedParticipant?.status}
                </div>
                <div>
                  <span className="font-semibold">Type:</span> {selectedParticipant?.type}
                </div>
                <div>
                  <span className="font-semibold">Submissions:</span> {selectedParticipant?.submissionCount}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <EditScheduleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        scheduleId={selectedParticipant?.id || null}
        onScheduleUpdated={fetchTrainings}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. This will permanently delete the schedule for{" "}
                  <span className="font-semibold">{selectedParticipant?.course}</span> and all related records including:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>All training records ({selectedParticipant?.submissionCount} submission(s))</li>
                  <li>All schedule dates</li>
                  <li>All schedule ranges</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Directory Dialog */}
      <ParticipantDirectoryDialog
        open={directoryOpen}
        onOpenChange={setDirectoryOpen}
        scheduleId={directoryScheduleId}
        courseName={directoryCourseName}
        scheduleRange={directoryRange}
      />
    </>
  )
}