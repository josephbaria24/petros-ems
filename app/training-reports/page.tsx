// PART 1 - PASTE THIS AT THE TOP OF YOUR FILE
// Replace your existing imports and add these new ones

"use client";

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil, MoreVertical, Upload, Download, Trash2, Filter, ChevronDown, Search } from 'lucide-react';
import { tmsDb } from '@/lib/supabase-client';
import { toast } from 'sonner';

interface TrainingReport {
  id: string;
  cert: boolean;
  ID: boolean;
  ptr: boolean;
  month: string;
  course: string;
  type: string;
  start_date: string;
  end_date: string;
  participants: number;
  male: number;
  female: number;
  company: number;
  notes: string;
}

interface ColumnFilter {
  [key: string]: Set<string>;
}
// PART 2 - PASTE THIS AFTER PART 1
// This replaces your existing "export default function TrainingReportsPage()" and adds filter states

export default function TrainingReportsPage() {
  const [reports, setReports] = useState<TrainingReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<TrainingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingReport, setEditingReport] = useState<TrainingReport | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newReport, setNewReport] = useState<Omit<TrainingReport, 'id'>>({
    cert: false,
    ID: false,
    ptr: false,
    month: '',
    course: '',
    type: '',
    start_date: '',
    end_date: '',
    participants: 0,
    male: 0,
    female: 0,
    company: 0,
    notes: '',
  });
  
  // Existing filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  
  // NEW: Column-based filters (Excel-style)
  const [columnFilters, setColumnFilters] = useState<ColumnFilter>({
    month: new Set(),
    course: new Set(),
    type: new Set(),
  });
  const [tempColumnFilters, setTempColumnFilters] = useState<ColumnFilter>({
    month: new Set(),
    course: new Set(),
    type: new Set(),
  });
  const [filterSearchTerms, setFilterSearchTerms] = useState<{[key: string]: string}>({
    month: '',
    course: '',
    type: '',
  });
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [stats, setStats] = useState({
    totalTrainings: 0,
    totalParticipants: 0,
  });
  
  const supabase = tmsDb;
  // PART 3 - PASTE THIS AFTER PART 2
