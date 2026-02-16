"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Search,
    Plus,
    Pencil,
    Trash2,
    RefreshCcw,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    Clock,
    Filter,
} from "lucide-react"
import { tmsDb } from "@/lib/supabase-client"
import { createClient } from "@/lib/supabase-client"
import { toast } from "sonner"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

type CertificateRecord = {
    id: string
    training: string | null
    serial_number: string
    last_name: string | null
    first_name: string | null
    middle_name: string | null
    suffix: string | null
    sex: string | null
    age: number | null
    company: string | null
    email_address: string | null
    contact_number: string | null
    training_venue: string | null
    training_date: string | null
    start_date: string | null
    end_date: string | null
    source: string | null
    created_at: string
}

type LogEntry = {
    id: string
    action: string
    details: string | null
    serial_number: string | null
    performed_by: string | null
    created_at: string
}

const ITEMS_PER_PAGE = 15

export default function AdminCertificateVerifierPage() {
    const [records, setRecords] = useState<CertificateRecord[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isSyncing, setIsSyncing] = useState(false)
    const [trainingFilter, setTrainingFilter] = useState("all")
    const [sourceFilter, setSourceFilter] = useState("all")
    const [trainingCategories, setTrainingCategories] = useState<string[]>([])
    const [duplicateSerials, setDuplicateSerials] = useState<Set<string>>(new Set())

    // Logs
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [showLogsDialog, setShowLogsDialog] = useState(false)

    // Dialog states
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<CertificateRecord | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
    const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("")

    // Current user
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        training: "",
        serial_number: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        suffix: "",
        sex: "",
        age: "",
        company: "",
        email_address: "",
        contact_number: "",
        training_venue: "",
        training_date: "",
        start_date: "",
        end_date: "",
    })

    // Get current user on mount
    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getSession().then(({ data: { session } }) => {
            setCurrentUserEmail(session?.user?.email || null)
        })
    }, [])

    // Fetch distinct training categories
    useEffect(() => {
        const fetchCategories = async () => {
            const { data } = await tmsDb
                .from("certificate_records")
                .select("training")
                .not("training", "is", null)
                .not("training", "eq", "")

            if (data) {
                const unique = [...new Set(data.map((r: any) => r.training as string).filter(Boolean))]
                unique.sort()
                setTrainingCategories(unique)
            }
        }
        fetchCategories()
    }, [])

    // Log activity helper
    const logActivity = async (action: string, details: string, serial_number?: string) => {
        await tmsDb.from("certificate_logs").insert({
            action,
            details,
            serial_number: serial_number || null,
            performed_by: currentUserEmail,
        })
    }

    const fetchRecords = useCallback(async () => {
        setIsLoading(true)
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        let query = tmsDb
            .from("certificate_records")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to)

        if (searchQuery.trim()) {
            const q = searchQuery.trim()
            query = query.or(`serial_number.ilike.%${q}%,last_name.ilike.%${q}%,first_name.ilike.%${q}%,training.ilike.%${q}%`)
        }

        if (trainingFilter && trainingFilter !== "all") {
            query = query.eq("training", trainingFilter)
        }

        if (sourceFilter && sourceFilter !== "all") {
            if (sourceFilter === "import") {
                query = query.or("source.is.null,source.eq.import")
            } else if (sourceFilter === "duplicates") {
                const dupes = Array.from(duplicateSerials)
                if (dupes.length > 0) {
                    query = query.in("serial_number", dupes)
                } else {
                    // No duplicates, return empty
                    setRecords([])
                    setTotalCount(0)
                    setIsLoading(false)
                    return
                }
            } else {
                query = query.eq("source", sourceFilter)
            }
        }

        const { data, error, count } = await query

        if (error) {
            toast.error("Failed to load records: " + error.message)
        } else {
            setRecords(data || [])
            setTotalCount(count || 0)
        }
        setIsLoading(false)
    }, [currentPage, searchQuery, trainingFilter, sourceFilter])

    // Fetch duplicate serial numbers
    const fetchDuplicates = useCallback(async () => {
        const { data } = await tmsDb.rpc("get_duplicate_serials").select("*")
        if (data) {
            setDuplicateSerials(new Set(data.map((r: any) => r.serial_number)))
        }
    }, [])

    useEffect(() => {
        fetchDuplicates()
    }, [fetchDuplicates])

    useEffect(() => {
        fetchRecords()
    }, [fetchRecords])

    const fetchLogs = async () => {
        const { data } = await tmsDb
            .from("certificate_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50)

        if (data) setLogs(data)
    }

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    const resetForm = () => {
        setFormData({
            training: "",
            serial_number: "",
            last_name: "",
            first_name: "",
            middle_name: "",
            suffix: "",
            sex: "",
            age: "",
            company: "",
            email_address: "",
            contact_number: "",
            training_venue: "",
            training_date: "",
            start_date: "",
            end_date: "",
        })
    }

    const handleAdd = () => {
        resetForm()
        setShowAddDialog(true)
    }

    const handleEdit = (record: CertificateRecord) => {
        setSelectedRecord(record)
        setFormData({
            training: record.training || "",
            serial_number: record.serial_number,
            last_name: record.last_name || "",
            first_name: record.first_name || "",
            middle_name: record.middle_name || "",
            suffix: record.suffix || "",
            sex: record.sex || "",
            age: record.age?.toString() || "",
            company: record.company || "",
            email_address: record.email_address || "",
            contact_number: record.contact_number || "",
            training_venue: record.training_venue || "",
            training_date: record.training_date || "",
            start_date: record.start_date || "",
            end_date: record.end_date || "",
        })
        setShowEditDialog(true)
    }

    const handleDelete = (record: CertificateRecord) => {
        setSelectedRecord(record)
        setShowDeleteDialog(true)
    }

    const handleShowLogs = async () => {
        await fetchLogs()
        setShowLogsDialog(true)
    }

    const saveRecord = async (isEdit: boolean) => {
        if (!formData.serial_number.trim()) {
            toast.error("Serial number is required")
            return
        }

        setIsSaving(true)
        const payload: any = {
            ...formData,
            age: formData.age ? parseInt(formData.age) : null,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            source: "manual",
        }

        if (isEdit && selectedRecord) {
            const { error } = await tmsDb
                .from("certificate_records")
                .update(payload)
                .eq("id", selectedRecord.id)

            if (error) {
                toast.error("Failed to update: " + error.message)
            } else {
                toast.success("Record updated successfully")
                await logActivity("EDIT", `Updated certificate ${formData.serial_number}`, formData.serial_number)
                setShowEditDialog(false)
                fetchRecords()
            }
        } else {
            const { error } = await tmsDb
                .from("certificate_records")
                .insert(payload)

            if (error) {
                toast.error("Failed to add: " + error.message)
            } else {
                toast.success("Record added successfully")
                await logActivity("ADD", `Added certificate ${formData.serial_number}`, formData.serial_number)
                setShowAddDialog(false)
                fetchRecords()
            }
        }
        setIsSaving(false)
    }

    const confirmDelete = async () => {
        if (!selectedRecord) return
        setIsSaving(true)

        const { error } = await tmsDb
            .from("certificate_records")
            .delete()
            .eq("id", selectedRecord.id)

        if (error) {
            toast.error("Failed to delete: " + error.message)
        } else {
            toast.success("Record deleted successfully")
            await logActivity("DELETE", `Deleted certificate ${selectedRecord.serial_number}`, selectedRecord.serial_number)
            setShowDeleteDialog(false)
            fetchRecords()
        }
        setIsSaving(false)
    }

    const handleSyncTrainings = async () => {
        setIsSyncing(true)
        try {
            const { data: trainings, error } = await tmsDb
                .from("trainings")
                .select("*, courses(name)")
                .not("certificate_number", "is", null)

            if (error) throw error

            if (!trainings || trainings.length === 0) {
                toast.info("No trainings with certificate numbers found to sync")
                setIsSyncing(false)
                return
            }

            let synced = 0
            for (const training of trainings) {
                const { data: existing } = await tmsDb
                    .from("certificate_records")
                    .select("id")
                    .eq("serial_number", training.certificate_number)
                    .limit(1)

                if (!existing || existing.length === 0) {
                    const { error: insertError } = await tmsDb
                        .from("certificate_records")
                        .insert({
                            training: (training.courses as any)?.name || "",
                            serial_number: training.certificate_number,
                            last_name: training.last_name,
                            first_name: training.first_name,
                            middle_name: training.middle_initial,
                            suffix: training.suffix,
                            sex: training.gender,
                            age: training.age,
                            company: training.company_name,
                            email_address: training.email,
                            contact_number: training.phone_number,
                            source: "synced",
                        })

                    if (!insertError) synced++
                }
            }

            await logActivity("SYNC", `Synced ${synced} new training records from trainings table`)
            toast.success(`Synced ${synced} new training records`)
            fetchRecords()
        } catch (err: any) {
            toast.error("Sync failed: " + err.message)
        }
        setIsSyncing(false)
    }

    // Form dialog content (reused for add/edit)
    const renderFormContent = () => (
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto py-2">
            <div className="col-span-2">
                <Label>Serial Number *</Label>
                <Input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} placeholder="PSI-BOSH-BTS-17-001" />
            </div>
            <div className="col-span-2">
                <Label>Training / Course</Label>
                <Input value={formData.training} onChange={(e) => setFormData({ ...formData, training: e.target.value })} placeholder="BOSH SO2" />
            </div>
            <div>
                <Label>First Name</Label>
                <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
            </div>
            <div>
                <Label>Last Name</Label>
                <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
            </div>
            <div>
                <Label>Middle Name</Label>
                <Input value={formData.middle_name} onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })} />
            </div>
            <div>
                <Label>Suffix</Label>
                <Input value={formData.suffix} onChange={(e) => setFormData({ ...formData, suffix: e.target.value })} placeholder="Jr., Sr., III" />
            </div>
            <div>
                <Label>Sex</Label>
                <Input value={formData.sex} onChange={(e) => setFormData({ ...formData, sex: e.target.value })} placeholder="Male / Female" />
            </div>
            <div>
                <Label>Age</Label>
                <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
            </div>
            <div className="col-span-2">
                <Label>Company</Label>
                <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
            </div>
            <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email_address} onChange={(e) => setFormData({ ...formData, email_address: e.target.value })} />
            </div>
            <div>
                <Label>Contact Number</Label>
                <Input value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} />
            </div>
            <div className="col-span-2">
                <Label>Training Venue</Label>
                <Input value={formData.training_venue} onChange={(e) => setFormData({ ...formData, training_venue: e.target.value })} />
            </div>
            <div className="col-span-2">
                <Label>Training Date (text)</Label>
                <Input value={formData.training_date} onChange={(e) => setFormData({ ...formData, training_date: e.target.value })} placeholder="July 25-28, 2017" />
            </div>
            <div>
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
            </div>
            <div>
                <Label>End Date</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Certificate Verifier</h1>
                    <p className="text-muted-foreground text-sm">Manage and verify certificate records</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleShowLogs}>
                        <Clock className="w-4 h-4 mr-2" />
                        Logs
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSyncTrainings} disabled={isSyncing}>
                        <RefreshCcw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Syncing..." : "Sync Trainings"}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/guest-certificate-verifier" target="_blank">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Guest Page
                        </Link>
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Record
                    </Button>
                </div>
            </div>

            {/* Main layout: side-by-side */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
                {/* Left: Records Table */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-base">Certificate Records</CardTitle>
                                <CardDescription className="text-xs">
                                    {totalCount} total records
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Source Filter */}
                                <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPage(1) }}>
                                    <SelectTrigger className="w-[150px] h-9">
                                        <SelectValue placeholder="Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sources</SelectItem>
                                        <SelectItem value="import">Import</SelectItem>
                                        <SelectItem value="synced">Synced</SelectItem>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="duplicates">Duplicates</SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Training Category Filter */}
                                <Select value={trainingFilter} onValueChange={(v) => { setTrainingFilter(v); setCurrentPage(1) }}>
                                    <SelectTrigger className="w-[200px] h-9">
                                        <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                        <SelectValue placeholder="Filter by training" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Trainings</SelectItem>
                                        {trainingCategories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, serial, or training..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value)
                                            setCurrentPage(1)
                                        }}
                                        className="pl-9 w-[300px] h-9"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Bulk action bar */}
                        {selectedIds.size > 0 && (
                            <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b">
                                <span className="text-sm font-medium">{selectedIds.size} record{selectedIds.size > 1 ? "s" : ""} selected</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                                    <Button variant="destructive" size="sm" onClick={() => { setBulkDeleteConfirmText(""); setShowBulkDeleteDialog(true) }}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Selected
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 dark:border-gray-600 accent-primary h-4 w-4 cursor-pointer"
                                                checked={records.length > 0 && records.every(r => selectedIds.has(r.id))}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds(new Set(records.map(r => r.id)))
                                                    } else {
                                                        setSelectedIds(new Set())
                                                    }
                                                }}
                                            />
                                        </TableHead>
                                        <TableHead className="w-[180px]">Serial Number</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Training</TableHead>
                                        <TableHead>Venue</TableHead>
                                        <TableHead>Training Date</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                    Loading...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : records.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                                No certificate records found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        records.map((record) => {
                                            const fullName = `${record.first_name ?? ""} ${record.middle_name ?? ""} ${record.last_name ?? ""}`.replace(/\s+/g, " ").trim()
                                            return (
                                                <TableRow key={record.id} className={selectedIds.has(record.id) ? "bg-muted/50" : ""}>
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 dark:border-gray-600 accent-primary h-4 w-4 cursor-pointer"
                                                            checked={selectedIds.has(record.id)}
                                                            onChange={(e) => {
                                                                const next = new Set(selectedIds)
                                                                if (e.target.checked) {
                                                                    next.add(record.id)
                                                                } else {
                                                                    next.delete(record.id)
                                                                }
                                                                setSelectedIds(next)
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{record.serial_number}</TableCell>
                                                    <TableCell className="font-medium">{fullName || "—"}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-xs font-normal">
                                                            {record.training || "—"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{record.training_venue || "—"}</TableCell>
                                                    <TableCell className="text-sm">{record.training_date || "—"}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {record.source === "synced" ? (
                                                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                                                    Synced
                                                                </Badge>
                                                            ) : record.source === "manual" ? (
                                                                <Badge variant="outline" className="text-xs">Manual</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs text-muted-foreground">Import</Badge>
                                                            )}
                                                            {duplicateSerials.has(record.serial_number) && (
                                                                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                                                    Duplicate
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(record)}>
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(record)}>
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right: Live Verifier Preview */}
                <Card className="h-fit sticky top-6">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            <div>
                                <CardTitle className="text-base">Live Verifier</CardTitle>
                                <CardDescription className="text-xs">Test certificate verification</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <LiveVerifier />
                    </CardContent>
                </Card>
            </div>

            {/* Add Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="lg:w-[60vw] w-[90vw]">
                    <DialogHeader>
                        <DialogTitle>Add Certificate Record</DialogTitle>
                        <DialogDescription>Create a new certificate record manually.</DialogDescription>
                    </DialogHeader>
                    {renderFormContent()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                        <Button onClick={() => saveRecord(false)} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Add Record"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="lg:w-[60vw] w-[90vw]">
                    <DialogHeader>
                        <DialogTitle>Edit Certificate Record</DialogTitle>
                        <DialogDescription>Update the certificate record details.</DialogDescription>
                    </DialogHeader>
                    {renderFormContent()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                        <Button onClick={() => saveRecord(true)} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Certificate Record</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the record for{" "}
                            <strong>{selectedRecord?.serial_number}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
                            {isSaving ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Delete Confirmation */}
            <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {selectedIds.size} Record{selectedIds.size > 1 ? "s" : ""}</DialogTitle>
                        <DialogDescription>
                            This will permanently delete <strong>{selectedIds.size}</strong> selected certificate record{selectedIds.size > 1 ? "s" : ""}. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Type <strong className="text-destructive">Delete entries</strong> to confirm</Label>
                        <Input
                            value={bulkDeleteConfirmText}
                            onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                            placeholder="Delete entries"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={bulkDeleteConfirmText !== "Delete entries" || isSaving}
                            onClick={async () => {
                                setIsSaving(true)
                                const ids = Array.from(selectedIds)
                                const { error } = await tmsDb
                                    .from("certificate_records")
                                    .delete()
                                    .in("id", ids)

                                if (error) {
                                    toast.error("Bulk delete failed: " + error.message)
                                } else {
                                    toast.success(`Deleted ${ids.length} record${ids.length > 1 ? "s" : ""}`)
                                    await logActivity("BULK_DELETE", `Deleted ${ids.length} certificate records`)
                                    setSelectedIds(new Set())
                                    setShowBulkDeleteDialog(false)
                                    fetchRecords()
                                }
                                setIsSaving(false)
                            }}
                        >
                            {isSaving ? "Deleting..." : `Delete ${selectedIds.size} Record${selectedIds.size > 1 ? "s" : ""}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Activity Logs Dialog */}
            <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
                <DialogContent className="lg:w-[60vw] w-[90vw]">
                    <DialogHeader>
                        <DialogTitle>Activity Logs</DialogTitle>
                        <DialogDescription>Recent actions performed on certificate records</DialogDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto max-h-[60vh] space-y-3">
                        {logs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No activity logs yet
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                                    <div className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${log.action === "ADD" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                        log.action === "EDIT" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                            log.action === "DELETE" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                                log.action === "SYNC" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                                                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                        }`}>
                                        {log.action === "ADD" && <Plus className="w-4 h-4" />}
                                        {log.action === "EDIT" && <Pencil className="w-4 h-4" />}
                                        {log.action === "DELETE" && <Trash2 className="w-4 h-4" />}
                                        {log.action === "SYNC" && <RefreshCcw className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{log.action}</Badge>
                                            {log.serial_number && (
                                                <span className="text-xs font-mono text-muted-foreground">{log.serial_number}</span>
                                            )}
                                        </div>
                                        <p className="text-sm mt-1">{log.details}</p>
                                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                                            <span>{log.performed_by || "Unknown"}</span>
                                            <span>•</span>
                                            <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// Embedded mini verifier for admin preview
function LiveVerifier() {
    const [certificateId, setCertificateId] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [result, setResult] = useState<{
        status: "valid" | "not-found"
        serial_number?: string
        name?: string
        training?: string
        venue?: string
        date?: string
    } | null>(null)

    const handleVerify = async () => {
        const trimmed = certificateId.trim().toUpperCase()
        if (!trimmed) return

        setIsVerifying(true)

        const { data: records, error } = await tmsDb
            .from("certificate_records")
            .select("*")
            .or(`serial_number.eq."${trimmed}",last_name.ilike."${trimmed}"`)
            .limit(1)

        const data = records?.[0]

        if (error || !data) {
            setResult({ status: "not-found" })
        } else {
            const fullName = `${data.first_name ?? ""} ${data.middle_name ?? ""} ${data.last_name ?? ""}`.replace(/\s+/g, " ").trim()
            setResult({
                status: "valid",
                serial_number: data.serial_number,
                name: fullName,
                training: data.training,
                venue: data.training_venue,
                date: data.training_date,
            })
        }

        setIsVerifying(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Serial number or last name"
                    value={certificateId}
                    onChange={(e) => setCertificateId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    className="h-9"
                    disabled={isVerifying}
                />
                <Button size="sm" onClick={handleVerify} disabled={!certificateId.trim() || isVerifying} className="h-9">
                    {isVerifying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
            </div>

            {result && (
                <div className="rounded-lg border p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {result.status === "valid" ? (
                        <>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">VERIFIED</Badge>
                            </div>
                            <div className="space-y-1.5 text-sm">
                                <p><span className="text-muted-foreground">Serial:</span> <span className="font-mono">{result.serial_number}</span></p>
                                <p><span className="text-muted-foreground">Name:</span> {result.name}</p>
                                <p><span className="text-muted-foreground">Training:</span> {result.training}</p>
                                {result.venue && <p><span className="text-muted-foreground">Venue:</span> {result.venue}</p>}
                                {result.date && <p><span className="text-muted-foreground">Date:</span> {result.date}</p>}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-2">
                            <Badge variant="destructive">NOT FOUND</Badge>
                            <p className="text-sm text-muted-foreground mt-2">No certificate found</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
