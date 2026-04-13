// app/view-material/layout.tsx
// Scoped layout for the material viewer — applies anti-copy/screenshot protections
// Does NOT re-declare <html>/<body> since root layout already handles that.

"use client"

import { useEffect } from "react"

export default function MaterialViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Apply anti-print stylesheet dynamically
    const style = document.createElement("style")
    style.textContent = `
      @media print {
        html, body, #__next {
          display: none !important;
          visibility: hidden !important;
        }
      }
    `
    document.head.appendChild(style)

    // Override body styles for the viewer
    document.body.style.background = "#141454"
    document.body.style.userSelect = "none"
    document.body.style.setProperty("-webkit-user-select", "none")

    return () => {
      document.head.removeChild(style)
      document.body.style.background = ""
      document.body.style.userSelect = ""
      document.body.style.removeProperty("-webkit-user-select")
    }
  }, [])

  return (
    <div
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        minHeight: "100vh",
        background: "#141454",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}
