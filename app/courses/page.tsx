import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Users, BookOpen, Calendar } from "lucide-react"

const courses = [
  {
    id: 1,
    title: "Advanced React Development",
    description: "Master advanced React patterns, hooks, and performance optimization techniques.",
    duration: "40 hours",
    participants: 124,
    level: "Advanced",
    category: "Frontend",
    nextSession: "Oct 25, 2025",
    status: "Active",
  },
  {
    id: 2,
    title: "TypeScript Fundamentals",
    description: "Learn TypeScript from basics to advanced type systems and generics.",
    duration: "32 hours",
    participants: 98,
    level: "Intermediate",
    category: "Programming",
    nextSession: "Nov 1, 2025",
    status: "Active",
  },
  {
    id: 3,
    title: "Next.js Workshop",
    description: "Build full-stack applications with Next.js 15, App Router, and Server Components.",
    duration: "48 hours",
    participants: 156,
    level: "Intermediate",
    category: "Full-stack",
    nextSession: "Nov 10, 2025",
    status: "Active",
  },
  {
    id: 4,
    title: "Node.js Backend Development",
    description: "Create scalable backend services with Node.js, Express, and modern APIs.",
    duration: "56 hours",
    participants: 87,
    level: "Intermediate",
    category: "Backend",
    nextSession: "Oct 20, 2025",
    status: "Active",
  },
  {
    id: 5,
    title: "Database Design",
    description: "Master SQL, NoSQL databases, and data modeling best practices.",
    duration: "36 hours",
    participants: 72,
    level: "Intermediate",
    category: "Database",
    nextSession: "Oct 22, 2025",
    status: "Active",
  },
  {
    id: 6,
    title: "Python for Data Science",
    description: "Learn Python programming for data analysis, visualization, and machine learning.",
    duration: "60 hours",
    participants: 143,
    level: "Beginner",
    category: "Data Science",
    nextSession: "Nov 5, 2025",
    status: "Active",
  },
  {
    id: 7,
    title: "Web Security Essentials",
    description: "Understand web security threats and implement secure coding practices.",
    duration: "28 hours",
    participants: 65,
    level: "Advanced",
    category: "Security",
    nextSession: "Nov 12, 2025",
    status: "Active",
  },
  {
    id: 8,
    title: "UI/UX Design Principles",
    description: "Create beautiful and user-friendly interfaces with modern design principles.",
    duration: "44 hours",
    participants: 91,
    level: "Beginner",
    category: "Design",
    nextSession: "Oct 28, 2025",
    status: "Active",
  },
]

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Courses</h1>
        <p className="text-muted-foreground mt-2">Browse and manage all available training courses</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge variant="outline" className="bg-muted">
                  {course.category}
                </Badge>
                <Badge
                  variant={
                    course.level === "Beginner"
                      ? "secondary"
                      : course.level === "Intermediate"
                        ? "default"
                        : "destructive"
                  }
                >
                  {course.level}
                </Badge>
              </div>
              <CardTitle className="text-lg text-balance">{course.title}</CardTitle>
              <CardDescription className="text-pretty">{course.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{course.participants} participants</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Next: {course.nextSession}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button className="flex-1" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                View Details
              </Button>
              <Button variant="outline" size="sm">
                Enroll
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
