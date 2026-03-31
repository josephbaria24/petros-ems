"use client"

import { Calendar } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  format,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
} from "date-fns"
import { useEffect, useState } from "react"

export type DateRange = {
  from: Date
  to: Date
}

export type FilterPreset = "today" | "yesterday" | "last7days" | "last30days" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisYear" | "custom"

interface DateFilterProps {
  value: FilterPreset
  dateRange: DateRange
  onChange: (preset: FilterPreset, range: DateRange) => void
}

export function DateFilter({ value, dateRange, onChange }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState<Date | undefined>(dateRange.from)
  const [customTo, setCustomTo] = useState<Date | undefined>(dateRange.to)

  useEffect(() => {
    if (value === "custom") {
      setCustomFrom(dateRange.from)
      setCustomTo(dateRange.to)
    }
  }, [value, dateRange.from, dateRange.to])

  const getPresetRange = (preset: FilterPreset): DateRange => {
    const today = new Date()
    
    switch (preset) {
      case "today":
        return { from: today, to: today }
      case "yesterday":
        return { from: subDays(today, 1), to: subDays(today, 1) }
      case "last7days":
        return { from: subDays(today, 7), to: today }
      case "last30days":
        return { from: subDays(today, 30), to: today }
      case "thisWeek":
        return { from: startOfWeek(today), to: endOfWeek(today) }
      case "lastWeek":
        const lastWeek = subWeeks(today, 1)
        return { from: startOfWeek(lastWeek), to: endOfWeek(lastWeek) }
      case "thisMonth":
        return { from: startOfMonth(today), to: endOfMonth(today) }
      case "lastMonth":
        const lastMonth = subMonths(today, 1)
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
      case "thisYear":
        return { from: startOfYear(today), to: endOfYear(today) }
      case "custom":
        return dateRange
      default:
        return { from: subDays(today, 30), to: today }
    }
  }

  const handlePresetChange = (preset: FilterPreset) => {
    if (preset === "custom") {
      // Must update parent to "custom" or the popover never mounts (it only renders when value === "custom")
      onChange("custom", { from: dateRange.from, to: dateRange.to })
      setCustomFrom(dateRange.from)
      setCustomTo(dateRange.to)
      setIsOpen(true)
      return
    }

    const range = getPresetRange(preset)
    onChange(preset, range)
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      let from = customFrom
      let to = customTo
      if (from > to) [from, to] = [to, from]
      onChange("custom", {
        from: startOfDay(from),
        to: endOfDay(to),
      })
      setIsOpen(false)
    }
  }

  const formatDateRange = () => {
    if (value === "custom") {
      return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
    }
    return value.replace(/([A-Z])/g, ' $1').trim()
  }

  return (
    <div className="flex gap-2 items-center shrink-0">
      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="last7days">Last 7 Days</SelectItem>
          <SelectItem value="last30days">Last 30 Days</SelectItem>
          <SelectItem value="thisWeek">This Week</SelectItem>
          <SelectItem value="lastWeek">Last Week</SelectItem>
          <SelectItem value="thisMonth">This Month</SelectItem>
          <SelectItem value="lastMonth">Last Month</SelectItem>
          <SelectItem value="thisYear">This Year</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 max-w-full">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">{formatDateRange()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[min(100vw-1rem,28rem)] p-0"
            align="end"
            side="bottom"
            sideOffset={8}
            alignOffset={0}
            collisionPadding={12}
            sticky="always"
            updatePositionStrategy="always"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="max-h-[min(85vh,42rem)] overflow-y-auto overscroll-contain p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <CalendarComponent
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  initialFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <CalendarComponent
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  disabled={(date) => customFrom ? date < customFrom : false}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}