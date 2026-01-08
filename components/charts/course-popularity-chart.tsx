"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"
import { useEffect, useState } from "react"

interface CoursePopularityChartProps {
  data: any[]
}

export function CoursePopularityChart({ data }: CoursePopularityChartProps) {
  const [colors, setColors] = useState({
    chart1: '#4462d8',
    chart2: '#5fc9cb',
    chart3: '#a05bf9',
    chart4: '#c8db3c',
    chart5: '#d4438b',
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
        chart3: getVar('--chart-3') || '#a05bf9',
        chart4: getVar('--chart-4') || '#c8db3c',
        chart5: getVar('--chart-5') || '#d4438b',
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

  const COLORS = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5]

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis 
            type="number"
            tick={{ fill: colors.foreground }}
            stroke={colors.border}
          />
          <YAxis 
            type="category"
            dataKey="name" 
            width={150}
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
          <Bar dataKey="value" name="Participants" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}