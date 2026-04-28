"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

export default function GuestRegistrationLayout({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme("light")        // 🔥 Force Light Mode
    document.documentElement.classList.remove("dark")  // 🔥 Hard override
  }, [])

  return (
    <div className="m-0 min-h-screen bg-[#f3f5ff] p-0 text-black">
      {children}
    </div>
  )
}