// Helper functions for column filters

  // Get unique values for a column
  const getUniqueColumnValues = (columnName: keyof TrainingReport): string[] => {
    const values = reports
      .map(report => String(report[columnName]))
      .filter(Boolean);
    return Array.from(new Set(values)).sort();
  };

  // Filter function that includes column filters
  const applyAllFilters = () => {
    let filtered = [...reports];

    // Year filter
    if (selectedYear !== 'all') {
      filtered = filtered.filter(report => {
        const year = new Date(report.start_date).getFullYear();
        return year.toString() === selectedYear;
      });
    }

    // Column filters (Excel-style)
    Object.entries(columnFilters).forEach(([column, selectedValues]) => {
      if (selectedValues.size > 0) {
        filtered = filtered.filter(report => 
          selectedValues.has(String(report[column as keyof TrainingReport]))
        );
      }
    });

    setFilteredReports(filtered);

    const totalTrainings = filtered.length;
    const totalParticipants = filtered.reduce((sum, report) => sum + (report.participants || 0), 0);
    
    setStats({
      totalTrainings,
      totalParticipants,
    });
  };

  // Handle applying column filter
  const handleApplyColumnFilter = (column: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: new Set(tempColumnFilters[column])
    }));
    setActiveFilterColumn(null);
  };

  // Handle clearing column filter
  const handleClearColumnFilter = (column: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: new Set()
    }));
    setTempColumnFilters(prev => ({
      ...prev,
      [column]: new Set()
    }));
    setFilterSearchTerms(prev => ({
      ...prev,
      [column]: ''
    }));
    setActiveFilterColumn(null);
  };

  // Handle select all in column filter
  const handleSelectAllInColumn = (column: string, values: string[]) => {
    setTempColumnFilters(prev => ({
      ...prev,
      [column]: new Set(values)
    }));
  };

  // Handle deselect all in column filter
  const handleDeselectAllInColumn = (column: string) => {
    setTempColumnFilters(prev => ({
      ...prev,
      [column]: new Set()
    }));
  };

  // Column Filter Popover Component
  const ColumnFilterPopover = ({ 
    column, 
    displayName 
  }: { 
    column: keyof TrainingReport; 
    displayName: string;
  }) => {
    const uniqueValues = getUniqueColumnValues(column);
    const filteredValues = uniqueValues.filter(value =>
      value.toLowerCase().includes(filterSearchTerms[column]?.toLowerCase() || '')
    );
    const hasActiveFilter = columnFilters[column].size > 0;
    
    return (
      <Popover 
        open={activeFilterColumn === column} 
        onOpenChange={(open) => {
          if (open) {
            setActiveFilterColumn(column);
            setTempColumnFilters(prev => ({
              ...prev,
              [column]: new Set(columnFilters[column])
            }));
          } else {
            setActiveFilterColumn(null);
            setFilterSearchTerms(prev => ({
              ...prev,
              [column]: ''
            }));
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-6 px-2 ${hasActiveFilter ? 'text-blue-600 dark:text-blue-400' : ''}`}
          >
            <Filter className={`h-3 w-3 ${hasActiveFilter ? 'fill-current' : ''}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${displayName}...`}
                value={filterSearchTerms[column] || ''}
                onChange={(e) => setFilterSearchTerms(prev => ({
                  ...prev,
                  [column]: e.target.value
                }))}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="p-2 border-b bg-muted/50">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => handleSelectAllInColumn(column, uniqueValues)}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => handleDeselectAllInColumn(column)}
              >
                Clear All
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {filteredValues.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No items found
              </div>
            ) : (
              filteredValues.map((value) => (
                <div
                  key={value}
                  className="flex items-center space-x-2 py-2 px-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => {
                    const newSet = new Set(tempColumnFilters[column]);
                    if (newSet.has(value)) {
                      newSet.delete(value);
                    } else {
                      newSet.add(value);
                    }
                    setTempColumnFilters(prev => ({
                      ...prev,
                      [column]: newSet
                    }));
                  }}
                >
                  <Checkbox
                    checked={tempColumnFilters[column]?.has(value)}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(tempColumnFilters[column]);
                      if (checked) {
                        newSet.add(value);
                      } else {
                        newSet.delete(value);
                      }
                      setTempColumnFilters(prev => ({
                        ...prev,
                        [column]: newSet
                      }));
                    }}
                  />
                  <label className="text-sm flex-1 cursor-pointer">
                    {value}
                  </label>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t bg-muted/50 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleClearColumnFilter(column)}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleApplyColumnFilter(column)}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };
  // PART 4 - PASTE THIS AFTER PART 3
// useEffect hooks - UPDATE the applyFilters effect

  const syncFromTrainings = async () => {
    setSyncing(true);
    const toastId = toast.loading('Syncing training reports from database...');
    
    try {
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select(`
          id,
          branch,
          event_type,
          status,
          courses!inner (
            name
          ),
          schedule_ranges (
            start_date,
            end_date
          ),
          trainings (
            id,
            gender,
            company_name
          )
        `)
        .eq('status', 'finished');

      if (schedulesError) throw schedulesError;

      const newReports: Omit<TrainingReport, 'id'>[] = [];

      for (const schedule of schedules || []) {
        if (!schedule.trainings || schedule.trainings.length === 0) continue;

        let startDate = '';
        let endDate = '';
        let monthName = '';

        if (schedule.schedule_ranges && schedule.schedule_ranges.length > 0) {
          const range = schedule.schedule_ranges[0];
          startDate = range.start_date;
          endDate = range.end_date;
          
          const date = new Date(range.start_date);
          monthName = date.toLocaleString('en-US', { month: 'long' });
        }

        const maleCount = schedule.trainings.filter((t: any) => 
          t.gender?.toLowerCase() === 'male'
        ).length;
        
        const femaleCount = schedule.trainings.filter((t: any) => 
          t.gender?.toLowerCase() === 'female'
        ).length;

        const companyCount = schedule.trainings.filter((t: any) => 
          t.company_name && t.company_name.trim() !== ''
        ).length;

        const courseName = (schedule.courses as any)?.name || 'Unknown';

        const { data: existing } = await supabase
          .from('training_reports')
          .select('id')
          .eq('course', courseName)
          .eq('start_date', startDate)
          .eq('end_date', endDate)
          .single();

        if (!existing) {
          newReports.push({
            cert: false,
            ID: false,
            ptr: false,
            month: monthName,
            course: courseName,
            type: schedule.branch || 'Unknown',
            start_date: startDate,
            end_date: endDate,
            participants: schedule.trainings.length,
            male: maleCount,
            female: femaleCount,
            company: companyCount,
            notes: `Synced from ${schedule.event_type || 'public'} training`,
          });
        }
      }

      if (newReports.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('training_reports')
          .insert(newReports)
          .select();

        if (insertError) throw insertError;

        if (inserted) {
          setReports(prev => [...prev, ...inserted]);
          toast.success(`Successfully synced ${inserted.length} training reports`, {
            id: toastId,
          });
        }
      } else {
        toast.info('No new training reports to sync', {
          id: toastId,
        });
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync training reports', {
        id: toastId,
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // UPDATED: This useEffect now uses the new applyAllFilters function
  useEffect(() => {
    applyAllFilters();
  }, [reports, selectedYear, columnFilters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, columnFilters, rowsPerPage]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('training_reports')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        toast.error('Failed to fetch training reports');
        throw error;
      }

      if (data) {
        setReports(data);
        toast.success(`Loaded ${data.length} training reports`);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('An error occurred while fetching reports');
    } finally {
      setLoading(false);
    }
  };

  const updateCheckbox = async (id: string, field: 'cert' | 'ID' | 'ptr', value: boolean) => {
    try {
      const { error } = await supabase
        .from('training_reports')
        .update({ [field]: value })
        .eq('id', id);

      if (error) {
        toast.error(`Failed to update ${field}`);
        throw error;
      }

      setReports(prev =>
        prev.map(report =>
          report.id === id ? { ...report, [field]: value } : report
        )
      );
      toast.success(`${field} updated successfully`);
    } catch (error) {
      console.error('Error updating checkbox:', error);
    }
  };

  const handleEdit = (report: TrainingReport) => {
    setEditingReport(report);
    setShowEditDialog(true);
  };

  const handleAdd = () => {
    setNewReport({
      cert: false,
      ID: false,
      ptr: false,
      month: '',
      course: '',
      type: '',
      start_date: '',
      end_date: '',
      participants: 0,
      male: 0,
      female: 0,
      company: 0,
      notes: '',
    });
    setShowAddDialog(true);
  };

  const handleSaveNew = async () => {
    try {
      const { data, error } = await supabase
        .from('training_reports')
        .insert([newReport])
        .select();

      if (error) {
        toast.error('Failed to add training report');
        throw error;
      }

      if (data) {
        setReports(prev => [...prev, ...data]);
        setShowAddDialog(false);
        toast.success('Training report added successfully');
      }
    } catch (error) {
      console.error('Error adding report:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingReport) return;

    try {
      const { error } = await supabase
        .from('training_reports')
        .update(editingReport)
        .eq('id', editingReport.id);

      if (error) {
        toast.error('Failed to update training report');
        throw error;
      }

      setReports(prev =>
        prev.map(report =>
          report.id === editingReport.id ? editingReport : report
        )
      );
      setShowEditDialog(false);
      setEditingReport(null);
      toast.success('Training report updated successfully');
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };
  // PART 5 - PASTE THIS AFTER PART 4
// All remaining handler functions

  const toggleSelectAll = () => {
    const paginatedReports = filteredReports.slice((currentPage - 1) * rowsPerPage, (currentPage - 1) * rowsPerPage + rowsPerPage);
    if (selectedIds.size === paginatedReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedReports.map(r => r.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    try {
      const idsToDelete = Array.from(selectedIds);
      const { error } = await supabase
        .from('training_reports')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        toast.error('Failed to delete training reports');
        throw error;
      }

      setReports(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setDeleteMode(false);
      setShowDeleteConfirm(false);
      toast.success(`Successfully deleted ${idsToDelete.length} training report(s)`);
    } catch (error) {
      console.error('Error deleting reports:', error);
    }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('CSV file is empty or invalid');
          return;
        }

        const dataLines = lines.slice(1);
        const newReports: Omit<TrainingReport, 'id'>[] = [];

        for (const line of dataLines) {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          
          if (values.length >= 13) {
            newReports.push({
              cert: values[0].toLowerCase() === 'true',
              ID: values[1].toLowerCase() === 'true',
              ptr: values[2].toLowerCase() === 'true',
              month: values[3] || '',
              course: values[4] || '',
              type: values[5] || '',
              start_date: values[6] || '',
              end_date: values[7] || '',
              participants: parseInt(values[8]) || 0,
              male: parseInt(values[9]) || 0,
              female: parseInt(values[10]) || 0,
              company: parseInt(values[11]) || 0,
              notes: values[12] || '',
            });
          }
        }

        if (newReports.length === 0) {
          toast.error('No valid data found in CSV');
          return;
        }

        const { data, error } = await supabase
          .from('training_reports')
          .insert(newReports)
          .select();

        if (error) {
          toast.error('Failed to import CSV data');
          throw error;
        }

        if (data) {
          setReports(prev => [...prev, ...data]);
          toast.success(`Successfully imported ${data.length} training reports`);
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read CSV file');
    };
    reader.readAsText(file);
    
    event.target.value = '';
  };

  const handleExportExcel = () => {
    try {
      const headers = ['cert', 'ID', 'ptr', 'month', 'course', 'type', 'start_date', 'end_date', 'participants', 'male', 'female', 'company', 'notes'];
      const csvRows = [headers.join(',')];

      filteredReports.forEach(report => {
        const row = [
          report.cert,
          report.ID,
          report.ptr,
          `"${report.month}"`,
          `"${report.course}"`,
          `"${report.type}"`,
          report.start_date,
          report.end_date,
          report.participants,
          report.male,
          report.female,
          report.company,
          `"${report.notes}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `training_reports_${selectedYear}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${filteredReports.length} training reports to CSV`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export data');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const uniqueYears = Array.from(new Set(reports.map(r => new Date(r.start_date).getFullYear()))).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  if (!uniqueYears.includes(currentYear)) {
    uniqueYears.unshift(currentYear);
  }

  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }
  // PART 6 - PASTE THIS AFTER PART 5
// The main return JSX - UPDATED filter section

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-primary dark:bg-card text-white p-6 rounded-t-lg relative">
          <h1 className="text-4xl font-bold text-center">
            {selectedYear === "all" ? "All Trainings" : `${selectedYear} Trainings`}
          </h1>

          <div className="absolute top-4 right-4 flex gap-4">
            <div className="bg-card text-card-foreground dark:bg-background px-4 py-2 rounded font-semibold">
              <div className="text-xs">Trainings</div>
              <div className="text-xl">{stats.totalTrainings}</div>
            </div>
            <div className="bg-card text-card-foreground dark:bg-background px-4 py-2 rounded font-semibold">
              <div className="text-xs">Participants</div>
              <div className="text-xl">{stats.totalParticipants}</div>
            </div>
          </div>
        </div>

        {/* UPDATED FILTER SECTION - Simplified with only Year filter and Rows per page */}
        <div className="bg-card p-4 border-b flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {uniqueYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={rowsPerPage.toString()} onValueChange={(val) => setRowsPerPage(parseInt(val))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="500">500 rows</SelectItem>
                <SelectItem value="1000">1000 rows</SelectItem>
              </SelectContent>
            </Select>

            {/* Show active filters count */}
            {(columnFilters.month.size > 0 || columnFilters.course.size > 0 || columnFilters.type.size > 0) && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md text-sm">
                <Filter className="h-4 w-4" />
                <span>
                  {columnFilters.month.size + columnFilters.course.size + columnFilters.type.size} filter(s) active
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 ml-2"
                  onClick={() => {
                    setColumnFilters({
                      month: new Set(),
                      course: new Set(),
                      type: new Set(),
                    });
                    setTempColumnFilters({
                      month: new Set(),
                      course: new Set(),
                      type: new Set(),
                    });
                  }}
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={syncFromTrainings} 
              disabled={syncing}
              className='bg-blue-600 cursor-pointer hover:bg-blue-700'
            >
              {syncing ? 'Syncing...' : 'Sync from Trainings'}
            </Button>
            <Button onClick={handleAdd} className='bg-green-600 cursor-pointer hover:bg-green-700'>
              Add New
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVertical className="h-4 w-4 mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => document.getElementById('csv-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleteMode(!deleteMode)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteMode ? 'Cancel Delete' : 'Delete Mode'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
        </div>

        {deleteMode && (
          <div className="bg-red-50 dark:bg-red-950 p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium dark:text-red-200">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === paginatedReports.length && paginatedReports.length > 0 ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Selected
            </Button>
          </div>
        )}

        <div className="bg-card rounded-b-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#141454]">
                  {deleteMode && (
                    <th className="text-white font-semibold px-3 py-2 text-center border-r border-[#141454]">
                      <Checkbox
                        checked={selectedIds.size === paginatedReports.length && paginatedReports.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-white font-semibold px-3 py-2 text-center border-r border-[#141454] text-xs">Actions</th>
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">cert</th>
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">ID</th>
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">ptr</th>
                  
                  {/* Month column with filter */}
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">
                    <div className="flex items-center justify-between">
                      <span>month</span>
                      <ColumnFilterPopover column="month" displayName="Month" />
                    </div>
                  </th>
                  
                  {/* Course column with filter */}
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">
                    <div className="flex items-center justify-between">
                      <span>course</span>
                      <ColumnFilterPopover column="course" displayName="Course" />
                    </div>
                  </th>
                  
                  {/* Type column with filter */}
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">
                    <div className="flex items-center justify-between">
                      <span>type</span>
                      <ColumnFilterPopover column="type" displayName="Type" />
                    </div>
                  </th>
                  
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">start_date</th>
                  <th className="text-white font-semibold px-3 py-2 text-left border-r border-[#141454] text-xs">end_date</th>
                  <th className="text-white font-semibold px-3 py-2 text-center border-r border-[#141454] text-xs">participants</th>
                  <th className="text-white font-semibold px-3 py-2 text-center border-r border-[#141454] text-xs">male</th>
                  <th className="text-white font-semibold px-3 py-2 text-center border-r border-[#141454] text-xs">female</th>
                  <th className="text-white font-semibold px-3 py-2 text-center border-r border-[#141454] text-xs">company</th>
                  <th className="text-white font-semibold px-3 py-2 text-left text-xs">notes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={deleteMode ? 15 : 14} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No training reports found
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((report, index) => (
                    <tr 
                      key={report.id} 
                      className={`hover:bg-secondary ${index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}`}
                    >
                      {deleteMode && (
                        <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={selectedIds.has(report.id)}
                              onCheckedChange={() => toggleSelectRow(report.id)}
                            />
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(report)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={report.cert}
                            onCheckedChange={(checked) => updateCheckbox(report.id, 'cert', checked as boolean)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={report.ID}
                            onCheckedChange={(checked) => updateCheckbox(report.id, 'ID', checked as boolean)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={report.ptr}
                            onCheckedChange={(checked) => updateCheckbox(report.id, 'ptr', checked as boolean)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">{report.month}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-medium">{report.course}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">{report.type}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">{formatDate(report.start_date)}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">{formatDate(report.end_date)}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center">{report.participants}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center">{report.male}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center">{report.female}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center">{report.company}</td>
                      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">{report.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredReports.length > 0 && (
          <div className="bg-card p-4 border-t flex items-center justify-between rounded-b-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredReports.length)} of {filteredReports.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>
                First
              </Button>
              <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                Next
              </Button>
              <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
                Last
              </Button>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="lg:w-[60vw] w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Training Report</DialogTitle>
              <DialogDescription>Make changes to the training report details.</DialogDescription>
            </DialogHeader>
            {editingReport && (
              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <label className="text-sm font-medium">Month</label>
                  <Input value={editingReport.month} onChange={(e) => setEditingReport({...editingReport, month: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Course</label>
                  <Input value={editingReport.course} onChange={(e) => setEditingReport({...editingReport, course: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Input value={editingReport.type} onChange={(e) => setEditingReport({...editingReport, type: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={editingReport.start_date} onChange={(e) => setEditingReport({...editingReport, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input type="date" value={editingReport.end_date} onChange={(e) => setEditingReport({...editingReport, end_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Participants</label>
                  <Input type="number" value={editingReport.participants || ''} onChange={(e) => setEditingReport({...editingReport, participants: e.target.value ? parseInt(e.target.value) : 0})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Male</label>
                  <Input type="number" value={editingReport.male || ''} onChange={(e) => setEditingReport({...editingReport, male: e.target.value ? parseInt(e.target.value) : 0})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Female</label>
                  <Input type="number" value={editingReport.female || ''} onChange={(e) => setEditingReport({...editingReport, female: e.target.value ? parseInt(e.target.value) : 0})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Company</label>
                  <Input type="number" value={editingReport.company || ''} onChange={(e) => setEditingReport({...editingReport, company: e.target.value ? parseInt(e.target.value) : 0})} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Input value={editingReport.notes} onChange={(e) => setEditingReport({...editingReport, notes: e.target.value})} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="lg:w-[60vw] w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Training Report</DialogTitle>
              <DialogDescription>Enter the details for the new training report.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="text-sm font-medium">Month</label>
                <Input value={newReport.month} onChange={(e) => setNewReport({...newReport, month: e.target.value})} placeholder="e.g., January" />
              </div>
              <div>
                <label className="text-sm font-medium">Course</label>
                <Input value={newReport.course} onChange={(e) => setNewReport({...newReport, course: e.target.value})} placeholder="e.g., COSH" />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Input value={newReport.type} onChange={(e) => setNewReport({...newReport, type: e.target.value})} placeholder="e.g., Online or Face to Face" />
              </div>
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={newReport.start_date} onChange={(e) => setNewReport({...newReport, start_date: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={newReport.end_date} onChange={(e) => setNewReport({...newReport, end_date: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Participants</label>
                <Input type="number" value={newReport.participants || ''} onChange={(e) => setNewReport({...newReport, participants: e.target.value ? parseInt(e.target.value) : 0})} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium">Male</label>
                <Input type="number" value={newReport.male || ''} onChange={(e) => setNewReport({...newReport, male: e.target.value ? parseInt(e.target.value) : 0})} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium">Female</label>
                <Input type="number" value={newReport.female || ''} onChange={(e) => setNewReport({...newReport, female: e.target.value ? parseInt(e.target.value) : 0})} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input type="number" value={newReport.company || ''} onChange={(e) => setNewReport({...newReport, company: e.target.value ? parseInt(e.target.value) : 0})} placeholder="0" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <Input value={newReport.notes} onChange={(e) => setNewReport({...newReport, notes: e.target.value})} placeholder="Additional notes" />
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="cert-new" checked={newReport.cert} onCheckedChange={(checked) => setNewReport({...newReport, cert: checked as boolean})} />
                  <label htmlFor="cert-new" className="text-sm font-medium">Certificate</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="id-new" checked={newReport.ID} onCheckedChange={(checked) => setNewReport({...newReport, ID: checked as boolean})} />
                  <label htmlFor="id-new" className="text-sm font-medium">ID</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="ptr-new" checked={newReport.ptr} onCheckedChange={(checked) => setNewReport({...newReport, ptr: checked as boolean})} />
                  <label htmlFor="ptr-new" className="text-sm font-medium">PTR</label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveNew}>Add Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className='lg:w-[60vw] w-full'>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedIds.size} training report(s)? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}