"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts"
import { useEffect, useState } from "react"

interface RevenueChartProps {
  data: any[]
}

export function RevenueChart({ data }: RevenueChartProps) {
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

    // Listen for theme changes
    const observer = new MutationObserver(updateColors)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis 
            dataKey="month" 
            tick={{ fill: colors.foreground }}
            stroke={colors.border}
          />
          <YAxis 
            tick={{ fill: colors.foreground }}
            stroke={colors.border}
            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
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
          <Bar dataKey="revenue" fill={colors.chart1} radius={[8, 8, 0, 0]} name="Revenue" />
          <Bar dataKey="target" fill={colors.chart2} radius={[8, 8, 0, 0]} name="Target" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}