"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  PaginationState,
} from "@tanstack/react-table"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase-client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { MoreVertical, Edit, Trash2, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"

type Course = {
  id: string
  name: string
  description: string | null
  training_fee: number | null
  created_at: string
}

type CourseFormData = {
  name: string
  description: string
  training_fee: string
}

export default function CoursesPage() {
  const [data, setData] = useState<Course[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    training_fee: "",
    title: "",
    serial_number: "",
    serial_number_pad: ""
  });
  

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, description, training_fee, created_at")
        .order("name", { ascending: true })

      if (error) {
        console.error("Error fetching courses:", error)
        toast.error("Failed to load courses")
      } else if (data) {
        setData(data)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      training_fee: "",
      title: "",
      serial_number: "",
      serial_number_pad: ""
    })
  }

  const handleAddCourse = () => {
    resetForm()
    setIsAddDialogOpen(true)
  }

  const handleViewCourse = (course: Course) => {
    setSelectedCourse(course)
    setIsViewDialogOpen(true)
  }

  const handleEditCourse = (course: Course) => {
    setSelectedCourse(course)
    setFormData({
      name: course.name,
      description: course.description || "",
      training_fee: course.training_fee?.toString() || "",
      title: "",
      serial_number: "",
      serial_number_pad: ""
    })
    setIsEditDialogOpen(true)
  }

  const handleDeleteClick = (course: Course) => {
    setSelectedCourse(course)
    setIsDeleteAlertOpen(true)
  }

  const handleSubmitAdd = async () => {
    if (!formData.name.trim()) {
      toast.error("Course name is required")
      return
    }

    setIsSubmitting(true)
    try {
      const { data: newCourse, error } = await supabase
        .from("courses")
        .insert([
          {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            training_fee: formData.training_fee ? parseFloat(formData.training_fee) : null,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error("Error adding course:", error)
        toast.error(error.message || "Failed to add course")
      } else {
        setData([...data, newCourse])
        toast.success("Course added successfully")
        setIsAddDialogOpen(false)
        resetForm()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitEdit = async () => {
    if (!selectedCourse || !formData.name.trim()) {
      toast.error("Course name is required")
      return
    }

    setIsSubmitting(true)
    try {
      const { data: updatedCourse, error } = await supabase
        .from("courses")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          training_fee: formData.training_fee ? parseFloat(formData.training_fee) : null,
        })
        .eq("id", selectedCourse.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating course:", error)
        toast.error(error.message || "Failed to update course")
      } else {
        setData(data.map((c) => (c.id === selectedCourse.id ? updatedCourse : c)))
        toast.success("Course updated successfully")
        setIsEditDialogOpen(false)
        setSelectedCourse(null)
        resetForm()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedCourse) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", selectedCourse.id)

      if (error) {
        console.error("Error deleting course:", error)
        toast.error(error.message || "Failed to delete course")
      } else {
        setData(data.filter((c) => c.id !== selectedCourse.id))
        toast.success("Course deleted successfully")
        setIsDeleteAlertOpen(false)
        setSelectedCourse(null)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePreTest = (course: Course) => {
    console.log("Create Pre-test for:", course)
    toast.info("Pre-test creation coming soon")
  }

  const handleCreatePostTest = (course: Course) => {
    console.log("Create Post-test for:", course)
    toast.info("Post-test creation coming soon")
  }

  const columns = useMemo<ColumnDef<Course>[]>(
    () => [
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditCourse(row.original)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteClick(row.original)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
      {
        accessorKey: "name",
        header: "Course",
        cell: ({ row }) => (
          <div className="font-medium max-w-xs truncate" title={row.original.name}>
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <div 
            className="text-muted-foreground text-sm max-w-md line-clamp-2" 
            title={row.original.description || "No description"}
          >
            {row.original.description || "No description"}
          </div>
        ),
      },
      {
        accessorKey: "training_fee",
        header: "Training Fee",
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            {row.original.training_fee !== null
              ? `₱${Number(row.original.training_fee).toLocaleString()}`
              : "N/A"}
          </div>
        ),
      },
      {
        id: "exam",
        header: "Exam",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button 
              className="cursor-pointer"
              variant="outline"
              size="sm"
              onClick={() => handleCreatePreTest(row.original)}
            >
              Pre-test
            </Button>
            <Button  
              className="cursor-pointer"
              variant="outline"
              size="sm"
              onClick={() => handleCreatePostTest(row.original)}
            >
              Post-test
            </Button>
          </div>
        ),
      },
      
    ],
    []
  )

  const filteredData = useMemo(() => {
    return data.filter((course) =>
      course.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [data, search])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
    autoResetPageIndex: false,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">
            List of available training courses
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button className="cursor-pointer" onClick={handleAddCourse}>
            <Plus className="mr-2 h-4 w-4" />
            New Course
          </Button>
        </div>
      </div>

      <Card className="overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center">
                  Loading courses...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow 
                  key={row.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewCourse(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      onClick={(e) => {
                        // Prevent row click when clicking on action buttons
                        if (
                          cell.column.id === "actions" || 
                          cell.column.id === "exam" ||
                          (e.target as HTMLElement).closest('button')
                        ) {
                          e.stopPropagation()
                        }
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center">
                  No courses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              filteredData.length
            )}{" "}
            of {filteredData.length} courses
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* View Course Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Course Details</DialogTitle>
            <DialogDescription>
              Complete information about this course
            </DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Course Name</Label>
                <p className="text-lg font-semibold">{selectedCourse.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedCourse.description || "No description provided"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Training Fee</Label>
                  <p className="text-lg font-semibold">
                    {selectedCourse.training_fee !== null
                      ? `₱${Number(selectedCourse.training_fee).toLocaleString()}`
                      : "Not specified"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Created Date</Label>
                  <p className="text-sm">
                    {new Date(selectedCourse.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewDialogOpen(false)
                if (selectedCourse) {
                  handleEditCourse(selectedCourse)
                }
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Course Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Course</DialogTitle>
            <DialogDescription>
              Create a new training course. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Course Name *</Label>
              <Input
                id="add-name"
                placeholder="Enter course name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                placeholder="Enter course description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-fee">Training Fee (₱)</Label>
              <Input
                id="add-fee"
                type="number"
                placeholder="0.00"
                value={formData.training_fee}
                onChange={(e) =>
                  setFormData({ ...formData, training_fee: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Course Name *</Label>
              <Input
                id="edit-name"
                placeholder="Enter course name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Course Title</Label>
              <Input
                id="edit-title"
                placeholder="Enter course title"
                value={formData.title || ""}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-serial">Serial Number</Label>
                <Input
                  id="edit-serial"
                  type="number"
                  placeholder="00000"
                  value={formData.serial_number || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pad">Serial Number Pad</Label>
                <Input
                  id="edit-pad"
                  type="number"
                  placeholder="e.g. 6"
                  value={formData.serial_number_pad || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number_pad: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter course description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fee">Training Fee (₱)</Label>
              <Input
                id="edit-fee"
                type="number"
                placeholder="0.00"
                value={formData.training_fee}
                onChange={(e) =>
                  setFormData({ ...formData, training_fee: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course "{selectedCourse?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}