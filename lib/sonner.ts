"use client"

import React, { type ReactNode } from "react"
import { Toaster as SileoToaster, sileo } from "sileo"
import { useTheme } from "next-themes"

type ToastType = "success" | "error" | "warning" | "info" | "loading"

type ToastOptions = {
  id?: string
  description?: ReactNode
  duration?: number
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
}

export type ToasterProps = React.ComponentProps<typeof SileoToaster> & {
  richColors?: boolean
}

const showTypedToast = (
  type: ToastType,
  message: ReactNode,
  options?: ToastOptions
) => {
  if (options?.id) {
    sileo.dismiss(options.id)
  }

  const title = typeof message === "string" ? message : undefined
  const description =
    typeof message === "string"
      ? options?.description
      : message ?? options?.description

  const fallbackDescriptionByType: Record<ToastType, string> = {
    success: "Action completed successfully.",
    error: "Something went wrong. Please try again.",
    warning: "Please review this action.",
    info: "Please check the latest update.",
    loading: "Please wait while we process your request.",
  }

  const safeDescription = description ?? fallbackDescriptionByType[type]

  return sileo.show({
    type,
    title,
    description: safeDescription,
    duration: options?.duration,
    position: options?.position,
  })
}

type ToastCallable = {
  (message: ReactNode, options?: ToastOptions): string
  success: (message: ReactNode, options?: ToastOptions) => string
  error: (message: ReactNode, options?: ToastOptions) => string
  warning: (message: ReactNode, options?: ToastOptions) => string
  info: (message: ReactNode, options?: ToastOptions) => string
  loading: (message: ReactNode, options?: ToastOptions) => string
  dismiss: (id?: string) => void
}

const baseToast = ((message: ReactNode, options?: ToastOptions) =>
  showTypedToast("info", message, options)) as ToastCallable

baseToast.success = (message: ReactNode, options?: ToastOptions) =>
  showTypedToast("success", message, options)
baseToast.error = (message: ReactNode, options?: ToastOptions) =>
  showTypedToast("error", message, options)
baseToast.warning = (message: ReactNode, options?: ToastOptions) =>
  showTypedToast("warning", message, options)
baseToast.info = (message: ReactNode, options?: ToastOptions) =>
  showTypedToast("info", message, options)
baseToast.loading = (message: ReactNode, options?: ToastOptions) =>
  showTypedToast("loading", message, options)
baseToast.dismiss = (id?: string) => {
  if (id) {
    sileo.dismiss(id)
    return
  }
  sileo.clear()
}

const Toaster = ({ richColors: _richColors, ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return React.createElement(SileoToaster, {
    position: "top-center",
    theme: isDark ? "dark" : "light",
    options: {
      roundness: 14,
      styles: {
        title: isDark
          ? "text-black font-semibold"
          : "text-white font-semibold",
        description: isDark ? "text-black/80" : "text-white/85",
      },
      // Requirement: light mode = dark/black toast, dark mode = white toast.
      fill: isDark ? "#FFFFFF" : "#0B0B0B",
    },
    ...props,
  })
}

export const toast = baseToast
export { Toaster }

