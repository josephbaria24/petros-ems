"use client"

import type { CSSProperties } from "react"
import type { PieLabelRenderProps } from "recharts"

/**
 * Theme tokens in globals use hex values — use `var(--foreground)` / `var(--card)`, not `hsl(var(...))`,
 * or SVG fill can resolve incorrectly (e.g. black in dark mode).
 */
const outlinedTextStyle: CSSProperties = {
  fill: "var(--foreground)",
  stroke: "var(--card)",
  strokeWidth: 2.5,
  paintOrder: "stroke fill",
  strokeLinejoin: "round",
}

export type OutlinedLabelListOptions = {
  formatter?: (v: number | string) => string
  fontSize?: number
  /** Extra horizontal shift (e.g. separate grouped bar labels) */
  dx?: number | ((index: number) => number)
  /** Extra vertical shift (e.g. separate dual series) */
  dy?: number | ((index: number) => number)
  /** Hide label when this returns true (overlap / clutter control) */
  filter?: (value: string | number | undefined, index: number) => boolean
}

function resolveDxDy(
  index: number,
  v: number | ((i: number) => number) | undefined
): number {
  if (v === undefined) return 0
  return typeof v === "function" ? v(index) : v
}

/**
 * Use as: <LabelList content={outlinedLabelListContent({ formatter: ... })} />
 * Return type is intentionally loose — Recharts’ LabelList `content` prop is overly narrow.
 */
export function outlinedLabelListContent(opts: OutlinedLabelListOptions = {}): any {
  const { formatter, fontSize = 10, dx = 0, dy = 0, filter } = opts

  function OutlinedCartesianLabel(props: Record<string, unknown>) {
    const idx = Number(props.index ?? 0)
    const raw = props.value
    let text: string
    if (formatter && raw !== undefined && raw !== null && raw !== "") {
      text = formatter(raw as number | string)
    } else if (props.children != null && props.children !== "") {
      text = String(props.children)
    } else if (raw !== undefined && raw !== null) {
      text = String(raw)
    } else {
      text = ""
    }
    if (text === "") return null
    if (filter && !filter(raw as string | number | undefined, idx)) return null

    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const ta = props.textAnchor
    const anchor =
      ta === "start" || ta === "end" || ta === "middle"
        ? ta
        : "middle"

    return (
      <text
        x={x}
        y={y}
        dx={resolveDxDy(idx, dx)}
        dy={resolveDxDy(idx, dy)}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={600}
        style={outlinedTextStyle}
      >
        {text}
      </text>
    )
  }

  return OutlinedCartesianLabel
}

export const fmtRevenueK = (v: number | string) => `₱${(Number(v) / 1000).toFixed(0)}k`

/** Grouped revenue + target: separate vertically on the same month to reduce overlap */
export const revenueBarLabelContent = outlinedLabelListContent({
  dy: -3,
  fontSize: 10,
  formatter: fmtRevenueK,
})
export const targetBarLabelContent = outlinedLabelListContent({
  dy: 4,
  fontSize: 10,
  formatter: fmtRevenueK,
})

/** YoY: horizontal stagger so two series at the same month don’t sit on top of each other */
export const yearCurrentLabelContent = outlinedLabelListContent({
  fontSize: 9,
  dx: -4,
  dy: -2,
})
export const yearPreviousLabelContent = outlinedLabelListContent({
  fontSize: 9,
  dx: 4,
  dy: 2,
})

/** Horizontal bars (course, participants, company): value at end of bar */
export const horizontalBarLabelContent = outlinedLabelListContent({ fontSize: 10 })
export const horizontalRevenueBarLabelContent = outlinedLabelListContent({
  fontSize: 9,
  formatter: fmtRevenueK,
})

/** Vertical column charts (age, etc.) */
export const columnBarLabelContent = outlinedLabelListContent({ fontSize: 10 })

/** Enrollment / line points: show all non-empty; halo for contrast on area fill */
export const enrollmentLineLabelContent = outlinedLabelListContent({
  fontSize: 11,
  formatter: (v) => {
    const n = Number(v)
    return n === 0 ? "" : String(n)
  },
})

/** Pie slices: hide labels on very small slices; outlined text; optional outer line */
export function PieOutlinedLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0)
  const cy = Number(props.cy ?? 0)
  const midAngle = Number(props.midAngle ?? 0)
  const innerR = Number(props.innerRadius ?? 0)
  const outerR = Number(props.outerRadius ?? 0)
  const percent = Number(props.percent ?? 0)
  const value = props.value
  if (percent < 0.04) return null

  const RADIAN = Math.PI / 180
  const radius = innerR + (outerR - innerR) * 0.52
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const ta = x > cx ? "start" : x < cx ? "end" : "middle"

  return (
    <text
      x={x}
      y={y}
      textAnchor={ta}
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
      style={outlinedTextStyle}
    >
      {`${value ?? 0} (${(percent * 100).toFixed(0)}%)`}
    </text>
  )
}
