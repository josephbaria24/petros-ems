"use client"

import * as React from "react"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ClipboardList,
    Plus,
    PlusCircle,
    X,
    Save,
    Link,
    BarChart3,
    Loader2,
    Trash2,
    Settings2,
    Edit2,
    Eye,
    Calendar,
} from "lucide-react"
import { format } from "date-fns"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend,
} from "recharts"

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#818cf8', '#a78bfa']

interface EvaluationDialogProps {
    id: string | null
    scheduleId?: string | null
    onIdCreated?: (newId: string) => void
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: "builder" | "results"
    initialTitle?: string
    multiIds?: string[] | null
    trainerOptions?: string[] // For delegation
}

export function EvaluationDialog({
    id,
    scheduleId,
    onIdCreated,
    open,
    onOpenChange,
    mode: initialMode,
    initialTitle = "New Evaluation",
    multiIds = null,
    trainerOptions = []
}: EvaluationDialogProps) {
    const [mode, setMode] = React.useState<"builder" | "results">(initialMode)
    const [evaluationId, setEvaluationId] = React.useState<string | null>(id)
    const [title, setTitle] = React.useState("")
    const [trainerName, setTrainerName] = React.useState<string | null>(null)
    const [questions, setQuestions] = React.useState<any[]>([])
    const [responses, setResponses] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(false)

    // Template States
    const [templates, setTemplates] = React.useState<any[]>([])
    const [loadingTemplates, setLoadingTemplates] = React.useState(false)
    const [isSaveTemplateOpen, setIsSaveTemplateOpen] = React.useState(false)
    const [templateName, setTemplateName] = React.useState("")

    // Results context
    const [isLoaded, setIsLoaded] = React.useState(false)
    const [contributingInfo, setContributingInfo] = React.useState<any[]>([])
    const [loadingInfo, setLoadingInfo] = React.useState(false)

    // Sync evaluationId with prop
    React.useEffect(() => {
        setEvaluationId(id)
    }, [id])

    // Sync mode with prop
    React.useEffect(() => {
        setMode(initialMode)
    }, [initialMode, open])

    const fetchEvaluation = async (evalId: string) => {
        setLoading(true)
        try {
            const { data: evalData, error: evalError } = await tmsDb
                .from("repo_evaluations")
                .select("*, questions:repo_eval_questions(*)")
                .eq("id", evalId)
                .single()

            if (evalError) throw evalError
            setTitle(evalData.title)
            setTrainerName(evalData.trainer_name)
            setQuestions(evalData.questions.sort((a: any, b: any) => a.sort_order - b.sort_order))
        } catch (error) {
            console.error("Failed to load evaluation:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchResponses = async (evalId: string) => {
        setLoading(true)
        try {
            // Ensure questions are loaded for rendering charts
            if (questions.length === 0) {
                await fetchEvaluation(evalId);
            }

            const { data, error } = await tmsDb
                .from("repo_eval_responses")
                .select("*")
                .in("evaluation_id", multiIds || [evalId])
            if (error) throw error
            setResponses(data)
        } catch (error) {
            console.error("Failed to load responses:", error)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (!open) return

        const runFetch = async () => {
            setIsLoaded(false)
            if (evaluationId) {
                if (mode === "builder") {
                    await fetchEvaluation(evaluationId)
                } else {
                    await fetchResponses(evaluationId)
                }
            } else if (mode === "results") {
                if (multiIds && multiIds.length > 0) {
                    await fetchEvaluation(multiIds[0])
                    await fetchResponses(multiIds[0])
                    await fetchContributingInfo(multiIds)
                } else if (evaluationId) {
                    await fetchEvaluation(evaluationId)
                    await fetchResponses(evaluationId)
                    if (scheduleId) await fetchContributingInfo([evaluationId])
                } else {
                    setTitle(initialTitle)
                    setTrainerName(null)
                    setQuestions([])
                    setResponses([])
                }
            }
            setIsLoaded(true)
        }
        runFetch()
    }, [open, evaluationId, mode, multiIds, initialTitle, scheduleId])

    const fetchContributingInfo = async (evalIds: string[]) => {
        setLoadingInfo(true)
        try {
            // Fetch evaluations to get their schedule_ids
            const { data: evals, error: evalError } = await tmsDb
                .from("repo_evaluations")
                .select("schedule_id")
                .in("id", evalIds)

            if (evalError) throw evalError
            const sIds = evals?.map(e => e.schedule_id).filter(Boolean) || []

            if (sIds.length === 0) {
                setContributingInfo([])
                return
            }

            // Fetch schedules and their courses
            const { data: schedules, error: sError } = await tmsDb
                .from("schedules")
                .select(`
                    id,
                    trainer_name,
                    schedule_type,
                    courses (name, course_code),
                    schedule_ranges (start_date, end_date),
                    schedule_dates (date)
                `)
                .in("id", sIds)

            if (sError) throw sError
            setContributingInfo(schedules || [])
        } catch (error) {
            console.error("Failed to fetch contributing info:", error)
        } finally {
            setLoadingInfo(false)
        }
    }

    const fetchTemplates = async () => {
        setLoadingTemplates(true)
        try {
            const { data, error } = await tmsDb
                .from("repo_evaluation_templates")
                .select("*")
                .order("name")
            if (error) throw error
            setTemplates(data || [])
        } catch (error) {
            console.error("Failed to load templates:", error)
        } finally {
            setLoadingTemplates(false)
        }
    }

    React.useEffect(() => {
        if (open && mode === "builder") {
            fetchTemplates()
        }
    }, [open, mode])

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            toast.error("Please enter a template name")
            return
        }
        setLoading(true)
        try {
            // 1. Create template
            const { data: template, error: tError } = await tmsDb
                .from("repo_evaluation_templates")
                .insert({ name: templateName })
                .select()
                .single()

            if (tError) throw tError

            // 2. Save questions
            if (questions.length > 0) {
                const { error: qError } = await tmsDb.from("repo_eval_template_questions").insert(
                    questions.map((q, i) => ({
                        template_id: template.id,
                        question_text: q.question_text,
                        question_type: q.question_type,
                        options: q.options,
                        sort_order: i,
                        is_required: q.is_required
                    }))
                )
                if (qError) throw qError
            }

            toast.success("Template saved successfully")
            setIsSaveTemplateOpen(false)
            setTemplateName("")
            fetchTemplates()
        } catch (error) {
            console.error(error)
            toast.error("Failed to save template")
        } finally {
            setLoading(false)
        }
    }

    const handleLoadTemplate = async (templateId: string) => {
        setLoading(true)
        try {
            const { data: templateQs, error } = await tmsDb
                .from("repo_eval_template_questions")
                .select("*")
                .eq("template_id", templateId)
                .order("sort_order")

            if (error) throw error

            const template = templates.find(t => t.id === templateId)
            if (template) setTitle(template.name)

            setQuestions(templateQs.map(q => ({
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
                is_required: q.is_required
            })))

            toast.success("Template loaded")
        } catch (error) {
            console.error(error)
            toast.error("Failed to load template")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveBuilder = async () => {
        setLoading(true)
        try {
            let currentId = evaluationId

            if (!currentId) {
                // Create new evaluation
                const { data, error } = await tmsDb
                    .from("repo_evaluations")
                    .insert({
                        title,
                        schedule_id: scheduleId,
                        trainer_name: trainerName
                    })
                    .select()
                    .single()

                if (error) throw error
                currentId = data.id as string
                setEvaluationId(currentId)
                if (onIdCreated) onIdCreated(currentId)
            } else if (currentId) {
                // Update title & trainer
                await tmsDb.from("repo_evaluations").update({ title, trainer_name: trainerName }).eq("id", currentId)
            }

            // Update questions (simplest way: delete all and re-insert for now)
            if (currentId) {
                await tmsDb.from("repo_eval_questions").delete().eq("evaluation_id", currentId)

                if (questions.length > 0) {
                    const { error } = await tmsDb.from("repo_eval_questions").insert(
                        questions.map((q, i) => ({
                            evaluation_id: currentId,
                            question_text: q.question_text,
                            question_type: q.question_type,
                            options: q.options,
                            sort_order: i,
                            is_required: q.is_required
                        }))
                    )
                    if (error) throw error
                }
            }

            toast.success("Evaluation saved")
            if (mode === "builder") {
                onOpenChange(false)
            }
        } catch (error) {
            toast.error("Failed to save evaluation")
            console.error(error)
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
        if (!evaluationId) return
        const url = `${window.location.origin}/evaluation/${evaluationId}`
        navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="lg:w-[70vw] md:w-[90vw] flex flex-col p-0 overflow-hidden max-h-[90vh]">
                {mode === "builder" ? (
                    <>
                        <DialogHeader className="p-6 pb-2">
                            <div className="flex items-center justify-between mr-8">
                                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                                    <ClipboardList className="h-5 w-5 text-primary" />
                                    Evaluation Builder
                                </DialogTitle>
                                {evaluationId && (
                                    <Button size="sm" variant="outline" onClick={copyLink} className="gap-2">
                                        <Link className="h-4 w-4" />
                                        Copy Public Link
                                    </Button>
                                )}
                            </div>
                            <DialogDescription>
                                Create your custom evaluation form. Changes are reflected immediately to the public link.
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

                            <div className="flex items-center justify-between pb-2">
                                <div className="flex-1 max-w-[200px]">
                                    <Select onValueChange={handleLoadTemplate}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Load from Template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {loadingTemplates ? (
                                                <SelectItem value="loading" disabled>Loading templates...</SelectItem>
                                            ) : templates.length === 0 ? (
                                                <SelectItem value="none" disabled>No templates found</SelectItem>
                                            ) : (
                                                templates.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsSaveTemplateOpen(true)}
                                    className="h-8 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save current as Template
                                </Button>
                            </div>

                            {scheduleId && trainerOptions.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold italic flex items-center gap-1.5">
                                        <Settings2 className="h-3 w-3" />
                                        Delegate to Trainer (Optional)
                                    </Label>
                                    <Select
                                        value={trainerName || "none"}
                                        onValueChange={(val) => setTrainerName(val === "none" ? null : val)}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="All Trainers" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Shared / All Trainers</SelectItem>
                                            {trainerOptions.map(t => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        If selected, responses will only be visible under this trainer's column in the repository.
                                    </p>
                                </div>
                            )}

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
                                        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground italic text-sm">
                                            No questions added yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-muted/20 border-t">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={handleSaveBuilder} disabled={loading} className="gap-2">
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Save className="h-4 w-4" /> Save Evaluation
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader className="p-6 pb-2">
                            <div className="flex items-center justify-between mr-8">
                                <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                                    <BarChart3 className="h-6 w-6 text-green-600" />
                                    Evaluation Results
                                </DialogTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setMode("builder")} className="gap-2">
                                        <ClipboardList className="h-4 w-4" />
                                        Edit Builder
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={copyLink} className="gap-2">
                                        <Link className="h-4 w-4" />
                                        Copy Link
                                    </Button>
                                </div>
                            </div>
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
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex flex-col items-center">
                                            <span className="text-xl font-bold text-primary">{responses.length}</span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Total Responses</span>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex flex-col items-center">
                                            <span className="text-xl font-bold text-green-700">
                                                {responses.length > 0 ? Math.round(responses.reduce((acc, r) => acc + Object.keys(r.answers).length, 0) / (responses.length * (questions.length || 1)) * 100) : 0}%
                                            </span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Completion Rate</span>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col items-center">
                                            <span className="text-xl font-bold text-blue-700">
                                                {responses.filter(r => new Date(r.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                                            </span>
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">New this week</span>
                                        </div>
                                    </div>

                                    {contributingInfo.length > 0 && (
                                        <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
                                            <div className="flex items-center gap-2 pb-1 border-b border-muted">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <h4 className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Source Data Detail</h4>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                {contributingInfo.map((s, i) => (
                                                    <div key={i} className="flex flex-col gap-0.5 border-l-2 border-primary/30 pl-2 py-0.5">
                                                        <span className="text-[11px] font-bold leading-tight">{s.courses?.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {s.schedule_type === 'staggered'
                                                                ? s.schedule_dates?.map((d: any) => format(new Date(d.date), "MMM d")).join(", ")
                                                                : s.schedule_ranges?.[0] ? `${format(new Date(s.schedule_ranges[0].start_date), "MMM d")} - ${format(new Date(s.schedule_ranges[0].end_date), "MMM d, yyyy")}` : "N/A"
                                                            }
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
                                                                <PieChart>
                                                                    <Pie
                                                                        data={chartData}
                                                                        cx="50%"
                                                                        cy="45%"
                                                                        innerRadius={35}
                                                                        outerRadius={55}
                                                                        paddingAngle={2}
                                                                        dataKey="value"
                                                                    >
                                                                        {chartData.map((_, index) => (
                                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                        ))}
                                                                    </Pie>
                                                                    <RechartsTooltip
                                                                        contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                                    />
                                                                    <Legend
                                                                        verticalAlign="bottom"
                                                                        iconSize={8}
                                                                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                                                                    />
                                                                </PieChart>
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

                        <DialogFooter className="p-6 border-t bg-muted/10">
                            <Button variant="secondary" onClick={() => onOpenChange(false)}>Close Analysis</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>

            {/* Save Template Dialog */}
            <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Save as Template</DialogTitle>
                        <DialogDescription>
                            Give this template a name to reuse it for future evaluations.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="templateName" className="text-right">Template Name</Label>
                        <Input
                            id="templateName"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g. Standard Trainer Feedback"
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveTemplateOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={loading}>
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    )
}

interface ScheduleEvaluationsDialogProps {
    scheduleId: string | null
    courseName?: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ScheduleEvaluationsDialog({
    scheduleId,
    courseName,
    open,
    onOpenChange
}: ScheduleEvaluationsDialogProps) {
    const [evaluations, setEvaluations] = React.useState<any[]>([])
    const [scheduleTrainers, setScheduleTrainers] = React.useState<string[]>([])
    const [loading, setLoading] = React.useState(false)
    const [selectedEval, setSelectedEval] = React.useState<{ id: string | null, mode: "builder" | "results" } | null>(null)
    const [isEvalDialogOpen, setIsEvalDialogOpen] = React.useState(false)

    const fetchEvaluations = async () => {
        if (!scheduleId) return
        setLoading(true)
        try {
            const { data: evalData, error: evalError } = await tmsDb
                .from("repo_evaluations")
                .select("*")
                .eq("schedule_id", scheduleId)
                .order("created_at", { ascending: false })

            if (evalError) throw evalError
            setEvaluations(evalData)

            // Also fetch schedule info to get assigned trainers
            const { data: schedule, error: sError } = await tmsDb
                .from("schedules")
                .select("trainer_name, day_trainers")
                .eq("id", scheduleId)
                .single()

            if (!sError && schedule) {
                const trainers = new Set<string>()
                if (schedule.trainer_name) trainers.add(schedule.trainer_name)
                if (schedule.day_trainers) {
                    Object.values(schedule.day_trainers as Record<string, string>).forEach(n => {
                        if (n) trainers.add(n)
                    })
                }
                setScheduleTrainers(Array.from(trainers).sort())
            }
        } catch (error) {
            console.error("Failed to load evaluations:", error)
            toast.error("Failed to load evaluations")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (open && scheduleId) {
            fetchEvaluations()
        }
    }, [open, scheduleId])

    const handleCreate = () => {
        setSelectedEval({ id: null, mode: "builder" })
        setIsEvalDialogOpen(true)
    }

    const handleEdit = (evalId: string) => {
        setSelectedEval({ id: evalId, mode: "builder" })
        setIsEvalDialogOpen(true)
    }

    const handleViewResults = (evalId: string) => {
        setSelectedEval({ id: evalId, mode: "results" })
        setIsEvalDialogOpen(true)
    }

    const handleDelete = async (evalId: string) => {
        if (!confirm("Are you sure you want to delete this evaluation and all its results?")) return
        try {
            const { error } = await tmsDb.from("repo_evaluations").delete().eq("id", evalId)
            if (error) throw error
            toast.success("Evaluation deleted")
            fetchEvaluations()
        } catch (error) {
            toast.error("Failed to delete evaluation")
            console.error(error)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary" />
                            Manage Evaluations
                        </DialogTitle>
                        <DialogDescription>
                            Create and manage multiple evaluation forms for <b>{courseName || "this schedule"}</b>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Linked Evaluations</h3>
                            <Button size="sm" onClick={handleCreate} className="gap-2">
                                <PlusCircle className="h-4 w-4" />
                                Create New Evaluation
                            </Button>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-xs text-muted-foreground">Loading evaluations...</p>
                            </div>
                        ) : evaluations.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/5">
                                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground font-medium">No evaluations created yet.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">You can have separate evaluations for the course and the trainer.</p>
                                <Button variant="outline" size="sm" onClick={handleCreate}>
                                    Get Started
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {evaluations.map((ev) => (
                                    <div key={ev.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                <ClipboardList className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">{ev.title}</h4>
                                                <p className="text-[10px] text-muted-foreground tracking-tight uppercase font-medium">
                                                    Created {new Date(ev.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleEdit(ev.id)}
                                                title="Edit Builder"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                onClick={() => handleViewResults(ev.id)}
                                                title="View Results"
                                            >
                                                <BarChart3 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(ev.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EvaluationDialog
                id={selectedEval?.id || null}
                scheduleId={scheduleId}
                open={isEvalDialogOpen}
                onOpenChange={setIsEvalDialogOpen}
                mode={selectedEval?.mode || "builder"}
                trainerOptions={scheduleTrainers}
                onIdCreated={(newId) => {
                    fetchEvaluations()
                    setSelectedEval(prev => prev ? { ...prev, id: newId } : null)
                }}
            />
        </>
    )
}
