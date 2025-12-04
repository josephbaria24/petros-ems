"use client"

import React, { useRef, useState, useMemo, useEffect } from "react"
import { scaleTime, scaleLinear } from "@visx/scale"
import { Brush } from "@visx/brush"
import { PatternLines } from "@visx/pattern"
import { Group } from "@visx/group"
import { LinearGradient } from "@visx/gradient"
import { extent, max } from "d3-array"
import AreaChart from "./area-chart"
import BaseBrush from "@visx/brush/lib/BaseBrush"
import { Bounds } from "@visx/brush/lib/types"

type Enrollment = {
  date: string
  enrollments: number
}

export const accentColor = "#f6acc8"
export const background = "#141454"
export const background2 = "#5fc9cb"

const PATTERN_ID = "brush_pattern"
const GRADIENT_ID = "brush_gradient"
const brushMargin = { top: 10, bottom: 15, left: 50, right: 20 }
const chartSeparation = 30

const getDate = (d: Enrollment) => new Date(d.date)
const getValue = (d: Enrollment) => d.enrollments

export default function EnrollmentBrushChart({
  data = [],
  width = 900,
  height = 400,
}: {
  data: Enrollment[]
  width?: number
  height?: number
}) {
  const brushRef = useRef<BaseBrush | null>(null)

  const [filteredData, setFilteredData] = useState<Enrollment[]>(data)

  // keep filtered data in sync with incoming data
  useEffect(() => {
    setFilteredData(data)
    if (brushRef.current) brushRef.current.reset()
  }, [data])

  const hasData = data.length > 0

  // ✅ safe fallback domain if empty
  const safeDomain: [Date, Date] = useMemo(() => {
    if (hasData) {
      return extent(data, getDate) as [Date, Date]
    }
    const now = new Date()
    return [now, now]
  }, [hasData, data])

  const margin = { top: 20, left: 50, bottom: 20, right: 20 }
  const innerHeight = height - margin.top - margin.bottom
  const topChartBottomMargin = chartSeparation + 10
  const topChartHeight = 0.8 * innerHeight - topChartBottomMargin
  const bottomChartHeight = innerHeight - topChartHeight - chartSeparation

  const xMax = Math.max(width - margin.left - margin.right, 0)
  const yMax = Math.max(topChartHeight, 0)
  const xBrushMax = Math.max(width - brushMargin.left - brushMargin.right, 0)
  const yBrushMax = Math.max(bottomChartHeight - brushMargin.top - brushMargin.bottom, 0)

  const dateScale = useMemo(
    () =>
      scaleTime<number>({
        range: [0, xMax],
        domain: hasData
          ? (extent(filteredData, getDate) as [Date, Date])
          : safeDomain,
      }),
    [xMax, filteredData, hasData, safeDomain]
  )

  const valueScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: hasData ? [0, max(filteredData, getValue) || 0] : [0, 1],
        nice: true,
      }),
    [yMax, filteredData, hasData]
  )

  const brushDateScale = useMemo(
    () =>
      scaleTime<number>({
        range: [0, xBrushMax],
        domain: safeDomain,
      }),
    [xBrushMax, safeDomain]
  )

  const brushValueScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [yBrushMax, 0],
        domain: hasData ? [0, max(data, getValue) || 0] : [0, 1],
        nice: true,
      }),
    [yBrushMax, data, hasData]
  )

  const initialBrushPosition = useMemo(() => {
    if (!hasData) return null

    const startIndex = Math.max(0, Math.floor(data.length * 0.2))
    const endIndex = Math.max(startIndex + 1, Math.floor(data.length * 0.6))

    return {
      start: { x: brushDateScale(getDate(data[startIndex])) },
      end: { x: brushDateScale(getDate(data[endIndex])) },
    }
  }, [brushDateScale, data, hasData])

  const onBrushChange = (domain: Bounds | null) => {
    if (!domain || !hasData) return
    const { x0, x1, y0, y1 } = domain

    const filtered = data.filter((d) => {
      const x = getDate(d).getTime()
      const y = getValue(d)
      return x >= x0 && x <= x1 && y >= y0 && y <= y1
    })

    setFilteredData(filtered.length ? filtered : data)
  }

  return (
    <div className="w-full">
      {!hasData ? (
        <div className="h-[400px] w-full flex items-center justify-center text-sm text-muted-foreground">
          No enrollment data yet.
        </div>
      ) : (
        <svg width={width} height={height}>
         <rect
  x={0}
  y={0}
  width={width}
  height={height}
  fill="var(--card)"
  rx={14}
/>


          {/* Top Area Chart (filtered) */}
          <AreaChart
            data={filteredData}
            xScale={dateScale}
            yScale={valueScale}
            yMax={yMax}
            width={width}
            margin={{ ...margin, bottom: topChartBottomMargin }}
              fillColor="var(--chart-1)"
  strokeColor="var(--chart-1)"

          />

          {/* Bottom Brush Area Chart */}
          <AreaChart
            hideBottomAxis
            hideLeftAxis
            data={data}
            xScale={brushDateScale}
            yScale={brushValueScale}
            yMax={yBrushMax}
            width={width}
            margin={brushMargin}
            top={topChartHeight + topChartBottomMargin + margin.top}
              fillColor="var(--chart-1)"
  strokeColor="var(--chart-1)"

          >
            <PatternLines
              id={PATTERN_ID}
              height={8}
              width={8}
              stroke={accentColor}
              strokeWidth={1}
              orientation={["diagonal"]}
            />

            {initialBrushPosition && (
              <Brush
                xScale={brushDateScale}
                yScale={brushValueScale}
                width={xBrushMax}
                height={yBrushMax}
                margin={brushMargin}
                innerRef={brushRef}
                handleSize={8}
                initialBrushPosition={initialBrushPosition}
                onChange={onBrushChange}
                selectedBoxStyle={{
                  fill: `url(#${PATTERN_ID})`,
                  stroke: "#ffffff",
                }}
                brushDirection="horizontal"
                useWindowMoveEvents
                renderBrushHandle={({ x, height, isBrushActive }) =>
                  isBrushActive ? (
                    <Group left={x + 4} top={(height - 15) / 2}>
                      <path
                        fill="#f2f2f2"
                        d="M -4.5 0.5 L 3.5 0.5 L 3.5 15.5 L -4.5 15.5 L -4.5 0.5
                           M -1.5 4 L -1.5 12 M 0.5 4 L 0.5 12"
                        stroke="#999999"
                        strokeWidth="1"
                        style={{ cursor: "ew-resize" }}
                      />
                    </Group>
                  ) : null
                }
              />
            )}
          </AreaChart>
        </svg>
      )}
    </div>
  )
}
