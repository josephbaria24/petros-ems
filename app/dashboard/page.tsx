"use client"

import { useEffect, useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, TrendingUp } from "lucide-react"

export default function DashboardPage() {
  const supabase = createClientComponentClient()

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
  
  useEffect(() => {
    const fetchStats = async () => {
      const [trainingsRes, coursesRes, schedulesRes] = await Promise.all([
        supabase.from("trainings").select("*"),
        supabase.from("courses").select("*"),
        supabase.from("schedules").select(`
          id,
          created_at,
          course_id,
          courses ( name )
        `).order("created_at", { ascending: false }).limit(3),
      ])

      const participants = trainingsRes.data?.length || 0
      const courses = coursesRes.data?.length || 0
      const events = schedulesRes.data || []

      setStats([
        { title: "Total Participants", value: participants.toString(), change: "+12.5%", icon: Users, color: "text-primary" },
        { title: "Active Courses", value: courses.toString(), change: "+3", icon: BookOpen, color: "text-secondary" },
        { title: "Scheduled Events", value: events.length.toString(), change: "+8.2%", icon: Calendar, color: "text-chart-2" },
        { title: "Completion Rate", value: "87.5%", change: "+2.3%", icon: TrendingUp, color: "text-chart-4" },
      ])

      const formattedEvents = events.map((event: any) => ({
        course: event.courses?.name || "Unnamed Course",
        date: new Date(event.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        participants: Math.floor(Math.random() * 30) + 10, // Placeholder until you link training counts
      }))

      setRecentEvents(formattedEvents)
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

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Submissions and assessments due soon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { title: "First Aid Final Exam", due: "2 days", status: "urgent" },
                { title: "Webinar Feedback Form", due: "5 days", status: "normal" },
                { title: "Training Materials Upload", due: "1 week", status: "normal" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">Due in {item.due}</p>
                  </div>
                  <div
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      item.status === "urgent"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary/10 text-secondary-foreground"
                    }`}
                  >
                    {item.status === "urgent" ? "Urgent" : "Pending"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
