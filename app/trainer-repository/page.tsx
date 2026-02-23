// app/trainer-repository/page.tsx
"use client"

import * as React from "react"
import * as XLSX from "xlsx"
import { tmsDb } from "@/lib/supabase-client"
import { Plus, Settings2, Trash2, Edit2, Check, X, Loader2, GripVertical, PlusCircle, FileUp, File, ExternalLink, Paperclip, FileSpreadsheet, Upload, ClipboardList, BarChart3, Link, Copy, Save, ChevronLeft, ChevronRight } from "lucide-react"
import { Reorder, useDragControls, AnimatePresence, motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EvaluationDialog } from "@/components/evaluation-dialog"
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
import { toast } from "sonner"

interface Tab {
    id: string
    name: string
    sort_order: number
}

interface Column {
    id: string
    tab_id: string
    name: string
    data_type: string
    sort_order: number
}

interface Row {
    id: string
    tab_id: string
    data: Record<string, any>
    sort_order: number
}

export default function TrainerRepositoryPage() {
    const [tabs, setTabs] = React.useState<Tab[]>([])
    const [activeTabId, setActiveTabId] = React.useState<string | null>(null)
    const [columns, setColumns] = React.useState<Column[]>([])
    const [rows, setRows] = React.useState<Row[]>([])
    const [loading, setLoading] = React.useState(true)

    // Dialog States
    const [tabDialogOpen, setTabDialogOpen] = React.useState(false)
    const [newTabName, setNewTabName] = React.useState("")
    const [editingTab, setEditingTab] = React.useState<Tab | null>(null)

    const [columnDialogOpen, setColumnDialogOpen] = React.useState(false)
    const [newColumnName, setNewColumnName] = React.useState("")
    const [newColumnType, setNewColumnType] = React.useState("text")
    const [editingColumn, setEditingColumn] = React.useState<Column | null>(null)

    const [isSaving, setIsSaving] = React.useState(false)

    // Delete Confirmation State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
    const [deleteConfig, setDeleteConfig] = React.useState<{
        title?: string;
        description: string;
        onConfirm: () => void;
    } | null>(null)

    // Scroll States
    const tableContainerRef = React.useRef<HTMLDivElement>(null)
    const tableRef = React.useRef<HTMLTableElement>(null)

    const scrollTable = (direction: 'left' | 'right') => {
        if (tableContainerRef.current) {
            const scrollAmount = 300
            tableContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            })
        }
    }

    React.useEffect(() => {
        fetchTabs()
    }, [])

    React.useEffect(() => {
        if (activeTabId) {
            fetchTabData(activeTabId)
        }
    }, [activeTabId])

    const fetchTabs = async () => {
        setLoading(true)
        try {
            const { data, error } = await tmsDb
                .from("trainer_repo_tabs")
                .select("*")
                .order("sort_order", { ascending: true })

            if (error) throw error
            setTabs(data || [])
            if (data && data.length > 0 && !activeTabId) {
                setActiveTabId(data[0].id)
            }
        } catch (error) {
            console.error("Error fetching tabs:", error)
            toast.error("Failed to load repository tabs. Ensure database tables are created.")
        } finally {
            setLoading(false)
        }
    }

    const fetchTabData = async (tabId: string) => {
        try {
            const [colRes, rowRes] = await Promise.all([
                tmsDb.from("trainer_repo_columns").select("*").eq("tab_id", tabId).order("sort_order", { ascending: true }),
                tmsDb.from("trainer_repo_rows").select("*").eq("tab_id", tabId).order("sort_order", { ascending: true })
            ])

            if (colRes.error) throw colRes.error
            if (rowRes.error) throw rowRes.error

            setColumns(colRes.data || [])
            setRows(rowRes.data || [])
        } catch (error) {
            console.error("Error fetching tab data:", error)
            toast.error("Failed to load tab content")
        }
    }

    const handleAddTab = async () => {
        if (!newTabName.trim()) return
        setIsSaving(true)
        try {
            if (editingTab) {
                const { error } = await tmsDb
                    .from("trainer_repo_tabs")
                    .update({ name: newTabName })
                    .eq("id", editingTab.id)
                if (error) throw error
                toast.success("Tab renamed")
            } else {
                const { data, error } = await tmsDb
                    .from("trainer_repo_tabs")
                    .insert({ name: newTabName, sort_order: tabs.length })
                    .select()
                    .single()
                if (error) throw error
                setTabs([...tabs, data])
                setActiveTabId(data.id)
                toast.success("New tab created")
            }
            setTabDialogOpen(false)
            setNewTabName("")
            setEditingTab(null)
            fetchTabs()
        } catch (error) {
            console.error("Error saving tab:", error)
            toast.error("Failed to save tab")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteTab = async (id: string) => {
        try {
            const { error } = await tmsDb.from("trainer_repo_tabs").delete().eq("id", id)
            if (error) throw error
            setTabs(tabs.filter(t => t.id !== id))
            if (activeTabId === id) {
                setActiveTabId(tabs[0]?.id || null)
            }
            toast.success("Tab deleted")
        } catch (error) {
            toast.error("Failed to delete tab")
        }
    }

    const handleAddColumn = async () => {
        if (!newColumnName.trim() || !activeTabId) return
        setIsSaving(true)
        try {
            if (editingColumn) {
                const { error } = await tmsDb
                    .from("trainer_repo_columns")
                    .update({ name: newColumnName, data_type: newColumnType })
                    .eq("id", editingColumn.id)
                if (error) throw error
                toast.success("Column updated")
            } else {
                const { error } = await tmsDb
                    .from("trainer_repo_columns")
                    .insert({
                        tab_id: activeTabId,
                        name: newColumnName,
                        data_type: newColumnType,
                        sort_order: columns.length
                    })
                if (error) throw error
                toast.success("New column added")
            }
            setColumnDialogOpen(false)
            setNewColumnName("")
            setEditingColumn(null)
            fetchTabData(activeTabId)
        } catch (error) {
            toast.error("Failed to save column")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteColumn = async (id: string) => {
        try {
            const { error } = await tmsDb.from("trainer_repo_columns").delete().eq("id", id)
            if (error) throw error
            toast.success("Column removed")
            if (activeTabId) fetchTabData(activeTabId)
        } catch (error) {
            toast.error("Failed to remove column")
        }
    }

    const handleAddRow = async () => {
        if (!activeTabId) return
        try {
            const { data, error } = await tmsDb
                .from("trainer_repo_rows")
                .insert({
                    tab_id: activeTabId,
                    data: {},
                    sort_order: rows.length
                })
                .select()
                .single()
            if (error) throw error
            setRows([...rows, data])
            toast.success("New row added")
        } catch (error) {
            toast.error("Failed to add row")
        }
    }

    const handleUpdateCellValue = async (rowId: string, colName: string, value: any) => {
        const row = rows.find(r => r.id === rowId)
        if (!row) return

        const newData = { ...row.data, [colName]: value }

        // Optimistic Update
        setRows(rows.map(r => r.id === rowId ? { ...r, data: newData } : r))

        try {
            const { error } = await tmsDb
                .from("trainer_repo_rows")
                .update({ data: newData, updated_at: new Date().toISOString() })
                .eq("id", rowId)
            if (error) throw error
        } catch (error) {
            console.error("Error saving cell:", error)
            toast.error("Failed to save changes")
            // Rollback? (Optional, usually just letting the user know is enough as they can re-edit)
        }
    }

    const handleDeleteRow = async (id: string) => {
        try {
            const { error } = await tmsDb.from("trainer_repo_rows").delete().eq("id", id)
            if (error) throw error
            setRows(rows.filter(r => r.id !== id))
            toast.success("Row deleted")
        } catch (error) {
            toast.error("Failed to delete row")
        }
    }

    const EvaluationCell = ({ rowId, colName, value, rowData }: { rowId: string, colName: string, value: string, rowData: any }) => {
        const [isResultsOpen, setIsResultsOpen] = React.useState(false)
        const [aggregatedIds, setAggregatedIds] = React.useState<string[]>([])
        const [loading, setLoading] = React.useState(false)

        const fetchAggregatedEvaluations = async () => {
            setLoading(true)
            try {
                // 1. Identify trainer name from common fields
                let trainerName = rowData["Full Name"] || rowData["Name"] || rowData["Trainer Name"] || rowData["Trainer"]

                if (!trainerName) {
                    // Fallback: search all keys for something that looks like a name/trainer
                    const potentialKeys = Object.keys(rowData).filter(k =>
                        /name|trainer|instructor/i.test(k) && typeof rowData[k] === 'string'
                    )
                    if (potentialKeys.length > 0) {
                        // Prioritize "FullName" or "Name" or "Trainer" if they exist in any case
                        const bestKey = potentialKeys.find(k => /full\s*name/i.test(k)) ||
                            potentialKeys.find(k => /^name$/i.test(k)) ||
                            potentialKeys.find(k => /trainer/i.test(k)) ||
                            potentialKeys[0]
                        trainerName = rowData[bestKey]
                    }
                }

                if (!trainerName) {
                    toast.error("Could not identify trainer name for aggregation. Ensure you have a 'Name' or 'Trainer' column.")
                    return
                }

                // 2. Find schedules where this trainer is assigned
                // We fetch schedules and filter in-memory for robustness (handles JSONB values and casing)
                const { data: allSchedules, error: scheduleError } = await tmsDb
                    .from("schedules")
                    .select("id, trainer_name, day_trainers")

                if (scheduleError) throw scheduleError
                if (!allSchedules || allSchedules.length === 0) {
                    setAggregatedIds([])
                    return
                }

                const targetName = trainerName.trim().toLowerCase()
                const matchingSchedules = allSchedules.filter(s => {
                    // Check main trainer name
                    if (s.trainer_name?.trim().toLowerCase() === targetName) return true

                    // Check all trainers in day_trainers JSONB
                    if (s.day_trainers && typeof s.day_trainers === 'object') {
                        const dayTrainerNames = Object.values(s.day_trainers as Record<string, string>)
                            .map(n => String(n).trim().toLowerCase())
                        if (dayTrainerNames.includes(targetName)) return true
                    }
                    return false
                })

                if (matchingSchedules.length === 0) {
                    setAggregatedIds([])
                    return
                }

                const scheduleIds = matchingSchedules.map(s => s.id)

                // 3. Find evaluations for these schedules
                const { data: allEvals, error: evalError } = await tmsDb
                    .from("repo_evaluations")
                    .select("id, title, trainer_name")
                    .in("schedule_id", scheduleIds)

                if (evalError) throw evalError

                const targetTitle = colName.trim().toLowerCase()
                const matchingEvals = (allEvals || []).filter(e => {
                    const titleMatch = e.title.trim().toLowerCase() === targetTitle
                    if (!titleMatch) return false

                    // If evaluation is explicitly delegated to a trainer, check if it matches current trainer
                    if (e.trainer_name) {
                        return e.trainer_name.trim().toLowerCase() === targetName
                    }

                    // Otherwise, it's a shared evaluation for the schedule
                    return true
                })

                setAggregatedIds(matchingEvals.map(e => e.id))
            } catch (error) {
                console.error("Aggregation failed:", error)
            } finally {
                setLoading(false)
            }
        }

        return (
            <>
                <div className="flex items-center gap-1 h-full px-2 group/eval justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7 gap-1.5 opacity-60 hover:opacity-100 text-green-600"
                        onClick={async () => {
                            await fetchAggregatedEvaluations()
                            setIsResultsOpen(true)
                        }}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                        View Feedback
                    </Button>
                </div>

                <EvaluationDialog
                    id={null}
                    open={isResultsOpen}
                    onOpenChange={setIsResultsOpen}
                    mode="results"
                    initialTitle={colName}
                    multiIds={aggregatedIds}
                />
            </>
        )
    }

    const handleReorderRows = async (newOrder: Row[]) => {
        setRows(newOrder)

        // Batch update sort_order in database
        try {
            const updates = newOrder.map((row, index) => ({
                id: row.id,
                tab_id: row.tab_id,
                data: row.data,
                sort_order: index,
                updated_at: new Date().toISOString()
            }))

            const { error } = await tmsDb
                .from("trainer_repo_rows")
                .upsert(updates)

            if (error) throw error
        } catch (error) {
            console.error("Error updating row order:", error)
            toast.error("Failed to save new row order")
        }
    }

    const handleReorderColumns = async (newOrder: Column[]) => {
        setColumns(newOrder)

        // Batch update sort_order in database
        try {
            const updates = newOrder.map((col, index) => ({
                id: col.id,
                tab_id: col.tab_id,
                name: col.name,
                data_type: col.data_type,
                sort_order: index
            }))

            const { error } = await tmsDb
                .from("trainer_repo_columns")
                .upsert(updates)

            if (error) throw error
        } catch (error) {
            console.error("Error updating column order:", error)
            toast.error("Failed to save new column order")
        }
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsSaving(true)
        const toastId = toast.loading("Importing Excel data...")

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

            if (jsonData.length < 1) {
                throw new Error("Excel file is empty")
            }

            const headers = jsonData[0] as string[]
            const dataRows = jsonData.slice(1)

            // 1. Create Tab
            const tabName = file.name.split('.')[0]
            const { data: newTab, error: tabError } = await tmsDb
                .from("trainer_repo_tabs")
                .insert({ name: tabName, sort_order: tabs.length })
                .select()
                .single()

            if (tabError) throw tabError

            // 2. Create Columns
            const columnPromises = headers.map((header, index) =>
                tmsDb.from("trainer_repo_columns").insert({
                    tab_id: newTab.id,
                    name: String(header || `Column ${index + 1}`),
                    data_type: 'text',
                    sort_order: index
                })
            )
            await Promise.all(columnPromises)

            // 3. Create Rows
            const rowPromises = dataRows.map(row => {
                const rowObj: Record<string, any> = {}
                headers.forEach((header, index) => {
                    if (header) rowObj[header] = row[index] || ""
                })
                return tmsDb.from("trainer_repo_rows").insert({
                    tab_id: newTab.id,
                    data: rowObj
                })
            })
            await Promise.all(rowPromises)

            toast.success("Import successful!", { id: toastId })
            fetchTabs()
            setActiveTabId(newTab.id)
        } catch (error: any) {
            console.error("Import error:", error)
            toast.error(error.message || "Failed to import Excel", { id: toastId })
        } finally {
            setIsSaving(false)
            if (e.target) e.target.value = ""
        }
    }

    const FileCell = ({ rowId, colName, value }: { rowId: string, colName: string, value: string }) => {
        const [uploading, setUploading] = React.useState(false)
        const fileInputRef = React.useRef<HTMLInputElement>(null)

        const handleUpload = async (file: File) => {
            setUploading(true)
            const formData = new FormData()
            formData.append("image", file) // API expects "image" fieldname for general uploads too

            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })
                const result = await res.json()
                if (result.url) {
                    await handleUpdateCellValue(rowId, colName, result.url)
                    toast.success("File uploaded successfully")
                } else {
                    throw new Error(result.error || "Upload failed")
                }
            } catch (error: any) {
                toast.error(error.message || "Failed to upload file")
            } finally {
                setUploading(false)
            }
        }

        if (uploading) {
            return (
                <div className="flex items-center justify-center p-2 h-full">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
            )
        }

        if (value) {
            const fileName = value.split('/').pop()?.split('_').pop() || "View File"
            return (
                <div className="flex items-center justify-between px-4 py-2 group/file h-full">
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:underline truncate max-w-[140px]"
                        title={fileName}
                    >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        {fileName}
                    </a>
                    <button
                        onClick={() => {
                            setDeleteConfig({
                                title: "Remove Attachment?",
                                description: `Are you sure you want to remove the file "${fileName}"?`,
                                onConfirm: () => handleUpdateCellValue(rowId, colName, "")
                            });
                            setDeleteConfirmOpen(true);
                        }}
                        className="opacity-0 group-hover/file:opacity-100 p-1 hover:bg-muted rounded text-destructive"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )
        }

        return (
            <div
                className="h-full w-full relative group/upload"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-muted/50') }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-muted/50') }}
                onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('bg-muted/50')
                    const file = e.dataTransfer.files[0]
                    if (file) handleUpload(file)
                }}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(file)
                    }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground/50 hover:text-primary transition-colors italic"
                >
                    <FileUp className="h-3.5 w-3.5 opacity-30 group-hover/upload:opacity-100" />
                    Drop or click to upload
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-background p-6 space-y-6 overflow-hidden min-h-0">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Trainer Repository</h1>
                    <p className="text-muted-foreground">Manage your trainer lists with custom categories and fields.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleImportExcel}
                            disabled={isSaving}
                        />
                        <Button variant="outline" size="sm" disabled={isSaving}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Import Excel
                        </Button>
                    </div>

                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Initializing repository...</p>
                </div>
            ) : tabs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center space-y-4">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                        <PlusCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold">No tabs yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">Create your first tab to start organizing your trainers. Each tab can have its own unique set of columns.</p>
                    </div>
                    <Button onClick={() => setTabDialogOpen(true)}>Create First Tab</Button>
                </div>
            ) : (
                <Tabs value={activeTabId || ""} onValueChange={setActiveTabId} className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                        <TabsList className="bg-muted p-1 h-11 shrink-0">
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    className="px-4 py-2 relative group data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    {tab.name}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <span
                                                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Settings2 className="h-3 w-3" />
                                            </span>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                setEditingTab(tab);
                                                setNewTabName(tab.name);
                                                setTabDialogOpen(true);
                                            }}>
                                                <Edit2 className="h-4 w-4 mr-2" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => {
                                                    setDeleteConfig({
                                                        title: "Delete Tab?",
                                                        description: `This will permanently delete the "${tab.name}" tab and all the trainer records within it.`,
                                                        onConfirm: () => handleDeleteTab(tab.id)
                                                    });
                                                    setDeleteConfirmOpen(true);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => {
                            setEditingTab(null);
                            setNewTabName("");
                            setTabDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 bg-card rounded-xl border shadow-sm">
                        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold flex items-center gap-2">
                                    Content Grid
                                </h3>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                                    {rows.length} records
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 border-x px-2 mx-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => scrollTable('left')}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => scrollTable('right')}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        setEditingColumn(null);
                                        setNewColumnName("");
                                        setNewColumnType("text");
                                        setColumnDialogOpen(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Add Column
                                </Button>
                                <Button variant="default" size="sm" className="h-8" onClick={handleAddRow}>
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Add Row
                                </Button>
                            </div>
                        </div>

                        <div
                            ref={tableContainerRef}
                            className="flex-1 overflow-auto relative min-h-0 scrollbar-thin"
                        >
                            <table ref={tableRef} className="w-full caption-bottom text-sm border-collapse">
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                    <Reorder.Group
                                        as="tr"
                                        axis="x"
                                        values={columns}
                                        onReorder={handleReorderColumns}
                                        className="hover:bg-transparent border-b"
                                    >
                                        <TableHead className="w-12 text-center"></TableHead>
                                        {columns.map((col) => (
                                            <Reorder.Item
                                                key={col.id}
                                                value={col}
                                                as="th"
                                                className="min-w-[180px] p-0 group border-b text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap"
                                            >
                                                <div className="flex items-center justify-between px-4 py-2 hover:bg-muted/80 transition-colors cursor-grab active:cursor-grabbing">
                                                    <span className="font-bold text-foreground text-sm flex items-center gap-2">
                                                        <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                                        {col.name}
                                                    </span>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded">
                                                                <Settings2 className="h-3 w-3" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => {
                                                                setEditingColumn(col);
                                                                setNewColumnName(col.name);
                                                                setNewColumnType(col.data_type);
                                                                setColumnDialogOpen(true);
                                                            }}>
                                                                <Edit2 className="h-4 w-4 mr-2" />
                                                                Rename / Type
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => {
                                                                    setDeleteConfig({
                                                                        title: "Remove Column?",
                                                                        description: `Are you sure you want to remove the "${col.name}" column? Existing data for this field will be hidden.`,
                                                                        onConfirm: () => handleDeleteColumn(col.id)
                                                                    });
                                                                    setDeleteConfirmOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete Column
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </Reorder.Item>
                                        ))}
                                        <TableHead className="w-12"></TableHead>
                                    </Reorder.Group>
                                </TableHeader>
                                <Reorder.Group
                                    as="tbody"
                                    axis="y"
                                    values={rows}
                                    onReorder={handleReorderRows}
                                    className="divide-y"
                                >
                                    {rows.length > 0 ? (
                                        rows.map((row) => (
                                            <Reorder.Item
                                                key={row.id}
                                                value={row}
                                                as="tr"
                                                className="group border-b bg-card hover:bg-muted/30 transition-colors"
                                            >
                                                <TableCell className="w-12 text-center p-0">
                                                    <div className="flex items-center justify-center h-full cursor-grab active:cursor-grabbing p-3 text-muted-foreground/30 hover:text-primary transition-colors">
                                                        <GripVertical className="h-4 w-4" />
                                                    </div>
                                                </TableCell>
                                                {columns.map((col) => (
                                                    <TableCell key={`${row.id}-${col.id}`} className="p-0 border-r last:border-r-0 h-11">
                                                        {col.data_type === 'file' ? (
                                                            <FileCell rowId={row.id} colName={col.name} value={row.data[col.name] || ""} />
                                                        ) : col.data_type === 'evaluation' ? (
                                                            <EvaluationCell rowId={row.id} colName={col.name} value={row.data[col.name] || ""} rowData={row.data} />
                                                        ) : (
                                                            <input
                                                                type={col.data_type === 'number' ? 'number' : col.data_type === 'date' ? 'date' : 'text'}
                                                                className="w-full h-full px-4 py-3 bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-primary text-sm outline-none transition-all placeholder:text-muted-foreground/30"
                                                                placeholder={`Enter ${col.name.toLowerCase()}...`}
                                                                value={row.data[col.name] || ""}
                                                                onChange={(e) => handleUpdateCellValue(row.id, col.name, e.target.value)}
                                                            />
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="w-12 text-center p-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            setDeleteConfig({
                                                                title: "Delete Record?",
                                                                description: "Are you sure you want to permanently delete this trainer record?",
                                                                onConfirm: () => handleDeleteRow(row.id)
                                                            });
                                                            setDeleteConfirmOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </Reorder.Item>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + 2} className="h-32 text-center text-muted-foreground bg-muted/5">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <p>No records in this tab.</p>
                                                    {columns.length > 0 ? (
                                                        <Button variant="link" onClick={handleAddRow}>Add some trainers</Button>
                                                    ) : (
                                                        <p className="text-xs">Add a column first to start entry.</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Reorder.Group>
                            </table>
                        </div>
                    </div>
                </Tabs >
            )
            }

            {/* Tab Management Dialog */}
            <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingTab ? "Rename Tab" : "Create New Tab"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="tab-name">Tab Name</Label>
                            <Input
                                id="tab-name"
                                value={newTabName}
                                onChange={(e) => setNewTabName(e.target.value)}
                                placeholder="e.g., External Trainers, Specialized, etc."
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTab()}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTabDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddTab} disabled={isSaving}>
                            {isSaving ? "Saving..." : editingTab ? "Update" : "Create Tab"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Column Management Dialog */}
            <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingColumn ? "Edit Column" : "Add New Column"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="col-name">Column Name</Label>
                            <Input
                                id="col-name"
                                value={newColumnName}
                                onChange={(e) => setNewColumnName(e.target.value)}
                                placeholder="e.g., Phone Number, Email, Specialization"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="col-type">Data Type</Label>
                            <Select value={newColumnType} onValueChange={setNewColumnType}>
                                <SelectTrigger id="col-type">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="file">File (Attachment)</SelectItem>
                                    <SelectItem value="evaluation">Evaluation Form</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setColumnDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddColumn} disabled={isSaving}>
                            {isSaving ? "Saving..." : editingColumn ? "Update" : "Add Column"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{deleteConfig?.title || "Are you absolutely sure?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfig?.description}
                            <br /><br />
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteConfig?.onConfirm) deleteConfig.onConfirm();
                                setDeleteConfirmOpen(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
