"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import { Navigation } from "@/components/navigation"
import { EventsDashboard } from "@/components/events-dashboard"
import { EventDetails } from "@/components/event-details"
import { QRScanner } from "@/components/qr-scanner"
import { Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

type ViewMode = "dashboard" | "details" | "qr-scan"

export default function EventManagementPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewMode>("dashboard")
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // ✅ Check authentication on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data?.session

      if (!session) {
        router.replace("/login") // redirect if not logged in
      } else {
        setLoading(false)
      }
    }

    checkUser()

    // ✅ Auto-logout handling
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login")
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  // ✅ Handlers for switching views
  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id)
    setCurrentView("details")
  }

  const handleBackToDashboard = () => {
    setSelectedEventId(null)
    setCurrentView("dashboard")
  }

  const handleOpenQRScanner = () => {
    if (selectedEventId) setCurrentView("qr-scan")
  }

  const handleBackToDetails = () => {
    setCurrentView("details")
  }

  // ✅ Loading screen during auth check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ✅ Actual page layout
  return (
    <div className="min-h-screen bg-background">
      {/* Optional: Navigation bar */}
      <Navigation
        currentEventId={selectedEventId}
        onQRScanClick={handleOpenQRScanner}
      />

      {/* Main content area */}
      {currentView === "dashboard" && (
        <EventsDashboard onSelectEvent={handleSelectEvent} />
      )}

      {currentView === "details" && selectedEventId && (
        <EventDetails
          eventId={selectedEventId}
          onBack={handleBackToDashboard}
        />
      )}

      {currentView === "qr-scan" && selectedEventId && (
        <div className="relative">
          <div className="p-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToDetails}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event Details
            </Button>
          </div>
          <QRScanner eventId={selectedEventId} />
        </div>
      )}
    </div>
  )
}
