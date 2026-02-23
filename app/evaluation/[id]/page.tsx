// app/evaluation/[id]/page.tsx
"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { tmsDb } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ClipboardList, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

export default function PublicEvaluationPage() {
    const params = useParams()
    const id = params.id as string

    const [evaluation, setEvaluation] = React.useState<any>(null)
    const [questions, setQuestions] = React.useState<any[]>([])
    const [answers, setAnswers] = React.useState<Record<string, string>>({})
    const [respondent, setRespondent] = React.useState({ name: "", email: "" })
    const [loading, setLoading] = React.useState(true)
    const [submitting, setSubmitting] = React.useState(false)
    const [submitted, setSubmitted] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: evalData, error: evalError } = await tmsDb
                    .from("repo_evaluations")
                    .select("*, questions:repo_eval_questions(*)")
                    .eq("id", id)
                    .single()

                if (evalError) throw evalError
                setEvaluation(evalData)
                setQuestions(evalData.questions.sort((a: any, b: any) => a.sort_order - b.sort_order))
            } catch (err: any) {
                console.error("Fetch error:", err)
                setError("Evaluation not found or has been removed.")
            } finally {
                setLoading(false)
            }
        }
        if (id) fetchData()
    }, [id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const { error: submitError } = await tmsDb
                .from("repo_eval_responses")
                .insert({
                    evaluation_id: id,
                    respondent_name: respondent.name,
                    respondent_email: respondent.email,
                    answers: answers
                })

            if (submitError) throw submitError
            setSubmitted(true)
            toast.success("Thank you! Your response has been submitted.")
        } catch (err: any) {
            toast.error("Failed to submit response. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Loading evaluation...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-6 text-center max-w-md mx-auto">
                <AlertCircle className="h-16 w-16 text-destructive mb-6" />
                <h1 className="text-2xl font-bold mb-2">Oops!</h1>
                <p className="text-muted-foreground mb-8">{error}</p>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-6 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-background p-10 rounded-3xl shadow-xl border max-w-lg w-full"
                >
                    <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-black mb-4">Submission Received!</h1>
                    <p className="text-muted-foreground mb-8 text-lg">
                        Thank you for your valuable feedback. Your response for <strong>{evaluation?.title}</strong> has been successfully recorded.
                    </p>
                    <Button variant="outline" className="rounded-full px-8" onClick={() => window.close()}>
                        Close Window
                    </Button>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted/30 py-12 px-6">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header Card */}
                <div className="bg-background p-8 rounded-3xl shadow-sm border overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-blue-600"></div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <ClipboardList className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">{evaluation?.title}</h1>
                    </div>
                    <p className="text-muted-foreground text-lg">{evaluation?.description || "Please fill out the following evaluation form accurately."}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Identity Section */}
                    <div className="bg-background p-8 rounded-3xl shadow-sm border space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-primary rounded-full"></span>
                            Respondent Information
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                                <Input
                                    id="name"
                                    required
                                    placeholder="Enter your name"
                                    className="rounded-xl h-12"
                                    value={respondent.name}
                                    onChange={(e) => setRespondent({ ...respondent, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="your@email.com"
                                    className="rounded-xl h-12"
                                    value={respondent.email}
                                    onChange={(e) => setRespondent({ ...respondent, email: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Questions Section */}
                    <div className="space-y-6">
                        {questions.map((q, idx) => (
                            <motion.div
                                key={q.id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-background p-8 rounded-3xl shadow-sm border space-y-4"
                            >
                                <div className="flex items-start gap-4">
                                    <span className="h-8 w-8 bg-muted rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                                        {idx + 1}
                                    </span>
                                    <Label className="text-xl font-semibold leading-relaxed pt-0.5">
                                        {q.question_text}
                                        {q.is_required && <span className="text-destructive ml-1">*</span>}
                                    </Label>
                                </div>

                                <div className="pl-12 pt-2">
                                    {q.question_type === 'text' && (
                                        <Input
                                            required={q.is_required}
                                            value={answers[q.id] || ""}
                                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                            placeholder="Type your answer here..."
                                            className="rounded-xl h-12 border-muted hover:border-primary/50 focus:border-primary transition-all"
                                        />
                                    )}

                                    {q.question_type === 'radio' && (
                                        <RadioGroup
                                            required={q.is_required}
                                            value={answers[q.id] || ""}
                                            onValueChange={(val) => setAnswers({ ...answers, [q.id]: val })}
                                            className="grid gap-3"
                                        >
                                            {(q.options || []).map((opt: string, optIdx: number) => (
                                                <div key={optIdx} className="flex items-center space-x-2 bg-muted/5 p-4 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group">
                                                    <RadioGroupItem value={opt} id={`${q.id}-${optIdx}`} className="h-5 w-5 border-2" />
                                                    <Label htmlFor={`${q.id}-${optIdx}`} className="flex-1 font-medium cursor-pointer text-base">
                                                        {opt}
                                                    </Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    )}

                                    {q.question_type === 'rating' && (
                                        <div className="flex flex-wrap gap-4 justify-between items-center py-4">
                                            {[1, 2, 3, 4, 5].map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setAnswers({ ...answers, [q.id]: String(num) })}
                                                    className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all ${answers[q.id] === String(num)
                                                            ? "bg-primary text-primary-foreground border-primary scale-110 shadow-lg"
                                                            : "bg-background text-muted-foreground border-muted hover:border-primary/50 hover:text-primary"
                                                        }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                            <div className="w-full flex justify-between px-2 mt-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">
                                                <span>Poor</span>
                                                <span>Excellent</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="pt-6 pb-20">
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-16 rounded-3xl text-xl font-black shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
                        >
                            {submitting ? (
                                <><Loader2 className="h-6 w-6 animate-spin mr-3" /> Submitting...</>
                            ) : (
                                "Submit Evaluation"
                            )}
                        </Button>
                        <p className="text-center text-muted-foreground text-sm mt-6">
                            Powered by Petrosphere EMS Repository
                        </p>
                    </div>
                </form>
            </div>
        </div>
    )
}
