"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"

interface Calendar03Props {
  value: Date[]
  onChange: (dates: Date[]) => void
}

export function Calendar03({ value, onChange }: Calendar03Props) {
  return (
    <Calendar
      mode="multiple"
      numberOfMonths={2}
      defaultMonth={value[0]}
      required
      selected={value}
      onSelect={onChange}
      max={10}
      className="rounded-lg border shadow-sm"
    />
  )
}
