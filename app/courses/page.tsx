//app\courses\page.tsx
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
import { tmsDb } from "@/lib/supabase-client"

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
import { MoreVertical, Edit, Trash2, ChevronLeft, ChevronRight, Plus, ExternalLink, Eye, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

type Course = {
  id: string
  name: string
  description: string | null
  training_fee: number | null
  online_fee: number | null
  face_to_face_fee: number | null
  elearning_fee: number | null
  title: string | null
  serial_number: number | null
  serial_number_pad: number | null
  pretest_link: string | null
  posttest_link: string | null
  has_pvc_id: boolean | null
  created_at: string
}

type CourseFormData = {
  name: string
  description: string
  online_fee: string
  face_to_face_fee: string
  elearning_fee: string
  title: string
  serial_number: string
  serial_number_pad: string
  has_pvc_id: boolean
}

type ExamLinkData = {
  pretest_link: string
  posttest_link: string
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
  const [isExamLinkDialogOpen, setIsExamLinkDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewTitle, setPreviewTitle] = useState("")
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [formData, setFormData] = useState<CourseFormData>({
    name: "",
    description: "",
    online_fee: "",
    face_to_face_fee: "",
    elearning_fee: "",
    title: "",
    serial_number: "",
    serial_number_pad: "",
    has_pvc_id: false
  })

  const [examLinkData, setExamLinkData] = useState<ExamLinkData>({
    pretest_link: "",
    posttest_link: ""
  })

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
     const { data, error } = await tmsDb
      .from("courses")
      .select("id, name, description, training_fee, online_fee, face_to_face_fee, elearning_fee, title, serial_number, serial_number_pad, pretest_link, posttest_link, has_pvc_id, created_at")
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
      online_fee: "",
      face_to_face_fee: "",
      elearning_fee: "",
      title: "",
      serial_number: "",
      serial_number_pad: "",
      has_pvc_id: false
    })
  }

  const resetExamLinkForm = () => {
    setExamLinkData({
      pretest_link: "",
      posttest_link: ""
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
    online_fee: course.online_fee?.toString() || "",
    face_to_face_fee: course.face_to_face_fee?.toString() || "",
    elearning_fee: course.elearning_fee?.toString() || "",
    title: course.title || "",
    serial_number: course.serial_number?.toString() || "",
    serial_number_pad: course.serial_number_pad?.toString() || "",
    has_pvc_id: course.has_pvc_id || false
  })
  setIsEditDialogOpen(true)
}
  const handleDeleteClick = (course: Course) => {
    setSelectedCourse(course)
    setIsDeleteAlertOpen(true)
  }

  const handleManageExamLinks = (course: Course) => {
    setSelectedCourse(course)
    setExamLinkData({
      pretest_link: course.pretest_link || "",
      posttest_link: course.posttest_link || ""
    })
    setIsExamLinkDialogOpen(true)
  }

  const handlePreviewExam = (url: string, title: string) => {
    setPreviewUrl(url)
    setPreviewTitle(title)
    setIsPreviewDialogOpen(true)
  }

  const handleSubmitAdd = async () => {
    if (!formData.name.trim()) {
      toast.error("Course name is required")
      return
    }

    setIsSubmitting(true)
    try {
     const { data: newCourse, error } = await tmsDb
        .from("courses")
        .insert([
          {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            online_fee: formData.online_fee ? parseFloat(formData.online_fee) : null,
            face_to_face_fee: formData.face_to_face_fee ? parseFloat(formData.face_to_face_fee) : null,
            elearning_fee: formData.elearning_fee ? parseFloat(formData.elearning_fee) : null,
            title: formData.title.trim() || null,
            serial_number: formData.serial_number ? parseInt(formData.serial_number) : null,
            serial_number_pad: formData.serial_number_pad ? parseInt(formData.serial_number_pad) : null,
            has_pvc_id: formData.has_pvc_id,
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
      const { data: updatedCourse, error } = await tmsDb
        .from("courses")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          online_fee: formData.online_fee ? parseFloat(formData.online_fee) : null,
          face_to_face_fee: formData.face_to_face_fee ? parseFloat(formData.face_to_face_fee) : null,
          elearning_fee: formData.elearning_fee ? parseFloat(formData.elearning_fee) : null,
          title: formData.title.trim() || null,
          serial_number: formData.serial_number ? parseInt(formData.serial_number) : null,
          serial_number_pad: formData.serial_number_pad ? parseInt(formData.serial_number_pad) : null,
          has_pvc_id: formData.has_pvc_id,
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

  const handleSubmitExamLinks = async () => {
    if (!selectedCourse) return

    setIsSubmitting(true)
    try {
      const { data: updatedCourse, error } = await tmsDb
        .from("courses")
        .update({
          pretest_link: examLinkData.pretest_link.trim() || null,
          posttest_link: examLinkData.posttest_link.trim() || null,
        })
        .eq("id", selectedCourse.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating exam links:", error)
        toast.error(error.message || "Failed to update exam links")
      } else {
        setData(data.map((c) => (c.id === selectedCourse.id ? updatedCourse : c)))
        toast.success("Exam links updated successfully")
        setIsExamLinkDialogOpen(false)
        setSelectedCourse(null)
        resetExamLinkForm()
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
      const { error } = await tmsDb
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
              <DropdownMenuItem onClick={() => handleManageExamLinks(row.original)}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Manage Exam Links
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
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="text-sm max-w-40 truncate" title={row.original.title || "N/A"}>
            {row.original.title || "N/A"}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <div 
            className="text-muted-foreground text-sm max-w-40 truncate" 
            title={row.original.description || "No description"}
          >
            {row.original.description || "No description"}
          </div>
        ),
      },
      {
        accessorKey: "serial_number",
        header: "Serial #",
        cell: ({ row }) => (
          <div className="text-sm font-mono">
            {row.original.serial_number !== null ? row.original.serial_number : "N/A"}
          </div>
        ),
      },
      {
        id: "fees",
        header: "Training Fees",
        cell: ({ row }) => (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Online:</span>
              <span className="font-semibold">
                {row.original.online_fee !== null
                  ? `₱${Number(row.original.online_fee).toLocaleString()}`
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">F2F:</span>
              <span className="font-semibold">
                {row.original.face_to_face_fee !== null
                  ? `₱${Number(row.original.face_to_face_fee).toLocaleString()}`
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">E-Learn:</span>
              <span className="font-semibold">
                {row.original.elearning_fee !== null
                  ? `₱${Number(row.original.elearning_fee).toLocaleString()}`
                  : "N/A"}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "exam",
        header: "Exam Links",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {row.original.pretest_link ? (
              <Button 
                className="cursor-pointer"
                variant="outline"
                size="sm"
                onClick={() => handlePreviewExam(row.original.pretest_link!, "Pre-test")}
              >
                <Eye className="mr-1 h-3 w-3" />
                Pre-test
              </Button>
            ) : (
              <Button 
                className="cursor-pointer"
                variant="ghost"
                size="sm"
                disabled
              >
                No Pre-test
              </Button>
            )}
            {row.original.posttest_link ? (
              <Button  
                className="cursor-pointer"
                variant="outline"
                size="sm"
                onClick={() => handlePreviewExam(row.original.posttest_link!, "Post-test")}
              >
                <Eye className="mr-1 h-3 w-3" />
                Post-test
              </Button>
            ) : (
              <Button  
                className="cursor-pointer"
                variant="ghost"
                size="sm"
                disabled
              >
                No Post-test
              </Button>
            )}
          </div>
        ),
      },
    ],
    []
  )

  const filteredData = useMemo(() => {
    return data.filter((course) =>
      course.name.toLowerCase().includes(search.toLowerCase()) ||
      (course.title && course.title.toLowerCase().includes(search.toLowerCase()))
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
        <DialogContent className="lg:w-[40vw] sm:w-[90vw]">
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
                <Label className="text-muted-foreground">Course Title</Label>
                <p className="text-sm">
                  {selectedCourse.title || "Not specified"}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedCourse.description || "No description provided"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Serial Number</Label>
                  <p className="text-sm font-mono">
                    {selectedCourse.serial_number !== null
                      ? selectedCourse.serial_number
                      : "Not specified"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Serial Padding</Label>
                  <p className="text-sm">
                    {selectedCourse.serial_number_pad !== null
                      ? `${selectedCourse.serial_number_pad} digits`
                      : "Not specified"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-muted-foreground">Training Fees</Label>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Online:</span>
                      <span className="text-lg font-semibold">
                        {selectedCourse.online_fee !== null
                          ? `₱${Number(selectedCourse.online_fee).toLocaleString()}`
                          : "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Face-to-Face:</span>
                      <span className="text-lg font-semibold">
                        {selectedCourse.face_to_face_fee !== null
                          ? `₱${Number(selectedCourse.face_to_face_fee).toLocaleString()}`
                          : "Not specified"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">E-Learning:</span>
                      <span className="text-lg font-semibold">
                        {selectedCourse.elearning_fee !== null
                          ? `₱${Number(selectedCourse.elearning_fee).toLocaleString()}`
                          : "Not specified"}
                      </span>
                    </div>
                  </div>
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
              <div className="space-y-2 border-t pt-4">
                <Label className="text-muted-foreground">Exam Links</Label>
                <div className="flex flex-col gap-2">
                  {selectedCourse.pretest_link ? (
                    <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span className="text-sm">Pre-test</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(selectedCourse.pretest_link!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No pre-test link</p>
                  )}
                  {selectedCourse.posttest_link ? (
                    <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <span className="text-sm">Post-test</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(selectedCourse.posttest_link!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No post-test link</p>
                  )}
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

      {/* Manage Exam Links Dialog */}
      <Dialog open={isExamLinkDialogOpen} onOpenChange={setIsExamLinkDialogOpen}>
        <DialogContent className="lg:w-[40vw] sm:w-[90vw]">
          <DialogHeader>
            <DialogTitle>Manage Exam Links</DialogTitle>
            <DialogDescription>
              Add or update pre-test and post-test links for {selectedCourse?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pretest-link">Pre-test Link</Label>
              <Input
                id="pretest-link"
                placeholder="https://forms.office.com/..."
                value={examLinkData.pretest_link}
                onChange={(e) =>
                  setExamLinkData({ ...examLinkData, pretest_link: e.target.value })
                }
              />
              {examLinkData.pretest_link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreviewExam(examLinkData.pretest_link, "Pre-test Preview")}
                  className="w-full"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Pre-test
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="posttest-link">Post-test Link</Label>
              <Input
                id="posttest-link"
                placeholder="https://forms.office.com/..."
                value={examLinkData.posttest_link}
                onChange={(e) =>
                  setExamLinkData({ ...examLinkData, posttest_link: e.target.value })
                }
              />
              {examLinkData.posttest_link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreviewExam(examLinkData.posttest_link, "Post-test Preview")}
                  className="w-full"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Post-test
                </Button>
              )}
            </div>
            <div className="bg-muted p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                💡 Tip: Paste the full URL from Microsoft Forms or any other online form platform.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsExamLinkDialogOpen(false)
                resetExamLinkForm()
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitExamLinks} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Links"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="lg:w-[40vw] sm:w-[90vw] h-[50vh]">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>
              Preview of the exam form
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0 rounded-md"
              title={previewTitle}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPreviewDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => window.open(previewUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Course Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="lg:w-[40vw] sm:w-[90vw]">
          <DialogHeader>
            <DialogTitle>Add New Course</DialogTitle>
            <DialogDescription>
              Create a new training course. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
              <Label htmlFor="add-title">Course Title</Label>
              <Input
                id="add-title"
                placeholder="Enter course title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-serial">Serial Number</Label>
                <Input
                  id="add-serial"
                  type="number"
                  placeholder="e.g., 1"
                  value={formData.serial_number}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-pad">Serial Number Pad</Label>
                <Input
                  id="add-pad"
                  type="number"
                  placeholder="e.g., 6"
                  value={formData.serial_number_pad}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number_pad: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Total digits for serial (e.g., 6 = 000001)
                </p>
              </div>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-online-fee">Online Training Fee (₱)</Label>
                <Input
                  id="add-online-fee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.online_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, online_fee: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-f2f-fee">Face-to-Face Training Fee (₱)</Label>
                <Input
                  id="add-f2f-fee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.face_to_face_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, face_to_face_fee: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-elearn-fee">E-Learning Training Fee (₱)</Label>
                <Input
                  id="add-elearn-fee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.elearning_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, elearning_fee: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="add-has-pvc"
                    checked={formData.has_pvc_id}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, has_pvc_id: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="add-has-pvc" className="cursor-pointer text-sm font-medium">
                    This course offers Physical PVC ID
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Check this if trainees can opt to add a Physical PVC ID for ₱150
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}
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
        <DialogContent className="lg:w-[40vw] sm:w-[90vw]">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
                value={formData.title}
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
                  placeholder="e.g., 1"
                  value={formData.serial_number}
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
                  placeholder="e.g., 6"
                  value={formData.serial_number_pad}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number_pad: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Total digits for serial (e.g., 6 = 000001)
                </p>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-online-fee">Online Training Fee (₱)</Label>
                <Input
                  id="edit-online-fee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.online_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, online_fee: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-f2f-fee">Face-to-Face Training Fee (₱)</Label>
                <Input
                  id="edit-f2f-fee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.face_to_face_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, face_to_face_fee: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-elearn-fee">E-Learning Training Fee (₱)</Label>
                <Input
                  id="edit-elearn-fee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.elearning_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, elearning_fee: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="edit-has-pvc"
                    checked={formData.has_pvc_id}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, has_pvc_id: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-has-pvc" className="cursor-pointer text-sm font-medium">
                    This course offers Physical PVC ID
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Check this if trainees can opt to add a Physical PVC ID for ₱150
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                resetForm()
              }}
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