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
import { ArrowUpDown, FileText, FolderOpen, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { type PostgrestSingleResponse } from "@supabase/supabase-js"

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
}

export function ParticipantsTable({ status }: ParticipantsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

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
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs hover:bg-muted">
                <FileText className="h-3 w-3" />
                Submission
                {submissionCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {submissionCount}
                  </Badge>
                )}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs hover:bg-muted">
                <FolderOpen className="h-3 w-3" />
                Directory
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs hover:bg-muted">
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
  ]

  const [data, setData] = React.useState<Participant[]>([])
  const [loading, setLoading] = React.useState(true)

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
  }, [status])

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
  )
}