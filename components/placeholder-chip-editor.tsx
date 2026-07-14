"use client"

import { useMemo, useRef } from "react"
import { cn } from "@/lib/utils"

export type PlaceholderOption = {
  value: string
  label: string
  description: string
}

type Token =
  | { type: "text"; value: string }
  | { type: "placeholder"; value: string; label: string }

function labelForPlaceholder(value: string, options: PlaceholderOption[]) {
  const match = options.find((option) => option.value === value)
  if (match) return match.label
  return value.replace(/\{\{|\}\}/g, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function tokenize(value: string, options: PlaceholderOption[]): Token[] {
  if (!value) return [{ type: "text", value: "" }]

  const parts = value.split(/(\{\{[a-z0-9_]+\}\})/gi)
  const tokens: Token[] = []

  for (const part of parts) {
    if (!part) continue
    if (/^\{\{[a-z0-9_]+\}\}$/i.test(part)) {
      tokens.push({
        type: "placeholder",
        value: part,
        label: labelForPlaceholder(part, options),
      })
    } else {
      tokens.push({ type: "text", value: part })
    }
  }

  // Always keep a trailing text token so users can keep typing after a chip
  if (tokens.length === 0 || tokens[tokens.length - 1].type === "placeholder") {
    tokens.push({ type: "text", value: "" })
  }

  return tokens
}

function detokenize(tokens: Token[]) {
  return tokens.map((token) => token.value).join("")
}

function friendlyPreview(value: string, options: PlaceholderOption[]) {
  if (!value) return "Empty"
  let result = value
  for (const option of options) {
    result = result.split(option.value).join(option.label)
  }
  // Fallback for unknown placeholders
  result = result.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
  )
  return result
}

type PlaceholderChipEditorProps = {
  value: string
  options: PlaceholderOption[]
  onChange: (value: string) => void
  className?: string
}

export function PlaceholderChipEditor({
  value,
  options,
  onChange,
  className,
}: PlaceholderChipEditorProps) {
  const tokens = useMemo(() => tokenize(value, options), [value, options])
  const endInputRef = useRef<HTMLTextAreaElement>(null)

  const commitTokens = (next: Token[]) => {
    onChange(detokenize(next))
  }

  const updateTextAt = (index: number, nextText: string) => {
    const next = tokens.map((token, i) =>
      i === index && token.type === "text" ? { ...token, value: nextText } : token
    )
    commitTokens(next)
  }

  const removePlaceholderAt = (index: number) => {
    const next = [...tokens]
    next.splice(index, 1)

    const merged: Token[] = []
    for (const token of next) {
      const last = merged[merged.length - 1]
      if (token.type === "text" && last?.type === "text") {
        last.value += token.value
      } else {
        merged.push({ ...token })
      }
    }

    if (merged.length === 0 || merged[merged.length - 1].type === "placeholder") {
      merged.push({ type: "text", value: "" })
    }

    commitTokens(merged)
  }

  return (
    <div
      className={cn(
        "min-h-[120px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm",
        "flex flex-wrap items-start gap-1.5 content-start focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
        className
      )}
      onClick={() => endInputRef.current?.focus()}
    >
      {tokens.map((token, index) => {
        if (token.type === "placeholder") {
          return (
            <span
              key={`${token.value}-${index}`}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              {token.label}
              <button
                type="button"
                className="rounded-sm p-0.5 opacity-70 hover:bg-blue-100 hover:opacity-100 dark:hover:bg-blue-900"
                onClick={() => removePlaceholderAt(index)}
                aria-label={`Remove ${token.label}`}
              >
                <XIcon />
              </button>
            </span>
          )
        }

        const isLast = index === tokens.length - 1
        const lineCount = Math.max(1, token.value.split("\n").length)

        return (
          <textarea
            key={`text-${index}`}
            ref={isLast ? endInputRef : undefined}
            value={token.value}
            rows={lineCount}
            onChange={(e) => updateTextAt(index, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && token.value === "" && index > 0) {
                const prev = tokens[index - 1]
                if (prev?.type === "placeholder") {
                  e.preventDefault()
                  removePlaceholderAt(index - 1)
                }
              }
            }}
            placeholder={
              tokens.length === 1 || (tokens.length === 2 && !token.value && tokens[0].type === "placeholder")
                ? "Type text or insert a placeholder…"
                : ""
            }
            className={cn(
              "resize-none overflow-hidden bg-transparent outline-none leading-relaxed",
              isLast ? "min-w-[8ch] flex-1" : "min-w-[2ch]"
            )}
            style={{
              width: isLast
                ? "100%"
                : `${Math.max(2, Math.min(40, token.value.split("\n").pop()?.length ?? 0) + 1)}ch`,
            }}
          />
        )
      })}
    </div>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
      <path
        d="M3 3l6 6M9 3L3 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function formatPlaceholderPreview(value: string, options: PlaceholderOption[]) {
  return friendlyPreview(value, options)
}
