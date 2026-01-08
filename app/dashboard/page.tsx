"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, TrendingUp } from "lucide-react"
import EnrollmentBrushChart from "@/components/charts/enrollment-brush-chart"
import { RevenueChart } from "@/components/charts/revenue-chart"
import { CoursePopularityChart } from "@/components/charts/course-popularity-chart"
import { PaymentStatusChart } from "@/components/charts/payment-status-chart"
import { AgeDistributionChart } from "@/components/charts/age-distribution-chart"
import { MonthlyComparisonChart } from "@/components/charts/monthly-comparison-chart"
import { EmploymentStatusChart } from "@/components/charts/employment-status-chart"
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateFilter, type DateRange, type FilterPreset } from "@/components/date-filter"
import { isWithinInterval } from "date-fns"

export default function DashboardPage() {
  const supabase = createClient()

  // Date filter state
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("last30days")
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  })

  const [stats, setStats] = useState([
    { title: "Total Participants", value: "—", change: "", icon: Users, color: "text-primary" },
    { title: "Active Courses", value: "—", change: "", icon: BookOpen, color: "text-secondary" },
    { title: "Scheduled Events", value: "—", change: "", icon: Calendar, color: "text-chart-2" },
    { title: "Total Revenue", value: "—", change: "", icon: TrendingUp, color: "text-chart-4" },
  ])

  type RecentEvent = {
    course: string
    date: string
    participants: number
  }
  
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [enrollmentData, setEnrollmentData] = useState<any[]>([])
  const [genderData, setGenderData] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [coursePopularityData, setCoursePopularityData] = useState<any[]>([])
  const [paymentStatusData, setPaymentStatusData] = useState<any[]>([])
  const [ageDistributionData, setAgeDistributionData] = useState<any[]>([])
  const [monthlyComparisonData, setMonthlyComparisonData] = useState<any[]>([])
  const [employmentStatusData, setEmploymentStatusData] = useState<any[]>([])
  
  // Chart selection states
  const [chart1Type, setChart1Type] = useState("coursePopularity")
  const [chart2Type, setChart2Type] = useState("revenue")
  const [chart3Type, setChart3Type] = useState("coursePopularity")

  // Colors for gender chart
  const [genderColors, setGenderColors] = useState({
    chart1: '#4462d8',
    chart2: '#5fc9cb',
    chart3: '#a05bf9',
    chart4: '#c8db3c',
    chart5: '#d4438b',
    foreground: '#141454',
    popover: '#ffffff',
    popoverForeground: '#3b3b46',
    border: '#e6e6f2',
  })

  useEffect(() => {
    const root = document.documentElement
    const styles = getComputedStyle(root)
    
    const getVar = (variable: string) => {
      return styles.getPropertyValue(variable).trim() || null
    }

    const updateColors = () => {
      setGenderColors({
        chart1: getVar('--chart-1') || '#4462d8',
        chart2: getVar('--chart-2') || '#5fc9cb',
        chart3: getVar('--chart-3') || '#a05bf9',
        chart4: getVar('--chart-4') || '#c8db3c',
        chart5: getVar('--chart-5') || '#d4438b',
        foreground: getVar('--foreground') || '#141454',
        popover: getVar('--popover') || '#ffffff',
        popoverForeground: getVar('--popover-foreground') || '#3b3b46',
        border: getVar('--border') || '#e6e6f2',
      })
    }

    updateColors()

    const observer = new MutationObserver(updateColors)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  const handleDateFilterChange = (preset: FilterPreset, range: DateRange) => {
    setFilterPreset(preset)
    setDateRange(range)
  }

  // Filter function to check if date is in range
  const isInDateRange = (date: string | Date) => {
    const checkDate = new Date(date)
    return isWithinInterval(checkDate, { start: dateRange.from, end: dateRange.to })
  }
  
  useEffect(() => {
    const fetchStats = async () => {
      const [trainingsRes, coursesRes, schedulesRes, scheduleDatesRes, scheduleRangesRes, paymentsRes] = await Promise.all([
        supabase.from("trainings").select("*, courses(name, training_fee), schedules(*)"),
        supabase.from("courses").select("*"),
        supabase.from("schedules").select(`
          id,
          created_at,
          course_id,
          courses ( name )
        `).order("created_at", { ascending: false }),
        supabase.from("schedule_dates").select("*, schedules(*)"),
        supabase.from("schedule_ranges").select("*, schedules(*)"),
        supabase.from("payments").select("amount_paid, payment_date, training_id, trainings(courses(training_fee), add_pvc_id, discounted_fee, has_discount)"),
      ])

      const allTrainings = trainingsRes.data || []
      const courses = coursesRes.data || []
      const allEvents = schedulesRes.data || []
      const scheduleDates = scheduleDatesRes.data || []
      const scheduleRanges = scheduleRangesRes.data || []
      const allPayments = paymentsRes.data || []

      // Filter data by date range
      const trainings = allTrainings.filter(t => isInDateRange(t.created_at))
      const events = allEvents.filter(e => isInDateRange(e.created_at))
      const payments = allPayments.filter(p => isInDateRange(p.payment_date))

      const participants = trainings.length
      const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0)

      setStats([
        { title: "Total Participants", value: participants.toString(), change: "+12.5%", icon: Users, color: "text-primary" },
        { title: "Active Courses", value: courses.length.toString(), change: "+3", icon: BookOpen, color: "text-secondary" },
        { title: "Scheduled Events", value: events.length.toString(), change: "+8.2%", icon: Calendar, color: "text-chart-2" },
        { title: "Total Revenue", value: `₱${totalRevenue.toLocaleString()}`, change: "+15.3%", icon: TrendingUp, color: "text-chart-4" },
      ])

      const formattedEvents = events.slice(0, 3).map((event: any) => ({
        course: event.courses?.name || "Unnamed Course",
        date: new Date(event.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        participants: trainings.filter(t => t.schedule_id === event.id).length,
      }))

      setRecentEvents(formattedEvents)
      
      const allMonths = Array.from({ length: 12 }, (_, i) =>
        new Date(0, i).toLocaleString("en-US", { month: "short" })
      )

      // Monthly enrollments (filtered)
      const monthlyEnrollments: Record<string, number> = {}
      
      trainings.forEach((training: any) => {
        const scheduleId = training.schedule_id
        
        const matchingDates = scheduleDates.filter((sd: any) => sd.schedule_id === scheduleId)
        if (matchingDates.length > 0) {
          const month = new Date(matchingDates[0].date).toLocaleString("en-US", { month: "short" })
          monthlyEnrollments[month] = (monthlyEnrollments[month] || 0) + 1
        } else {
          const matchingRange = scheduleRanges.find((sr: any) => sr.schedule_id === scheduleId)
          if (matchingRange) {
            const month = new Date(matchingRange.start_date).toLocaleString("en-US", { month: "short" })
            monthlyEnrollments[month] = (monthlyEnrollments[month] || 0) + 1
          }
        }
      })

      const enrollmentTrend = allMonths.map((month) => {
        const date = new Date(`1 ${month} ${new Date().getFullYear()}`)
        return {
          date: date.toISOString(),
          enrollments: monthlyEnrollments[month] || 0
        }
      })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-6)

      const now = new Date()
      const filteredTrend = enrollmentTrend.filter(d => new Date(d.date) <= now)

      setEnrollmentData(filteredTrend)

      // Course popularity (Top 5) - filtered
      const courseCounts = trainings.reduce((acc: any, training: any) => {
        const courseName = training.courses?.name || "Other"
        acc[courseName] = (acc[courseName] || 0) + 1
        return acc
      }, {})

      const popularity = Object.entries(courseCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5)

      setCoursePopularityData(popularity)

      // Gender distribution - filtered
      const genderCounts = trainings.reduce((acc: any, training: any) => {
        const gender = training.gender || "Unspecified"
        acc[gender] = (acc[gender] || 0) + 1
        return acc
      }, {})

      const genderDist = Object.entries(genderCounts).map(([name, value]) => ({
        name,
        value
      }))

      setGenderData(genderDist)

      // Revenue data (monthly) - filtered
      const monthlyRevenue: Record<string, number> = {}
      const monthlyTarget: Record<string, number> = {}

      payments.forEach((payment: any) => {
        const month = new Date(payment.payment_date).toLocaleString("en-US", { month: "short" })
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(payment.amount_paid || 0)
      })

      trainings.forEach((training: any) => {
        const scheduleId = training.schedule_id
        const matchingDates = scheduleDates.filter((sd: any) => sd.schedule_id === scheduleId)
        
        let month = ""
        if (matchingDates.length > 0) {
          month = new Date(matchingDates[0].date).toLocaleString("en-US", { month: "short" })
        } else {
          const matchingRange = scheduleRanges.find((sr: any) => sr.schedule_id === scheduleId)
          if (matchingRange) {
            month = new Date(matchingRange.start_date).toLocaleString("en-US", { month: "short" })
          }
        }
        
        if (month) {
          const expectedRevenue = training.has_discount && training.discounted_fee
            ? Number(training.discounted_fee) + (training.add_pvc_id ? 150 : 0)
            : Number(training.courses?.training_fee || 0) + (training.add_pvc_id ? 150 : 0)
          
          monthlyTarget[month] = (monthlyTarget[month] || 0) + expectedRevenue
        }
      })

      const revenueChartData = allMonths.map(month => ({
        month,
        revenue: monthlyRevenue[month] || 0,
        target: monthlyTarget[month] || 0
      })).slice(-6)

      setRevenueData(revenueChartData)

      // Payment status distribution - filtered
      const statusCounts = trainings.reduce((acc: any, training: any) => {
        const status = training.status || "Unknown"
        const normalizedStatus = status.toLowerCase()
        
        let category = "Other"
        if (normalizedStatus.includes("pending")) category = "Pending Payment"
        else if (normalizedStatus.includes("partial")) category = "Partially Paid"
        else if (normalizedStatus.includes("completed")) category = "Completed"
        else if (normalizedStatus.includes("declined")) category = "Declined"
        
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {})

      const paymentDist = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value
      }))

      setPaymentStatusData(paymentDist)

      // Age distribution - filtered
      const ageRanges = {
        "18-25": 0,
        "26-35": 0,
        "36-45": 0,
        "46-55": 0,
        "56+": 0
      }

      trainings.forEach((training: any) => {
        const age = training.age
        if (!age) return
        
        if (age >= 18 && age <= 25) ageRanges["18-25"]++
        else if (age >= 26 && age <= 35) ageRanges["26-35"]++
        else if (age >= 36 && age <= 45) ageRanges["36-45"]++
        else if (age >= 46 && age <= 55) ageRanges["46-55"]++
        else if (age >= 56) ageRanges["56+"]++
      })

      const ageDist = Object.entries(ageRanges).map(([range, count]) => ({
        range,
        count
      }))

      setAgeDistributionData(ageDist)

      // Monthly comparison (2025 vs 2026) - filtered
      const currentYearData: Record<string, number> = {}
      const previousYearData: Record<string, number> = {}

      allTrainings.forEach((training: any) => {
        const createdDate = new Date(training.created_at)
        if (!isInDateRange(createdDate)) return
        
        const month = createdDate.toLocaleString("en-US", { month: "short" })
        const year = createdDate.getFullYear()
        
        if (year === 2026) {
          currentYearData[month] = (currentYearData[month] || 0) + 1
        } else if (year === 2025) {
          previousYearData[month] = (previousYearData[month] || 0) + 1
        }
      })

      const comparisonData = allMonths.map(month => ({
        month,
        currentYear: currentYearData[month] || 0,
        previousYear: previousYearData[month] || 0
      })).slice(-6)

      setMonthlyComparisonData(comparisonData)

      // Employment status distribution - filtered
      const employmentCounts = trainings.reduce((acc: any, training: any) => {
        const status = training.employment_status || "Unknown"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      const employmentDist = Object.entries(employmentCounts).map(([name, value]) => ({
        name,
        value
      }))

      setEmploymentStatusData(employmentDist)
    }

    fetchStats()
  }, [supabase, dateRange]) // Re-fetch when date range changes

  const renderChart = (type: string) => {
    const genderChartColors = [
      genderColors.chart1,
      genderColors.chart2,
      genderColors.chart3,
      genderColors.chart4,
      genderColors.chart5,
    ]

    switch (type) {
      case "enrollment":
        return <EnrollmentBrushChart data={enrollmentData} width={900} height={350} />
      case "revenue":
        return <RevenueChart data={revenueData} />
      case "coursePopularity":
        return <CoursePopularityChart data={coursePopularityData} />
      case "paymentStatus":
        return <PaymentStatusChart data={paymentStatusData} />
      case "ageDistribution":
        return <AgeDistributionChart data={ageDistributionData} />
      case "monthlyComparison":
        return <MonthlyComparisonChart data={monthlyComparisonData} />
      case "employmentStatus":
        return <EmploymentStatusChart data={employmentStatusData} />
      case "gender":
        return (
          <div className="h-[350px] w-full">
            <div className="flex items-center justify-center h-full">
              <ResponsiveContainer width={250} height={250}>
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props) => {
                      const { name, percent, cx, cy, midAngle, outerRadius } = props
                      const RADIAN = Math.PI / 180
                      const radius = outerRadius + 25
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill={genderColors.foreground} 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize={12}
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )
                    }}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {genderData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={genderChartColors[index % genderChartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: genderColors.popover,
                      border: `1px solid ${genderColors.border}`,
                      borderRadius: '8px',
                      color: genderColors.popoverForeground
                    }}
                    itemStyle={{ color: genderColors.popoverForeground }}
                  />
                  <Legend 
                    wrapperStyle={{ color: genderColors.foreground }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      default:
        return <div>No chart selected</div>
    }
  }

  const chartOptions = [
    { value: "enrollment", label: "Enrollment Trend" },
    { value: "revenue", label: "Revenue vs Target" },
    { value: "coursePopularity", label: "Course Popularity" },
    { value: "paymentStatus", label: "Payment Status" },
    { value: "ageDistribution", label: "Age Distribution" },
    { value: "monthlyComparison", label: "Year Comparison" },
    { value: "employmentStatus", label: "Employment Status" },
    { value: "gender", label: "Gender Distribution" },
  ]

  const getChartDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      enrollment: "Monthly enrollment statistics based on schedule dates",
      revenue: "Monthly revenue compared to expected targets",
      coursePopularity: "Top 5 most popular training courses",
      paymentStatus: "Distribution of payment statuses",
      ageDistribution: "Age range distribution of participants",
      monthlyComparison: "Enrollment comparison between 2025 and 2026",
      employmentStatus: "Employment status breakdown",
      gender: "Gender distribution of participants"
    }
    return descriptions[type] || ""
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back! Here's an overview of your training programs.</p>
        </div>
        
        {/* Date Filter */}
        <DateFilter 
          value={filterPreset}
          dateRange={dateRange}
          onChange={handleDateFilterChange}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-chart-4">{stat.change}</span> from last period
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Chart 1 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{chartOptions.find(opt => opt.value === chart1Type)?.label}</CardTitle>
              <CardDescription>{getChartDescription(chart1Type)}</CardDescription>
            </div>
            <Select value={chart1Type} onValueChange={setChart1Type}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {renderChart(chart1Type)}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Chart 2 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-base">{chartOptions.find(opt => opt.value === chart2Type)?.label}</CardTitle>
                <CardDescription className="text-xs">{getChartDescription(chart2Type)}</CardDescription>
              </div>
              <Select value={chart2Type} onValueChange={setChart2Type}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {renderChart(chart2Type)}
          </CardContent>
        </Card>

        {/* Chart 3 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-base">{chartOptions.find(opt => opt.value === chart3Type)?.label}</CardTitle>
                <CardDescription className="text-xs">{getChartDescription(chart3Type)}</CardDescription>
              </div>
              <Select value={chart3Type} onValueChange={setChart3Type}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {renderChart(chart3Type)}
          </CardContent>
        </Card>
      </div>
      {/* Recent Events */}
  <Card>
    <CardHeader>
      <CardTitle>Recent Training Events</CardTitle>
      <CardDescription>Latest scheduled training sessions</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {recentEvents.length > 0 ? (
          recentEvents.map((event, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium text-card-foreground">{event.course}</p>
                <p className="text-sm text-muted-foreground">{event.date}</p>
              </div>
              <div className="text-sm font-medium text-primary">
                {event.participants} participants
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No recent events found.</p>
        )}
      </div>
    </CardContent>
  </Card>
</div>

  )
}