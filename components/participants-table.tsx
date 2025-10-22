//components\participants-table.tsx
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
import { ArrowUpDown, FileText, FolderOpen, ClipboardCheck, MoreVertical, Eye, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
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

type Participant = {
  id: string
  course: string
  branch: string
  schedule: string
  status: string
  type: string
  submissionCount: number
}

interface ParticipantsTableProps {
  status: "planned" | "confirmed" | "cancelled" | "finished"
  refreshTrigger?: number
}

export function ParticipantsTable({ status, refreshTrigger }: ParticipantsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [data, setData] = React.useState<Participant[]>([])
  const [loading, setLoading] = React.useState(true)
  
  // Alert dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false)
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

  const handleEdit = (participant: Participant) => {
    console.log("Edit participant:", participant)
    toast.info("Edit functionality", {
      description: "Edit feature coming soon!",
    })
    // Add your edit logic here
    // Example: open edit modal or navigate to edit page
    // router.push(`/participants/${participant.id}/edit`)
  }

  const handleDeleteClick = (participant: Participant) => {
    setSelectedParticipant(participant)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedParticipant) return

    setIsDeleting(true)
    try {
      // Delete related records first (in order of dependencies)
      // 1. Delete trainings
      const { error: trainingsError } = await supabase
        .from("trainings")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (trainingsError) {
        console.error("Error deleting trainings:", trainingsError)
        alert(`Failed to delete trainings: ${trainingsError.message}`)
        setIsDeleting(false)
        return
      }

      // 2. Delete schedule_dates
      const { error: datesError } = await supabase
        .from("schedule_dates")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (datesError) {
        console.error("Error deleting schedule dates:", datesError)
        alert(`Failed to delete schedule dates: ${datesError.message}`)
        setIsDeleting(false)
        return
      }

      // 3. Delete schedule_ranges
      const { error: rangesError } = await supabase
        .from("schedule_ranges")
        .delete()
        .eq("schedule_id", selectedParticipant.id)

      if (rangesError) {
        console.error("Error deleting schedule ranges:", rangesError)
        alert(`Failed to delete schedule ranges: ${rangesError.message}`)
        setIsDeleting(false)
        return
      }

      // 4. Finally delete the schedule
      const { error: scheduleError } = await supabase
        .from("schedules")
        .delete()
        .eq("id", selectedParticipant.id)

      if (scheduleError) {
        console.error("Error deleting schedule:", scheduleError)
        alert(`Failed to delete schedule: ${scheduleError.message}`)
      } else {
        console.log("Deleted participant:", selectedParticipant)
        // Refresh data
        setData((prevData) => prevData.filter((item) => item.id !== selectedParticipant.id))
      }
    } catch (error) {
      console.error("Error:", error)
      alert("An error occurred while deleting")
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setSelectedParticipant(null)
    }
  }

  const columns: ColumnDef<Participant>[] = [
    {
      accessorKey: "course",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-muted"
        >
          Course
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const submissionCount = row.original.submissionCount
        return (
          <div className="space-y-2">
            <div className="font-medium text-card-foreground">{row.getValue("course")}</div>
            <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs hover:bg-muted cursor-pointer"
              onClick={() => window.location.href = `/submissions?scheduleId=${row.original.id}`}
            >
              <FileText className="h-3 w-3" />
              Submission
              {submissionCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                  {submissionCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs hover:bg-muted cursor-pointer"
              onClick={() => {
                setDirectoryScheduleId(row.original.id)
                setDirectoryCourseName(row.original.course)
                setDirectoryRange(row.original.schedule) // format as needed
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-muted"
        >
          Branch
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-card-foreground">{row.getValue("branch")}</div>,
    },
    {
      accessorKey: "schedule",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-muted"
        >
          Schedule
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-card-foreground">{row.getValue("schedule")}</div>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const variant =
          status === "confirmed"
            ? "default"
            : status === "cancelled"
              ? "destructive"
              : status === "finished"
                ? "secondary"
                : "outline"
        return <Badge variant={variant}>{status}</Badge>
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

  React.useEffect(() => {
    const fetchTrainings = async () => {
      setLoading(true)
  
      const { data, error }: PostgrestSingleResponse<any[]> = await supabase
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
        .eq(
          "status",
          status === "finished"
            ? "finished"
            : status === "cancelled"
            ? "cancelled"
            : status === "confirmed"
            ? "confirmed"
            : "planned"
        )
        .order("created_at", { ascending: false }) // 👈 Sort newest first
  
      if (error) {
        console.error("Supabase fetch error:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        setData([])
      } else {
        console.log("Fetched schedules data:", data)
        const mapped: Participant[] = (data ?? []).map((schedule) => {
          const courseName = schedule.courses?.name ?? "Unknown Course"
          const branch = schedule.branch ?? "N/A"
          
          // Get training info from first training entry (if exists)
          const firstTraining = schedule.trainings?.[0]
          const type = firstTraining?.training_type ?? schedule.event_type ?? "Public"
          const scheduleStatus = schedule.status ?? "planned"
  
          let scheduleDisplay = ""
  
          if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.length) {
            const range = schedule.schedule_ranges[0]
            scheduleDisplay = `${new Date(range.start_date).toLocaleDateString()} – ${new Date(
              range.end_date
            ).toLocaleDateString()}`
          } else if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length) {
            scheduleDisplay = schedule.schedule_dates
              .map((d: { date: string }) => new Date(d.date).toLocaleDateString())
              .join(", ")
          }
  
          return {
            id: schedule.id,
            course: courseName,
            branch,
            schedule: scheduleDisplay,
            status: scheduleStatus,
            type,
            submissionCount: schedule.trainings?.length ?? 0,
          }
        })
  
        setData(mapped)
      }
  
      setLoading(false)
    }
  
    fetchTrainings()
  }, [status, refreshTrigger])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  if (loading) {
    return <Card className="p-6">Loading {status} schedules...</Card>
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Input
            placeholder="Filter courses..."
            value={(table.getColumn("course")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("course")?.setFilterValue(event.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-2">
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
            <TableHeader>
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