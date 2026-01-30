//app\submissions\page.tsx
"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import { SubmissionDialog } from "@/components/submission-dialog"
import { DeclinePhotoDialog } from "@/components/decline-photo"
import { Skeleton } from "@/components/ui/skeleton"
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
  ArrowLeft,
  AlertCircle,
  Upload,
  MoveRight
} from "lucide-react";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import Link from "next/link"

export default function SubmissionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const scheduleId = searchParams.get("scheduleId")
  const fromTab = searchParams.get("from") || "all"

  const [trainees, setTrainees] = useState<any[]>([])
  const [courseName, setCourseName] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  
  // Bulk action states
  const [bulkMode, setBulkMode] = useState<"paid" | "room" | "move" | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [roomLinkDialog, setRoomLinkDialog] = useState(false)
  const [roomLink, setRoomLink] = useState("")
  const [processing, setProcessing] = useState(false)
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [groupChatLink, setGroupChatLink] = useState("")

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [traineeToDelete, setTraineeToDelete] = useState<any | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [scheduleDateText, setScheduleDateText] = useState<string>("");

    const [batchNumber, setBatchNumber] = useState<number | null>(null);
  const [isLoadingTrainees, setIsLoadingTrainees] = useState(true)

  const [moveScheduleDialog, setMoveScheduleDialog] = useState(false)
const [availableSchedules, setAvailableSchedules] = useState<any[]>([])
const [selectedTargetSchedule, setSelectedTargetSchedule] = useState<string>("")
const [currentCourseId, setCurrentCourseId] = useState<string>("")




//duplication
const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
const [duplicateGroups, setDuplicateGroups] = useState<Map<string, any[]>>(new Map())


// ADD THIS FUNCTION to detect duplicates (around line 400, before filteredTrainees)
const detectDuplicates = () => {
  const groups = new Map<string, any[]>()
  
  trainees.forEach((trainee) => {
    // Create potential duplicate keys
    const keys = [
      // Exact email match
      trainee.email?.toLowerCase().trim(),
      // Exact phone match (normalized)
      trainee.phone_number?.replace(/\s+/g, '').replace(/\+/g, ''),
      // First name + Last name + Age
      `${trainee.first_name?.toLowerCase()}_${trainee.last_name?.toLowerCase()}_${trainee.age}`,
      // Last name + Email
      `${trainee.last_name?.toLowerCase()}_${trainee.email?.toLowerCase()}`,
    ].filter(Boolean)
    
    keys.forEach((key) => {
      if (!key) return
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(trainee)
    })
  })
  
  // Only keep groups with 2+ trainees
  const duplicateOnly = new Map()
  groups.forEach((group, key) => {
    if (group.length > 1) {
      // Remove duplicates within the group (same trainee matched multiple ways)
      const uniqueIds = new Set()
      const uniqueGroup = group.filter(t => {
        if (uniqueIds.has(t.id)) return false
        uniqueIds.add(t.id)
        return true
      })
      if (uniqueGroup.length > 1) {
        duplicateOnly.set(key, uniqueGroup)
      }
    }
  })
  
  setDuplicateGroups(duplicateOnly)
}

useEffect(() => {
  if (trainees.length > 0) {
    detectDuplicates()
  }
}, [trainees])

const hasPendingReceipt = (trainee: any) => {
  return trainee.payments?.some(
    (payment: any) => 
      payment.receipt_link && 
      payment.receipt_uploaded_at && // Has been uploaded
      payment.payment_status === 'pending' // But still pending approval
  );
};


