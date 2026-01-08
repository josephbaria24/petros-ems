"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useEffect, useState } from "react"

interface AgeDistributionChartProps {
  data: any[]
}

export function AgeDistributionChart({ data }: AgeDistributionChartProps) {
  const [colors, setColors] = useState({
    chart3: '#a05bf9',
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
        chart3: getVar('--chart-3') || '#a05bf9',
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis 
            dataKey="range" 
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
          <Bar dataKey="count" fill={colors.chart3} radius={[8, 8, 0, 0]} name="Participants" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}