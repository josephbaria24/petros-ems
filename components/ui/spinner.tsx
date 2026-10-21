"use client"

import { HashLoader } from "react-spinners"
import { cn } from "@/lib/utils"

/** Petrosphere brand colors for HashLoader. */
export const SPINNER_COLOR_BLUE = "#1A1D66"
export const SPINNER_COLOR_YELLOW = "#FFCC00"
/** @deprecated Prefer the dual brand spinner; kept for call sites that pass `color`. */
export const SPINNER_COLOR = SPINNER_COLOR_YELLOW

type SpinnerProps = {
  className?: string
  /** Pixel size passed to HashLoader (default 24). */
  size?: number
  /** Optional single-color override (disables dual yellow/blue). */
  color?: string
  loading?: boolean
  "aria-label"?: string
}

function Spinner({
  className,
  size = 24,
  color,
  loading = true,
  "aria-label": ariaLabel = "Loading",
}: SpinnerProps) {
  if (!loading) return null

  // Single-color override when callers pass `color`
  if (color) {
    return (
      <span
        role="status"
        aria-label={ariaLabel}
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
      >
        <HashLoader color={color} size={size} loading />
      </span>
    )
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <HashLoader color={SPINNER_COLOR_BLUE} size={size} loading />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <HashLoader color={SPINNER_COLOR_YELLOW} size={size} loading speedMultiplier={0.9} />
      </span>
    </span>
  )
}

export { Spinner }
