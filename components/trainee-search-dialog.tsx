//components\trainee-search-dialog.tsx
"use client"

import { useState } from "react"
import { tmsDb } from "@/lib/supabase-client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type SearchResult = {
  training_id: string
  trainee_name: string
  course_name: string
  schedule_id: string
  schedule_date: string
  status: string
  tab: string
}

export function TraineeSearchDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

const handleSearch = async () => {
  if (!searchTerm.trim()) {
    toast.error("Please enter a search term")
    return
  }

  setLoading(true)
  try {
    const searchWords = searchTerm.trim().split(/\s+/)
    
    // ✅ Build OR conditions for each word to search both first and last name
    let query = tmsDb
      .from("trainings")
      .select(`
        id,
        first_name,
        last_name,
        status,
        schedule_id,
        schedules (
          id,
          status,
          course_id,
          schedule_type,
          schedule_ranges (start_date, end_date),
          schedule_dates (date),
          courses (name)
        )
      `)
    
    // ✅ Search for each word in either first_name OR last_name
    if (searchWords.length === 1) {
      // Single word - search in both first and last name
      query = query.or(`first_name.ilike.%${searchWords[0]}%,last_name.ilike.%${searchWords[0]}%`)
    } else {
      // Multiple words - more flexible matching
      // This will find results where ANY word matches first OR last name
      const orConditions = searchWords
        .map(word => `first_name.ilike.%${word}%,last_name.ilike.%${word}%`)
        .join(',')
      query = query.or(orConditions)
    }
    
    const { data: trainings, error } = await query
      .order('created_at', { ascending: false })
      .limit(100) // Fetch more for client-side refinement

    if (error) throw error

    // ✅ Client-side filtering for exact multi-word match
    const filtered = searchWords.length > 1 
      ? (trainings || []).filter((t: any) => {
          const fullName = `${t.first_name || ''} ${t.last_name || ''}`.toLowerCase()
          // All words must be present in the full name
          return searchWords.every(word => fullName.includes(word.toLowerCase()))
        })
      : trainings || []

    const formatted: SearchResult[] = filtered.slice(0, 50).map((t: any) => {
      const schedule = t.schedules
      let scheduleDate = "N/A"
      
      if (schedule?.schedule_type === "regular" && schedule.schedule_ranges?.length > 0) {
        const range = schedule.schedule_ranges[0]
        scheduleDate = `${new Date(range.start_date).toLocaleDateString()} - ${new Date(range.end_date).toLocaleDateString()}`
      } else if (schedule?.schedule_type === "staggered" && schedule.schedule_dates?.length > 0) {
        scheduleDate = schedule.schedule_dates
          .map((d: any) => new Date(d.date).toLocaleDateString())
          .join(", ")
      }

      const scheduleStatus = schedule?.status || "planned"
      const tab = scheduleStatus === "all" ? "all" : scheduleStatus

      return {
        training_id: t.id,
        trainee_name: `${t.first_name} ${t.last_name}`,
        course_name: schedule?.courses?.name || "Unknown",
        schedule_id: t.schedule_id,
        schedule_date: scheduleDate,
        status: t.status || "Pending",
        tab: tab
      }
    })

    setResults(formatted)
    
    if (formatted.length === 0) {
      toast.info("No trainees found")
    } else if (filtered.length > 50) {
      toast.info(`Found ${filtered.length} results, showing first 50`)
    }
  } catch (error) {
    console.error("Search error:", error)
    toast.error("Failed to search trainees")
  } finally {
    setLoading(false)
  }
}

  const handleGoToTrainee = (result: SearchResult) => {
    router.push(`/submissions?scheduleId=${result.schedule_id}&from=${result.tab}&highlight=${result.training_id}`)
    setOpen(false)
    setSearchTerm("")
    setResults([])
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Search className="h-4 w-4" />
        Search Trainee
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Trainee</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter trainee name (e.g., 'John Doe')..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                <p className="text-sm text-muted-foreground">
                  Found {results.length} result(s)
                </p>
                {results.map((result) => (
                  <div
                    key={result.training_id}
                    className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleGoToTrainee(result)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold">{result.trainee_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.course_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.schedule_date}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs">
                          {result.status}
                        </Badge>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}