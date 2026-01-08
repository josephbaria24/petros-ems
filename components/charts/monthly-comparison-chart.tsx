"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"
import { useEffect, useState } from "react"

interface MonthlyComparisonChartProps {
  data: any[]
}

export function MonthlyComparisonChart({ data }: MonthlyComparisonChartProps) {
  const [colors, setColors] = useState({
    chart1: '#4462d8',
    chart2: '#5fc9cb',
    foreground: '#141454',
    border: '#e6e6f2',
    popover: '#ffffff',
    popoverForeground: '#3b3b46',
  })

  useEffect(() => {
    const root = document.documentElement
    const styles = getComputedStyle(root)
    
    const getVar = (variable: string) => {
      return styles.getPropertyValue(variable).trim() || null
    }

    const updateColors = () => {
      setColors({
        chart1: getVar('--chart-1') || '#4462d8',
        chart2: getVar('--chart-2') || '#5fc9cb',
        foreground: getVar('--foreground') || '#141454',
        border: getVar('--border') || '#e6e6f2',
        popover: getVar('--popover') || '#ffffff',
        popoverForeground: getVar('--popover-foreground') || '#3b3b46',
      })
    }

    updateColors()

    const observer = new MutationObserver(updateColors)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis 
            dataKey="month" 
            tick={{ fill: colors.foreground }}
            stroke={colors.border}
          />
          <YAxis 
            tick={{ fill: colors.foreground }}
            stroke={colors.border}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: colors.popover,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.popoverForeground
            }}
            labelStyle={{ color: colors.popoverForeground }}
            itemStyle={{ color: colors.popoverForeground }}
          />
          <Legend 
            wrapperStyle={{ color: colors.foreground }}
          />
          <Line 
            type="monotone" 
            dataKey="currentYear" 
            stroke={colors.chart1}
            strokeWidth={2}
            name="2026"
            dot={{ r: 4, fill: colors.chart1 }}
          />
          <Line 
            type="monotone" 
            dataKey="previousYear" 
            stroke={colors.chart2}
            strokeWidth={2}
            name="2025"
            dot={{ r: 4, fill: colors.chart2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}