const formatScheduleDate = (schedule: any) => {
  if (!schedule) return "";

  if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.length > 0) {
    const r = schedule.schedule_ranges[0];
    const startDate = new Date(r.start_date);
    const endDate = new Date(r.end_date);
    
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();
    
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  }

  if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length > 0) {
    return schedule.schedule_dates
      .map((d: any) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      })
      .join(", ");
  }

  return "";
};


  const getStatusBadge = (status: string) => {
  const normalized = status?.toLowerCase().trim() || "pending";
  


  switch (normalized) {
    case "pending":
      return (
        <Badge className="bg-orange-100 text-orange-800 border border-orange-300">
          <Clock className="w-4 h-4 mr-1" />
          Pending
        </Badge>
      );
    
    case "awaiting receipt":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">
          <Clock className="w-4 h-4 mr-1" />
          Awaiting Receipt
        </Badge>
      );
    
    case "declined (waiting for resubmission)":
      return (
        <Badge className="bg-red-100 text-red-800 border border-red-300">
          <AlertCircle className="w-4 h-4 mr-1" />
          Declined - Awaiting Resubmission
        </Badge>
      );
    
    case "resubmitted (pending verification)":
      return (
        <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
          <Upload className="w-4 h-4 mr-1" />
          Resubmitted - Pending Verification
        </Badge>
      );
    
    case "pending payment":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">
          <Wallet className="w-4 h-4 mr-1" />
          Pending Payment
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
    
    case "payment completed (discounted)":
      return (
        <Badge className="bg-green-100 text-green-800 border border-green-300">
          <Wallet className="w-4 h-4 mr-1" />
          Payment Completed (Discounted)
        </Badge>
      );
    
    case "partially paid (discounted)":
      return (
        <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
          <PieChart className="w-4 h-4 mr-1" />
          Partially Paid (Discounted)
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

   setIsLoadingTrainees(true);
   
  try {
    // Fetch schedule with course name
    const { data: scheduleData, error: scheduleError } = await tmsDb
      .from("schedules")
      .select(`
        course_id,
        schedule_type,
        batch_number,
        schedule_dates(date),
        schedule_ranges(start_date, end_date),
        courses(name)
      `)

      .eq("id", scheduleId)
      .single();

    if (scheduleError) {
  console.error(scheduleError);
  toast.error("Failed to fetch schedule details");
} else if (scheduleData?.courses) {
  // @ts-ignore
  setCourseName(scheduleData.courses.name || "");
  setScheduleDateText(formatScheduleDate(scheduleData));
  setCurrentCourseId(scheduleData.course_id); // ADD THIS LINE
   setBatchNumber(scheduleData.batch_number);
}

    // Fetch trainings data
    const { data, error } = await tmsDb
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
        declined_photos,
        has_discount,
        discounted_fee,
        add_pvc_id,
        courses:course_id (
          id,
          name,
          training_fee
        ),
        payments (
          id,
          payment_date,
          payment_method,
          payment_status,
          amount_paid,
          receipt_link,
          online_classroom_url,
          receipt_uploaded_by,
          receipt_uploaded_at
        )
      `)
      .eq("schedule_id", scheduleId);

    if (error) {
      console.error(error);
      toast.error("Failed to fetch trainees");
      return;
    }

    // ✅ COMPLETELY NEW APPROACH - No nested selects
    const traineeIds = (data || [])
      .filter(t => t.has_discount && t.discounted_fee)
      .map(t => t.id);

    let voucherMap = new Map();

    if (traineeIds.length > 0) {
      console.log("🔍 Fetching vouchers for trainee IDs:", traineeIds);
      
      // Query 1: Get voucher_usage records WITHOUT nested select
      const { data: usageRecords, error: usageError } = await tmsDb
        .from("voucher_usage")
        .select("*")
        .in("training_id", traineeIds);

      console.log("📋 Voucher usage records:", usageRecords);
      console.log("📋 Usage error (if any):", usageError);

      if (usageError) {
        console.error("❌ Error fetching voucher usage:", usageError);
      } else if (usageRecords && usageRecords.length > 0) {
        // Query 2: Get all voucher IDs from usage records
        const voucherIds = [...new Set(usageRecords.map(u => u.voucher_id))];
        
        console.log("🎫 Fetching voucher details for IDs:", voucherIds);
        
        // Query 3: Fetch actual voucher details
        const { data: voucherRecords, error: voucherError } = await tmsDb
          .from("vouchers")
          .select("*")
          .in("id", voucherIds);

        console.log("🎟️ Voucher records:", voucherRecords);
        console.log("🎟️ Voucher error (if any):", voucherError);

        if (voucherError) {
          console.error("❌ Error fetching vouchers:", voucherError);
        } else if (voucherRecords) {
          // Create a map of voucher_id -> voucher data
          const voucherById = new Map(
            voucherRecords.map(v => [v.id, v])
          );

          // Map vouchers to training IDs
          usageRecords.forEach((usage) => {
            const voucher = voucherById.get(usage.voucher_id);
            if (voucher) {
              console.log(`✅ Mapping voucher ${voucher.code} to training ${usage.training_id}`);
              voucherMap.set(usage.training_id, voucher);
            } else {
              console.log(`⚠️ No voucher found for voucher_id ${usage.voucher_id}`);
            }
          });
        }
      } else {
        console.log("ℹ️ No voucher usage records found for these trainees");
      }
    }

    console.log("🗺️ Final voucher map size:", voucherMap.size);
    console.log("🗺️ Voucher map entries:", Array.from(voucherMap.entries()));

    // Format data with all nested info
    const formattedData = (data || []).map((trainee: any, index: number) => {
      const voucherInfo = voucherMap.get(trainee.id) || null;
      
      console.log(`👤 Processing trainee ${trainee.first_name} ${trainee.last_name}:`, {
        id: trainee.id,
        hasDiscount: trainee.has_discount,
        discountedFee: trainee.discounted_fee,
        voucherInfo: voucherInfo ? {
          code: voucherInfo.code,
          amount: voucherInfo.amount,
          type: voucherInfo.voucher_type
        } : null
      });
      
      return {
        ...trainee,
        training_fee: trainee.courses?.training_fee || 0,
        payments: trainee.payments || [],
        voucherInfo,
        rowIndex: index,
      };
    });

    console.log("📊 Total trainees:", formattedData.length);
    console.log("📊 Trainees with discounts:", formattedData.filter(t => t.has_discount).length);
    console.log("📊 Trainees with vouchers:", formattedData.filter(t => t.voucherInfo).length);
    
    setTrainees(formattedData);
 } catch (err) {
    console.error("💥 Unexpected error:", err);
    toast.error("An error occurred while loading trainees");
  } finally {
    setIsLoadingTrainees(false); // ADD THIS LINE
  }
};



  useEffect(() => {
    fetchTrainees();
  }, [scheduleId]);

const handleView = (trainee: any) => {
  if (bulkMode) return;
  
  // ✅ No refetching needed - all data is already loaded
  setSelectedTrainee(trainee);
  setDialogOpen(true);
};


   const handleDeclineFromSubmission = () => {
    setDialogOpen(false);
    setDeclineDialogOpen(true);
  };

  const handleDeclinePhoto = (trainee: any) => {
    setSelectedTrainee(trainee)
    setDeclineDialogOpen(true)
  }


  
  
const handleDialogClose = async (open: boolean) => {
  setDialogOpen(open);
  
  if (!open && selectedTrainee) {
    // ✅ Only refetch the specific trainee that was updated
    const { data: updatedTrainee } = await tmsDb
      .from("trainings")
      .select(`
        *,
        courses:course_id(id, name, training_fee),
        payments (
          id,
          payment_date,
          payment_method,
          payment_status,
          amount_paid,
          receipt_link,
          online_classroom_url,
          receipt_uploaded_by,
          receipt_uploaded_at
        )
      `)
      .eq("id", selectedTrainee.id)
      .single();

    if (updatedTrainee) {
      // Check for voucher if has discount
      let voucherInfo = null;
      if (updatedTrainee.has_discount && updatedTrainee.discounted_fee) {
        const { data: voucherUsage } = await tmsDb
          .from("voucher_usage")
          .select(`
            voucher_id,
            vouchers (
              id,
              code,
              amount,
              service,
              voucher_type,
              expiry_date,
              is_batch,
              batch_count,
              batch_remaining
            )
          `)
          .eq("training_id", updatedTrainee.id)
          .single();

        if (voucherUsage?.vouchers) {
          voucherInfo = voucherUsage.vouchers;
        }
      }

      const updated = {
        ...updatedTrainee,
        training_fee: updatedTrainee.courses?.training_fee || 0,
        payments: updatedTrainee.payments || [],
        voucherInfo,
      };

      setTrainees((prev) => {
        const updatedList = prev.map((t) =>
          t.id === updated.id ? { ...updated, rowIndex: t.rowIndex } : t
        );
        updatedList.sort((a, b) => a.rowIndex - b.rowIndex);
        return updatedList;
      });
    }
  }
};




const handleDeleteTrainee = async () => {
  if (!traineeToDelete) return;

  const expectedText = "delete this trainee";
  
  if (deleteConfirmText !== expectedText) {
    toast.error("Confirmation text doesn't match. Please type exactly as shown.");
    return;
  }

  setIsDeleting(true);
  
  try {
    // First, delete related records from payments table
    const { error: paymentsError } = await tmsDb
      .from("payments")
      .delete()
      .eq("training_id", traineeToDelete.id);

    if (paymentsError) {
      console.error("Error deleting payments:", paymentsError);
      throw new Error("Failed to delete payment records");
    }

    // Delete from booking_summary if exists
    const { error: bookingError } = await tmsDb
      .from("booking_summary")
      .delete()
      .eq("training_id", traineeToDelete.id);

    if (bookingError) {
      console.error("Error deleting booking summary:", bookingError);
      // Continue anyway as this might not exist
    }

    // Finally, delete the trainee record
    const { error: traineeError } = await tmsDb
      .from("trainings")
      .delete()
      .eq("id", traineeToDelete.id);

    if (traineeError) {
      console.error("Error deleting trainee:", traineeError);
      throw new Error("Failed to delete trainee record");
    }

    // Update local state to remove the deleted trainee
    setTrainees((prev) => prev.filter((t) => t.id !== traineeToDelete.id));

    toast.success(`${traineeToDelete.first_name} ${traineeToDelete.last_name} has been deleted successfully`);
    
    // Reset and close dialog
    setDeleteDialogOpen(false);
    setTraineeToDelete(null);
    setDeleteConfirmText("");

  } catch (error: any) {
    console.error("Delete trainee error:", error);
    toast.error(error.message || "Failed to delete trainee. Please try again.");
  } finally {
    setIsDeleting(false);
  }
};

const handleInitiateDelete = (trainee: any) => {
  setTraineeToDelete(trainee);
  setDeleteConfirmText("");
  setDeleteDialogOpen(true);
};

const handleCancelDelete = () => {
  setDeleteDialogOpen(false);
  setTraineeToDelete(null);
  setDeleteConfirmText("");
};


const highlightId = searchParams.get("highlight")
const [highlightedRow, setHighlightedRow] = useState<string | null>(null)

useEffect(() => {
  if (highlightId && trainees.length > 0) {
    setHighlightedRow(highlightId);
    
    // Scroll to highlighted row
    setTimeout(() => {
      const element = document.getElementById(`trainee-row-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedRow(null);
    }, 2000);
  }
}, [highlightId, trainees]);


