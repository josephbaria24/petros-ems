"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateFilter, type DateRange, type FilterPreset } from "@/components/date-filter"
import { CourseDetailsModal } from "@/components/modals/course-details-modal"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import {
  Users, BookOpen, Calendar, TrendingUp, Loader2, Pencil,
} from "lucide-react"
import {
  Area, AreaChart,
  Bar, BarChart,
  Line, LineChart,
  Pie, PieChart,
  Cell,
  XAxis, YAxis, CartesianGrid,
} from "recharts"
import { startOfYear } from "date-fns"

// ─── Types ───────────────────────────────────────────────────────────────────

type DashboardData = {
  stats: { participants: number; activeCourses: number; scheduledEvents: number; totalRevenue: number }
  enrollmentTrend: { month: string; enrollments: number }[]
  revenueData: { month: string; revenue: number; target: number }[]
  coursePopularity: { name: string; value: number }[]
  paymentStatus: { name: string; value: number }[]
  genderDistribution: { name: string; value: number }[]
  ageDistribution: { range: string; count: number }[]
  yearComparison: { month: string; currentYear: number; previousYear: number }[]
  employmentStatus: { name: string; value: number }[]
  branchDistribution: { name: string; value: number }[]
  trainingStatusDist: { name: string; value: number }[]
  companyDistribution: { name: string; value: number }[]
  recentEvents: { course: string; date: string; participants: number; status: string }[]
  monthlyTarget: number
  currentYear: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
]

const toKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_")

function makePieData(items: { name: string; value: number }[]) {
  const data = items.map((item, i) => ({
    ...item,
    key: toKey(item.name),
    fill: `var(--color-${toKey(item.name)})`,
  }))
  const config: ChartConfig = {
    value: { label: "Count" },
    ...Object.fromEntries(
      items.map((item, i) => [
        toKey(item.name),
        { label: item.name, color: COLORS[i % COLORS.length] },
      ])
    ),
  }
  return { data, config }
}

const fade = (i: number): React.CSSProperties => ({
  animation: `dash-fade-in 0.4s ease-out ${i * 0.05}s both`,
})

// ─── Static chart configs ────────────────────────────────────────────────────

const enrollmentCfg = {
  enrollments: { label: "Enrollments", color: "var(--chart-1)" },
} satisfies ChartConfig

const revenueCfg = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  target: { label: "Target", color: "var(--chart-3)" },
} satisfies ChartConfig

const ageCfg = {
  count: { label: "Participants", color: "var(--chart-2)" },
} satisfies ChartConfig

// ─── Chart type options for the swappable slots ──────────────────────────────

