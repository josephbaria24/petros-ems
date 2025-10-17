"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Suspense } from "react"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGuestPage = pathname.startsWith("/guest")

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<div>Loading...</div>}>
        {!isGuestPage && <AppSidebar />}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!isGuestPage && <AppHeader />}
          <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
        </div>
      </Suspense>
    </div>
  )
}
