"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ParticipantsTable } from "@/components/participants-table"
import { NewScheduleDialog } from "@/components/new-schedule-dialog"
import { supabase } from "@/lib/supabase-client"


export default function TrainingSchedulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [refreshTrigger, setRefreshTrigger] = React.useState(0)

  const handleScheduleCreated = () => {
    // Increment to trigger refresh in all tables
    setRefreshTrigger(prev => prev + 1)
  }
  React.useEffect(() => {
    autoFinishSchedules()
  }, [])
  


  const autoFinishSchedules = async () => {
    const today = new Date()
  
    const { data: schedules, error } = await supabase
      .from("schedules")
      .select(`
        id,
        status,
        schedule_type,
        schedule_ranges (end_date),
        schedule_dates (date)
      `)
      .in("status", ["planned", "confirmed"])
  
    if (error) {
      console.error("Error fetching schedules:", error)
      return
    }
  
    const toUpdate: string[] = []
  
    for (const schedule of schedules ?? []) {
      let endDate: Date | null = null
  
      if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.length) {
        endDate = new Date(schedule.schedule_ranges[0].end_date)
      } else if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length) {
        const sorted = schedule.schedule_dates
          .map((d: { date: string }) => new Date(d.date))
          .sort((a, b) => b.getTime() - a.getTime())
        endDate = sorted[0]
      }
  
      if (endDate && endDate < today) {
        toUpdate.push(schedule.id)
      }
    }
  
    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from("schedules")
        .update({ status: "finished" })
        .in("id", toUpdate)
  
      if (updateError) {
        console.error("Error updating finished schedules:", updateError)
      } else {
        console.log(`✅ ${toUpdate.length} schedules auto-updated to "finished".`)
        setRefreshTrigger((prev) => prev + 1) // ✅ Refresh ParticipantsTable
      }
    }
  }

  


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Training Schedules</h1>
          <p className="text-muted-foreground mt-2">Manage and organize all training events and participants</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <Tabs defaultValue="planned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="planned">Planned Events</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed Events</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled Events</TabsTrigger>
          <TabsTrigger value="finished">Finished Events</TabsTrigger>
        </TabsList>

        <TabsContent value="planned" className="space-y-4">
          <ParticipantsTable status="planned" refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4">
          <ParticipantsTable status="confirmed" refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          <ParticipantsTable status="cancelled" refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="finished" className="space-y-4">
          <ParticipantsTable status="finished" refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>

      <NewScheduleDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onScheduleCreated={handleScheduleCreated}
      />
    </div>
  )
}