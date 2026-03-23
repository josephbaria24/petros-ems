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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
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
    GripVertical,
    UserCircle,
    BookOpen,
    Star,
    MessageSquare,
    CircleDot,
    Type,
    Hash,
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
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    LineChart,
    Line,
} from "recharts"

const COLORS = ['#141454', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

type ChartType = 'bar' | 'doughnut' | 'radar' | 'line'
const CHART_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
    { value: 'bar', label: 'Bar', icon: '📊' },
    { value: 'doughnut', label: 'Doughnut', icon: '🍩' },
    { value: 'radar', label: 'Radar', icon: '🕸️' },
    { value: 'line', label: 'Line', icon: '📈' },
]

// Question type icon helper
function QuestionTypeIcon({ type, className }: { type: string; className?: string }) {
    switch (type) {
        case 'text': return <Type className={className} />
        case 'radio': return <CircleDot className={className} />
        case 'rating': return <Star className={className} />
        default: return <MessageSquare className={className} />
    }
}

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
    const [focusedQuestion, setFocusedQuestion] = React.useState<number | null>(null)
    const [chartTypeMap, setChartTypeMap] = React.useState<Record<string, ChartType>>({})

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
            const { data: template, error: tError } = await tmsDb
                .from("repo_evaluation_templates")
                .insert({ name: templateName })
                .select()
                .single()

            if (tError) throw tError

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
                await tmsDb.from("repo_evaluations").update({ title, trainer_name: trainerName }).eq("id", currentId)
            }

            if (currentId) {
                // Get IDs of questions to keep
                const questionsWithId = questions.filter(q => q.id)
                const questionIdsToKeep = questionsWithId.map(q => q.id)

                // Delete questions that are no longer in the list
                if (questionIdsToKeep.length > 0) {
                    await tmsDb.from("repo_eval_questions")
                        .delete()
                        .eq("evaluation_id", currentId)
                        .not("id", "in", `(${questionIdsToKeep.join(',')})`)
                } else {
                    await tmsDb.from("repo_eval_questions").delete().eq("evaluation_id", currentId)
                }

                if (questions.length > 0) {
                    const { error } = await tmsDb.from("repo_eval_questions").upsert(
                        questions.map((q, i) => ({
                            id: q.id || undefined,
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
            question_text: "",
            question_type: "text",
            options: [],
            is_required: true
        }])
        setFocusedQuestion(questions.length)
    }

    const copyLink = () => {
        if (!evaluationId) return
        const url = `${window.location.origin}/evaluation/${evaluationId}`
        navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard")
    }

    // ========== BUILDER MODE (MS Forms-like) ==========
    const renderBuilder = () => (
        <>
            {/* Accent bar using primary color */}
            <div className="relative">
                <div className="h-2 w-full bg-primary" />
                <DialogHeader className="p-6 pb-3">
                    <div className="flex items-center justify-between mr-8">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground">
                                <ClipboardList className="h-4.5 w-4.5" />
                            </div>
                            Evaluation Builder
                        </DialogTitle>
                        <div className="flex gap-2">
                            {evaluationId && (
                                <Button size="sm" variant="outline" onClick={copyLink} className="gap-2 rounded-lg">
                                    <Link className="h-3.5 w-3.5" />
                                    Copy Link
                                </Button>
                            )}
                        </div>
                    </div>
                    <DialogDescription className="pl-[46px]">
                        Design your evaluation form. Share the link for respondents to fill it out.
                    </DialogDescription>
                </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-5">
                {/* Title Card */}
                <div className="rounded-xl border shadow-sm overflow-hidden">
                    <div className="h-1.5 w-full bg-primary" />
                    <div className="p-5 space-y-4">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Untitled Evaluation"
                            className="text-2xl font-bold border-0 border-b-2 border-transparent focus:border-primary rounded-none px-0 h-auto py-2 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                        />
                        <p className="text-sm text-muted-foreground">
                            Enter a description for your evaluation (optional)
                        </p>
                    </div>
                </div>

                {/* Template & Settings Bar */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Select onValueChange={handleLoadTemplate}>
                            <SelectTrigger className="h-9 text-xs rounded-lg w-[200px]">
                                <SelectValue placeholder="📋 Load from Template..." />
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
                        className="h-9 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save as Template
                    </Button>
                </div>

                {scheduleId && trainerOptions.length > 0 && (
                    <div className="rounded-xl border shadow-sm p-4 space-y-2 bg-primary/5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                            <UserCircle className="h-3.5 w-3.5" />
                            Delegate to Trainer (Optional)
                        </Label>
                        <Select
                            value={trainerName || "none"}
                            onValueChange={(val) => setTrainerName(val === "none" ? null : val)}
                        >
                            <SelectTrigger className="h-9 rounded-lg">
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

                {/* Questions — MS Forms Card Style */}
                <div className="space-y-3">
                    {questions.map((q, idx) => (
                        <div
                            key={idx}
                            className={`rounded-xl border shadow-sm overflow-hidden transition-all duration-200 ${focusedQuestion === idx ? 'border-primary ring-1 ring-primary/20' : 'hover:border-muted-foreground/20'}`}
                            onClick={() => setFocusedQuestion(idx)}
                        >
                            <div className="flex">
                                <div className={`w-1 shrink-0 transition-colors duration-200 ${focusedQuestion === idx ? 'bg-primary' : 'bg-transparent'}`} />
                                <div className="flex-1 p-5 space-y-4">
                                    {/* Question header row */}
                                    <div className="flex items-start gap-3">
                                        <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1 space-y-3">
                                            <Input
                                                value={q.question_text}
                                                onChange={(e) => {
                                                    const newQs = [...questions]
                                                    newQs[idx].question_text = e.target.value
                                                    setQuestions(newQs)
                                                }}
                                                placeholder="Enter your question..."
                                                className="text-base font-medium border-0 border-b-2 border-transparent focus:border-primary rounded-none px-0 h-auto py-1.5 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                                                onFocus={() => setFocusedQuestion(idx)}
                                            />
                                            <div className="flex items-center gap-3">
                                                <Select
                                                    value={q.question_type}
                                                    onValueChange={(val) => {
                                                        const newQs = [...questions]
                                                        newQs[idx].question_type = val
                                                        setQuestions(newQs)
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 w-[180px] rounded-lg text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <QuestionTypeIcon type={q.question_type} className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <SelectValue />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="text">
                                                            <div className="flex items-center gap-2"><Type className="h-3.5 w-3.5" /> Text Input</div>
                                                        </SelectItem>
                                                        <SelectItem value="radio">
                                                            <div className="flex items-center gap-2"><CircleDot className="h-3.5 w-3.5" /> Multiple Choice</div>
                                                        </SelectItem>
                                                        <SelectItem value="rating">
                                                            <div className="flex items-center gap-2"><Star className="h-3.5 w-3.5" /> Rating Scale (1-5)</div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                <div className="flex-1" />

                                                {/* Required toggle */}
                                                <button
                                                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors ${q.is_required
                                                        ? 'bg-red-50 text-red-600 border border-red-200'
                                                        : 'bg-muted text-muted-foreground border border-muted'
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        const newQs = [...questions]
                                                        newQs[idx].is_required = !newQs[idx].is_required
                                                        setQuestions(newQs)
                                                    }}
                                                >
                                                    {q.is_required ? 'Required ✱' : 'Optional'}
                                                </button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setQuestions(questions.filter((_, i) => i !== idx))
                                                        setFocusedQuestion(null)
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Options for radio type */}
                                    {q.question_type === 'radio' && (
                                        <div className="pl-10 space-y-2">
                                            {(q.options || []).map((opt: string, optIdx: number) => (
                                                <div key={optIdx} className="flex items-center gap-3 group/opt">
                                                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                                                    <span className="text-sm flex-1">{opt}</span>
                                                    <button
                                                        className="opacity-0 group-hover/opt:opacity-100 p-1 hover:bg-destructive/10 rounded text-destructive transition-opacity"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            const newQs = [...questions]
                                                            newQs[idx].options = newQs[idx].options.filter((_: any, i: number) => i !== optIdx)
                                                            setQuestions(newQs)
                                                        }}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-3">
                                                <div className="h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground/20 shrink-0" />
                                                <Input
                                                    className="h-8 text-sm border-0 border-b border-muted focus:border-primary rounded-none px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                                                    placeholder="Add option..."
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

                                    {/* Preview for rating type */}
                                    {q.question_type === 'rating' && (
                                        <div className="pl-10 flex items-center gap-2 py-2">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <div key={n} className="h-10 w-10 rounded-xl border-2 border-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                                                    {n}
                                                </div>
                                            ))}
                                            <div className="ml-2 text-[10px] text-muted-foreground">
                                                <span className="text-muted-foreground/50">Poor</span>
                                                <span className="mx-2">→</span>
                                                <span className="text-muted-foreground/50">Excellent</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview for text type */}
                                    {q.question_type === 'text' && (
                                        <div className="pl-10">
                                            <div className="border-b border-muted-foreground/20 py-2 text-sm text-muted-foreground/40 italic">
                                                Short answer text
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add Question Button */}
                    <button
                        onClick={addQuestion}
                        className="w-full rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary hover:bg-primary/5 transition-all p-6 flex flex-col items-center gap-2 group"
                    >
                        <div className="h-10 w-10 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                            <Plus className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            Add new question
                        </span>
                    </button>
                </div>
            </div>

            <DialogFooter className="p-5 border-t bg-muted/10">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancel</Button>
                <Button onClick={handleSaveBuilder} disabled={loading} className="gap-2 rounded-lg">
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4" /> Save Evaluation
                </Button>
            </DialogFooter>
        </>
    )

    // ========== RESULTS MODE (MS Forms-style charts) ==========
    const renderResults = () => {
        const totalResponses = responses.length
        const completionRate = totalResponses > 0
            ? Math.round(responses.reduce((acc, r) => acc + Object.keys(r.answers).length, 0) / (totalResponses * (questions.length || 1)) * 100)
            : 0
        const recentResponses = responses.filter(r => new Date(r.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length

        return (
            <>
                {/* Accent bar using primary color */}
                <div className="relative">
                    <div className="h-2 w-full bg-primary" />
                    <DialogHeader className="p-6 pb-3">
                        <div className="flex items-center justify-between mr-8">
                            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold">
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground">
                                    <BarChart3 className="h-4.5 w-4.5" />
                                </div>
                                Evaluation Results
                            </DialogTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setMode("builder")} className="gap-2 rounded-lg">
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    Edit Form
                                </Button>
                                {evaluationId && (
                                    <Button size="sm" variant="outline" onClick={copyLink} className="gap-2 rounded-lg">
                                        <Link className="h-3.5 w-3.5" />
                                        Copy Link
                                    </Button>
                                )}
                            </div>
                        </div>
                        <DialogDescription className="pl-[46px]">
                            {totalResponses} response{totalResponses !== 1 ? 's' : ''} collected for "{title}"
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-5">
                    {totalResponses === 0 ? (
                        <div className="text-center py-20 rounded-xl border-2 border-dashed">
                            <div className="h-14 w-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                <ClipboardList className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground font-medium text-lg">No responses yet</p>
                            <p className="text-sm text-muted-foreground/60 mt-1 mb-6">Share the evaluation link to start collecting responses.</p>
                            <Button variant="outline" onClick={copyLink} className="rounded-full px-6">
                                <Link className="h-4 w-4 mr-2" /> Copy Share Link
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                <div className="p-6 rounded-2xl border shadow-sm bg-card hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                                        <ClipboardList className="h-16 w-16" />
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Responses</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <h3 className="text-3xl font-black text-primary">{totalResponses}</h3>
                                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Active</span>
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl border shadow-sm bg-card hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                                        <BarChart3 className="h-16 w-16" />
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completion Rate</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <h3 className="text-3xl font-black text-primary">{completionRate}%</h3>
                                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">High</span>
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl border shadow-sm bg-card hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                                        <Calendar className="h-16 w-16" />
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">This Week</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <h3 className="text-3xl font-black text-primary">{recentResponses}</h3>
                                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">New</span>
                                    </div>
                                </div>
                            </div>

                            {contributingInfo.length > 0 && (
                                <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
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

                            {/* Per-question results */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {questions.map((q, idx) => {
                                    if (q.question_type === 'rating' || q.question_type === 'radio') {
                                        const dataMap: Record<string, number> = {}
                                        responses.forEach(r => {
                                            let ans = r.answers[q.id]
                                            
                                            // Robust Fallback: Match by value if ID matching fails (handles recreated questions)
                                            if (ans === undefined) {
                                                if (q.question_type === 'radio' && q.options) {
                                                    // Find if any value in the response matches one of this question's options
                                                    ans = Object.values(r.answers).find(v => q.options.includes(String(v)))
                                                } else if (q.question_type === 'rating') {
                                                    // For rating, look for any value that is a number 1-5
                                                    ans = Object.values(r.answers).find(v => {
                                                        const n = Number(v)
                                                        return !isNaN(n) && n >= 1 && n <= 5
                                                    })
                                                }
                                            }
                                            
                                            if (ans !== undefined) dataMap[ans] = (dataMap[ans] || 0) + 1
                                        })

                                        let chartEntries = Object.entries(dataMap)
                                        if (q.question_type === 'rating') {
                                            chartEntries = chartEntries.map(([k, v]) => [String(k), v])
                                            chartEntries.sort((a, b) => Number(a[0]) - Number(b[0]))
                                        } else if (q.options) {
                                            const orderedEntries: [string, number][] = []
                                            for (const opt of q.options) {
                                                orderedEntries.push([opt, dataMap[opt] || 0])
                                            }
                                            chartEntries.forEach(([key, val]) => {
                                                if (!q.options.includes(key)) orderedEntries.push([key, val])
                                            })
                                            chartEntries = orderedEntries
                                        }

                                        const totalForQuestion = chartEntries.reduce((acc, [, v]) => acc + v, 0)
                                        let ratingAvg = 0
                                        if (q.question_type === 'rating' && totalForQuestion > 0) {
                                            ratingAvg = chartEntries.reduce((acc, [key, count]) => acc + Number(key) * count, 0) / totalForQuestion
                                        }

                                        const selectedChart = chartTypeMap[q.id] || 'bar'
                                        const chartData = chartEntries.map(([name, value]) => ({ 
                                            name, 
                                            value, 
                                            pct: totalForQuestion > 0 ? Math.round((value / totalForQuestion) * 100) : 0 
                                        }))

                                        return (
                                            <div key={idx} className="rounded-2xl border shadow-sm bg-card hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col">
                                                <div className="h-1.5 w-full bg-primary/20" />
                                                <div className="p-5 flex-1 flex flex-col space-y-5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm text-foreground leading-tight">{q.question_text}</h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                                                                        {totalForQuestion} response{totalForQuestion !== 1 ? 's' : ''}
                                                                    </span>
                                                                    {q.question_type === 'rating' && totalForQuestion > 0 && (
                                                                        <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                                                            <Star className="h-3 w-3 fill-primary" />
                                                                            {ratingAvg.toFixed(1)} Average
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Chart type selector */}
                                                        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                                                            {CHART_OPTIONS.map(opt => (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => setChartTypeMap(prev => ({ ...prev, [q.id]: opt.value }))}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-md text-sm transition-all ${selectedChart === opt.value ? 'bg-background shadow-sm text-foreground scale-110' : 'text-muted-foreground/60 hover:text-foreground hover:bg-background/50'}`}
                                                                    title={opt.label}
                                                                >
                                                                    {opt.icon}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-h-[220px]">
                                                        {/* Dynamic chart rendering */}
                                                        {selectedChart === 'bar' && (
                                                            <div className="space-y-4 py-2">
                                                                {chartEntries.map(([name, value], barIdx) => {
                                                                    const pct = totalForQuestion > 0 ? Math.round((value / totalForQuestion) * 100) : 0
                                                                    return (
                                                                        <div key={barIdx} className="group/bar space-y-1.5">
                                                                            <div className="flex items-center justify-between text-[11px]">
                                                                                <span className="font-semibold text-foreground/80">{name}</span>
                                                                                <span className="text-muted-foreground tabular-nums font-bold">
                                                                                    {value} <span className="text-[9px] font-normal opacity-60">({pct}%)</span>
                                                                                </span>
                                                                            </div>
                                                                            <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className="h-full rounded-full transition-all duration-1000 ease-in-out relative"
                                                                                    style={{
                                                                                        width: `${Math.max(pct, 1)}%`,
                                                                                        background: COLORS[barIdx % COLORS.length]
                                                                                    }}
                                                                                >
                                                                                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                        {selectedChart === 'doughnut' && (
                                                            <div className="flex items-center justify-center h-full">
                                                                <ResponsiveContainer width="100%" height={240}>
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={chartData}
                                                                            cx="50%"
                                                                            cy="50%"
                                                                            innerRadius={60}
                                                                            outerRadius={85}
                                                                            paddingAngle={5}
                                                                            dataKey="value"
                                                                            animationBegin={0}
                                                                            animationDuration={1500}
                                                                        >
                                                                            {chartData.map((entry, index) => (
                                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                                                                            ))}
                                                                        </Pie>
                                                                        <RechartsTooltip 
                                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '600' }}
                                                                            formatter={(value: number, name: string) => [`${value} response${value !== 1 ? 's' : ''}`, name]}
                                                                        />
                                                                        <Legend 
                                                                            verticalAlign="bottom" 
                                                                            align="center"
                                                                            iconType="circle"
                                                                            wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }}
                                                                        />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        )}

                                                        {selectedChart === 'radar' && (
                                                            <div className="flex items-center justify-center h-full pt-4">
                                                                <ResponsiveContainer width="100%" height={240}>
                                                                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                                                                        <PolarGrid stroke="#e2e8f0" />
                                                                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} />
                                                                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9 }} />
                                                                        <Radar
                                                                            name="Responses"
                                                                            dataKey="value"
                                                                            stroke={COLORS[0]}
                                                                            fill={COLORS[0]}
                                                                            fillOpacity={0.4}
                                                                            animationDuration={1500}
                                                                        />
                                                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                                    </RadarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        )}

                                                        {selectedChart === 'line' && (
                                                            <div className="flex items-center justify-center h-full pt-4">
                                                                <ResponsiveContainer width="100%" height={240}>
                                                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                                        <Line 
                                                                            type="monotone" 
                                                                            dataKey="value" 
                                                                            stroke={COLORS[0]} 
                                                                            strokeWidth={3} 
                                                                            dot={{ r: 4, fill: COLORS[0], strokeWidth: 2, stroke: '#fff' }}
                                                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                                                            animationDuration={1500}
                                                                        />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }

                                    if (q.question_type === 'text') {
                                        const textResponses = responses.filter(r => r.answers[q.id])
                                        return (
                                            <div key={idx} className="rounded-2xl border shadow-sm bg-card hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col">
                                                <div className="h-1.5 w-full bg-primary/20" />
                                                <div className="p-5 flex-1 space-y-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-sm text-foreground leading-tight">{q.question_text}</h4>
                                                            <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider mt-1">
                                                                {textResponses.length} response{textResponses.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {textResponses.map((r, rIdx) => (
                                                            <div key={rIdx} className="flex items-start gap-3 p-3 bg-muted/20 rounded-xl border border-muted/50 text-sm hover:bg-muted/30 transition-colors">
                                                                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 border border-primary/20">
                                                                    {r.respondent_name?.charAt(0)?.toUpperCase() || '?'}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[11px] text-primary font-bold">{r.respondent_name || 'Anonymous'}</p>
                                                                    <p className="text-sm mt-0.5 leading-relaxed text-foreground/80">{r.answers[q.id]}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
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

                <DialogFooter className="p-5 border-t bg-muted/10">
                    <Button variant="secondary" onClick={() => onOpenChange(false)} className="rounded-lg">Close</Button>
                </DialogFooter>
            </>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="lg:w-[70vw] md:w-[90vw] flex flex-col p-0 overflow-hidden max-h-[90vh]">
                {mode === "builder" ? renderBuilder() : renderResults()}
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

// ================================================================
// ScheduleEvaluationsDialog — with By Training / By Trainer tabs
// ================================================================

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
    const [manageTab, setManageTab] = React.useState<"training" | "trainer">("training")

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

    // Group evaluations by trainer for the "By Trainer" tab
    const evaluationsByTrainer = React.useMemo(() => {
        const groups: Record<string, any[]> = {}
        const shared: any[] = []

        evaluations.forEach(ev => {
            if (ev.trainer_name) {
                if (!groups[ev.trainer_name]) groups[ev.trainer_name] = []
                groups[ev.trainer_name].push(ev)
            } else {
                shared.push(ev)
            }
        })

        return { groups, shared }
    }, [evaluations])

    const renderEvalCard = (ev: any) => (
        <div key={ev.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shrink-0">
                    <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">{ev.title}</h4>
                    <p className="text-[10px] text-muted-foreground tracking-tight uppercase font-medium">
                        Created {new Date(ev.created_at).toLocaleDateString()}
                        {ev.trainer_name && <span className="ml-1.5 text-primary">• {ev.trainer_name}</span>}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg"
                    onClick={() => handleEdit(ev.id)}
                    title="Edit Builder"
                >
                    <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-lg"
                    onClick={() => handleViewResults(ev.id)}
                    title="View Results"
                >
                    <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                    onClick={() => handleDelete(ev.id)}
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
                    <div className="h-2 w-full bg-primary" />

                    <DialogHeader className="px-6 pt-5 pb-2">
                        <div className="flex items-center justify-between mr-8">
                            <DialogTitle className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground">
                                    <Settings2 className="h-4.5 w-4.5" />
                                </div>
                                <span className="text-lg font-bold">Manage Evaluations</span>
                            </DialogTitle>
                            <Button size="sm" onClick={handleCreate} className="gap-2 rounded-lg">
                                <PlusCircle className="h-4 w-4" />
                                New Evaluation
                            </Button>
                        </div>
                        <DialogDescription className="pl-[46px]">
                            Create and manage evaluation forms for <b>{courseName || "this schedule"}</b>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-6">
                        {/* Tabs: By Training / By Trainer */}
                        <Tabs value={manageTab} onValueChange={(v) => setManageTab(v as any)} className="mt-2">
                            <TabsList className="w-full bg-muted/50 h-10 rounded-xl p-1">
                                <TabsTrigger
                                    value="training"
                                    className="flex-1 gap-2 rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    <BookOpen className="h-3.5 w-3.5" />
                                    By Training
                                </TabsTrigger>
                                <TabsTrigger
                                    value="trainer"
                                    className="flex-1 gap-2 rounded-lg text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    <UserCircle className="h-3.5 w-3.5" />
                                    By Trainer
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="training" className="mt-4">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-xs text-muted-foreground">Loading evaluations...</p>
                                    </div>
                                ) : evaluations.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/5">
                                        <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground font-medium">No evaluations created yet.</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Create separate evaluations for the course and trainer.</p>
                                        <Button variant="outline" size="sm" onClick={handleCreate} className="rounded-lg">
                                            Get Started
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {evaluations.map(renderEvalCard)}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="trainer" className="mt-4">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-xs text-muted-foreground">Loading evaluations...</p>
                                    </div>
                                ) : scheduleTrainers.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/5">
                                        <UserCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground font-medium">No trainers assigned to this schedule.</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Assign trainers in the schedule settings to use this view.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {scheduleTrainers.map(trainer => {
                                            const trainerEvals = evaluationsByTrainer.groups[trainer] || []
                                            return (
                                                <div key={trainer} className="space-y-2">
                                                    <div className="flex items-center gap-2 pb-1.5 border-b">
                                                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                            {trainer.charAt(0).toUpperCase()}
                                                        </div>
                                                        <h4 className="text-sm font-bold">{trainer}</h4>
                                                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                            {trainerEvals.length} evaluation{trainerEvals.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    {trainerEvals.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground/60 italic pl-9">
                                                            No evaluations delegated to this trainer yet.
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-2 pl-2">
                                                            {trainerEvals.map(renderEvalCard)}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}

                                        {/* Shared evaluations (no specific trainer) */}
                                        {evaluationsByTrainer.shared.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 pb-1.5 border-b">
                                                    <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                                                        ★
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Shared / General</h4>
                                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                        {evaluationsByTrainer.shared.length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2 pl-2">
                                                    {evaluationsByTrainer.shared.map(renderEvalCard)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="px-6 pb-5 pt-0">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Close</Button>
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
