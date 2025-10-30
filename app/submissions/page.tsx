"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"
import { SubmissionDialog } from "@/components/submission-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle,
  XCircle,
  Clock,
  Wallet,
  MoreVertical,
  Zap,
  Loader2,
  PieChart,
} from "lucide-react";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export default function SubmissionPage() {
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get("scheduleId")

  const [trainees, setTrainees] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  // Bulk action states
  const [bulkMode, setBulkMode] = useState<"paid" | "room" | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [roomLinkDialog, setRoomLinkDialog] = useState(false)
  const [roomLink, setRoomLink] = useState("")
  const [processing, setProcessing] = useState(false)
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case "pending":
        return (
          <Badge className="bg-orange-100 text-orange-800 border border-orange-300">
            <Clock className="w-4 h-4 mr-1" />
            Pending
          </Badge>
        );
      case "partially paid":
        return (
          <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
            <PieChart className="w-4 h-4 mr-1" />
            Partially Paid
          </Badge>
        );
      case "payment completed":
        return (
          <Badge className="bg-green-100 text-green-800 border border-green-300">
            <CheckCircle className="w-4 h-4 mr-1" />
            Payment Completed
          </Badge>
        );
      case "pending payment":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">
            <Wallet className="w-4 h-4 mr-1" />
            Pending Payment
          </Badge>
        );
      case "declined":
        return (
          <Badge className="bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-4 h-4 mr-1" />
            Declined
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {status}
          </Badge>
        );
    }
  };
  
  const fetchTrainees = async () => {
    if (!scheduleId) return;

    const { data, error } = await supabase
      .from("trainings")
      .select(`
        id,
        first_name,
        last_name,
        middle_initial,
        suffix,
        email,
        phone_number,
        gender,
        age,
        status,
        id_picture_url,
        picture_2x2_url,
        mailing_street,
        mailing_city,
        mailing_province,
        employment_status,
        company_name,
        company_position,
        company_industry,
        company_email,
        company_landline,
        company_city,
        company_region,
        payment_method,
        payment_status,
        receipt_link,
        amount_paid,
        food_restriction,
        course_id,
        courses:course_id (
          training_fee
        )
      `)
      .eq("schedule_id", scheduleId);

    if (error) {
      console.error(error);
      toast.error("Failed to fetch trainees");
    } else {
      const formattedData = (data || []).map((trainee: any) => ({
        ...trainee,
        training_fee: trainee.courses?.training_fee || 0,
      }));
      setTrainees(formattedData);
    }
  };

  useEffect(() => {
    fetchTrainees();
  }, [scheduleId]);

  const handleView = (trainee: any) => {
    if (bulkMode) return; // Prevent opening dialog in bulk mode
    setSelectedTrainee(trainee)
    setDialogOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      fetchTrainees();
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedTrainee || !scheduleId) return;
  
    let certNumber: string | null = null;

    try {
      if (status === "Pending Payment" || status === "Payment Completed") {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from("schedules")
          .select("course_id")
          .eq("id", scheduleId)
          .single();
    
        if (scheduleError || !scheduleData) throw scheduleError;
    
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("name, serial_number_pad")
          .eq("id", scheduleData.course_id)
          .single();
    
        if (courseError || !courseData) throw courseError;
    
        const courseName = courseData.name;
        const padLength = courseData.serial_number_pad || 6;
    
        const { count, error: countError } = await supabase
          .from("trainings")
          .select("certificate_number", { count: "exact", head: true })
          .eq("course_id", scheduleData.course_id)
          .not("certificate_number", "is", null);
    
        if (countError) throw countError;
    
        const nextNumber = (count ?? 0) + 1;
        const padded = nextNumber.toString().padStart(padLength, "0");
        certNumber = `PSI-${courseName}-${padded}`;
      }
    
      const { error: updateError } = await supabase
        .from("trainings")
        .update({
          status,
          ...(certNumber && { certificate_number: certNumber }),
        })
        .eq("id", selectedTrainee.id);
    
      if (updateError) throw updateError;
    
      setTrainees((prev) =>
        prev.map((t) =>
          t.id === selectedTrainee.id
            ? { ...t, status, ...(certNumber && { certificate_number: certNumber }) }
            : t
        )
      );
    
      setDialogOpen(false);
    
      toast.success(
        status === "Declined"
          ? "Trainee has been declined."
          : status === "Pending Payment"
          ? "Trainee has been verified and marked for payment."
          : status === "Payment Completed"
          ? "Trainee payment has been completed."
          : `Trainee updated to ${status}.`
      );
      
    } catch (err: any) {
      console.error("Status update failed:", err);
      toast.error(`Failed to update status: ${err.message || "Unknown error"}`);
    }
    
  };

  // Bulk action handlers
  const handleQuickAction = (action: "paid" | "room") => {
    setBulkMode(action);
    setSelectedIds([]);
  };

  const handleCancelBulk = () => {
    setBulkMode(null);
    setSelectedIds([]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTrainees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTrainees.map(t => t.id));
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one trainee");
      return;
    }

    setProcessing(true);
    setProgressCurrent(0);
    setProgressTotal(selectedIds.length);

    try {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedIds.length; i++) {
        const traineeId = selectedIds[i];
        const trainee = trainees.find(t => t.id === traineeId);
        
        setProgressCurrent(i + 1);
        
        if (!trainee) {
          failCount++;
          continue;
        }

        // Insert payment record
        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            training_id: traineeId,
            payment_method: trainee.payment_method || "Counter",
            payment_status: "completed",
            amount_paid: trainee.training_fee || 0,
            receipt_link: null,
          });

        if (paymentError) {
          console.error(`Failed to mark ${trainee.first_name} as paid:`, paymentError);
          failCount++;
          continue;
        }

        // Update trainee status to "Payment Completed"
        const { error: statusError } = await supabase
          .from("trainings")
          .update({ status: "Payment Completed" })
          .eq("id", traineeId);

        if (statusError) {
          console.error(`Failed to update status for ${trainee.first_name}:`, statusError);
          failCount++;
        } else {
          successCount++;
        }
      }

      toast.success(`${successCount} trainee(s) marked as paid${failCount > 0 ? `, ${failCount} failed` : ""}`);
      
      handleCancelBulk();
      fetchTrainees();
    } catch (error) {
      console.error("Bulk mark as paid error:", error);
      toast.error("Failed to process bulk payment");
    } finally {
      setProcessing(false);
      setProgressCurrent(0);
      setProgressTotal(0);
    }
  };

  const handleBulkSendRoomLink = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one trainee");
      return;
    }

    if (!roomLink.trim()) {
      toast.error("Please enter a room link");
      return;
    }

    setProcessing(true);
    setProgressCurrent(0);
    setProgressTotal(selectedIds.length);

    try {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedIds.length; i++) {
        const traineeId = selectedIds[i];
        const trainee = trainees.find(t => t.id === traineeId);
        
        setProgressCurrent(i + 1);
        
        if (!trainee || !trainee.email) {
          failCount++;
          continue;
        }

        const response = await fetch("/api/send-payment-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            traineeEmail: trainee.email,
            traineeName: `${trainee.first_name} ${trainee.last_name}`,
            amount: 0,
            sendConfirmation: false,
            sendClassroom: true,
            classroomUrl: roomLink,
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }

      toast.success(`Room link sent to ${successCount} trainee(s)${failCount > 0 ? `, ${failCount} failed` : ""}`);
      
      setRoomLinkDialog(false);
      setRoomLink("");
      handleCancelBulk();
    } catch (error) {
      console.error("Bulk send room link error:", error);
      toast.error("Failed to send room links");
    } finally {
      setProcessing(false);
      setProgressCurrent(0);
      setProgressTotal(0);
    }
  };

  const handleRoomLinkSubmit = () => {
    if (bulkMode === "room") {
      setRoomLinkDialog(true);
    }
  };

  const filteredTrainees = trainees.filter((t) => {
    const fullName = `${t.first_name} ${t.last_name}`.toLowerCase()
    return fullName.includes(searchTerm.toLowerCase())
  })

  return (
    <div className="p-6 space-y-2">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-indigo-900">Trainee Submissions</h1>
        
        {bulkMode ? (
          <div className="flex gap-2">
            <Badge variant="outline" className="px-3 py-1">
              {selectedIds.length} selected
            </Badge>
            {processing && (
              <Badge variant="secondary" className="px-3 py-1">
                {progressCurrent} / {progressTotal}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelBulk}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={bulkMode === "paid" ? handleBulkMarkAsPaid : handleRoomLinkSubmit}
              disabled={selectedIds.length === 0 || processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing... ({progressCurrent}/{progressTotal})
                </>
              ) : (
                bulkMode === "paid" ? "Mark as Paid" : "Send Room Link"
              )}
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="cursor-pointer">
                <Zap className="h-4 w-4 mr-2" />
                Quick Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleQuickAction("paid")} className="cursor-pointer">
                Quick Mark as Paid
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickAction("room")} className="cursor-pointer">
                Quick Send Room Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Input
        type="text"
        placeholder="Search trainee..."
        className="max-w-md"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <Card>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {bulkMode && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredTrainees.length && filteredTrainees.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Photo</TableHead>
                {!bulkMode && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrainees.map((trainee, index) => (
                <TableRow
                  key={trainee.id}
                  className={bulkMode ? "" : "cursor-pointer"}
                  onClick={() => !bulkMode && handleView(trainee)}
                >
                  {bulkMode && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(trainee.id)}
                        onCheckedChange={() => handleRowSelect(trainee.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{trainee.first_name} {trainee.last_name}</TableCell>
                  <TableCell>{trainee.phone_number || "N/A"}</TableCell>
                  <TableCell>{getStatusBadge(trainee.status || "Active")}</TableCell>
                  <TableCell>
                    <Avatar>
                      <AvatarImage src={trainee.picture_2x2_url} alt="2x2" />
                      <AvatarFallback>
                        {trainee.first_name[0]}
                        {trainee.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  {!bulkMode && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(trainee)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Room Link Dialog */}
      <Dialog open={roomLinkDialog} onOpenChange={setRoomLinkDialog}>
        <DialogContent className="lg:w-[40vw] sm:w-[80vw]">
          <DialogHeader>
            <DialogTitle>Send Online Meeting Link</DialogTitle>
            <DialogDescription>
              Enter the meeting URL to send to {selectedIds.length} selected trainee(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="room-link">Online Classroom URL</Label>
              <Input
                id="room-link"
                type="url"
                placeholder="https://zoom.example.com/..."
                value={roomLink}
                onChange={(e) => setRoomLink(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRoomLinkDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkSendRoomLink} disabled={!roomLink.trim() || processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending... ({progressCurrent}/{progressTotal})
                </>
              ) : (
                "Send to Selected"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubmissionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        trainee={selectedTrainee}
        onVerify={() => updateStatus("Pending Payment")}
        onDecline={() => updateStatus("Declined")}
      />
    </div>
  )
}