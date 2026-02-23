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
        if (!confirm("Are you sure you want to delete this tab and all its data?")) return
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
        if (!confirm("Delete this column? Existing data for this field will be hidden.")) return
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

    const EvaluationCell = ({ rowId, colName, value }: { rowId: string, colName: string, value: string }) => {
        const [isBuilderOpen, setIsBuilderOpen] = React.useState(false)
        const [isResultsOpen, setIsResultsOpen] = React.useState(false)
        const [evaluationId, setEvaluationId] = React.useState(value)
        const [title, setTitle] = React.useState("")
        const [questions, setQuestions] = React.useState<any[]>([])
        const [responses, setResponses] = React.useState<any[]>([])
        const [loading, setLoading] = React.useState(false)

        const fetchEvaluation = async (id: string) => {
            setLoading(true)
            try {
                const { data: evalData, error: evalError } = await tmsDb
                    .from("repo_evaluations")
                    .select("*, questions:repo_eval_questions(*)")
                    .eq("id", id)
                    .single()

                if (evalError) throw evalError
                setTitle(evalData.title)
                setQuestions(evalData.questions.sort((a: any, b: any) => a.sort_order - b.sort_order))
            } catch (error) {
                toast.error("Failed to load evaluation")
            } finally {
                setLoading(false)
            }
        }

        const fetchResponses = async (id: string) => {
            setLoading(true)
            try {
                // Ensure questions are loaded for rendering charts
                if (questions.length === 0) {
                    await fetchEvaluation(id);
                }

                const { data, error } = await tmsDb
                    .from("repo_eval_responses")
                    .select("*")
                    .eq("evaluation_id", id)
                if (error) throw error
                setResponses(data)
            } catch (error) {
                toast.error("Failed to load responses")
            } finally {
                setLoading(false)
            }
        }

        const handleCreateEvaluation = async () => {
            setLoading(true)
            try {
                const { data, error } = await tmsDb
                    .from("repo_evaluations")
                    .insert({ title: "New Evaluation" })
                    .select()
                    .single()

                if (error) throw error
                await handleUpdateCellValue(rowId, colName, data.id)
                setEvaluationId(data.id)
                setTitle("New Evaluation")
                setQuestions([])
                setIsBuilderOpen(true)
            } catch (error) {
                toast.error("Failed to create evaluation")
            } finally {
                setLoading(false)
            }
        }

        const handleSaveBuilder = async () => {
            setLoading(true)
            try {
                // Update title
                await tmsDb.from("repo_evaluations").update({ title }).eq("id", evaluationId)

                // Update questions (simplest way: delete all and re-insert for now, or sophisticated upsert)
                await tmsDb.from("repo_eval_questions").delete().eq("evaluation_id", evaluationId)

                if (questions.length > 0) {
                    const { error } = await tmsDb.from("repo_eval_questions").insert(
                        questions.map((q, i) => ({
                            evaluation_id: evaluationId,
                            question_text: q.question_text,
                            question_type: q.question_type,
                            options: q.options,
                            sort_order: i,
                            is_required: q.is_required
                        }))
                    )
                    if (error) throw error
                }

                toast.success("Evaluation saved")
                setIsBuilderOpen(false)
            } catch (error) {
                toast.error("Failed to save evaluation")
            } finally {
                setLoading(false)
            }
        }

        const addQuestion = () => {
            setQuestions([...questions, {
                question_text: "New Question",
                question_type: "text",
                options: [],
                is_required: true
            }])
        }

        const copyLink = () => {
            const url = `${window.location.origin}/evaluation/${evaluationId}`
            navigator.clipboard.writeText(url)
            toast.success("Link copied to clipboard")
        }

        if (!evaluationId) {
            return (
                <div className="flex items-center justify-center h-full">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7 gap-1.5 opacity-40 hover:opacity-100"
                        onClick={handleCreateEvaluation}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
                        Create Eval
                    </Button>
                </div>
            )
        }

        return (
            <>
                <div className="flex items-center gap-1 h-full px-2 group/eval justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                        onClick={() => { fetchEvaluation(evaluationId); setIsBuilderOpen(true); }}
                        title="Edit Evaluation / Share Link"
                    >
                        <ClipboardList className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:bg-green-50"
                        onClick={() => { fetchResponses(evaluationId); setIsResultsOpen(true); }}
                        title="View Results"
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* Builder Dialog */}
                <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
                    <DialogContent className="lg:w-[70vw] md:w-[90vw] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2">
                            <div className="flex items-center justify-between mr-8">
                                <DialogTitle className="flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-primary" />
                                    Evaluation Builder
                                </DialogTitle>
                                <Button size="sm" variant="outline" onClick={copyLink} className="gap-2">
                                    <Link className="h-4 w-4" />
                                    Copy Public Link
                                </Button>
                            </div>
                            <DialogDescription>
                                Create your custom evaluation form for this trainer.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Evaluation Title</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Trainer Performance Review"
                                    className="text-lg font-medium"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Questions</Label>
                                    <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={addQuestion}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Question
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {questions.map((q, idx) => (
                                        <div key={idx} className="p-4 border rounded-lg bg-muted/5 space-y-3 group/q relative">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/q:opacity-100 text-destructive hover:bg-destructive/10"
                                                onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>

                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-8 space-y-1.5">
                                                    <Input
                                                        value={q.question_text}
                                                        onChange={(e) => {
                                                            const newQs = [...questions]
                                                            newQs[idx].question_text = e.target.value
                                                            setQuestions(newQs)
                                                        }}
                                                        placeholder="Enter question text..."
                                                        className="font-medium"
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <Select
                                                        value={q.question_type}
                                                        onValueChange={(val) => {
                                                            const newQs = [...questions]
                                                            newQs[idx].question_type = val
                                                            setQuestions(newQs)
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="text">Text Input</SelectItem>
                                                            <SelectItem value="radio">Multiple Choice (Radio)</SelectItem>
                                                            <SelectItem value="rating">Scale (1-5)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {q.question_type === 'radio' && (
                                                <div className="pl-4 border-l-2 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Options</Label>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(q.options || []).map((opt: string, optIdx: number) => (
                                                            <div key={optIdx} className="flex items-center bg-muted px-2 py-1 rounded gap-1 text-xs">
                                                                <span>{opt}</span>
                                                                <button
                                                                    className="hover:text-destructive"
                                                                    onClick={() => {
                                                                        const newQs = [...questions]
                                                                        newQs[idx].options = newQs[idx].options.filter((_: any, i: number) => i !== optIdx)
                                                                        setQuestions(newQs)
                                                                    }}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <Input
                                                            className="w-24 h-6 text-xs"
                                                            placeholder="Add opt..."
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    const val = (e.target as HTMLInputElement).value
                                                                    if (!val) return
                                                                    const newQs = [...questions]
                                                                    newQs[idx].options = [...(newQs[idx].options || []), val]
                                                                    setQuestions(newQs)
                                                                        ; (e.target as HTMLInputElement).value = ""
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {questions.length === 0 && (
                                        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground italic">
                                            No questions added yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-muted/20 border-t">
                            <Button variant="outline" onClick={() => setIsBuilderOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveBuilder} disabled={loading} className="gap-2">
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Save className="h-4 w-4" /> Save Evaluation
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Results Dialog */}
                <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
                    <DialogContent className="lg:w-[70vw] lg:h-[80vh]  flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2">
                            <DialogTitle className="flex items-center gap-2 text-2xl">
                                <BarChart3 className="h-6 w-6 text-green-600" />
                                Evaluation Results
                            </DialogTitle>
                            <DialogDescription>
                                Analysis of responses for "{title}"
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {responses.length === 0 ? (
                                <div className="text-center py-20 bg-muted/5 border-2 border-dashed rounded-xl">
                                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ClipboardList className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-muted-foreground font-medium">No responses yet.</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Share the link with respondents to start collecting data.</p>
                                    <Button variant="outline" size="sm" onClick={copyLink} className="mt-4">Copy Share Link</Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex flex-col items-center">
                                            <span className="text-xl font-bold text-primary">{responses.length}</span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Total Responses</span>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex flex-col items-center">
                                            <span className="text-xl font-bold text-green-700">
                                                {Math.round(responses.reduce((acc, r) => acc + Object.keys(r.answers).length, 0) / (responses.length * (questions.length || 1)) * 100)}%
                                            </span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Completion Rate</span>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col items-center">
                                            <span className="text-xl font-bold text-blue-700">
                                                {Math.round((responses.filter(r => new Date(r.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length))}
                                            </span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">New this week</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {questions.map((q, idx) => {
                                            if (q.question_type === 'rating' || q.question_type === 'radio') {
                                                const dataMap: Record<string, number> = {}
                                                responses.forEach(r => {
                                                    const ans = r.answers[q.id]
                                                    if (ans) dataMap[ans] = (dataMap[ans] || 0) + 1
                                                })

                                                const chartData = Object.entries(dataMap).map(([name, value]) => ({ name, value }))

                                                return (
                                                    <div key={idx} className="space-y-3 p-4 border rounded-lg bg-card shadow-sm">
                                                        <h4 className="font-bold text-xs text-foreground truncate" title={q.question_text}>
                                                            {idx + 1}. {q.question_text}
                                                        </h4>
                                                        <div className="h-40 w-full">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                                                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                                                    <RechartsTooltip
                                                                        cursor={{ fill: 'transparent' }}
                                                                        contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                                    />
                                                                    <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={30}>
                                                                        {chartData.map((_, index) => (
                                                                            <Cell key={`cell-${index}`} fill="#60a5fa" />
                                                                        ))}
                                                                    </Bar>
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            if (q.question_type === 'text') {
                                                return (
                                                    <div key={idx} className="space-y-3 p-4 border rounded-lg bg-card shadow-sm">
                                                        <h4 className="font-bold text-xs text-foreground truncate" title={q.question_text}>
                                                            {idx + 1}. {q.question_text}
                                                        </h4>
                                                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                            {responses.map((r, rIdx) => (
                                                                r.answers[q.id] && (
                                                                    <div key={rIdx} className="p-2 bg-muted/30 rounded border text-[10px] italic text-muted-foreground leading-tight">
                                                                        "{r.answers[q.id]}"
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-6 border-t">
                            <Button variant="secondary" onClick={() => setIsResultsOpen(false)}>Close Analysis</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
                        onClick={() => handleUpdateCellValue(rowId, colName, "")}
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
                                                onClick={() => handleDeleteTab(tab.id)}
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
                                                                onClick={() => handleDeleteColumn(col.id)}
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
                                                            <EvaluationCell rowId={row.id} colName={col.name} value={row.data[col.name] || ""} />
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
                                                        onClick={() => handleDeleteRow(row.id)}
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
        </div >
    )
}
