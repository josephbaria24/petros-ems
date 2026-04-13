// app/view-material/[id]/page.tsx
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"

// Helper: Load pdf.js from CDN via script tag (avoids Turbopack bundling issues)
// Uses v3.11.174 which has a proper UMD build that exposes window.pdfjsLib
function loadPdfJs(): Promise<any> {
  const version = "3.11.174"
  return new Promise((resolve, reject) => {
    // If already loaded, return it
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib)
      return
    }

    const script = document.createElement("script")
    script.src = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.min.js`
    script.type = "text/javascript"

    script.onload = () => {
      const lib = (window as any).pdfjsLib
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.js`
        resolve(lib)
      } else {
        reject(new Error("pdf.js loaded but pdfjsLib not found on window"))
      }
    }
    script.onerror = () => reject(new Error("Failed to load pdf.js from CDN"))
    document.head.appendChild(script)
  })
}

export default function MaterialViewerPage() {
  const params = useParams()
  const materialId = params.id as string

  // Auth state
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [password, setPassword] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState("")
  const [materialInfo, setMaterialInfo] = useState<any>(null)

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(0.75)
  const [rotation, setRotation] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [isBlurred, setIsBlurred] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ===== ANTI-SCREENSHOT PROTECTIONS =====
  useEffect(() => {
    // Disable right-click
    const handleContextMenu = (e: Event) => {
      e.preventDefault()
      return false
    }

    // Block keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault()
        setIsBlurred(true)
        setTimeout(() => setIsBlurred(false), 1500)
        return false
      }

      // Block Ctrl+P (Print)
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault()
        return false
      }

      // Block Ctrl+S (Save)
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault()
        return false
      }

      // Block Ctrl+Shift+S (Save As)
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault()
        return false
      }

      // Block Ctrl+C (Copy)
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault()
        return false
      }

      // Block F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault()
        return false
      }

      // Page navigation with arrows
      if (isUnlocked && pdfDoc) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault()
          goToNextPage()
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault()
          goToPrevPage()
        }
      }
    }

    // Blur content when tab loses focus or window loses focus (anti-screen-capture)
    const handleBlur = () => {
      setIsBlurred(true)
    }

    const handleFocus = () => {
      // Small delay before unblurring
      setTimeout(() => setIsBlurred(false), 300)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true)
      } else {
        handleFocus()
      }
    }

    // Block drag
    const handleDragStart = (e: Event) => {
      e.preventDefault()
      return false
    }

    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("dragstart", handleDragStart)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("dragstart", handleDragStart)
    }
  }, [isUnlocked, pdfDoc, currentPage, totalPages])

  // ===== PASSWORD VERIFICATION =====
  const handleVerify = async () => {
    if (!password.trim()) {
      setError("Please enter a password")
      return
    }

    setVerifying(true)
    setError("")

    try {
      const res = await fetch("/api/course-materials/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, password }),
      })

      const json = await res.json()

      if (json.valid) {
        setMaterialInfo(json.material)
        setIsUnlocked(true)
        sessionStorage.setItem(`material_${materialId}`, "unlocked")
      } else {
        setError(json.error || "Incorrect password")
      }
    } catch (err) {
      setError("Verification failed. Please try again.")
    } finally {
      setVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify()
    }
  }

  // ===== PDF LOADING =====
  useEffect(() => {
    if (!isUnlocked || !materialInfo?.file_url) return

    const loadPdf = async () => {
      setPdfLoading(true)
      try {
        // Load pdf.js from CDN (avoids Turbopack bundling issues)
        const pdfjsLib = await loadPdfJs()

        // Fetch the PDF through our proxy to avoid CORS, then pass raw data to pdf.js
        const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(materialInfo.file_url)}`
        const pdfResponse = await fetch(proxyUrl)
        if (!pdfResponse.ok) throw new Error("Failed to fetch PDF")
        const pdfData = await pdfResponse.arrayBuffer()

        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
      } catch (err) {
        console.error("Error loading PDF:", err)
        setError("Failed to load the document. Please try again.")
      } finally {
        setPdfLoading(false)
      }
    }

    loadPdf()
  }, [isUnlocked, materialInfo])

  // ===== PAGE RENDERING =====
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current || rendering) return

      setRendering(true)
      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale, rotation })

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")!

        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        }

        await page.render(renderContext).promise

        // Draw watermark overlay
        ctx.globalAlpha = 0.06
        ctx.font = "40px sans-serif"
        ctx.fillStyle = "#ffffff"
        ctx.textAlign = "center"

        const watermarkText = "PETROSPHERE • CONFIDENTIAL"
        for (let y = 80; y < viewport.height; y += 200) {
          for (let x = 0; x < viewport.width; x += 400) {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(-0.3)
            ctx.fillText(watermarkText, 0, 0)
            ctx.restore()
          }
        }
        ctx.globalAlpha = 1.0
      } catch (err) {
        console.error("Error rendering page:", err)
      } finally {
        setRendering(false)
      }
    },
    [pdfDoc, scale, rendering]
  )

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage)
    }
  }, [pdfDoc, currentPage, scale, rotation])

  // ===== NAVIGATION =====
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1)
    }
  }

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0))
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5))
  const rotate = () => setRotation((prev) => (prev + 90) % 360)  // ===== LOCKED STATE — PASSWORD GATE =====
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141454] p-4 relative overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[150px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(20,20,84,0)_0%,#141454_100%)]" />
        </div>

        <div className="relative w-full max-w-md z-10">
          {/* Main Card */}
          <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/20">
            {/* Header / Icon */}
            <div className="flex flex-col items-center mb-10">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center shadow-xl mb-6 relative group">
                <div className="absolute inset-0 bg-amber-400 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <svg
                  className="w-12 h-12 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-black text-[#141454] text-center tracking-tight">
                Secure Access
              </h1>
              <div className="w-12 h-1.5 bg-amber-400 mt-2 rounded-full" />
              <p className="text-slate-500 font-medium text-center mt-4">
                Please enter the material password
              </p>
            </div>

            {/* Form */}
            <div className="space-y-6">
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError("")
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter password..."
                  autoFocus
                  className="
                    w-full px-6 py-5 rounded-2xl
                    bg-slate-50 border-2 border-slate-100
                    text-[#141454] placeholder-slate-400 font-semibold
                    focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-700
                    transition-all duration-300
                    text-lg
                  "
                />
              </div>

              {error && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-50 border border-red-100 animate-in fade-in slide-in-from-top-2">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-red-600 tracking-tight">{error}</span>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="
                  w-full px-6 py-5 rounded-2xl font-bold text-lg
                  bg-[#141454] hover:bg-blue-900
                  text-white shadow-2xl shadow-blue-900/20
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300
                  flex items-center justify-center gap-3
                  group
                "
              >
                {verifying ? (
                  <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-amber-400">Unlock</span>
                    <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Brand Logo / Footer */}
            <div className="mt-12 flex flex-col items-center gap-4">
              <div className="px-4 py-1.5 rounded-full bg-slate-100 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-700 animate-pulse" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Petrosphere Inc.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===== UNLOCKED STATE — BOOK VIEWER =====
  return (
    <div
      className={`min-h-screen bg-[#141454] flex flex-col transition-all duration-300 ${
        isBlurred ? "blur-xl" : ""
      }`}
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-[#16162a]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white truncate max-w-[240px] sm:max-w-none">
                {materialInfo?.title}
              </h1>
              <p className="text-xs text-white/40">Secure Viewer</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <div className="hidden sm:flex items-center gap-1 bg-white/[0.06] rounded-lg px-2 py-1">
              <button
                onClick={zoomOut}
                className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>
              <span className="text-xs text-white/50 w-12 text-center font-mono">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Rotate */}
            <button
              onClick={rotate}
              className="w-9 h-9 flex items-center justify-center bg-white/[0.06] rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Rotate 90°"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Page Navigation */}
            <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg px-2 py-1">
              <button
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-white/50 font-mono px-2 min-w-[70px] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center py-8 px-4"
        style={{ background: "#141454" }}
      >
        {materialInfo?.file_type === "articulate" ? (
          <div className="w-full h-full max-w-6xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-white relative material-content">
             <iframe
              src={materialInfo.file_url}
              className="w-full h-full border-none transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
              title={materialInfo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
            {/* Overlay to prevent direct interaction with the iframe's context menu if possible */}
            <div className="absolute inset-0 pointer-events-none" />
          </div>
        ) : pdfLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm text-white/40">Loading document...</p>
          </div>
        ) : (
          <div className="relative material-content">
            {/* Page shadow effect */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.3)",
              }}
            >
              <canvas
                ref={canvasRef}
                className="block bg-white rounded-xl"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
            </div>

            {/* Rendering overlay */}
            {rendering && (
              <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar — Mobile Zoom */}
      <div className="sm:hidden sticky bottom-0 bg-[#16162a]/95 backdrop-blur-xl border-t border-white/[0.06] p-2 flex justify-center gap-2">
        <button
          onClick={zoomOut}
          className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/60 text-xs hover:bg-white/[0.1] transition-colors"
        >
          Zoom Out
        </button>
        <span className="px-4 py-2 text-xs text-white/40 font-mono">{Math.round(scale * 100)}%</span>
        <button
          onClick={zoomIn}
          className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/60 text-xs hover:bg-white/[0.1] transition-colors"
        >
          Zoom In
        </button>
        <button
          onClick={rotate}
          className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/60 text-xs hover:bg-white/[0.1] transition-colors flex items-center gap-2"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Rotate
        </button>
      </div>

      {/* Anti-screenshot blur overlay */}
      {isBlurred && (
        <div className="fixed inset-0 z-[9999] bg-[#141454] flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            <p className="text-lg font-semibold text-white/80 uppercase tracking-widest">Protected Content</p>
            <p className="text-sm text-white/40 mt-1">Screenshot tool detected or focus lost</p>
          </div>
        </div>
      )}
    </div>
  )
}