type ChartType =
  | "enrollment" | "revenue" | "coursePopularity" | "paymentStatus"
  | "gender" | "age" | "yearComparison" | "employment"
  | "branch" | "trainingStatus" | "company"

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "enrollment", label: "Enrollment Trend" },
  { value: "revenue", label: "Revenue vs Target" },
  { value: "coursePopularity", label: "Course Popularity" },
  { value: "paymentStatus", label: "Payment Status" },
  { value: "gender", label: "Gender Distribution" },
  { value: "age", label: "Age Distribution" },
  { value: "yearComparison", label: "Year Comparison" },
  { value: "employment", label: "Employment Status" },
  { value: "branch", label: "Branch Distribution" },
  { value: "trainingStatus", label: "Training Status" },
  { value: "company", label: "Top Companies" },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("thisYear")
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfYear(new Date()),
    to: new Date(),
  })

  const [monthlyTarget, setMonthlyTarget] = useState(1000000)
  const [editingTarget, setEditingTarget] = useState(false)
  const [tempTarget, setTempTarget] = useState("")
  const [isSavingTarget, setIsSavingTarget] = useState(false)

  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [showCourseModal, setShowCourseModal] = useState(false)

  // Swappable chart slots (bottom row)
  const [slot1, setSlot1] = useState<ChartType>("branch")
  const [slot2, setSlot2] = useState<ChartType>("trainingStatus")

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/dashboard?from=${encodeURIComponent(dateRange.from.toISOString())}&to=${encodeURIComponent(dateRange.to.toISOString())}`
      )
      if (!res.ok) throw new Error("Failed to load")
      const json: DashboardData = await res.json()
      setData(json)
      setMonthlyTarget(json.monthlyTarget)
    } catch (err: any) {
      console.error(err)
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDateChange = (preset: FilterPreset, range: DateRange) => {
    setFilterPreset(preset)
    setDateRange(range)
  }

  const saveTarget = async () => {
    setIsSavingTarget(true)
    try {
      const val = Number(tempTarget)
      if (isNaN(val) || val < 0) throw new Error("Invalid target amount")
      await tmsDb.from("system_settings").upsert(
        { setting_key: "monthly_revenue_target", setting_value: { amount: val } },
        { onConflict: "setting_key" }
      )
      setMonthlyTarget(val)
      setEditingTarget(false)
      toast.success("Monthly target updated")
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSavingTarget(false)
    }
  }

  // ─── Dynamic configs ─────────────────────────────────────────────────────

  const yearCfg = useMemo<ChartConfig>(() => {
    if (!data) return {}
    return {
      currentYear: { label: `${data.currentYear}`, color: "var(--chart-1)" },
      previousYear: { label: `${data.currentYear - 1}`, color: "var(--chart-3)" },
    }
  }, [data])

  const paymentPie = useMemo(() => data ? makePieData(data.paymentStatus) : null, [data])
  const genderPie = useMemo(() => data ? makePieData(data.genderDistribution) : null, [data])
  const employmentPie = useMemo(() => data ? makePieData(data.employmentStatus) : null, [data])
  const branchPie = useMemo(() => data ? makePieData(data.branchDistribution) : null, [data])
  const trainingStatusPie = useMemo(() => data ? makePieData(data.trainingStatusDist) : null, [data])
  const companyPie = useMemo(() => data ? makePieData(data.companyDistribution) : null, [data])

  const courseCfg = useMemo<ChartConfig>(() => {
    if (!data) return {}
    return {
      value: { label: "Participants" },
      ...Object.fromEntries(
        data.coursePopularity.map((item, i) => [
          toKey(item.name),
          { label: item.name, color: COLORS[i % COLORS.length] },
        ])
      ),
    }
  }, [data])

  // ─── Render a chart by type ──────────────────────────────────────────────

  const renderChart = (type: ChartType) => {
    if (!data) return null
    switch (type) {
      case "enrollment":
        return (
          <ChartContainer config={enrollmentCfg} className="h-[200px] w-full">
            <AreaChart data={data.enrollmentTrend} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <defs>
                <linearGradient id="gEnroll" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-enrollments)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-enrollments)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="enrollments" stroke="var(--color-enrollments)" fill="url(#gEnroll)" strokeWidth={2} animationDuration={700} />
            </AreaChart>
          </ChartContainer>
        )
      case "revenue":
        return (
          <ChartContainer config={revenueCfg} className="h-[200px] w-full">
            <BarChart data={data.revenueData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} animationDuration={600} />
              <Bar dataKey="target" fill="var(--color-target)" radius={[4, 4, 0, 0]} animationDuration={600} />
            </BarChart>
          </ChartContainer>
        )
      case "coursePopularity":
        return (
          <ChartContainer config={courseCfg} className="h-[200px] w-full">
            <BarChart data={data.coursePopularity.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))} layout="vertical" margin={{ left: 0, right: 8 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={600} style={{ cursor: "pointer" }}>
                {data.coursePopularity.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    className="cursor-pointer"
                    onClick={() => { setSelectedCourse(entry.name); setShowCourseModal(true) }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )
      case "paymentStatus":
        return paymentPie && (
          <ChartContainer config={paymentPie.config} className="h-[200px] w-full">
            <PieChart>
              <Pie data={paymentPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={45} outerRadius={72} strokeWidth={2} animationDuration={600} />
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-1 text-xs" />} />
            </PieChart>
          </ChartContainer>
        )
      case "gender":
        return genderPie && (
          <ChartContainer config={genderPie.config} className="h-[200px] w-full">
            <PieChart>
              <Pie data={genderPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" outerRadius={72} animationDuration={600} />
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-1 text-xs" />} />
            </PieChart>
          </ChartContainer>
        )
      case "age":
        return (
          <ChartContainer config={ageCfg} className="h-[200px] w-full">
            <BarChart data={data.ageDistribution} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} animationDuration={600} />
            </BarChart>
          </ChartContainer>
        )
      case "yearComparison":
        return (
          <ChartContainer config={yearCfg} className="h-[200px] w-full">
            <LineChart data={data.yearComparison} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="currentYear" stroke="var(--color-currentYear)" strokeWidth={2} dot={{ r: 3 }} animationDuration={700} />
              <Line type="monotone" dataKey="previousYear" stroke="var(--color-previousYear)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" animationDuration={700} />
            </LineChart>
          </ChartContainer>
        )
      case "employment":
        return employmentPie && (
          <ChartContainer config={employmentPie.config} className="h-[200px] w-full">
            <PieChart>
              <Pie data={employmentPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={45} outerRadius={72} animationDuration={600} />
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-1 text-xs" />} />
            </PieChart>
          </ChartContainer>
        )
      case "branch":
        return branchPie && (
          <ChartContainer config={branchPie.config} className="h-[200px] w-full">
            <PieChart>
              <Pie data={branchPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={45} outerRadius={72} animationDuration={600} />
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-1 text-xs" />} />
            </PieChart>
          </ChartContainer>
        )
      case "trainingStatus":
        return trainingStatusPie && (
          <ChartContainer config={trainingStatusPie.config} className="h-[200px] w-full">
            <PieChart>
              <Pie data={trainingStatusPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" outerRadius={72} animationDuration={600} />
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-1 text-xs" />} />
            </PieChart>
          </ChartContainer>
        )
      case "company":
        return (
          <ChartContainer config={{ value: { label: "Registrations", color: "var(--chart-4)" } }} className="h-[200px] w-full">
            <BarChart data={data.companyDistribution} layout="vertical" margin={{ left: 0, right: 8 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} fontSize={9} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} animationDuration={600}>
                {data.companyDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )
      default:
        return null
    }
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[260px] rounded-xl" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[260px] rounded-xl" />)}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const statCards = [
    { title: "Participants", value: data.stats.participants.toLocaleString(), icon: Users, color: "text-primary bg-primary/10" },
    { title: "Active Courses", value: data.stats.activeCourses.toLocaleString(), icon: BookOpen, color: "text-chart-2 bg-chart-2/10" },
    { title: "Scheduled Events", value: data.stats.scheduledEvents.toLocaleString(), icon: Calendar, color: "text-chart-3 bg-chart-3/10" },
    { title: "Total Revenue", value: `₱${data.stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-chart-4 bg-chart-4/10" },
  ]

  return (
    <div className="space-y-3">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2" style={fade(0)}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Training programs overview</p>
        </div>
        <DateFilter value={filterPreset} dateRange={dateRange} onChange={handleDateChange} />
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => {
          const Icon = s.icon
          return (
            <Card key={s.title} className="py-3" style={fade(i + 1)}>
              <CardContent className="flex items-center gap-3 px-4 py-0">
                <div className={`rounded-lg p-2 ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{s.title}</p>
                  <p className="text-lg font-bold leading-none mt-0.5 truncate">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Row 1: Enrollment Trend (full width) ────────────────────────── */}
      <Card style={fade(5)}>
        <CardHeader className="pb-1 px-4 pt-3">
          <CardTitle className="text-sm font-medium">Enrollment Trend</CardTitle>
          <CardDescription className="text-xs">Monthly registration volume</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <ChartContainer config={enrollmentCfg} className="h-[220px] w-full">
            <AreaChart data={data.enrollmentTrend} margin={{ left: -20, right: 12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <defs>
                <linearGradient id="gEnrollMain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-enrollments)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-enrollments)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="enrollments" stroke="var(--color-enrollments)" fill="url(#gEnrollMain)" strokeWidth={2} animationDuration={800} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── Row 2: Revenue + Course Popularity ──────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card style={fade(6)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-medium">Revenue vs Target</CardTitle>
                <CardDescription className="text-xs">Monthly revenue performance</CardDescription>
              </div>
              {editingTarget ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={tempTarget}
                    onChange={e => setTempTarget(e.target.value)}
                    className="w-24 h-7 text-xs"
                    onKeyDown={e => e.key === "Enter" && saveTarget()}
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={saveTarget} disabled={isSavingTarget}>
                    {isSavingTarget ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingTarget(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() => { setTempTarget(String(monthlyTarget)); setEditingTarget(true) }}
                >
                  Target: ₱{monthlyTarget.toLocaleString()} <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ChartContainer config={revenueCfg} className="h-[220px] w-full">
              <BarChart data={data.revenueData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} animationDuration={600} />
                <Bar dataKey="target" fill="var(--color-target)" radius={[4, 4, 0, 0]} animationDuration={600} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card style={fade(7)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Course Popularity</CardTitle>
            <CardDescription className="text-xs">Top courses by registrations (click to view details)</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ChartContainer config={courseCfg} className="h-[220px] w-full">
              <BarChart
                data={data.coursePopularity.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))}
                layout="vertical"
                margin={{ left: 0, right: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={600} style={{ cursor: "pointer" }}>
                  {data.coursePopularity.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                      className="cursor-pointer"
                      onClick={() => { setSelectedCourse(entry.name); setShowCourseModal(true) }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Payment + Gender + Employment (3 columns) ────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card style={fade(8)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
            <CardDescription className="text-xs">Registration status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {paymentPie && (
              <ChartContainer config={paymentPie.config} className="h-[200px] w-full">
                <PieChart>
                  <Pie data={paymentPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={40} outerRadius={68} strokeWidth={2} animationDuration={600} />
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                  <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-x-3 gap-y-0.5 text-[11px]" />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card style={fade(9)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Gender Distribution</CardTitle>
            <CardDescription className="text-xs">Participant demographics</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {genderPie && (
              <ChartContainer config={genderPie.config} className="h-[200px] w-full">
                <PieChart>
                  <Pie data={genderPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" outerRadius={68} animationDuration={600} />
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                  <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-x-3 gap-y-0.5 text-[11px]" />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card style={fade(10)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Employment Status</CardTitle>
            <CardDescription className="text-xs">Workforce breakdown</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {employmentPie && (
              <ChartContainer config={employmentPie.config} className="h-[200px] w-full">
                <PieChart>
                  <Pie data={employmentPie.data} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={40} outerRadius={68} animationDuration={600} />
                  <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                  <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-x-3 gap-y-0.5 text-[11px]" />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Age + Year Comparison ─────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card style={fade(11)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Age Distribution</CardTitle>
            <CardDescription className="text-xs">Participant age ranges</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ChartContainer config={ageCfg} className="h-[200px] w-full">
              <BarChart data={data.ageDistribution} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} animationDuration={600} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card style={fade(12)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <CardTitle className="text-sm font-medium">Year-over-Year Comparison</CardTitle>
            <CardDescription className="text-xs">Enrollment: {data.currentYear} vs {data.currentYear - 1}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ChartContainer config={yearCfg} className="h-[200px] w-full">
              <LineChart data={data.yearComparison} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="currentYear" stroke="var(--color-currentYear)" strokeWidth={2} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="previousYear" stroke="var(--color-previousYear)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" animationDuration={700} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 5: Swappable chart slots ─────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card style={fade(13)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium">
                {CHART_OPTIONS.find(o => o.value === slot1)?.label}
              </CardTitle>
              <Select value={slot1} onValueChange={v => setSlot1(v as ChartType)}>
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {renderChart(slot1)}
          </CardContent>
        </Card>

        <Card style={fade(14)}>
          <CardHeader className="pb-1 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium">
                {CHART_OPTIONS.find(o => o.value === slot2)?.label}
              </CardTitle>
              <Select value={slot2} onValueChange={v => setSlot2(v as ChartType)}>
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {renderChart(slot2)}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Events ────────────────────────────────────────────────── */}
      <Card style={fade(15)}>
        <CardHeader className="pb-1 px-4 pt-3">
          <CardTitle className="text-sm font-medium">Recent Training Events</CardTitle>
          <CardDescription className="text-xs">Ongoing runs or sessions scheduled this month</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-2">
            {data.recentEvents.length > 0 ? data.recentEvents.map((event, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{event.course}</p>
                  <p className="text-[11px] text-muted-foreground">{event.date}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{event.status}</Badge>
                  <span className="text-xs font-medium tabular-nums">{event.participants} pax</span>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No events in this period</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Course Details Modal ──────────────────────────────────────────── */}
      {selectedCourse && (
        <CourseDetailsModal
          isOpen={showCourseModal}
          onClose={() => setShowCourseModal(false)}
          courseName={selectedCourse}
        />
      )}
    </div>
  )
}
