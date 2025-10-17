"use client"

import * as React from "react"
import { type DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"

interface Calendar05Props {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}

export function Calendar05({ value, onChange }: Calendar05Props) {
  return (
    <Calendar
      mode="range"
      defaultMonth={value?.from}
      selected={value}
      onSelect={onChange}
      numberOfMonths={2}
      className="rounded-lg border shadow-sm"
    />
  )
}
