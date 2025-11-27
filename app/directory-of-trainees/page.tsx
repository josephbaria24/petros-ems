'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'

import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

interface ImportRow {
  no: number
  lastName: string
  firstName: string
  middleInitial?: string
  suffix?: string
  gender?: string
  age?: number
  company?: string
  position?: string
  city?: string
  region?: string
  industry?: string
  workers?: number
  companyEmail?: string
  personalEmail?: string
  mobile?: string
  landline?: string
  mode?: string
  batchNo?: string
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
  
  // Import Dialog States
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importData, setImportData] = useState<ImportRow[]>([])
  const [importCourseId, setImportCourseId] = useState<string>('')
  const [importScheduleId, setImportScheduleId] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  
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

  // 📤 Handle Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Read from "Directory of Participants" sheet
        const sheetName = 'Directory of Participants'
        const worksheet = workbook.Sheets[sheetName]
        
        if (!worksheet) {
          alert('Sheet "Directory of Participants" not found in Excel file')
          return
        }

        // Parse starting from row 15 (where data begins)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          range: 14, // Start from row 15 (0-indexed)
          header: ['no', 'certNum', 'lastName', 'firstName', 'middleInitial', 'suffix', 
                   'gender', 'age', 'company', 'position', 'city', 'region', 'industry', 
                   'workers', 'companyEmail', 'personalEmail', 'mobile', 'landline', 
                   'idPicture', 'mode', 'batchNo'],
          defval: ''
        })

        // Filter out empty rows and map to our structure
        const parsedData: ImportRow[] = jsonData
          .filter((row: any) => row.lastName && row.firstName)
          .map((row: any) => ({
            no: row.no,
            lastName: row.lastName,
            firstName: row.firstName,
            middleInitial: row.middleInitial || '',
            suffix: row.suffix || '',
            gender: row.gender || '',
            age: row.age ? parseInt(row.age) : undefined,
            company: row.company || '',
            position: row.position || '',
            city: row.city || '',
            region: row.region || '',
            industry: row.industry || '',
            workers: row.workers ? parseInt(row.workers) : undefined,
            companyEmail: row.companyEmail || '',
            personalEmail: row.personalEmail || '',
            mobile: row.mobile || '',
            landline: row.landline || '',
            mode: row.mode || '',
            batchNo: row.batchNo || ''
          }))

        setImportData(parsedData)
        console.log('Parsed data:', parsedData)
      } catch (error) {
        console.error('Error parsing Excel:', error)
        alert('Error parsing Excel file. Please check the format.')
      }
    }

    reader.readAsArrayBuffer(file)
  }

  // 💾 Import Data to Database
  const handleImport = async () => {
    if (!importCourseId || !importScheduleId) {
      alert('Please select a course and schedule')
      return
    }

    if (importData.length === 0) {
      alert('No data to import')
      return
    }

    setImporting(true)
    setImportResult(null)

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    try {
      // Get the schedule details to extract batch number
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('batch_number')
        .eq('id', importScheduleId)
        .single()

      if (scheduleError) {
        throw new Error('Failed to fetch schedule details')
      }

      const batchNumber = scheduleData?.batch_number

      for (const row of importData) {
        try {
          // Extract training mode from "Mode of Training" column
          let trainingType = 'Online'
          if (row.mode) {
            if (row.mode.toLowerCase().includes('face-to-face')) {
              trainingType = 'Face-to-Face'
            } else if (row.mode.toLowerCase().includes('online')) {
              trainingType = 'Online'
            }
          }

          const traineeData = {
            schedule_id: importScheduleId,
            course_id: importCourseId,
            first_name: row.firstName,
            last_name: row.lastName,
            middle_initial: row.middleInitial || null,
            suffix: row.suffix || null,
            gender: row.gender || null,
            age: row.age || null,
            company_name: row.company || null,
            company_position: row.position || null,
            mailing_city: row.city || null,
            company_region: row.region || null,
            company_industry: row.industry || null,
            total_workers: row.workers || null,
            company_email: row.companyEmail || null,
            email: row.personalEmail || null,
            phone_number: row.mobile || null,
            company_landline: row.landline || null,
            training_type: trainingType,
            batch_number: batchNumber,
            status: 'TBC',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { error } = await supabase
            .from('trainings')
            .insert(traineeData)

          if (error) {
            failedCount++
            errors.push(`${row.firstName} ${row.lastName}: ${error.message}`)
          } else {
            successCount++
          }
        } catch (error: any) {
          failedCount++
          errors.push(`${row.firstName} ${row.lastName}: ${error.message}`)
        }
      }

      setImportResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10) // Show first 10 errors
      })

      // Refresh the trainee list if current course is selected
      if (selectedCourseId === importCourseId) {
        // Trigger refetch
        setCurrentPage(1)
      }

    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  // 🔄 Reset Import Dialog
  const resetImportDialog = () => {
    setImportFile(null)
    setImportData([])
    setImportCourseId('')
    setImportScheduleId('')
    setImportResult(null)
  }

  return (
    <div className="p-6">
      <Tabs defaultValue="directory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="directory">Directory of Trainees</TabsTrigger>
          <TabsTrigger value="database">Training Database</TabsTrigger>
        </TabsList>

        {/* 🧑 Directory of Trainees Tab */}
        <TabsContent value="directory" className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
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

            {/* Import Button */}
            <Button
              onClick={() => setImportDialogOpen(true)}
              className="gap-2"
              variant="outline"
            >
              <Upload className="h-4 w-4" />
              Import from Excel
            </Button>
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
                      <TableRow key={t.id} className="border-b bg-card dark:text-white text-primary">
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
                  {totalCount} trainee(s) total
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
                    <TableRow key={t.id} className="border-b dark:text-white text-primary">
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

            {trainingList.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                <div className="text-sm text-muted-foreground">
                  {trainingList.length} event(s) total
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* 📥 Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open)
        if (!open) resetImportDialog()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Trainees from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file exported from the previous system. The file should have a "Directory of Participants" sheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Upload */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {importFile ? importFile.name : 'Click to upload Excel file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xlsx and .xls files
                </p>
              </label>
            </div>

            {/* Preview Data */}
            {importData.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Found {importData.length} trainees in file
                </p>
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Gender</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{`${row.firstName} ${row.lastName}`}</TableCell>
                          <TableCell>{row.company || '-'}</TableCell>
                          <TableCell>{row.gender || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {importData.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing 5 of {importData.length} trainees
                  </p>
                )}
              </div>
            )}

            {/* Course Selection */}
            {importData.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Course</label>
                <Select value={importCourseId} onValueChange={setImportCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a course" />
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
            )}

            {/* Schedule Selection */}
            {importCourseId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Schedule</label>
                <Select value={importScheduleId} onValueChange={setImportScheduleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainingList
                      .filter(t => courses.find(c => c.id === importCourseId)?.name === t.name)
                      .map(schedule => (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          Batch {schedule.batch_number} - {schedule.branch} ({schedule.status})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium">
                    Successfully imported {importResult.success} trainees
                  </p>
                </div>
                
                {importResult.failed > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <p className="text-sm font-medium">
                        Failed to import {importResult.failed} trainees
                      </p>
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, i) => (
                          <p key={i}>• {error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false)
                resetImportDialog()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importCourseId || !importScheduleId || importData.length === 0 || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {importData.length} Trainees
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}