const updateStatus = async (status: string) => {
  if (!selectedTrainee || !scheduleId) return;

  let certNumber: string | null = null;

  try {
    if (status === "Pending Payment" || status === "Payment Completed") {
      const { data: scheduleData, error: scheduleError } = await tmsDb
        .from("schedules")
        .select("course_id")
        .eq("id", scheduleId)
        .single();
  
      if (scheduleError || !scheduleData) throw scheduleError;
  
      const { data: courseData, error: courseError } = await tmsDb
        .from("courses")
        .select("name, serial_number_pad")
        .eq("id", scheduleData.course_id)
        .single();
  
      if (courseError || !courseData) throw courseError;
  
      const courseName = courseData.name;
      const padLength = courseData.serial_number_pad || 6;
  
      const { count, error: countError } = await tmsDb
        .from("trainings")
        .select("certificate_number", { count: "exact", head: true })
        .eq("course_id", scheduleData.course_id)
        .not("certificate_number", "is", null);
  
      if (countError) throw countError;
  
      const nextNumber = (count ?? 0) + 1;
      const padded = nextNumber.toString().padStart(padLength, "0");
      certNumber = `PSI-${courseName}-${padded}`;
    }
  
    const updateData: any = {
      status,
      ...(certNumber && { certificate_number: certNumber }),
    };

    const currentStatus = selectedTrainee.status?.toLowerCase();
    const isVerifying = status === "Pending Payment" && (
      currentStatus === "pending" ||
      currentStatus === "awaiting receipt" ||
      currentStatus === "resubmitted (pending verification)"
    );
    
    if (isVerifying) {
      updateData.declined_photos = null;
      updateData.payment_status = null;
    }

    if (status === "Declined") {
      updateData.status = "Declined (Waiting for Resubmission)";
    }

    const { error: updateError } = await tmsDb
      .from("trainings")
      .update(updateData)
      .eq("id", selectedTrainee.id);
  
    if (updateError) throw updateError;
  
    setTrainees((prev) =>
      prev.map((t) =>
        t.id === selectedTrainee.id
          ? { 
              ...t, 
              status: updateData.status || status, 
              ...(certNumber && { certificate_number: certNumber }),
              ...(isVerifying && { declined_photos: null, payment_status: null })
            }
          : t
      )
    );
  
    setDialogOpen(false);
  
    toast.success(
      status === "Declined"
        ? "Photos declined. Trainee will receive resubmission link via email."
        : status === "Pending Payment"
        ? "Trainee verified successfully! Now pending payment."
        : status === "Payment Completed"
        ? "Payment completed successfully!"
        : `Status updated to ${status}.`
    );
    
  } catch (err: any) {
    console.error("Status update failed:", err);
    toast.error(`Failed to update status: ${err.message || "Unknown error"}`);
  }
};

  const handleQuickAction = (action: "paid" | "room" | "move") => {
  setBulkMode(action);
  setSelectedIds([]);
};

  const handleCancelBulk = () => {
    setBulkMode(null);
    setSelectedIds([]);
  };


