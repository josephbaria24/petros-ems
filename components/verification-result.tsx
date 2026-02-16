"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle, Calendar, User, Building2, Hash, MapPin } from "lucide-react"

interface VerificationResultProps {
    result: {
        status: "valid" | "invalid" | "not-found"
        certificateId: string
        holderName?: string
        training?: string
        trainingDate?: string
        startDate?: string
        endDate?: string
        venue?: string
    }
    onReset: () => void
}

const statusConfig: Record<string, {
    icon: typeof CheckCircle2
    color: string
    borderColor: string
    badgeVariant: string
    label: string
    description: string
}> = {
    valid: {
        icon: CheckCircle2,
        color: "bg-slate-900 text-white",
        borderColor: "border-slate-200",
        badgeVariant: "bg-slate-900 text-white border-slate-200",
        label: "Valid Certificate",
        description: "This certificate has been verified and is authentic",
    },
    invalid: {
        icon: XCircle,
        color: "bg-slate-100 text-slate-900",
        borderColor: "border-slate-300",
        badgeVariant: "bg-white text-slate-900 border-slate-300",
        label: "Invalid Certificate",
        description: "This certificate could not be verified or has been revoked",
    },
    "not-found": {
        icon: AlertCircle,
        color: "bg-slate-100 text-slate-600",
        borderColor: "border-slate-200",
        badgeVariant: "bg-slate-100 text-slate-600 border-slate-200",
        label: "Not Found",
        description: "No certificate found with this ID",
    },
}

export function VerificationResult({ result, onReset }: VerificationResultProps) {
    const config = statusConfig[result.status]
    const StatusIcon = config.icon

    return (
        <Card className={`border-0 shadow-sm border-2 ${config.borderColor} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <CardHeader className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${config.color} shrink-0`}>
                            <StatusIcon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                {config.label}
                            </CardTitle>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {config.description}
                            </p>
                        </div>
                    </div>
                    <Badge className={`shrink-0 ${config.badgeVariant}`}>
                        {result.status.toUpperCase()}
                    </Badge>
                </div>
            </CardHeader>

            {result.status === "valid" && (
                <CardContent className="p-6 pt-0 space-y-4">
                    <div className="grid gap-4">
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                            <Hash className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                    Serial Number
                                </p>
                                <p className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all mt-1">
                                    {result.certificateId}
                                </p>
                            </div>
                        </div>

                        {result.holderName && (
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                <User className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                        Certificate Holder
                                    </p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                                        {result.holderName}
                                    </p>
                                </div>
                            </div>
                        )}

                        {result.training && (
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                <Building2 className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                        Training / Course
                                    </p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                                        {result.training}
                                    </p>
                                </div>
                            </div>
                        )}

                        {result.venue && (
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                <MapPin className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                        Training Venue
                                    </p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                                        {result.venue}
                                    </p>
                                </div>
                            </div>
                        )}

                        {(result.trainingDate || result.startDate || result.endDate) && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {result.trainingDate && (
                                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                                Training Date
                                            </p>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                                                {result.trainingDate}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {result.startDate && (
                                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                                Start Date
                                            </p>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                                                {result.startDate !== "N/A" && !isNaN(new Date(result.startDate).getTime())
                                                    ? new Date(result.startDate).toLocaleDateString("en-US", {
                                                        year: "numeric",
                                                        month: "long",
                                                        day: "numeric",
                                                    })
                                                    : result.startDate}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {result.endDate && (
                                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                                End Date
                                            </p>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                                                {result.endDate !== "N/A" && !isNaN(new Date(result.endDate).getTime())
                                                    ? new Date(result.endDate).toLocaleDateString("en-US", {
                                                        year: "numeric",
                                                        month: "long",
                                                        day: "numeric",
                                                    })
                                                    : result.endDate}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={onReset}
                        variant="outline"
                        className="w-full h-11 font-medium"
                    >
                        Verify Another Certificate
                    </Button>
                </CardContent>
            )}

            {result.status !== "valid" && (
                <CardContent className="p-6 pt-0">
                    <Button
                        onClick={onReset}
                        variant="outline"
                        className="w-full h-11 font-medium"
                    >
                        Try Again
                    </Button>
                </CardContent>
            )}
        </Card>
    )
}

export default VerificationResult
