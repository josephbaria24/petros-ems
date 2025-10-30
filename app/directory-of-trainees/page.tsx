'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import {
  Tabs, TabsList, TabsTrigger, TabsContent
} from '@/components/ui/tabs'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table'
import {
  Select, SelectItem, SelectTrigger, SelectValue, SelectContent
} from '@/components/ui/select'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Course {
  id: string
  name: string
}

interface Trainee {
  id: string
  certificate_number?: string
  first_name: string
  last_name: string
  middle_initial?: string
  suffix?: string
  gender?: string
  age?: number
  company_name?: string
  company_position?: string
  mailing_city?: string
  company_region?: string
  company_industry?: string
  total_workers?: number
  company_email?: string
  email?: string
  phone_number?: string
  company_landline?: string
  id_picture_url?: string
  training_type?: string
  batch_number?: number
}

interface TrainingEntry {
  id: string
  name: string
  batch_number?: number
  start_date?: string
  end_date?: string
  branch?: string
  status?: string
  created_at: string
}

export default function DirectoryTabs() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [trainees, setTrainees] = useState<Trainee[]>([])
  const [trainingList, setTrainingList] = useState<TrainingEntry[]>([])
  const [batchNumbers, setBatchNumbers] = useState<number[]>([])
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10
  
  // 🔁 Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name')
        .order('name')

      if (error) console.error('Error fetching courses:', error)
      else setCourses(data)
    }

    fetchCourses()
  }, [])

  // 🔁 Fetch batch numbers for selected course
  useEffect(() => {
    if (!selectedCourseId) return

    const fetchBatches = async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('batch_number')
        .eq('course_id', selectedCourseId)
        .not('batch_number', 'is', null)
    
      if (error) {
        console.error('Error fetching batches:', error)
        return
      }
    
      const uniqueBatches = Array.from(
        new Set(data.map((t: any) => t.batch_number))
      ).sort((a, b) => a - b)
    
      setBatchNumbers(uniqueBatches)
      setSelectedBatch(null)
    }

    fetchBatches()
  }, [selectedCourseId])

  // 👥 Fetch trainees for selected course and batch
  useEffect(() => {
    if (!selectedCourseId) return

    const fetchTrainees = async () => {
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
    
      let query = supabase
        .from('trainings')
        .select(`
          id, certificate_number, first_name, last_name, middle_initial, suffix, gender, age,
          company_name, company_position, mailing_city, company_region, company_industry,
          total_workers, company_email, email, phone_number, company_landline,
          id_picture_url, training_type, batch_number
        `, { count: 'exact' })
        .eq('course_id', selectedCourseId)
        .order('last_name')
        .range(from, to)
    
      if (selectedBatch !== null) {
        query = query.eq('batch_number', selectedBatch)
      }
    
      const { data, error, count } = await query
    
      if (error) console.error('Error fetching trainees:', error)
      else {
        setTrainees(data || [])
        setTotalCount(count || 0)
      }
    }

    fetchTrainees()
  }, [selectedCourseId, selectedBatch, currentPage])

  // 🧾 Fetch training list
  useEffect(() => {
    const fetchTrainings = async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select(`id, branch, status, course_id, created_at, batch_number`)
        .order('created_at', { ascending: false })

      const { data: courseData } = await supabase.from('courses').select('id, name')
      const courseMap = new Map(courseData?.map(c => [c.id, c.name]))

      const mapped = data?.map(t => ({
        ...t,
        name: courseMap.get(t.course_id) || 'Unknown'
      })) || []

      setTrainingList(mapped)
    }

    fetchTrainings()
  }, [])

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  return (
    <div className="p-6">
      <Tabs defaultValue="directory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="directory">Directory of Trainees</TabsTrigger>
          <TabsTrigger value="database">Training Database</TabsTrigger>
        </TabsList>

        {/* 🧑 Directory of Trainees Tab */}
        <TabsContent value="directory" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Course Select */}
            <div className="w-64 space-y-1">
              {selectedCourseId && (
                <p className="text-sm text-muted-foreground">
                  Selected Course:{' '}
                  <span className="font-medium">
                    {courses.find(c => c.id === selectedCourseId)?.name}
                  </span>
                </p>
              )}
              <Select onValueChange={(val) => { setSelectedCourseId(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Batch Select */}
            <div className="w-40 space-y-1">
              {selectedBatch !== null && (
                <p className="text-sm text-muted-foreground">
                  Selected Batch: <span className="font-medium">Batch {selectedBatch}</span>
                </p>
              )}
              <Select
                value={selectedBatch !== null ? selectedBatch.toString() : ''}
                onValueChange={(val) => { setSelectedBatch(val ? parseInt(val) : null); setCurrentPage(1); }}
                disabled={!batchNumbers.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batchNumbers.map(batch => (
                    <SelectItem key={batch} value={batch.toString()}>
                      Batch {batch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card border-b">
                    <TableHead className="font-semibold">No.</TableHead>
                    <TableHead className="font-semibold">Certificate No.</TableHead>
                    <TableHead className="font-semibold">Full Name</TableHead>
                    <TableHead className="font-semibold">Sex</TableHead>
                    <TableHead className="font-semibold">Age</TableHead>
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Position</TableHead>
                    <TableHead className="font-semibold">City</TableHead>
                    <TableHead className="font-semibold">Region</TableHead>
                    <TableHead className="font-semibold">Industry</TableHead>
                    <TableHead className="font-semibold">Workers</TableHead>
                    <TableHead className="font-semibold">Company Email</TableHead>
                    <TableHead className="font-semibold">Personal Email</TableHead>
                    <TableHead className="font-semibold">Mobile No.</TableHead>
                    <TableHead className="font-semibold">Landline</TableHead>
                    <TableHead className="font-semibold">ID Picture</TableHead>
                    <TableHead className="font-semibold">Mode</TableHead>
                    <TableHead className="font-semibold">Batch No.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                        {selectedCourseId ? 'No trainees found' : 'Please select a course'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    trainees.map((t, i) => (
                      <TableRow key={t.id} className="border-b  bg-card dark:text-white text-primary">
                        <TableCell>{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                        <TableCell>{t.certificate_number ?? '-'}</TableCell>
                        <TableCell>{`${t.last_name}, ${t.first_name} ${t.middle_initial ?? ''} ${t.suffix ?? ''}`}</TableCell>
                        <TableCell>{t.gender ?? '-'}</TableCell>
                        <TableCell>{t.age ?? '-'}</TableCell>
                        <TableCell>{t.company_name ?? '-'}</TableCell>
                        <TableCell>{t.company_position ?? '-'}</TableCell>
                        <TableCell>{t.mailing_city ?? '-'}</TableCell>
                        <TableCell>{t.company_region ?? '-'}</TableCell>
                        <TableCell>{t.company_industry ?? '-'}</TableCell>
                        <TableCell>{t.total_workers ?? '-'}</TableCell>
                        <TableCell>{t.company_email ?? '-'}</TableCell>
                        <TableCell>{t.email ?? '-'}</TableCell>
                        <TableCell>{t.phone_number ?? '-'}</TableCell>
                        <TableCell>{t.company_landline ?? '-'}</TableCell>
                        <TableCell>
                          {t.id_picture_url ? (
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={t.id_picture_url} />
                            </Avatar>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell>{t.training_type ?? '-'}</TableCell>
                        <TableCell>{t.batch_number ?? '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {trainees.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                <div className="text-sm text-muted-foreground">
                  {totalCount} event(s) total
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 🗂 Training Database Tab */}
        <TabsContent value="database">
          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card border-b">
                    <TableHead className="font-semibold">No.</TableHead>
                    <TableHead className="font-semibold">Training Title</TableHead>
                    <TableHead className="font-semibold">Batch No.</TableHead>
                    <TableHead className="font-semibold">Date Created</TableHead>
                    <TableHead className="font-semibold">Mode of Training</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainingList.map((t, i) => (
                    <TableRow key={t.id} className="border-b  dark:text-white text-primary">
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.batch_number ?? '-'}</TableCell>
                      <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{t.branch}</TableCell>
                      <TableCell>{t.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination for Training Database */}
            {trainingList.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                <div className="text-sm text-muted-foreground">
                  {trainingList.length} event(s) total
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    disabled
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}