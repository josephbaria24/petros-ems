import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, TrendingUp } from "lucide-react"

const stats = [
  {
    title: "Total Participants",
    value: "1,234",
    change: "+12.5%",
    icon: Users,
    color: "text-primary",
  },
  {
    title: "Active Courses",
    value: "48",
    change: "+3",
    icon: BookOpen,
    color: "text-secondary",
  },
  {
    title: "Scheduled Events",
    value: "156",
    change: "+8.2%",
    icon: Calendar,
    color: "text-chart-2",
  },
  {
    title: "Completion Rate",
    value: "87.5%",
    change: "+2.3%",
    icon: TrendingUp,
    color: "text-chart-4",
  },
]

export default function DashboardPage() {
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
              {[
                { course: "Advanced React", date: "Oct 18, 2025", participants: 24 },
                { course: "TypeScript Fundamentals", date: "Oct 20, 2025", participants: 18 },
                { course: "Next.js Workshop", date: "Oct 22, 2025", participants: 32 },
              ].map((event, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{event.course}</p>
                    <p className="text-sm text-muted-foreground">{event.date}</p>
                  </div>
                  <div className="text-sm font-medium text-primary">{event.participants} participants</div>
                </div>
              ))}
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
                { title: "React Certification Exam", due: "2 days", status: "urgent" },
                { title: "Project Submission - Web Dev", due: "5 days", status: "normal" },
                { title: "Feedback Forms", due: "1 week", status: "normal" },
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
