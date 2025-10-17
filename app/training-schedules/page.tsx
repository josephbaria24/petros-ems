"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ParticipantsTable } from "@/components/participants-table"
import { NewScheduleDialog } from "@/components/new-schedule-dialog"

export default function TrainingSchedulesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)

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
          <ParticipantsTable status="planned" />
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4">
          <ParticipantsTable status="confirmed" />
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          <ParticipantsTable status="cancelled" />
        </TabsContent>

        <TabsContent value="finished" className="space-y-4">
          <ParticipantsTable status="finished" />
        </TabsContent>
      </Tabs>

      <NewScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
