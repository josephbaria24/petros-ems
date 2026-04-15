"use client"

import type * as React from "react"
import { toast as globalToast } from "sonner"

type LegacyToast = {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "destructive"
}

function toast(props: LegacyToast) {
  const message = props.title ?? "Notification"

  if (props.variant === "destructive") {
    const id = globalToast.error(message, { description: props.description })
    return { id, dismiss: () => globalToast.dismiss(id), update: () => {} }
  }

  const id = globalToast.success(message, { description: props.description })
  return { id, dismiss: () => globalToast.dismiss(id), update: () => {} }
}

function useToast() {
  return {
    toasts: [] as LegacyToast[],
    toast,
    dismiss: (toastId?: string) => globalToast.dismiss(toastId),
  }
}

export { useToast, toast }
