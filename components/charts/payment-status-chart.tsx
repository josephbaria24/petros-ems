"use client"

import { Pie, PieChart, ResponsiveContainer, Cell, Legend, Tooltip } from "recharts"
import { useEffect, useState } from "react"

interface PaymentStatusChartProps {
  data: any[]
}

export function PaymentStatusChart({ data }: PaymentStatusChartProps) {
  const [colors, setColors] = useState({
    chart1: '#4462d8',
    chart2: '#5fc9cb',
    chart3: '#a05bf9',
    chart4: '#c8db3c',
    chart5: '#d4438b',
    foreground: '#141454',
    popover: '#ffffff',
    popoverForeground: '#3b3b46',
    border: '#e6e6f2',
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
        popover: getVar('--popover') || '#ffffff',
        popoverForeground: getVar('--popover-foreground') || '#3b3b46',
        border: getVar('--border') || '#e6e6f2',
      })
    }

    updateColors()

    const observer = new MutationObserver(updateColors)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  const COLORS = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5]

  const renderLabel = (entry: any) => {
    return {
      fill: colors.foreground,
      fontSize: 12,
    }
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(props) => {
              const { name, percent, cx, cy, midAngle, outerRadius } = props
              const RADIAN = Math.PI / 180
              const radius = outerRadius + 25
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)
              
              return (
                <text 
                  x={x} 
                  y={y} 
                  fill={colors.foreground} 
                  textAnchor={x > cx ? 'start' : 'end'} 
                  dominantBaseline="central"
                  fontSize={12}
                >
                  {`${name} (${(percent * 100).toFixed(0)}%)`}
                </text>
              )
            }}
            outerRadius={100}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: colors.popover,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.popoverForeground
            }}
            itemStyle={{ color: colors.popoverForeground }}
          />
          <Legend 
            wrapperStyle={{ color: colors.foreground }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}