const fetchAvailableSchedules = async () => {
  if (!scheduleId || !currentCourseId) return;

  try {
    // Fetch schedules
    const { data: schedules, error } = await tmsDb
      .from("schedules")
      .select(`
        id,
        schedule_type,
        event_type,
        branch,
        status,
        batch_number,
        schedule_dates(date),
        schedule_ranges(start_date, end_date)
      `)
      .eq("course_id", currentCourseId)
      .neq("id", scheduleId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch trainee counts for each schedule
    const schedulesWithCounts = await Promise.all(
      (schedules || []).map(async (schedule) => {
        const { count, error: countError } = await tmsDb
          .from("trainings")
          .select("*", { count: "exact", head: true })
          .eq("schedule_id", schedule.id);

        if (countError) {
          console.error("Error counting trainees:", countError);
          return { ...schedule, trainee_count: 0 };
        }

        return { ...schedule, trainee_count: count || 0 };
      })
    );

    setAvailableSchedules(schedulesWithCounts);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    toast.error("Failed to load available schedules");
  }
};

const handleMoveScheduleSubmit = () => {
  if (bulkMode === "move") {
    fetchAvailableSchedules();
    setMoveScheduleDialog(true);
  }
};

const handleBulkMoveSchedule = async () => {
  if (selectedIds.length === 0) {
    toast.error("Please select at least one trainee");
    return;
  }

  if (!selectedTargetSchedule) {
    toast.error("Please select a target schedule");
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
      setProgressCurrent(i + 1);

      const { error } = await tmsDb
        .from("trainings")
        .update({ schedule_id: selectedTargetSchedule })
        .eq("id", traineeId);

      if (error) {
        console.error(`Failed to move trainee ${traineeId}:`, error);
        failCount++;
      } else {
        successCount++;
      }
    }

    toast.success(
      `${successCount} trainee(s) moved successfully${
        failCount > 0 ? `, ${failCount} failed` : ""
      }`
    );

    setMoveScheduleDialog(false);
    setSelectedTargetSchedule("");
    handleCancelBulk();
    fetchTrainees();
  } catch (error) {
    console.error("Bulk move schedule error:", error);
    toast.error("Failed to move trainees");
  } finally {
    setProcessing(false);
    setProgressCurrent(0);
    setProgressTotal(0);
  }
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

        const { error: paymentError } = await tmsDb
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

        const { error: statusError } = await tmsDb
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
            groupChatLink
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
  const matchesSearch = fullName.includes(searchTerm.toLowerCase())
  
  if (!matchesSearch) return false
  
  // If showing duplicates only, check if trainee is in any duplicate group
  if (showDuplicatesOnly) {
    return Array.from(duplicateGroups.values()).some(group => 
      group.some(duplicate => duplicate.id === t.id)
    )
  }
  
  return true
})


  return (

     <>
    <style jsx>{`
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .blink-dot {
        animation: blink 1.5s ease-in-out infinite;
      }
    `}</style>
    
    <div className="p-6 space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href={`/training-schedules?tab=${fromTab}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
           {/* ✅ ADD THIS REFRESH BUTTON */}
          <div>
            {courseName && (
              <div className="flex flex-col">
                <p className="text-sm text-muted-foreground font-medium">
                  {courseName}
                  {batchNumber && (
                      <Badge variant="default" className="ml-2 text-xs">
                        Batch #{batchNumber}
                      </Badge>
                    )}
                  {scheduleDateText ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      • {scheduleDateText}
                    </span>
                  ) : null}
                </p>
              </div>
            )}

            <h1 className="text-2xl font-bold">Trainee Submissions</h1>
          </div>
        </div>
        
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
            onClick={
              bulkMode === "paid" 
                ? handleBulkMarkAsPaid 
                : bulkMode === "room" 
                ? handleRoomLinkSubmit 
                : handleMoveScheduleSubmit
            }
            disabled={selectedIds.length === 0 || processing}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing... ({progressCurrent}/{progressTotal})
              </>
            ) : bulkMode === "paid" ? (
              "Mark as Paid"
            ) : bulkMode === "room" ? (
              "Send Room Link"
            ) : (
              "Move Schedule"
            )}
          </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="cursor-pointer bg-primary hover:bg-primary/20 text-primary-foreground">
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
              <DropdownMenuItem onClick={() => handleQuickAction("move")} className="cursor-pointer">
                Move to Another Schedule
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  setShowDuplicatesOnly(!showDuplicatesOnly)
                  if (!showDuplicatesOnly) {
                    detectDuplicates()
                  }
                }} 
                className="cursor-pointer"
              >
                {showDuplicatesOnly ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Show All Entries
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    View Duplicate Entries
                    {duplicateGroups.size > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {Array.from(duplicateGroups.values()).reduce((sum, group) => sum + group.length, 0)}
                      </Badge>
                    )}
                  </>
                )}
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


