"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export default function SubmissionPage() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("scheduleId")

  const [trainees, setTrainees] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!scheduleId) return

    const fetchTrainees = async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, first_name, last_name, phone_number, status, id_picture_url, picture_2x2_url")
        .eq("schedule_id", scheduleId)

      if (error) console.error(error)
      else setTrainees(data || [])
    }

    fetchTrainees()
  }, [scheduleId])

  const handleView = (trainee: any) => {
    setSelectedTrainee(trainee)
    setDialogOpen(true)
  }

  const updateStatus = async (status: string) => {
    if (!selectedTrainee) return

    const { error } = await supabase
      .from("trainings")
      .update({ status })
      .eq("id", selectedTrainee.id)

    if (!error) {
      setTrainees((prev) =>
        prev.map((t) => (t.id === selectedTrainee.id ? { ...t, status } : t))
      )
      setDialogOpen(false)
    }
  }

  const filteredTrainees = trainees.filter((t) => {
    const fullName = `${t.first_name} ${t.last_name}`.toLowerCase()
    return fullName.includes(searchTerm.toLowerCase())
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-indigo-900">Trainee Submissions</h1>

      <Input
        type="text"
        placeholder="Search trainee..."
        className="max-w-md"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="">
              <TableHead className="">#</TableHead>
              <TableHead className="">Name</TableHead>
              <TableHead className="">Phone</TableHead>
              <TableHead className="">Status</TableHead>
              <TableHead className="">Photo</TableHead>
              <TableHead className="">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTrainees.map((trainee, index) => (
              <TableRow
                key={trainee.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleView(trainee)}
              >
                <TableCell>{index + 1}</TableCell>
                <TableCell>{trainee.first_name} {trainee.last_name}</TableCell>
                <TableCell>{trainee.phone_number || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{trainee.status || "Active"}</Badge>
                </TableCell>
                <TableCell>
                  <Avatar>
                    <AvatarImage src={trainee.picture_2x2_url} alt="2x2" />
                    <AvatarFallback>{trainee.first_name[0]}{trainee.last_name[0]}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(trainee)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
          </DialogHeader>
          {selectedTrainee && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">ID Picture</h4>
                <img
                  src={selectedTrainee.id_picture_url}
                  alt="ID Picture"
                  className="w-full rounded border"
                />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">2x2 Photo</h4>
                <img
                  src={selectedTrainee.picture_2x2_url}
                  alt="2x2 Photo"
                  className="w-full rounded border"
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button variant="destructive" onClick={() => updateStatus("Declined")}>Decline</Button>
            <Button onClick={() => updateStatus("Verified")}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
