"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BookOpen, CalendarDays, FileText, Loader2, Search, User, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { tmsDb } from "@/lib/supabase-client"
import { cn } from "@/lib/utils"
import {
  groupSearchResults,
  searchStaticPages,
  type GlobalSearchItem,
} from "@/lib/global-search"

function CategoryIcon({ category }: { category: GlobalSearchItem["category"] }) {
  switch (category) {
    case "Courses":
      return <BookOpen className="h-4 w-4 shrink-0 text-[#1A1D66]" />
    case "Schedules":
      return <CalendarDays className="h-4 w-4 shrink-0 text-[#1A1D66]" />
    case "Trainees":
      return <User className="h-4 w-4 shrink-0 text-[#1A1D66]" />
    default:
      return <FileText className="h-4 w-4 shrink-0 text-[#1A1D66]" />
  }
}

export function GlobalSearch() {
  const router = useRouter()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [liveItems, setLiveItems] = React.useState<GlobalSearchItem[]>([])
  const [searchingLive, setSearchingLive] = React.useState(false)

  const pageItems = React.useMemo(() => searchStaticPages(query, 8), [query])

  const results = React.useMemo(() => {
    const merged = [...pageItems, ...liveItems]
    const seen = new Set<string>()
    return merged.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [pageItems, liveItems])

  const groups = React.useMemo(() => groupSearchResults(results), [results])
  const flat = React.useMemo(() => groups.flatMap((g) => g.items), [groups])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query, results.length])

  React.useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setLiveItems([])
      setSearchingLive(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearchingLive(true)
      try {
        const safe = q.replace(/[%_,.()]/g, " ").trim()
        if (!safe) {
          setLiveItems([])
          setSearchingLive(false)
          return
        }
        const like = `%${safe}%`
        const [coursesRes, schedulesRes, traineesRes] = await Promise.all([
          tmsDb
            .from("courses")
            .select("id, name, title")
            .or(`name.ilike.${like},title.ilike.${like}`)
            .limit(5),
          tmsDb
            .from("schedules")
            .select("id, status, branch, courses(name)")
            .order("created_at", { ascending: false })
            .limit(40),
          tmsDb
            .from("trainings")
            .select("id, first_name, last_name, schedule_id, company_name")
            .or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like}`)
            .limit(6),
        ])

        if (cancelled) return

        const courseItems: GlobalSearchItem[] = (coursesRes.data || []).map((c) => ({
          id: `course-${c.id}`,
          title: c.name || "Course",
          description: c.title || "Open in Courses",
          href: "/courses",
          category: "Courses",
          keywords: [],
        }))

        const qLower = q.toLowerCase()
        const scheduleItems: GlobalSearchItem[] = (schedulesRes.data || [])
          .map((s) => {
            const course = Array.isArray(s.courses) ? s.courses[0] : s.courses
            const name = (course as { name?: string } | null)?.name || "Schedule"
            return {
              id: `schedule-${s.id}`,
              title: name,
              description: `${s.status || "schedule"}${s.branch ? ` · ${s.branch}` : ""}`,
              href: `/training-schedules?tab=all&openDirectory=${encodeURIComponent(s.id)}`,
              category: "Schedules" as const,
              keywords: [name, s.status || "", s.branch || ""],
              _match: `${name} ${s.status || ""} ${s.branch || ""}`.toLowerCase(),
            }
          })
          .filter((s) => s._match.includes(qLower))
          .slice(0, 5)
          .map(({ _match, ...rest }) => rest)

        const traineeItems: GlobalSearchItem[] = (traineesRes.data || []).map((t) => {
          const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Trainee"
          const href = t.schedule_id
            ? `/submissions?scheduleId=${encodeURIComponent(t.schedule_id)}&highlight=${encodeURIComponent(t.id)}&from=all`
            : "/directory-of-trainees"
          return {
            id: `trainee-${t.id}`,
            title: name,
            description: t.company_name || "Open submission / directory",
            href,
            category: "Trainees" as const,
            keywords: [],
          }
        })

        setLiveItems([...courseItems, ...scheduleItems, ...traineeItems])
      } catch (err) {
        console.error("Global search failed:", err)
        if (!cancelled) setLiveItems([])
      } finally {
        if (!cancelled) setSearchingLive(false)
      }
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  React.useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const goTo = (item: GlobalSearchItem) => {
    setOpen(false)
    setQuery("")
    router.push(item.href)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true)
      return
    }
    if (e.key === "Escape") {
      setOpen(false)
      return
    }
    if (!flat.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % flat.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = flat[activeIndex]
      if (item) goTo(item)
    }
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={rootRef} className="relative mx-2 min-w-0 flex-1 max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1A1D66]/55" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search pages, courses, schedules, trainees…"
          className="h-10 border-0 bg-white/95 pl-9 pr-16 text-sm text-[#1A1D66] shadow-sm placeholder:text-[#1A1D66]/45 focus-visible:ring-2 focus-visible:ring-[#FFCC00]"
          aria-label="Global search"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <button
              type="button"
              className="rounded p-1 text-[#1A1D66]/60 hover:bg-[#1A1D66]/10 hover:text-[#1A1D66]"
              onClick={() => {
                setQuery("")
                setLiveItems([])
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-[#1A1D66]/20 bg-[#1A1D66]/5 px-1.5 py-0.5 text-[10px] font-medium text-[#1A1D66]/70 sm:inline">
              Ctrl K
            </kbd>
          )}
        </div>
      </div>

      {showPanel ? (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[90] overflow-hidden rounded-xl border border-[#FFCC00]/50 bg-white shadow-xl shadow-black/20 dark:bg-card"
        >
          <div className="max-h-[min(24rem,70vh)] overflow-y-auto py-1">
            {searchingLive ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching records…
              </div>
            ) : null}

            {!flat.length && !searchingLive ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matches for “{query.trim()}”
              </div>
            ) : null}

            {groups.map((group) => (
              <div key={group.category} className="py-1">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1A1D66]/55">
                  {group.category}
                </div>
                {group.items.map((item) => {
                  const index = flat.findIndex((f) => f.id === item.id)
                  const active = index === activeIndex
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-[#FFCC00]/25" : "hover:bg-[#1A1D66]/5"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(item)}
                    >
                      <CategoryIcon category={item.category} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#1A1D66] dark:text-foreground">
                          {item.title}
                        </span>
                        {item.description ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{item.category}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