{showDuplicatesOnly && (
  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <AlertCircle className="h-5 w-5 text-amber-600" />
    <div className="flex-1">
      <p className="text-sm font-medium text-amber-900">
        Showing Duplicate Entries Only
      </p>
      <p className="text-xs text-amber-700">
        Found {duplicateGroups.size} duplicate group(s) with {Array.from(duplicateGroups.values()).reduce((sum, group) => sum + group.length, 0)} trainee(s)
      </p>
    </div>
    <Button 
      size="sm" 
      variant="outline" 
      onClick={() => setShowDuplicatesOnly(false)}
      className="cursor-pointer"
    >
      Clear Filter
    </Button>
  </div>
)}

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
          <TableHead>PVC ID</TableHead>
          {!bulkMode && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoadingTrainees ? (
          // Skeleton rows
          Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`}>
              {bulkMode && (
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
              )}
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-10 w-10 rounded-full" />
              </TableCell>
              <TableCell> {/* ADD THIS */}
                <Skeleton className="h-6 w-16" />
              </TableCell>
              {!bulkMode && (
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              )}
            </TableRow>
          ))
        ) : filteredTrainees.length === 0 ? (
          // Empty state
          <TableRow>
            <TableCell 
                colSpan={bulkMode ? 7 : 8} 
                className="text-center py-8 text-muted-foreground"
              >
              No trainees found
            </TableCell>
          </TableRow>
        ) : (
          // Actual data
          filteredTrainees.map((trainee, index) => (
           <TableRow
  id={`trainee-row-${trainee.id}`}
  key={trainee.id}
  className={`
    ${bulkMode ? "" : "cursor-pointer"} 
    ${highlightedRow === trainee.id ? "bg-yellow-100 dark:bg-yellow-900/20 animate-pulse" : ""}
    transition-colors duration-300
  `}
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
              <TableCell>
  <div className="flex items-center gap-2">
    {hasPendingReceipt(trainee) && (
      <div 
        className="w-2 h-2 bg-orange-500 rounded-full blink-dot" 
        title="Pending receipt approval"
      />
    )}
    {Array.from(duplicateGroups.values()).some(group => 
      group.length > 1 && group.some(t => t.id === trainee.id)
    ) && (
      <Badge variant="destructive" className="text-xs px-1 py-0">
        DUP
      </Badge>
    )}
    <span>{trainee.first_name} {trainee.last_name}</span>
  </div>
</TableCell>
             <TableCell>
                <div className="flex items-center gap-2">
                  {hasPendingReceipt(trainee) && (
                    <div 
                      className="w-2 h-2 bg-orange-500 rounded-full blink-dot" 
                      title="Pending receipt approval"
                    />
                  )}
                  <span>{trainee.first_name} {trainee.last_name}</span>
                </div>
              </TableCell>
              <TableCell>{trainee.phone_number || "N/A"}</TableCell>
              <TableCell>
                {getStatusBadge(trainee.status || "Pending")}
              </TableCell>
              <TableCell>
                <Avatar>
                  <AvatarImage src={trainee.picture_2x2_url} alt="2x2" />
                  <AvatarFallback>
                    {trainee.first_name[0]}
                    {trainee.last_name[0]}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>
                {trainee.add_pvc_id ? (
                  <Badge className="bg-green-100 text-green-800 border border-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <XCircle className="w-3 h-3 mr-1" />
                    No
                  </Badge>
                )}
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
                      <DropdownMenuItem onClick={() => handleDeclinePhoto(trainee)}>
                        Decline Photos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive cursor-pointer"
                        onClick={() => handleInitiateDelete(trainee)}
                      >
                        Delete Trainee
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
</Card>

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
            <div>
              <Label htmlFor="group-chat-link">Group Chat Link</Label>
              <Input
                id="group-chat-link"
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                value={groupChatLink}
                onChange={(e) => setGroupChatLink(e.target.value)}
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
        onDecline={handleDeclineFromSubmission}
      />

     <DeclinePhotoDialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
        trainee={selectedTrainee}
        onSuccess={fetchTrainees}
      />

{/* Delete Confirmation Dialog */}
<Dialog open={deleteDialogOpen} onOpenChange={handleCancelDelete}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" />
        Delete Trainee
      </DialogTitle>
      <DialogDescription className="pt-2">
        This action cannot be undone. This will permanently delete the trainee record and all associated data including:
      </DialogDescription>
    </DialogHeader>

    {traineeToDelete && (
      <div className="space-y-4 py-4">
        {/* Warning Banner */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold mb-1">You are about to delete:</p>
              <p className="font-bold text-base">
                {traineeToDelete.first_name} {traineeToDelete.last_name}
              </p>
              <p className="text-xs text-red-600 mt-1">{traineeToDelete.email}</p>
            </div>
          </div>
        </div>

        {/* What will be deleted */}
        <div className="p-3 bg-gray-50 border rounded-lg">
          <p className="text-sm font-semibold mb-2">The following data will be permanently removed:</p>
          <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
            <li>Personal information and documents</li>
            <li>Payment records ({trainees.find(t => t.id === traineeToDelete.id)?.amount_paid ? `₱${Number(trainees.find(t => t.id === traineeToDelete.id)?.amount_paid).toLocaleString()}` : '₱0'})</li>
            <li>Booking summary</li>
            <li>All associated records</li>
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2">
          <Label htmlFor="delete-confirm" className="text-sm font-medium">
            To confirm deletion, type:{" "}
            <span className="font-mono font-bold text-red-600">
              delete this trainee
            </span>
          </Label>
          <Input
            id="delete-confirm"
            type="text"
            placeholder="delete this trainee"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className="font-mono"
            autoComplete="off"
          />
          {deleteConfirmText && deleteConfirmText !== "delete this trainee" && (
            <p className="text-xs text-red-600">
              Text doesn't match. Please type exactly: delete this trainee
            </p>
          )}
        </div>
      </div>
    )}

    <DialogFooter className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleCancelDelete}
        disabled={isDeleting}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={handleDeleteTrainee}
        disabled={
          isDeleting || 
          !traineeToDelete || 
          deleteConfirmText !== "delete this trainee"
        }
      >
        {isDeleting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            Delete Permanently
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


{/* Move Schedule Dialog */}
<Dialog open={moveScheduleDialog} onOpenChange={setMoveScheduleDialog}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MoveRight className="h-5 w-5" />
        Move to Another Schedule
      </DialogTitle>
      <DialogDescription>
        Select a schedule to move {selectedIds.length} selected trainee(s)
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Available Schedules for {courseName}</Label>
        <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-2">
          {availableSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No other schedules available for this course
            </p>
          ) : (
           availableSchedules.map((schedule) => {
  const formatScheduleDate = () => {
    if (schedule.schedule_type === "regular" && schedule.schedule_ranges?.length > 0) {
      const range = schedule.schedule_ranges[0];
      return `${new Date(range.start_date).toLocaleDateString()} - ${new Date(range.end_date).toLocaleDateString()}`;
    } else if (schedule.schedule_type === "staggered" && schedule.schedule_dates?.length > 0) {
      return schedule.schedule_dates
        .map((d: any) => new Date(d.date).toLocaleDateString())
        .join(", ");
    }
    return "No dates";
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ongoing":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "finished":
        return "bg-green-100 text-green-800 border-green-300";
      case "confirmed":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300";
      default: // planned
        return "bg-orange-100 text-orange-800 border-orange-300";
    }
  };

  return (
    <div
      key={schedule.id}
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        selectedTargetSchedule === schedule.id
          ? "border-primary bg-primary/5"
          : "hover:border-gray-400"
      }`}
      onClick={() => setSelectedTargetSchedule(schedule.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge 
              className={`text-xs border ${getStatusBadgeColor(schedule.status)}`}
            >
              {schedule.status || "Planned"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {schedule.schedule_type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {schedule.event_type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {schedule.branch}
            </Badge>
          </div>
          <p className="text-sm font-medium mb-1">{formatScheduleDate()}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {schedule.batch_number && (
              <span>Batch #{schedule.batch_number}</span>
            )}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-foreground">{schedule.trainee_count || 0}</span> 
              trainee{schedule.trainee_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <Checkbox
          checked={selectedTargetSchedule === schedule.id}
          onCheckedChange={() => setSelectedTargetSchedule(schedule.id)}
        />
      </div>
    </div>
  );
})
          )}
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => {
          setMoveScheduleDialog(false);
          setSelectedTargetSchedule("");
        }}
        disabled={processing}
      >
        Cancel
      </Button>
      <Button
        onClick={handleBulkMoveSchedule}
        disabled={!selectedTargetSchedule || processing}
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Moving... ({progressCurrent}/{progressTotal})
          </>
        ) : (
          <>
            <MoveRight className="h-4 w-4 mr-2" />
            Move Selected
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


    </div>
    </>
  )
}