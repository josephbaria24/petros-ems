import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, CheckCircle, Clock, XCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const submissions = [
  {
    id: 1,
    participant: "Alice Johnson",
    course: "Advanced React Development",
    submissionDate: "Oct 12, 2025",
    status: "Reviewed",
    score: 95,
    fileName: "react-project-final.zip",
  },
  {
    id: 2,
    participant: "Bob Smith",
    course: "TypeScript Fundamentals",
    submissionDate: "Oct 14, 2025",
    status: "Pending",
    score: null,
    fileName: "typescript-assignment.pdf",
  },
  {
    id: 3,
    participant: "Carol Williams",
    course: "Next.js Workshop",
    submissionDate: "Oct 10, 2025",
    status: "Reviewed",
    score: 88,
    fileName: "nextjs-app.zip",
  },
  {
    id: 4,
    participant: "David Brown",
    course: "Node.js Backend Development",
    submissionDate: "Oct 15, 2025",
    status: "Pending",
    score: null,
    fileName: "backend-api.zip",
  },
  {
    id: 5,
    participant: "Emma Davis",
    course: "Database Design",
    submissionDate: "Oct 8, 2025",
    status: "Reviewed",
    score: 92,
    fileName: "database-schema.sql",
  },
  {
    id: 6,
    participant: "Frank Miller",
    course: "Web Security Essentials",
    submissionDate: "Oct 13, 2025",
    status: "Rejected",
    score: 45,
    fileName: "security-audit.pdf",
  },
  {
    id: 7,
    participant: "Grace Lee",
    course: "UI/UX Design Principles",
    submissionDate: "Oct 11, 2025",
    status: "Reviewed",
    score: 97,
    fileName: "design-portfolio.pdf",
  },
  {
    id: 8,
    participant: "Henry Wilson",
    course: "Python for Data Science",
    submissionDate: "Oct 14, 2025",
    status: "Pending",
    score: null,
    fileName: "data-analysis.ipynb",
  },
]

const stats = [
  {
    title: "Total Submissions",
    value: "248",
    icon: FileText,
    color: "text-primary",
  },
  {
    title: "Pending Review",
    value: "42",
    icon: Clock,
    color: "text-secondary",
  },
  {
    title: "Reviewed",
    value: "198",
    icon: CheckCircle,
    color: "text-chart-4",
  },
  {
    title: "Rejected",
    value: "8",
    icon: XCircle,
    color: "text-destructive",
  },
]

export default function SubmissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Submissions</h1>
        <p className="text-muted-foreground mt-2">Review and manage participant submissions and assessments</p>
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
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>Latest participant submissions across all courses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium text-card-foreground">{submission.participant}</TableCell>
                    <TableCell className="text-card-foreground">{submission.course}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{submission.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-card-foreground">{submission.submissionDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          submission.status === "Reviewed"
                            ? "default"
                            : submission.status === "Pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {submission.score !== null ? (
                        <span
                          className={`font-medium ${
                            submission.score >= 90
                              ? "text-chart-4"
                              : submission.score >= 70
                                ? "text-primary"
                                : "text-destructive"
                          }`}
                        >
                          {submission.score}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
