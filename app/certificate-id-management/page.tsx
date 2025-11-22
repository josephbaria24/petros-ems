"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Settings, Search, FileText, Plus, Loader2 } from "lucide-react"
import CertificateTemplateModal from "@/components/certificate-template-modal"
import { supabase } from "@/lib/supabase-client"

interface Course {
  id: string
  name: string
  title: string | null
  serial_number: number | null
  serial_number_pad: number | null
  created_at: string
  template_count?: number
}

export default function CertificateManagementPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    filterCourses()
  }, [searchQuery, courses])

  const loadCourses = async () => {
    try {
      setLoading(true)
      
      // Fetch all courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("serial_number", { ascending: true })

      if (coursesError) throw coursesError

      // Fetch template counts for each course
      const { data: templatesData, error: templatesError } = await supabase
        .from("certificate_templates")
        .select("course_id, template_type")

      if (templatesError) throw templatesError

      // Count templates per course
      const templateCounts: Record<string, number> = {}
      templatesData?.forEach((template) => {
        if (template.course_id) {
          templateCounts[template.course_id] = (templateCounts[template.course_id] || 0) + 1
        }
      })

      // Merge data
      const coursesWithCounts = coursesData?.map((course) => ({
        ...course,
        template_count: templateCounts[course.id] || 0
      })) || []

      setCourses(coursesWithCounts)
      setFilteredCourses(coursesWithCounts)
    } catch (error) {
      console.error("Error loading courses:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterCourses = () => {
    if (!searchQuery.trim()) {
      setFilteredCourses(courses)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = courses.filter(
      (course) =>
        course.name.toLowerCase().includes(query) ||
        course.title?.toLowerCase().includes(query) ||
        (course.serial_number && course.serial_number.toString().includes(query))
    )
    setFilteredCourses(filtered)
  }

  const openTemplateEditor = (course: Course) => {
    setSelectedCourse(course)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedCourse(null)
    loadCourses() // Reload to update template counts
  }

  const formatSerialNumber = (num: number | null, pad: number | null) => {
    if (num === null || num === undefined) return "N/A"
    const paddingLength = pad || 4
    return num.toString().padStart(paddingLength, '0')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Certificate Template Management</h1>
          <p className="text-muted-foreground mt-1">
            Configure certificate templates and serial numbers for each course
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
            <p className="text-xs text-muted-foreground">Active courses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configured Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courses.filter(c => c.template_count && c.template_count > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Courses with templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Total Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courses.reduce((sum, c) => sum + (c.template_count || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Certificate templates created</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Course Certificates</CardTitle>
              <CardDescription>
                Manage certificate templates and numbering for all courses
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No courses found</p>
              <p className="text-sm">
                {searchQuery ? "Try adjusting your search query" : "No courses available"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Serial #</TableHead>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-center">Templates</TableHead>
                    <TableHead className="text-center">Cert ID Format</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-mono font-medium">
                        {formatSerialNumber(course.serial_number, course.serial_number_pad || 4)}
                      </TableCell>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        <span className="block truncate">
                            {course.title || "—"}
                        </span>
                        </TableCell>
                      <TableCell className="text-center">
                        {course.template_count && course.template_count > 0 ? (
                          <Badge variant="default" className="font-normal">
                            {course.template_count} template{course.template_count !== 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            No templates
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {course.serial_number ? `${course.serial_number}-XXXX` : "Not Set"}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTemplateEditor(course)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      

      {/* Template Modal */}
      {selectedCourse && (
        <CertificateTemplateModal
          courseId={selectedCourse.id}
          courseName={selectedCourse.name}
          open={modalOpen}
          onClose={closeModal}
        />
      )}
    </div>
  )
}