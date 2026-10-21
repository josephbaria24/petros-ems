//app\submissions\page.tsx
"use client"

import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
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
import { CheckCircle, XCircle, Clock, Wallet, MoreVertical, Zap, PieChart, ArrowLeft, AlertCircle, Upload, MoveRight, Settings2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  const [submissionInitialTab, setSubmissionInitialTab] = useState<"info" | "payment">("info")
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
const [duplicateBasis, setDuplicateBasis] = useState<string[]>(['email'])


// ADD THIS FUNCTION to detect duplicates (around line 400, before filteredTrainees)
const detectDuplicates = () => {
  const groups = new Map<string, any[]>()
  
  trainees.forEach((trainee) => {
    const keys: string[] = []
    
    if (duplicateBasis.includes('email') && trainee.email) {
      keys.push(`email_${trainee.email.toLowerCase().trim()}`)
    }
    
    if (duplicateBasis.includes('phone') && trainee.phone_number) {
      keys.push(`phone_${trainee.phone_number.replace(/\s+/g, '').replace(/\+/g, '')}`)
    }
    
    if (duplicateBasis.includes('name') && trainee.first_name && trainee.last_name) {
      keys.push(`name_${trainee.first_name.toLowerCase().trim()}_${trainee.last_name.toLowerCase().trim()}`)
    }
    
    keys.forEach((key) => {
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
}, [trainees, duplicateBasis])

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


  const statusBadgeClass =
    "h-5 max-w-full gap-1 truncate border px-1.5 text-[10px] font-medium sm:h-6 sm:px-2 sm:text-xs [&_svg]:h-3 [&_svg]:w-3"

  const getStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase().trim() || "pending"

    switch (normalized) {
      case "pending":
        return (
          <Badge className={`${statusBadgeClass} border-orange-300 bg-orange-100 text-orange-800`}>
            <Clock />
            Pending
          </Badge>
        )
      case "awaiting receipt":
        return (
          <Badge className={`${statusBadgeClass} border-yellow-300 bg-yellow-100 text-yellow-800`}>
            <Clock />
            <span className="sm:hidden">Awaiting</span>
            <span className="hidden sm:inline">Awaiting Receipt</span>
          </Badge>
        )
      case "declined (waiting for resubmission)":
        return (
          <Badge className={`${statusBadgeClass} border-red-300 bg-red-100 text-red-800`}>
            <AlertCircle />
            <span className="sm:hidden">Declined</span>
            <span className="hidden sm:inline">Declined - Awaiting Resubmission</span>
          </Badge>
        )
      case "resubmitted (pending verification)":
        return (
          <Badge className={`${statusBadgeClass} border-purple-300 bg-purple-100 text-purple-800`}>
            <Upload />
            <span className="sm:hidden">Resubmitted</span>
            <span className="hidden sm:inline">Resubmitted - Pending Verification</span>
          </Badge>
        )
      case "pending payment":
        return (
          <Badge className={`${statusBadgeClass} border-yellow-300 bg-yellow-100 text-yellow-800`}>
            <Wallet />
            <span className="sm:hidden">Unpaid</span>
            <span className="hidden sm:inline">Pending Payment</span>
          </Badge>
        )
      case "partially paid":
        return (
          <Badge className={`${statusBadgeClass} border-blue-300 bg-blue-100 text-blue-800`}>
            <PieChart />
            Partial
          </Badge>
        )
      case "payment completed":
        return (
          <Badge className={`${statusBadgeClass} border-green-300 bg-green-100 text-green-800`}>
            <CheckCircle />
            Paid
          </Badge>
        )
      case "payment completed (discounted)":
        return (
          <Badge className={`${statusBadgeClass} border-green-300 bg-green-100 text-green-800`}>
            <Wallet />
            <span className="sm:hidden">Paid</span>
            <span className="hidden sm:inline">Payment Completed (Discounted)</span>
          </Badge>
        )
      case "partially paid (discounted)":
        return (
          <Badge className={`${statusBadgeClass} border-purple-300 bg-purple-100 text-purple-800`}>
            <PieChart />
            <span className="sm:hidden">Partial</span>
            <span className="hidden sm:inline">Partially Paid (Discounted)</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className={`${statusBadgeClass} text-muted-foreground`}>
            {status}
          </Badge>
        )
    }
  }
  



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
        event_type,
        branch,
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
  setCurrentCourseId(scheduleData.course_id); 
  setBatchNumber(scheduleData.batch_number);

  // Store the schedule info to attach to trainees
  // @ts-ignore
  const scheduleInfo = {
    id: scheduleId,
    event_type: scheduleData.event_type,
    schedule_type: scheduleData.schedule_type,
    branch: scheduleData.branch
  };
  localStorage.setItem(`schedule_info_${scheduleId}`, JSON.stringify(scheduleInfo));
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
        custom_data,
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
          training_fee,
          online_fee,
          face_to_face_fee,
          elearning_fee,
          pvc_id_type,
          pvc_student_price,
          pvc_professional_price
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

    const getBaseFee = (t: any) => {
      const et = scheduleData?.event_type?.toLowerCase();
      if (et === "online") return Number(t.courses?.online_fee) || 0;
      if (et === "face-to-face") return Number(t.courses?.face_to_face_fee) || 0;
      if (et === "elearning") return Number(t.courses?.elearning_fee) || 0;
      return Number(t.courses?.training_fee) || 0;
    };

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
        training_fee: getBaseFee(trainee),
        payments: trainee.payments || [],
        voucherInfo,
        rowIndex: index,
        schedules: {
          event_type: scheduleData?.event_type
        }
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
  if (!open) {
    setSubmissionInitialTab("info");
  }

  if (!open && selectedTrainee) {
    // ✅ Only refetch the specific trainee that was updated
    const { data: updatedTrainee } = await tmsDb
      .from("trainings")
      .select(`
        *,
        courses:course_id(
          id, 
          name, 
          training_fee,
          online_fee,
          face_to_face_fee,
          elearning_fee,
          pvc_id_type,
          pvc_student_price,
          pvc_professional_price
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

      const getBaseFee = (t: any) => {
        const et = selectedTrainee.schedules?.event_type?.toLowerCase();
        if (et === 'online') return Number(t.courses?.online_fee) || 0;
        if (et === 'face-to-face') return Number(t.courses?.face_to_face_fee) || 0;
        if (et === 'elearning') return Number(t.courses?.elearning_fee) || 0;
        return Number(t.courses?.training_fee) || 0;
      };

      const updated = {
        ...updatedTrainee,
        training_fee: getBaseFee(updatedTrainee),
        payments: updatedTrainee.payments || [],
        voucherInfo,
        schedules: {
          event_type: selectedTrainee.schedules?.event_type
        }
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
const openPaymentFromUrl = searchParams.get("openPayment") === "1"
const [highlightedRow, setHighlightedRow] = useState<string | null>(null)

useEffect(() => {
  if (!highlightId || trainees.length === 0 || !scheduleId) return

  const trainee = trainees.find((t) => t.id === highlightId)
  if (!trainee) return

  if (openPaymentFromUrl) {
    setSelectedTrainee(trainee)
    setSubmissionInitialTab("payment")
    setDialogOpen(true)
    setHighlightedRow(null)
    router.replace(
      `/submissions?scheduleId=${scheduleId}&from=${encodeURIComponent(fromTab)}`,
      { scroll: false }
    )
    return
  }

  setHighlightedRow(highlightId)

  const scrollTimer = setTimeout(() => {
    const candidates = document.querySelectorAll<HTMLElement>(
      `[data-trainee-row="${highlightId}"]`
    )
    const element =
      Array.from(candidates).find((el) => el.getClientRects().length > 0) ||
      candidates[0]
    element?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, 100)

  const clearTimer = setTimeout(() => {
    setHighlightedRow(null)
  }, 2000)

  return () => {
    clearTimeout(scrollTimer)
    clearTimeout(clearTimer)
  }
}, [highlightId, openPaymentFromUrl, trainees, scheduleId, fromTab, router])


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

  const handleOpenEmailComposer = () => {
    if (!scheduleId) {
      toast.error("Schedule ID is required")
      return
    }
    router.push(`/submissions/email?scheduleId=${scheduleId}&from=${encodeURIComponent(fromTab)}`)
  }

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

        const listPrice = Number(trainee.training_fee) || 0
        const discounted =
          trainee.has_discount && trainee.discounted_fee != null
            ? Number(trainee.discounted_fee)
            : null
        const pvcFee = trainee.add_pvc_id ? Number(trainee.pvc_fee ?? 0) : 0
        const amountDue =
          (discounted != null && Number.isFinite(discounted) ? discounted : listPrice) + pvcFee

        const { error: paymentError } = await tmsDb
          .from("payments")
          .insert({
            training_id: traineeId,
            payment_method: trainee.payment_method || "Counter",
            payment_status: "completed",
            amount_paid: amountDue,
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
  const email = (t.email || "").toLowerCase()
  const searchLower = searchTerm.toLowerCase()
  
  const matchesSearch = fullName.includes(searchLower) || email.includes(searchLower)
  
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
    
    <div className="page-shell min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Link href={`/training-schedules?tab=${fromTab}`} className="shrink-0">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="sm:inline">Back</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            {courseName ? (
              <div className="mb-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                  {courseName}
                </p>
                {batchNumber ? (
                  <Badge variant="default" className="h-5 shrink-0 px-1.5 text-[10px]">
                    Batch #{batchNumber}
                  </Badge>
                ) : null}
                {scheduleDateText ? (
                  <span className="truncate text-[10px] text-muted-foreground sm:text-xs">
                    • {scheduleDateText}
                  </span>
                ) : null}
              </div>
            ) : null}
            <h1 className="page-title text-xl font-bold tracking-tight sm:text-2xl">
              Trainee Submissions
            </h1>
          </div>
        </div>

        {bulkMode ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-7 px-2 text-xs">
              {selectedIds.length} selected
            </Badge>
            {processing && (
              <Badge variant="secondary" className="h-7 px-2 text-xs">
                {progressCurrent} / {progressTotal}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleCancelBulk}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8"
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
                  <Spinner size={18} className="mr-1.5" />
                  <span className="sm:hidden">…</span>
                  <span className="hidden sm:inline">
                    Processing... ({progressCurrent}/{progressTotal})
                  </span>
                </>
              ) : bulkMode === "paid" ? (
                "Mark Paid"
              ) : bulkMode === "room" ? (
                "Send Link"
              ) : (
                "Move"
              )}
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 px-2 sm:flex-none">
                  <Settings2 className="h-4 w-4" />
                  <span className="sm:hidden">Duplicates</span>
                  <span className="hidden sm:inline">Duplication Config</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Duplication Basis</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose which fields to check for duplicates.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="basis-name"
                        checked={duplicateBasis.includes("name")}
                        onCheckedChange={(checked) => {
                          if (checked) setDuplicateBasis((prev) => [...prev, "name"])
                          else setDuplicateBasis((prev) => prev.filter((b) => b !== "name"))
                        }}
                      />
                      <Label htmlFor="basis-name" className="cursor-pointer">
                        Full Name
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="basis-email"
                        checked={duplicateBasis.includes("email")}
                        onCheckedChange={(checked) => {
                          if (checked) setDuplicateBasis((prev) => [...prev, "email"])
                          else setDuplicateBasis((prev) => prev.filter((b) => b !== "email"))
                        }}
                      />
                      <Label htmlFor="basis-email" className="cursor-pointer">
                        Email Address
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="basis-phone"
                        checked={duplicateBasis.includes("phone")}
                        onCheckedChange={(checked) => {
                          if (checked) setDuplicateBasis((prev) => [...prev, "phone"])
                          else setDuplicateBasis((prev) => prev.filter((b) => b !== "phone"))
                        }}
                      />
                      <Label htmlFor="basis-phone" className="cursor-pointer">
                        Phone Number
                      </Label>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1.5 bg-primary px-2 text-white hover:bg-primary/90 sm:flex-none dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
                >
                  <Zap className="h-4 w-4" />
                  <span className="sm:hidden">Actions</span>
                  <span className="hidden sm:inline">Quick Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleQuickAction("paid")} className="cursor-pointer">
                  Quick Mark as Paid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickAction("room")} className="cursor-pointer">
                  Quick Send Room Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenEmailComposer} className="cursor-pointer">
                  Send Email to Participants
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
                      <XCircle className="mr-2 h-4 w-4" />
                      Show All Entries
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      View Duplicate Entries
                      {duplicateGroups.size > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {Array.from(duplicateGroups.values()).reduce(
                            (sum, group) => sum + group.length,
                            0
                          )}
                        </Badge>
                      )}
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Input
        type="text"
        placeholder="Search trainee..."
        className="h-9 w-full max-w-md"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {showDuplicatesOnly && (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 sm:flex-row sm:items-center sm:gap-2 sm:p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Showing duplicates only
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {duplicateGroups.size} group(s) ·{" "}
                {Array.from(duplicateGroups.values()).reduce((sum, group) => sum + group.length, 0)}{" "}
                trainee(s)
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDuplicatesOnly(false)}
            className="h-8 shrink-0"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {isLoadingTrainees ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={`m-skel-${index}`} className="gap-0 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </Card>
          ))
        ) : filteredTrainees.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground shadow-sm">
            No trainees found
          </Card>
        ) : (
          filteredTrainees.map((trainee, index) => {
            const isDup = Array.from(duplicateGroups.values()).some(
              (group) => group.length > 1 && group.some((t) => t.id === trainee.id)
            )
            return (
              <Card
                key={trainee.id}
                data-trainee-row={trainee.id}
                className={`gap-0 overflow-hidden p-0 shadow-sm transition-colors ${
                  bulkMode ? "" : "cursor-pointer active:bg-muted/40"
                } ${
                  highlightedRow === trainee.id
                    ? "bg-yellow-100 dark:bg-yellow-900/20"
                    : ""
                }`}
                onClick={() => !bulkMode && handleView(trainee)}
              >
                <div className="flex items-start gap-2.5 p-3">
                  {bulkMode ? (
                    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(trainee.id)}
                        onCheckedChange={() => handleRowSelect(trainee.id)}
                      />
                    </div>
                  ) : null}
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={trainee.picture_2x2_url} alt="2x2" />
                    <AvatarFallback className="text-xs">
                      {trainee.first_name?.[0]}
                      {trainee.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
                          {hasPendingReceipt(trainee) ? (
                            <span
                              className="blink-dot h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"
                              title="Pending receipt approval"
                            />
                          ) : null}
                          {isDup ? (
                            <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                              DUP
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-sm font-semibold leading-tight">
                          {trainee.first_name} {trainee.last_name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {trainee.email || "No email"}
                          {trainee.phone_number ? ` · ${trainee.phone_number}` : ""}
                        </p>
                      </div>
                      {!bulkMode ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
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
                                className="cursor-pointer text-destructive"
                                onClick={() => handleInitiateDelete(trainee)}
                              >
                                Delete Trainee
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {getStatusBadge(trainee.status || "Pending")}
                      {trainee.add_pvc_id ? (
                        <Badge className="h-5 border border-green-300 bg-green-100 px-1.5 text-[10px] text-green-800">
                          PVC
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden min-w-0 overflow-hidden shadow-sm md:block">
        <div className="table-scroll max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {bulkMode && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedIds.length === filteredTrainees.length &&
                        filteredTrainees.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>PVC ID</TableHead>
                {!bulkMode && <TableHead className="w-12">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTrainees ? (
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
                      <Skeleton className="h-4 w-40" />
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
                    <TableCell>
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
                <TableRow>
                  <TableCell
                    colSpan={bulkMode ? 9 : 8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No trainees found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrainees.map((trainee, index) => (
                  <TableRow
                    data-trainee-row={trainee.id}
                    key={trainee.id}
                    className={`${bulkMode ? "" : "cursor-pointer"} ${
                      highlightedRow === trainee.id
                        ? "bg-yellow-100 animate-pulse dark:bg-yellow-900/20"
                        : ""
                    } transition-colors duration-300`}
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
                            className="blink-dot h-2 w-2 rounded-full bg-orange-500"
                            title="Pending receipt approval"
                          />
                        )}
                        {Array.from(duplicateGroups.values()).some(
                          (group) =>
                            group.length > 1 && group.some((t) => t.id === trainee.id)
                        ) && (
                          <Badge variant="destructive" className="px-1 py-0 text-xs">
                            DUP
                          </Badge>
                        )}
                        <span>
                          {trainee.first_name} {trainee.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{trainee.email || "N/A"}</TableCell>
                    <TableCell>{trainee.phone_number || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(trainee.status || "Pending")}</TableCell>
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
                        <Badge className="border border-green-300 bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="mr-1 h-3 w-3" />
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
                              className="cursor-pointer text-destructive"
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
                  <Spinner size={18} className="mr-2" />
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
        initialTab={submissionInitialTab}
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
            <Spinner size={18} className="mr-2" />
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
            <Spinner size={18} className="mr-2" />
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