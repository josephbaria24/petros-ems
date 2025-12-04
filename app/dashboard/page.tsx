"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, TrendingUp } from "lucide-react"
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Tooltip } from "recharts"
import EnrollmentBrushChart from "@/components/charts/enrollment-brush-chart"

export default function DashboardPage() {
  const supabase = createClient()

  const [stats, setStats] = useState([
    { title: "Total Participants", value: "—", change: "", icon: Users, color: "text-primary" },
    { title: "Active Courses", value: "—", change: "", icon: BookOpen, color: "text-secondary" },
    { title: "Scheduled Events", value: "—", change: "", icon: Calendar, color: "text-chart-2" },
    { title: "Completion Rate", value: "—", change: "", icon: TrendingUp, color: "text-chart-4" },
  ])

  type RecentEvent = {
    course: string
    date: string
    participants: number
  }
  
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [enrollmentData, setEnrollmentData] = useState<any[]>([])
  const [courseDistribution, setCourseDistribution] = useState<any[]>([])
  const [genderData, setGenderData] = useState<any[]>([])
  
  useEffect(() => {
    const fetchStats = async () => {
      const [trainingsRes, coursesRes, schedulesRes, scheduleDatesRes, scheduleRangesRes] = await Promise.all([
        supabase.from("trainings").select("*, courses(name), schedules(*)"),
        supabase.from("courses").select("*"),
        supabase.from("schedules").select(`
          id,
          created_at,
          course_id,
          courses ( name )
        `).order("created_at", { ascending: false }).limit(3),
        supabase.from("schedule_dates").select("*, schedules(*)"),
        supabase.from("schedule_ranges").select("*, schedules(*)"),
      ])

      const participants = trainingsRes.data?.length || 0
      const courses = coursesRes.data?.length || 0
      const events = schedulesRes.data || []
      const trainings = trainingsRes.data || []
      const scheduleDates = scheduleDatesRes.data || []
      const scheduleRanges = scheduleRangesRes.data || []

      setStats([
        { title: "Total Participants", value: participants.toString(), change: "+12.5%", icon: Users, color: "text-primary" },
        { title: "Active Courses", value: courses.toString(), change: "+3", icon: BookOpen, color: "text-secondary" },
        { title: "Scheduled Events", value: events.length.toString(), change: "+8.2%", icon: Calendar, color: "text-chart-2" },
        { title: "Completion Rate", value: "0%", change: "+2.3%", icon: TrendingUp, color: "text-chart-4" },
      ])

      const formattedEvents = events.map((event: any) => ({
        course: event.courses?.name || "Unnamed Course",
        date: new Date(event.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        participants: Math.floor(Math.random() * 30) + 10,
      }))

      setRecentEvents(formattedEvents)
      
      const allMonths = Array.from({ length: 12 }, (_, i) =>
        new Date(0, i).toLocaleString("en-US", { month: "short" })
      )

      // Step 2: Count enrollments per month based on schedule dates
      const monthlyEnrollments: Record<string, number> = {}
      
      // Process trainings with schedule dates
      trainings.forEach((training: any) => {
        const scheduleId = training.schedule_id
        
        // Find matching schedule dates
        const matchingDates = scheduleDates.filter((sd: any) => sd.schedule_id === scheduleId)
        if (matchingDates.length > 0) {
          // Use the first date from schedule_dates
          const month = new Date(matchingDates[0].date).toLocaleString("en-US", { month: "short" })
          monthlyEnrollments[month] = (monthlyEnrollments[month] || 0) + 1
        } else {
          // Check schedule ranges
          const matchingRange = scheduleRanges.find((sr: any) => sr.schedule_id === scheduleId)
          if (matchingRange) {
            // Use start_date from schedule_ranges
            const month = new Date(matchingRange.start_date).toLocaleString("en-US", { month: "short" })
            monthlyEnrollments[month] = (monthlyEnrollments[month] || 0) + 1
          }
        }
      })

      // Step 3: Format trend with 0s filled in
      const enrollmentTrend = allMonths.map((month) => {
        const date = new Date(`1 ${month} ${new Date().getFullYear()}`)
        return {
          date: date.toISOString(),
          enrollments: monthlyEnrollments[month] || 0
        }
      })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-6)

      // Step 4 (optional): limit to current or past months
      const now = new Date()
      const filteredTrend = enrollmentTrend.filter(d => new Date(d.date) <= now)

      setEnrollmentData(filteredTrend)

      // Course distribution
      const courseCounts = trainings.reduce((acc: any, training: any) => {
        const courseName = training.courses?.name || "Other"
        acc[courseName] = (acc[courseName] || 0) + 1
        return acc
      }, {})

      const distribution = Object.entries(courseCounts).map(([name, value]) => ({
        name,
        value
      })).slice(0, 5)

      setCourseDistribution(distribution)

      // Gender distribution
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
    }

    fetchStats()
  }, [supabase]) 
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back! Here's an overview of your training programs.</p>
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
                  <span className="text-chart-4">{stat.change}</span> from last month
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Enrollment Trend Chart */}
        <Card className="col-span-1 md:col-span-3">
          <CardHeader>
            <CardTitle>Enrollment Trend</CardTitle>
            <CardDescription>Monthly enrollment statistics based on schedule dates</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <EnrollmentBrushChart data={enrollmentData} width={900} height={400} />
          </CardContent>
        </Card>
      </div>

      {/* Course Distribution & Recent Events */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gender Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
            <CardDescription>Participant demographics</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ value: { label: "Participants" } }}
              className="h-[300px]"
            >
              <div className="flex items-center justify-center h-full">
                <ResponsiveContainer width={250} height={250}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      dataKey="value"
                    >
                      {genderData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`var(--chart-${(index % 5) + 1})`}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartContainer>
          </CardContent>
        </Card>

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
    </div>
  )
}