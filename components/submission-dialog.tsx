//components/submission-dialog.tsx - FIXED FLOW (Part 1 - Replace entire component)
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2, Download, Trash2, ChevronDown, Edit, User, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

interface Payment {
  id: string;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  receipt_link: string | null;
  online_classroom_url: string | null;
  receipt_uploaded_by: string | null;
  receipt_uploaded_at: string | null;
}

interface SubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainee: any;
  onVerify: () => void;
  onDecline: () => void; // This will now open decline dialog
}

export function SubmissionDialog({
  open,
  onOpenChange,
  trainee,
  onVerify,
  onDecline, // Will be used to open decline photo dialog
}: SubmissionDialogProps) {
  const [showPaidConfirm, setShowPaidConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [onlineClassroomUrl, setOnlineClassroomUrl] = useState<string>("");
  const supabase = createClient();
  const [isDiscounted, setIsDiscounted] = useState(false);
  const [discountPrice, setDiscountPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [discountApplied, setDiscountApplied] = useState<number | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Add these new state variables after the existing ones (around line 85)
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [decliningPayment, setDecliningPayment] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);


  const [voucherInfo, setVoucherInfo] = useState<any>(null);
  
  const [pvcIdFee, setPvcIdFee] = useState<number>(0);

  const [newDetails, setNewDetails] = useState({
    company_name: trainee?.company_name || "",
    gender: trainee?.gender || "",
    age: trainee?.age || "",
    phone_number: trainee?.phone_number || "",
    food_restriction: trainee?.food_restriction || "",
  });
  const [show2x2ViewModal, setShow2x2ViewModal] = useState(false);
  const [showIdViewModal, setShowIdViewModal] = useState(false);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  const [newAddress, setNewAddress] = useState({
    mailing_street: trainee?.mailing_street || "",
    mailing_city: trainee?.mailing_city || "",
    mailing_province: trainee?.mailing_province || "",
  });

const fetchPayments = async () => {
  if (!trainee?.id) return;
  
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("training_id", trainee.id)
    .order("payment_date", { ascending: false });

  if (!error && data) {
    setPayments(data);
    
    // Calculate total including PVC fee if applicable
    const paymentTotal = data.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const pvcFee = trainee.add_pvc_id ? 150 : 0;
    setPvcIdFee(pvcFee);
    
    await supabase
      .from("trainings")
      .update({ amount_paid: paymentTotal })
      .eq("id", trainee.id);
  }
};


// Separate function to fetch voucher details
const fetchVoucherInfo = async () => {
  console.log("fetchVoucherInfo called", { 
    traineeId: trainee?.id,
    hasDiscount: trainee?.has_discount,
    discountedFee: trainee?.discounted_fee 
  });

  // Reset voucher info first
  setVoucherInfo(null);

  if (!trainee?.has_discount || !trainee?.discounted_fee) {
    console.log("No discount applied, skipping voucher fetch");
    return;
  }

  try {
    // Method 1: Try to find via voucher_usage table (most accurate)
    const { data: usageData, error: usageError } = await supabase
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
      .eq("training_id", trainee.id)
      .single();

    if (!usageError && usageData?.vouchers) {
      console.log("Found voucher via usage table:", usageData.vouchers);
      setVoucherInfo(usageData.vouchers);
      return;
    }

    // Method 2: Calculate and find matching voucher
    console.log("Trying to find voucher by calculation...");
    const originalFee = Number(trainee.courses?.training_fee) || Number(trainee.training_fee) || 0;
    const discountedFee = Number(trainee.discounted_fee);
    const discountAmount = originalFee - discountedFee;

    console.log("Discount calculation:", {
      originalFee,
      discountedFee,
      discountAmount
    });

    // Get all vouchers for this course
    const { data: vouchers, error: voucherError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("service_id", trainee.course_id)
      .order("created_at", { ascending: false });

    if (voucherError) {
      console.error("Error fetching vouchers:", voucherError);
      return;
    }

    console.log("Found vouchers:", vouchers?.length);

    if (vouchers && vouchers.length > 0) {
      // Find matching voucher
      for (const voucher of vouchers) {
        let matches = false;

        if (voucher.voucher_type === "Free") {
          matches = Math.abs(discountAmount - originalFee) < 1;
        } else {
          const vAmount = voucher.amount.replace(/₱/g, "").replace(/,/g, "").trim();
          
          if (vAmount.includes("%")) {
            const percent = parseFloat(vAmount.replace("%", ""));
            const calculatedDiscount = (originalFee * percent) / 100;
            matches = Math.abs(calculatedDiscount - discountAmount) < 1;
          } else {
            matches = Math.abs(parseFloat(vAmount) - discountAmount) < 1;
          }
        }

        if (matches) {
          console.log("Found matching voucher:", voucher);
          setVoucherInfo(voucher);
          return;
        }
      }
    }

    // Method 3: Create generic voucher display if no exact match
    console.log("Creating generic voucher info");
    const genericVoucher = {
      code: "DISCOUNT",
      voucher_type: discountAmount >= originalFee ? "Free" : "Discount",
      amount: discountAmount >= originalFee 
        ? "Free" 
        : `₱${discountAmount.toLocaleString()}`,
      service: trainee.courses?.name || "Applied Discount",
      is_batch: false
    };
    
    console.log("Setting generic voucher:", genericVoucher);
    setVoucherInfo(genericVoucher);

  } catch (err) {
    console.error("Error fetching voucher info:", err);
  }
};



const fetchFreshTrainee = async () => {
  if (!trainee?.id) return null;

  const { data, error } = await supabase
    .from("trainings")
    .select(`
      *,
      courses:course_id (
        training_fee,
        name
      )
    `)
    .eq("id", trainee.id)
    .single();

  if (error) {
    console.error("Failed to refetch trainee:", error);
    return null;
  }

  return {
    ...data,
    training_fee: data.courses?.training_fee || 0,
    courses: data.courses,
  };
};


const checkAndUpdatePaymentStatus = async (totalPaid: number) => {
  if (!trainee?.id || !trainee?.training_fee) return;

  const originalFee = Number(trainee.training_fee);
  const discountedFee = discountApplied !== null ? Number(discountApplied) : null;
  const pvcFee = trainee.add_pvc_id ? 150 : 0;

  const currentStatus = trainee.status?.toLowerCase();
  if (
    currentStatus === "pending" ||
    currentStatus === "awaiting receipt" ||
    currentStatus === "declined (waiting for resubmission)" ||
    currentStatus === "resubmitted (pending verification)"
  ) {
    return;
  }

  let newStatus = "";
  let newPaymentStatus: string | null = null;
  const totalRequired = (discountedFee !== null ? discountedFee : originalFee) + pvcFee;

  if (discountedFee !== null) {
    if (totalPaid >= totalRequired) {
      newStatus = "Payment Completed";
      newPaymentStatus = trainee.add_pvc_id 
        ? "Payment Completed (Discounted + PVC)" 
        : "Payment Completed (Discounted)";
    } else if (totalPaid > 0) {
      newStatus = "Partially Paid";
      newPaymentStatus = trainee.add_pvc_id 
        ? "Partially Paid (Discounted + PVC)" 
        : "Partially Paid (Discounted)";
    } else {
      newStatus = "Pending Payment";
      newPaymentStatus = null;
    }
  } else {
    if (totalPaid >= totalRequired) {
      newStatus = "Payment Completed";
      newPaymentStatus = trainee.add_pvc_id 
        ? "Payment Completed (with PVC)" 
        : "Payment Completed";
    } else if (totalPaid > 0) {
      newStatus = "Partially Paid";
      newPaymentStatus = trainee.add_pvc_id 
        ? "Partially Paid (with PVC)" 
        : "Partially Paid";
    } else {
      newStatus = "Pending Payment";
      newPaymentStatus = null;
    }
  }

  await supabase
    .from("trainings")
    .update({
      status: newStatus,
      payment_status: newPaymentStatus,
    })
    .eq("id", trainee.id);
};

useEffect(() => {
  if (!open || !trainee?.id) return;

  let cancelled = false;

  const loadDialogData = async () => {
    // ✅ FIXED: Use passed trainee prop instead of refetching to prevent flickering
    const currentTrainee = trainee;
    
    if (!currentTrainee || cancelled) return;

    const hasDiscount = currentTrainee.has_discount ?? false;
    const discountedFee = currentTrainee.discounted_fee ?? null;

    setIsDiscounted(hasDiscount);
    setDiscountApplied(discountedFee);
    setDiscountPrice(discountedFee !== null ? String(discountedFee) : "");

    // ✅ Use courses.training_fee for percentage calculation
    const originalFee = Number(currentTrainee.courses?.training_fee) || 0;
    
    if (hasDiscount && discountedFee !== null && originalFee > 0) {
      const percent = ((originalFee - discountedFee) / originalFee) * 100;
      setDiscountPercent(Math.round(percent));
    } else {
      setDiscountPercent(null);
    }

    // Fetch payments
    await fetchPayments();

    // Fetch voucher info if discount applied
    if (hasDiscount && discountedFee !== null) {
      await fetchVoucherInfo();
    }
  };

  loadDialogData();

  return () => {
    cancelled = true;
  };
}, [open, trainee?.id]);





  useEffect(() => {
    if (!isDiscounted || !trainee?.training_fee) {
      setDiscountPercent(null);
      return;
    }

    const original = Number(trainee.training_fee);
    const discounted = Number(discountPrice);

    if (!discounted || discounted <= 0 || discounted > original) {
      setDiscountPercent(null);
      return;
    }

    const percent = ((original - discounted) / original) * 100;
    setDiscountPercent(Math.round(percent));
  }, [isDiscounted, discountPrice, trainee?.training_fee]);

  useEffect(() => {
    if (open && trainee?.id) {
      fetchPayments();
    }
  }, [open, trainee?.id]);

  useEffect(() => {
  if (open && trainee?.has_discount && trainee?.discounted_fee && !voucherInfo) {
    console.log("Discount detected but no voucher info, fetching...");
    fetchVoucherInfo();
  }
}, [open, trainee?.has_discount, trainee?.discounted_fee, voucherInfo]);


  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approveAmount, setApproveAmount] = useState<string>("");
  const [approveType, setApproveType] = useState<'full' | 'half' | 'custom'>('full');

  if (!trainee) return null;

   const normalizedStatus = trainee.status?.toLowerCase().trim();

  const needsPhotoVerification = 
    normalizedStatus === "pending" ||
    normalizedStatus === "awaiting receipt" ||
    normalizedStatus === "resubmitted (pending verification)";

  const isInitialSubmission = 
    normalizedStatus === "pending" ||
    normalizedStatus === "awaiting receipt";

  const isResubmission = 
    normalizedStatus === "resubmitted (pending verification)";

  const isDeclinedAwaitingResubmission = 
    normalizedStatus === "declined (waiting for resubmission)";

  // ✅ For all other statuses (Pending Payment, Partially Paid, Payment Completed, etc.)
  const showFullDetailsView = !needsPhotoVerification && !isDeclinedAwaitingResubmission;

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  const isPending = trainee.status?.toLowerCase() === "pending";



  const isCounterPayment = trainee.payment_method?.toUpperCase() === "COUNTER";
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const hasPayments = payments.length > 0;

  const handleFollowUp = async () => {
    setSendingFollowUp(true);
    try {
      const declinedInfo = trainee.declined_photos;
      const token = declinedInfo?.token || crypto.randomUUID();
      const reuploadUrl = `${window.location.origin}/reupload?token=${token}&traineeId=${trainee.id}`;

      const declinedPhotos = [];
      if (declinedInfo?.id_picture) declinedPhotos.push("ID Picture");
      if (declinedInfo?.picture_2x2) declinedPhotos.push("2x2 Picture");

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .declined-list { background: white; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Follow-Up: Photo Resubmission Required</h2>
            </div>
            <div class="content">
              <p>Dear ${trainee.first_name} ${trainee.last_name},</p>
              
              <p>This is a follow-up reminder that we are still waiting for your resubmitted photos.</p>
              
              <div class="declined-list">
                <strong>Photos Requiring Resubmission:</strong>
                <ul>
                  ${declinedPhotos.map(photo => `<li>${photo}</li>`).join('')}
                </ul>
              </div>
              
              <p>Please re-upload the required photo(s) by clicking the button below:</p>
              
              <a href="${reuploadUrl}" class="button">Re-upload Photos Now</a>
              
              <p><small>If you have questions, please contact us.</small></p>
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: trainee.email,
          subject: "Follow-Up: Photo Resubmission Required",
          message: emailContent,
        }),
      });

      if (!response.ok) throw new Error("Failed to send follow-up email");

      alert("Follow-up email sent successfully!");
    } catch (error) {
      console.error("Error sending follow-up:", error);
      alert("Failed to send follow-up email");
    } finally {
      setSendingFollowUp(false);
    }
  };


  const handleFileSelect = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("receipt", file);

        const response = await fetch("/api/upload-receipt", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");

        const { url } = await response.json();
        
        setUploadedReceiptUrl(url);
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => setPreviewImage(e.target?.result as string);
          reader.readAsDataURL(file);
        } else {
          setPreviewImage("");
        }
        setShowPreviewDialog(true);
      } catch (error) {
        console.error("Error uploading receipt:", error);
        alert("Failed to upload receipt. Please try again.");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleSavePayment = async (sendEmail: boolean, sendClassroom: boolean) => {
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
  
    setSaving(true);
    try {
      const finalAmount = Number(amountPaid);
      const discountedFee = discountApplied ?? Number(trainee.training_fee);
      let finalStatus = "pending";

      if (finalAmount >= discountedFee) {
        finalStatus = isDiscounted ? "Payment Completed (Discounted)" : "Payment Completed";
      } else if (finalAmount > 0) {
        finalStatus = isDiscounted ? "Partially Paid (Discounted)" : "Partially Paid";
      }

      const payload = {
        training_id: trainee.id,
        payment_method: trainee.payment_method,
        payment_status: finalStatus,
        amount_paid: finalAmount,
        receipt_link: uploadedReceiptUrl || null,
        online_classroom_url: sendClassroom ? onlineClassroomUrl : null,
        confirmation_email_sent: sendEmail,
        classroom_url_sent: sendClassroom,
        receipt_uploaded_by: 'admin',
      };

      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert("Invalid amount. Please enter a valid number.");
        return;
      }

      const { data, error } = await supabase
        .from("payments")
        .insert(payload)
        .select();

      if (error) throw error;

      const newTotalPaid = totalPaid + parseFloat(amountPaid);
      await checkAndUpdatePaymentStatus(newTotalPaid);

      if (sendEmail || sendClassroom) {
        try {
          const notifyRes = await fetch("/api/send-payment-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              traineeEmail: trainee.email,
              traineeName: `${trainee.first_name} ${trainee.last_name}`,
              amount: parseFloat(amountPaid),
              sendConfirmation: sendEmail,
              sendClassroom: sendClassroom,
              classroomUrl: sendClassroom ? onlineClassroomUrl : null,
            }),
          });
      
          if (notifyRes.ok) {
            alert("Payment saved and email sent successfully!");
          } else {
            alert("Payment saved, but email failed to send.");
          }
        } catch (emailError) {
          console.error("Error sending email notification:", emailError);
          alert("Payment saved, but email notification failed.");
        }
      } else {
        alert("Payment saved successfully!");
      }
      
      setShowPreviewDialog(false);
      setAmountPaid("");
      setOnlineClassroomUrl("");
      setUploadedReceiptUrl("");
      setPreviewImage("");
      fetchPayments();
      
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Failed to save payment. Check console for details.");
    } finally {
      setSaving(false);
    }
  };
  
const handleApplyDiscount = async () => {
  if (!discountPrice || Number(discountPrice) <= 0) {
    alert("Please enter a valid discounted price.");
    return;
  }

  const originalFee = Number(trainee.training_fee);
  const discounted = Number(discountPrice);

  if (discounted > originalFee) {
    alert("Discounted price cannot be higher than original fee.");
    return;
  }

  setApplyingDiscount(true); // Add loading state
  try {
    const totalPaidNow = payments.reduce(
      (sum, p) => sum + (p.amount_paid || 0),
      0
    );

    if (totalPaidNow >= discounted) {
      await supabase
        .from("trainings")
        .update({
          status: "Payment Completed",
          payment_status: "Payment Completed (Discounted)",
          amount_paid: totalPaidNow,
          discounted_fee: discounted,
          has_discount: true,
        })
        .eq("id", trainee.id);
    } else if (totalPaidNow > 0) {
      await supabase
        .from("trainings")
        .update({
          status: "Partially Paid",
          payment_status: "Partially Paid (Discounted)",
          amount_paid: totalPaidNow,
          discounted_fee: discounted,
          has_discount: true,
        })
        .eq("id", trainee.id);
    } else {
      await supabase
        .from("trainings")
        .update({
          status: "Pending Payment",
          payment_status: null,
          amount_paid: 0,
          discounted_fee: discounted,
          has_discount: true,
        })
        .eq("id", trainee.id);
    }

    alert("Discount applied successfully!");
    setDiscountApplied(discounted);
    fetchPayments();
  } catch (err) {
    console.error("Error applying discount:", err);
    alert("Failed to apply discount.");
  } finally {
    setApplyingDiscount(false); // Reset loading state
  }
};

const handleApprovePayment = async () => {
  if (!selectedPaymentId) return;

  let finalAmount = 0;
  const fee = discountApplied ?? Number(trainee.training_fee);
  const remainingBalance = fee - totalPaid;

  if (approveType === 'full') {
    finalAmount = remainingBalance;
  } else if (approveType === 'half') {
    finalAmount = remainingBalance / 2;
  } else if (approveType === 'custom') {
    finalAmount = Number(approveAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (finalAmount > remainingBalance) {
      alert(`Amount cannot exceed remaining balance of ${formatCurrency(remainingBalance)}`);
      return;
    }
  }

  setSaving(true);
  try {
    const newTotal = totalPaid + finalAmount;
    const discountedFee = discountApplied ?? Number(trainee.training_fee);
    
    let finalStatus = 'completed';
    if (newTotal >= discountedFee) {
      finalStatus = isDiscounted ? 'Payment Completed (Discounted)' : 'Payment Completed';
    } else if (newTotal > 0) {
      finalStatus = isDiscounted ? 'Partially Paid (Discounted)' : 'Partially Paid';
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        payment_status: finalStatus,
        amount_paid: finalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedPaymentId);

    if (updateError) throw updateError;

    // Update training record
    await supabase
      .from('trainings')
      .update({
        amount_paid: newTotal,
        payment_status: finalStatus,
        status: newTotal >= discountedFee ? 'Payment Completed' : 'Partially Paid',
      })
      .eq('id', trainee.id);

    // Get course details for email
    const { data: courseData } = await supabase
      .from('courses')
      .select('name')
      .eq('id', trainee.course_id)
      .single();

    // Send approval email to client
    try {
      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white; 
              padding: 30px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content { 
              padding: 30px; 
            }
            .success-icon {
              text-align: center;
              font-size: 48px;
              margin-bottom: 20px;
            }
            .info-box { 
              background: #f0fdf4; 
              padding: 20px; 
              border-left: 4px solid #10b981; 
              margin: 20px 0;
              border-radius: 4px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              color: #6b7280;
              font-weight: 600;
            }
            .value {
              color: #111827;
              font-weight: 500;
            }
            .amount {
              font-size: 24px;
              color: #10b981;
              font-weight: bold;
              text-align: center;
              margin: 20px 0;
            }
            .footer { 
              background: #f9fafb; 
              padding: 20px; 
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Payment Approved!</h1>
            </div>
            <div class="content">
              <div class="success-icon">🎉</div>
              
              <p>Dear ${trainee.first_name} ${trainee.last_name},</p>
              
              <p>Great news! Your payment has been successfully verified and approved.</p>
              
              <div class="amount">
                ₱${finalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Course:</span>
                  <span class="value">${courseData?.name || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Payment Amount:</span>
                  <span class="value">₱${finalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Total Paid:</span>
                  <span class="value">₱${newTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Remaining Balance:</span>
                  <span class="value">₱${(discountedFee - newTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Status:</span>
                  <span class="value" style="color: #10b981; font-weight: bold;">${finalStatus}</span>
                </div>
              </div>
              
              ${newTotal >= discountedFee 
                ? `<p style="color: #10b981; font-weight: bold; text-align: center; font-size: 18px;">
                     🎊 Congratulations! Your payment is now complete!
                   </p>`
                : `<p style="color: #f59e0b; font-weight: 600;">
                     Please note: You still have a remaining balance of ₱${(discountedFee - newTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}.
                   </p>`
              }
              
              <p>If you have any questions, please don't hesitate to contact us.</p>
              
              <p>Best regards,<br><strong>Petrosphere Incorporated</strong></p>
            </div>
            <div class="footer">
              <p><strong>Petrosphere Incorporated</strong></p>
              <p>Unit 305 3F, Trigold Business Park, Barangay San Pedro</p>
              <p>Puerto Princesa City, 5300 Palawan, Philippines</p>
              <p>📞 0917 708 7994 | 📧 sales@petrosphere.com.ph</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: trainee.email,
          subject: '✓ Payment Approved - Petrosphere Incorporated',
          message: emailContent,
        }),
      });

      console.log('Approval email sent successfully');
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the whole operation if email fails
    }

    alert('Payment approved and client notified!');
    setShowApproveDialog(false);
    setSelectedPaymentId(null);
    setApproveAmount('');
    setApproveType('full');
    fetchPayments();

  } catch (error) {
    console.error('Error approving payment:', error);
    alert('Failed to approve payment. Please try again.');
  } finally {
    setSaving(false);
  }
};

 const handleDeclinePayment = async (paymentId: string) => {
  const confirm = window.confirm(
    'Are you sure you want to decline this payment? The client will be notified to upload a clearer receipt.'
  );
  
  if (!confirm) return;

  setDecliningPayment(paymentId); // Set loading state with payment ID
  try {
    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) throw deleteError;

    try {
      await fetch('/api/send-payment-rejection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traineeEmail: trainee.email,
          traineeName: `${trainee.first_name} ${trainee.last_name}`,
        }),
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    alert('Payment declined and client notified.');
    fetchPayments();

  } catch (error) {
    console.error('Error declining payment:', error);
    alert('Failed to decline payment. Please try again.');
  } finally {
    setDecliningPayment(null); // Reset loading state
  }
};

  const handleMarkAsPaid = async () => {
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("payments")
        .insert({
          training_id: trainee.id,
          payment_method: trainee.payment_method,
          payment_status: "completed",
          amount_paid: parseFloat(amountPaid),
          receipt_link: null,
          receipt_uploaded_by: 'admin',
        });

      if (error) throw error;

      const newTotalPaid = totalPaid + parseFloat(amountPaid);
      await checkAndUpdatePaymentStatus(newTotalPaid);

      alert("Payment marked as paid successfully!");
      setShowPaidConfirm(false);
      setAmountPaid("");
      fetchPayments();
    } catch (error) {
      console.error("Error marking as paid:", error);
      alert("Failed to mark as paid. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async () => {
  if (!deleteId) return;

  setDeletingPayment(true); // Add loading state
  try {
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", deleteId);

    if (error) throw error;

    const { data: newPayments } = await supabase
      .from("payments")
      .select("*")
      .eq("training_id", trainee.id);

    if (!newPayments || newPayments.length === 0) {
      await supabase
        .from("trainings")
        .update({
          status: "Pending Payment",
          payment_status: null,
          amount_paid: 0
        })
        .eq("id", trainee.id);
    } else {
      const newTotal = newPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      await supabase
        .from("trainings")
        .update({ amount_paid: newTotal })
        .eq("id", trainee.id);
      await checkAndUpdatePaymentStatus(newTotal);
    }

    alert("Payment deleted successfully!");
    setShowDeleteConfirm(false);
    setDeleteId(null);
    fetchPayments();

  } catch (error) {
    console.error("Error deleting payment:", error);
    alert("Failed to delete payment. Please try again.");
  } finally {
    setDeletingPayment(false); // Reset loading state
  }
};

  const generateCounterReceipt = (payment: Payment) => {
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin: 20px 0; }
          .row { display: flex; justify-content: space-between; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Payment Receipt</h1>
          <p>Petrosphere Incorporated</p>
        </div>
        <div class="content">
          <div class="row"><strong>Receipt ID:</strong> <span>${payment.id}</span></div>
          <div class="row"><strong>Date:</strong> <span>${new Date(payment.payment_date).toLocaleDateString()}</span></div>
          <div class="row"><strong>Trainee:</strong> <span>${trainee.first_name} ${trainee.last_name}</span></div>
          <div class="row"><strong>Payment Method:</strong> <span>${payment.payment_method}</span></div>
          <div class="row"><strong>Amount Paid:</strong> <span>${formatCurrency(payment.amount_paid)}</span></div>
          <div class="row"><strong>Status:</strong> <span>${payment.payment_status}</span></div>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([receiptHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt_${payment.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

const handleSavePersonalDetails = async () => {
  setUpdatingDetails(true);
  try {
    const { error } = await supabase
      .from("trainings")
      .update(newDetails)
      .eq("id", trainee.id);
    if (error) {
      alert("Failed to update personal details.");
      return;
    }
    setIsEditingDetails(false);
    alert("Personal details updated.");
  } catch (err) {
    console.error("Error updating details:", err);
    alert("Failed to update personal details.");
  } finally {
    setUpdatingDetails(false);
  }
};

    const handleSaveAddress = async () => {
      setUpdatingAddress(true);
      try {
        const { error } = await supabase
          .from("trainings")
          .update(newAddress)
          .eq("id", trainee.id);
        if (error) {
          alert("Failed to update address.");
          return;
        }
        setIsEditingAddress(false);
        alert("Address updated.");
      } catch (err) {
        console.error("Error updating address:", err);
        alert("Failed to update address.");
      } finally {
        setUpdatingAddress(false);
      }
    };

const handleUpdate2x2Photo = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setUpdatingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        await supabase
          .from("trainings")
          .update({ picture_2x2_url: data.url })
          .eq("id", trainee.id);
        alert("2x2 photo updated!");
        window.location.reload();
      } else {
        alert("Upload failed.");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Upload failed.");
    } finally {
      setUpdatingPhoto(false);
    }
  };
  input.click();
};

const handleUpdateIdPhoto = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setUpdatingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        await supabase
          .from("trainings")
          .update({ id_picture_url: data.url })
          .eq("id", trainee.id);
        alert("ID photo updated!");
        window.location.reload();
      } else {
        alert("Upload failed.");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Upload failed.");
    } finally {
      setUpdatingPhoto(false);
    }
  };
  input.click();
};

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* ✅ VIEW 1: PHOTO VERIFICATION - For Pending/Resubmitted */}
        {needsPhotoVerification ? (
          <DialogContent className="w-[40vw]">
            <DialogHeader>
              <DialogTitle>
                {isResubmission ? "Review Resubmitted Photos" : "Review Submission"}
              </DialogTitle>
              {isResubmission && trainee.declined_photos && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <p className="font-semibold text-yellow-800">Previous Decline Reason:</p>
                  <p className="text-yellow-700 mt-1">{trainee.declined_photos.reason}</p>
                  <p className="text-xs text-yellow-600 mt-2">
                    Declined: {new Date(trainee.declined_photos.declined_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ID Picture */}
              <div className="relative cursor-pointer" onClick={() => setShowIdViewModal(true)}>
                <h4 className="text-sm font-semibold mb-2">
                  ID Picture
                  {trainee.declined_photos?.id_picture && (
                    <span className="ml-2 text-xs text-red-600">(Was Declined)</span>
                  )}
                </h4>
                <img
                  src={trainee.id_picture_url}
                  alt="ID Picture"
                  className={`w-full rounded border hover:opacity-80 transition ${
                    trainee.declined_photos?.id_picture ? 'border-red-400 border-2' : ''
                  }`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateIdPhoto();
                  }}
                >
                  <Edit />
                </Button>
              </div>
              
              {/* 2x2 Photo */}
              <div className="relative cursor-pointer" onClick={() => setShow2x2ViewModal(true)}>
                <h4 className="text-sm font-semibold mb-2">
                  2x2 Photo
                  {trainee.declined_photos?.picture_2x2 && (
                    <span className="ml-2 text-xs text-red-600">(Was Declined)</span>
                  )}
                </h4>
                <img
                  src={trainee.picture_2x2_url}
                  alt="2x2 Photo"
                  className={`w-full rounded border hover:opacity-80 transition ${
                    trainee.declined_photos?.picture_2x2 ? 'border-red-400 border-2' : ''
                  }`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdate2x2Photo();
                  }}
                  disabled={updatingPhoto}
                >
                  {updatingPhoto ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Edit className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            
            <DialogFooter className="pt-4">
              <Button 
                variant="destructive" 
                onClick={onDecline}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Decline'
                )}
              </Button>
              <Button 
                onClick={onVerify}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Proceed to Payment'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )
        // Complete Return Block - Part 2 of 5
// This continues directly after Part 1 (after the photo verification view closing)

        //* ✅ VIEW 2: DECLINED WAITING VIEW - Shows when status is "Declined (Waiting for Resubmission)" */}
        : isDeclinedAwaitingResubmission ? (
          <DialogContent className="w-[50vw] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Waiting for Photo Resubmission
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto pr-4 flex-1">
              <div className="space-y-4">
                {/* Status Banner */}
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Status: Declined - Awaiting Resubmission</p>
                      <p className="text-sm text-red-600 mt-1">
                        The trainee has been notified via email to resubmit their photos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trainee Info */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={trainee.picture_2x2_url} />
                  </Avatar>
                  <div>
                    <p className="font-semibold text-lg">{trainee.first_name} {trainee.last_name}</p>
                    <p className="text-sm text-muted-foreground">{trainee.email}</p>
                    <p className="text-sm text-muted-foreground">{trainee.phone_number}</p>
                  </div>
                </div>

                {/* Decline Details */}
                {trainee.declined_photos && (
                  <div className="space-y-3">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="font-semibold text-yellow-800 mb-2">Photos Requiring Resubmission:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                        {trainee.declined_photos.id_picture && <li>ID Picture</li>}
                        {trainee.declined_photos.picture_2x2 && <li>2x2 Picture</li>}
                      </ul>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="font-semibold text-gray-800 mb-1">Decline Reason:</p>
                      <p className="text-sm text-gray-700">{trainee.declined_photos.reason}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Declined on: {new Date(trainee.declined_photos.declined_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Current Photos Preview - Now with limited height */}
                <div className="p-4 border rounded-lg">
                  <p className="font-semibold mb-3">Current Submitted Photos:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">ID Picture</p>
                      <img 
                        src={trainee.id_picture_url} 
                        alt="ID" 
                        className="w-full max-h-48 object-contain rounded border cursor-pointer hover:opacity-80"
                        onClick={() => setShowIdViewModal(true)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">2x2 Photo</p>
                      <img 
                        src={trainee.picture_2x2_url} 
                        alt="2x2" 
                        className="w-full max-h-48 object-contain rounded border cursor-pointer hover:opacity-80"
                        onClick={() => setShow2x2ViewModal(true)}
                      />
                    </div>
                  </div>
                </div>

                {/* Info Note */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Once the trainee resubmits their photos, 
                    their status will automatically change to "Resubmitted (Pending Verification)" 
                    and you'll be able to review the new submissions.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button 
                variant="outline" 
                onClick={handleFollowUp}
                disabled={sendingFollowUp}
              >
                {sendingFollowUp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Send Follow-Up Email
                  </>
                )}
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )
        
    
        //* ✅ VIEW 3: FULL DETAILS VIEW - For Pending Payment, Partially Paid, Payment Completed, etc. */}
        : showFullDetailsView ? (
          <DialogContent className="w-[70vw] p-0">
            <ScrollArea className="h-[90vh] p-6 custom-scrollbar">
              <DialogHeader>
                <DialogTitle className="text-indigo-900 text-sm">
                  Submission ID: {trainee?.id}
                </DialogTitle>
              </DialogHeader>

              <div className="text-right text-sm text-muted-foreground mb-2">
                {new Date().toLocaleDateString()}
              </div>

              {/* Photo Section */}
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex gap-4 items-start">
                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-xs text-muted-foreground">2x2 Photo</Label>
                    <div className="relative cursor-pointer" onClick={() => setShow2x2ViewModal(true)}>
                      <div className="border-2 border-primary rounded-lg p-1">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={trainee?.picture_2x2_url} />
                        </Avatar>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdate2x2Photo();
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-xs text-muted-foreground">ID Picture</Label>
                    <div className="relative cursor-pointer" onClick={() => setShowIdViewModal(true)}>
                      <div className="border-2 border-primary rounded-lg p-1 w-32 h-24 overflow-hidden">
                        <img 
                          src={trainee?.id_picture_url} 
                          alt="ID" 
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateIdPhoto();
                        }}
                        disabled={updatingPhoto}
                      >
                        {updatingPhoto ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Edit className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <span className="font-bold text-indigo-900 text-lg">
                  {trainee?.first_name} {trainee?.last_name}
                </span>
                <span className="text-sm italic text-muted-foreground">
                  {trainee?.email}
                </span>
              </div>

              <div className="space-y-4">
                {/* Personal Details Section */}
                <section className="border rounded overflow-hidden">
                  <div className="flex justify-between items-center font-bold px-4 py-2">
                    Personal Details
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingDetails(!isEditingDetails)}>
                      <Edit/>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-4 text-sm">
                    {isEditingDetails ? (
                      <>
                        <div>
                          <Label>Company</Label>
                          <Input value={newDetails.company_name} onChange={e => setNewDetails(prev => ({ ...prev, company_name: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Gender</Label>
                          <Input value={newDetails.gender} onChange={e => setNewDetails(prev => ({ ...prev, gender: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Age</Label>
                          <Input type="number" value={newDetails.age} onChange={e => setNewDetails(prev => ({ ...prev, age: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input value={newDetails.phone_number} onChange={e => setNewDetails(prev => ({ ...prev, phone_number: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Food Restriction</Label>
                          <Input value={newDetails.food_restriction} onChange={e => setNewDetails(prev => ({ ...prev, food_restriction: e.target.value }))} />
                        </div>
                        <Button 
                            onClick={handleSavePersonalDetails} 
                            className="col-span-6"
                            disabled={updatingDetails}
                          >
                            {updatingDetails ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </Button>
                      </>
                    ) : (
                      <>
                        <div><strong>Company</strong><div>{trainee?.company_name || "N/A"}</div></div>
                        <div><strong>Gender</strong><div>{trainee?.gender}</div></div>
                        <div><strong>Age</strong><div>{trainee?.age}</div></div>
                        <div><strong>Phone Number</strong><div>{trainee?.phone_number || "N/A"}</div></div>
                        <div><strong>Food Restriction</strong><div>{trainee?.food_restriction || "N/A"}</div></div>
                      </>
                    )}
                  </div>
                </section>

                {/* Mailing Address Section */}
                <section className="border rounded overflow-hidden">
                  <div className="flex justify-between items-center font-bold px-4 py-2">
                    Mailing Address Details
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingAddress(!isEditingAddress)}>
                      <Edit/>
                    </Button>
                  </div>
                  <div className="p-4 text-sm">
                    {isEditingAddress ? (
                      <>
                        <Label>Street</Label>
                        <Input value={newAddress.mailing_street} onChange={e => setNewAddress(prev => ({ ...prev, mailing_street: e.target.value }))} />
                        <Label className="mt-2">City</Label>
                        <Input value={newAddress.mailing_city} onChange={e => setNewAddress(prev => ({ ...prev, mailing_city: e.target.value }))} />
                        <Label className="mt-2">Province</Label>
                        <Input value={newAddress.mailing_province} onChange={e => setNewAddress(prev => ({ ...prev, mailing_province: e.target.value }))} />
                        <Button 
                          onClick={handleSaveAddress} 
                          className="mt-2"
                          disabled={updatingAddress}
                        >
                          {updatingAddress ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <strong>Address</strong>
                        <div>{[trainee?.mailing_street, trainee?.mailing_city, trainee?.mailing_province].filter(Boolean).join(", ") || "N/A"}</div>
                      </>
                    )}
                  </div>
                </section>
                {/* Payment and Payment History Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                 {/* Payment Details Section */}
                  <section className="border rounded overflow-hidden">
                    <div className="font-bold px-4 py-2 bg-green-100 dark:text-blue-950 rounded border border-green-300">
                      Payment Details
                    </div>
                   <div className="p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Training Fee</span>
                      <span>{formatCurrency(Number(trainee?.courses?.training_fee) || 0)}</span>
                    </div>
                      
                      {/*useEffect(() => {PVC ID Add-on Display */}
                      {trainee.add_pvc_id && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-300 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-blue-800 dark:text-blue-200">
                              Physical PVC ID Requested
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                            <span>PVC ID Fee:</span>
                            <span className="font-semibold">₱150.00</span>
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Client opted for Physical PVC ID card in addition to Digital ID
                          </p>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span>Payment Method</span>
                        <span>{trainee?.payment_method || "N/A"}</span>
                      </div>
                      
                      {/* Voucher Info Banner - Show if voucher was applied */}
                        {trainee.has_discount && voucherInfo && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                                Voucher Applied
                              </span>
                            </div>
                            <div className="text-xs space-y-1 text-emerald-700 dark:text-emerald-300">
                              <div className="flex justify-between">
                                <span>Code:</span>
                                <span className="font-mono font-semibold">{voucherInfo.code}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Type:</span>
                                <span>{voucherInfo.voucher_type}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Discount:</span>
                                <span className="font-semibold">{voucherInfo.amount}</span>
                              </div>
                            <div className="flex justify-between">
                              <span>Course:</span>
                              <span>{voucherInfo.service}</span>
                            </div>
                            {voucherInfo.expiry_date && (
                              <div className="flex justify-between">
                                <span>Expires:</span>
                                <span>{new Date(voucherInfo.expiry_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                        
                        {/* Discount Toggle - Auto-checked if voucher applied */}
                        <div className="flex items-center gap-2 pt-2">
                          <Label>Discounted?</Label>
                         <input 
                          type="checkbox" 
                          checked={isDiscounted}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setIsDiscounted(checked);
                            
                            // Reset voucher info if discount is turned off
                            if (!checked) {
                              setVoucherInfo(null);
                            }
                            
                            const { error } = await supabase
                              .from("trainings")
                              .update({ has_discount: checked })
                              .eq("id", trainee.id);
                              
                            if (error) {
                              alert("Failed to update discount status.");
                              console.error("Update discount toggle error:", error);
                            } else if (checked && trainee.discounted_fee) {
                              // If turning on discount and there's a discounted fee, try to fetch voucher
                              await fetchVoucherInfo();
                            }
                          }}
                          disabled={trainee.has_discount && voucherInfo}
                        />
                          {trainee.has_discount && voucherInfo && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">
                              (Applied via voucher)
                            </span>
                          )}
                        </div>

                        {/* Discount Input - Show current discount if voucher applied */}
                        {isDiscounted && (
                          <div className="space-y-2 p-3 border rounded bg-background">
                            <Label>Discounted Price</Label>
                            <Input
                              type="number"
                              placeholder="Enter discounted price"
                              value={discountPrice}
                              onChange={(e) => setDiscountPrice(e.target.value)}
                              disabled={trainee.has_discount && voucherInfo} // Disable if voucher applied
                            />
                            {discountPercent !== null && (
                              <p className="text-sm text-green-700 font-semibold">
                                Discount Applied: {discountPercent}% off
                                {voucherInfo && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    (from voucher code: {voucherInfo.code})
                                  </span>
                                )}
                              </p>
                            )}
                            {trainee.has_discount && voucherInfo && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                This discount was applied via voucher and cannot be modified.
                              </p>
                            )}
                          </div>
                        )}

                      {discountApplied !== null && (() => {
                        // ✅ FIXED: Always use courses.training_fee as the original fee
                        const originalFee = Number(trainee.courses?.training_fee) || 0;
                        const discounted = Number(discountApplied) || 0;
                        const savings = originalFee - discounted;
                        
                        return (
                          <div className="p-2 rounded bg-green-50 border border-green-300 text-green-800 text-sm">
                            <strong>Discounted Fee:</strong> {formatCurrency(discountApplied)}
                            {discountPercent !== null && (
                              <> ({discountPercent}% off)</>
                            )}
                            {voucherInfo && originalFee > 0 && (
                              <div className="text-xs mt-1 text-green-700">
                                Original: {formatCurrency(originalFee)} - 
                                Savings: {formatCurrency(savings)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                                                
                        {/* Updated Total Calculation with PVC */}
                        <div className="border-t pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Course Fee:</span>
                            <span>{formatCurrency(discountApplied !== null ? discountApplied : (trainee?.training_fee || 0))}</span>
                          </div>
                          {trainee.add_pvc_id && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>+ PVC ID:</span>
                              <span>₱150.00</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold text-base text-gray-900 dark:text-gray-100 pt-1 border-t">
                            <span>Total Required:</span>
                            <span>{formatCurrency((discountApplied !== null ? discountApplied : (trainee?.training_fee || 0)) + pvcIdFee)}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between font-semibold text-green-700">
                          <span>Total Amount Paid</span>
                          <span>{formatCurrency(totalPaid)}</span>
                        </div>
                        
                        {/* ✅ FIXED: Remaining Balance Calculation - No more NaN and conditionally hidden */}
                          {(() => {
                            const courseFee = discountApplied !== null ? Number(discountApplied) : Number(trainee?.training_fee || 0);
                            const pvcFee = trainee.add_pvc_id ? 150 : 0;
                            const requiredFee = courseFee + pvcFee;
                            const currentPaid = Number(totalPaid) || 0;
                            const balance = requiredFee - currentPaid;
                            
                            // Don't show if balance is 0 or less than 1 peso (accounting for rounding)
                            if (Math.abs(balance) < 1) {
                              return null;
                            }
                            
                            if (balance < 0) {
                              return (
                                <div className="flex justify-between font-semibold text-blue-700">
                                  <span>Exceeded Amount</span>
                                  <span>{formatCurrency(Math.abs(balance))}</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex justify-between font-semibold text-red-700">
                                  <span>Remaining Balance</span>
                                  <span>{formatCurrency(balance)}</span>
                                </div>
                              );
                            }
                          })()}
                      </div>
                    </section>

                  {/* Payment History Section */}
                  <section className="border rounded overflow-hidden">
                    <div className="bg-yellow-100 dark:text-blue-950 rounded border border-yellow-300 font-bold px-4 py-2 flex justify-between items-center">
                      <span>Payment History</span>
                      {(!hasPayments || !isCounterPayment) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={!isCounterPayment ? handleFileSelect : () => setShowPaidConfirm(true)}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {hasPayments && isCounterPayment && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setShowPaidConfirm(true)}
                        >
                          Add Payment
                        </Button>
                      )}
                    </div>
                    <div className="p-4 text-sm">
                      {!hasPayments ? (
                        <p className="italic text-muted-foreground">
                          No Payment History Recorded.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {payments.map((payment) => (
                            <div 
                              key={payment.id} 
                              className={`border rounded-lg p-3 ${
                                payment.payment_status === 'pending' 
                                  ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' 
                                  : 'border-gray-200 bg-white dark:bg-gray-900'
                              }`}
                            >
                              {/* Payment Header */}
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                    payment.payment_status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                      : payment.payment_status?.toLowerCase().includes('completed')
                                      ? 'bg-green-100 text-green-800 border border-green-300'
                                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                                  }`}>
                                    {payment.payment_status}
                                  </span>
                                  
                                  {/* Uploaded By Badge */}
                                  {payment.receipt_uploaded_by && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                      payment.receipt_uploaded_by === 'client' 
                                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                        : 'bg-purple-100 text-purple-800 border border-purple-300'
                                    }`}>
                                      <User className="w-3 h-3" />
                                      {payment.receipt_uploaded_by === 'client' ? 'Client Upload' : 'Admin Upload'}
                                    </span>
                                  )}
                                </div>

                                {/* Delete Button */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                                  onClick={() => {
                                    setDeleteId(payment.id);
                                    setShowDeleteConfirm(true);
                                  }}
                                  disabled={deletingPayment || saving || decliningPayment === payment.id}
                                >
                                  {deletingPayment && deleteId === payment.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>

                              {/* Payment Details Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                <div>
                                  <span className="text-muted-foreground">Date:</span>
                                  <span className="ml-1 font-medium">
                                    {new Date(payment.payment_date).toLocaleDateString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Method:</span>
                                  <span className="ml-1 font-medium">{payment.payment_method}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Amount:</span>
                                  <span className="ml-1 font-semibold text-green-700">
                                    {payment.amount_paid > 0 
                                      ? formatCurrency(payment.amount_paid)
                                      : 'Not Set'
                                    }
                                  </span>
                                </div>
                                {payment.receipt_uploaded_at && (
                                  <div>
                                    <span className="text-muted-foreground">Uploaded:</span>
                                    <span className="ml-1 text-xs">
                                      {new Date(payment.receipt_uploaded_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Receipt Preview */}
                              {payment.receipt_link && (
                                <div className="mb-2">
                                  <img 
                                    src={payment.receipt_link} 
                                    alt="Receipt" 
                                    className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition"
                                    onClick={() => payment.receipt_link && window.open(payment.receipt_link, '_blank')}
                                  />
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex gap-2 mt-2">
                                {payment.receipt_link && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-8 text-xs cursor-pointer"
                                    onClick={() => payment.receipt_link && window.open(payment.receipt_link, '_blank')}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    View Receipt
                                  </Button>
                                )}

                                {/* Show Approve/Decline for pending payments */}
                                {payment.payment_status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 cursor-pointer"
                                      onClick={() => {
                                        setSelectedPaymentId(payment.id);
                                        setShowApproveDialog(true);
                                      }}
                                      disabled={saving || decliningPayment === payment.id}
                                    >
                                      {saving && selectedPaymentId === payment.id ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Approving...
                                        </>
                                      ) : (
                                        '✓ Approve'
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="flex-1 h-8 text-xs cursor-pointer"
                                      onClick={() => handleDeclinePayment(payment.id)}
                                      disabled={decliningPayment === payment.id || saving}
                                    >
                                      {decliningPayment === payment.id ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Declining...
                                        </>
                                      ) : (
                                        '✗ Decline'
                                      )}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {isPending && (
                <DialogFooter className="pt-4">
                  <Button 
                    variant="destructive" 
                    onClick={onDecline}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Decline'
                    )}
                  </Button>
                  <Button 
                    onClick={onVerify}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </DialogFooter>
              )}
            </ScrollArea>
          </DialogContent>
        ) : null}
      </Dialog>
      {/* Supporting Dialogs - Photo Viewers */}
      
      {/* 2x2 Photo Viewer Dialog */}
      <Dialog open={show2x2ViewModal} onOpenChange={setShow2x2ViewModal}>
        <DialogContent className="w-[50vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>2x2 Photo Viewer</DialogTitle>
          </DialogHeader>
          <div className="w-full h-full text-center">
            <img
              src={trainee.picture_2x2_url}
              alt="2x2 Full View"
              className="max-w-full max-h-[80vh] mx-auto rounded border shadow"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ID Photo Viewer Dialog */}
      <Dialog open={showIdViewModal} onOpenChange={setShowIdViewModal}>
        <DialogContent className="w-[50vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>ID Picture Viewer</DialogTitle>
          </DialogHeader>
          <div className="w-full h-full text-center">
            <img
              src={trainee.id_picture_url}
              alt="ID Full View"
              className="max-w-full max-h-[80vh] mx-auto rounded border shadow"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog for Receipt Upload */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="lg:w-[40vw] sm:w-[80vw]">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          
          {previewImage && (
            <div className="border rounded p-4">
              <img src={previewImage} alt="Receipt" className="max-h-96 mx-auto" />
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount Paid</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="classroom">Online Classroom URL</Label>
              <Input
                id="classroom"
                type="url"
                placeholder="Enter classroom URL (optional)"
                value={onlineClassroomUrl}
                onChange={(e) => setOnlineClassroomUrl(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleSavePayment(false, false)}>
                  Save Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSavePayment(true, false)}>
                  Save & Send Confirmation Email
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleSavePayment(false, true)}
                  disabled={!onlineClassroomUrl}
                >
                  Save & Send Classroom Url
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleSavePayment(true, true)} 
                  disabled={!onlineClassroomUrl}
                >
                  Save & Send Both Confirmation + Classroom Url
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter Payment Dialog */}
      <AlertDialog open={showPaidConfirm} onOpenChange={setShowPaidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Counter Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the amount paid by {trainee?.first_name} {trainee?.last_name} at the counter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="counter-amount">Amount Paid</Label>
            <Input
              id="counter-amount"
              type="number"
              placeholder="Enter amount"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAmountPaid("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsPaid} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        {/* Delete Payment Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this payment record? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => setDeleteId(null)}
                disabled={deletingPayment}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeletePayment} 
                className="bg-red-600"
                disabled={deletingPayment}
              >
                {deletingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      {/* Approve Payment Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Select the payment amount for {trainee?.first_name} {trainee?.last_name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Payment Info */}
              {(() => {
                const courseFee = discountApplied ?? (trainee?.training_fee || 0);
                const pvcFee = trainee.add_pvc_id ? 150 : 0;
                const totalFee = courseFee + pvcFee;
                const remainingBalance = totalFee - totalPaid;
                
                return (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Course Fee:</span>
                      <span className="font-semibold">
                        {formatCurrency(courseFee)}
                      </span>
                    </div>
                    {trainee.add_pvc_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PVC ID Fee:</span>
                        <span className="font-semibold">
                          ₱150.00
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">Total Fee:</span>
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(totalFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Already Paid:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(totalPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">Remaining Balance:</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(remainingBalance)}
                      </span>
                    </div>
                  </div>
                );
              })()}

           {/* Payment Type Selection */}
          <div className="space-y-2">
            <Label>Payment Amount</Label>
            
            <div className="space-y-2">
              {(() => {
                // ✅ FIXED: Include PVC fee in total calculation
                const courseFee = discountApplied !== null ? discountApplied : (trainee?.training_fee || 0);
                const pvcFee = trainee.add_pvc_id ? 150 : 0;
                const totalFee = courseFee + pvcFee;
                const remainingBalance = totalFee - totalPaid;
                
                return (
                  <>
                    {/* Full Payment Option */}
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        approveType === 'full' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setApproveType('full')}
                    >
        <div className="flex items-center gap-2">
          <input 
            type="radio" 
            checked={approveType === 'full'}
            onChange={() => setApproveType('full')}
          />
          <div className="flex-1">
            <div className="font-medium">Full Remaining Payment</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(remainingBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* Half Payment Option */}
      <div 
        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
          approveType === 'half' 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setApproveType('half')}
      >
        <div className="flex items-center gap-2">
          <input 
            type="radio" 
            checked={approveType === 'half'}
            onChange={() => setApproveType('half')}
          />
          <div className="flex-1">
            <div className="font-medium">Half Remaining Payment (50%)</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(remainingBalance / 2)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
})()}

                {/* Custom Amount Option */}
                <div 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    approveType === 'custom' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setApproveType('custom')}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={approveType === 'custom'}
                      onChange={() => setApproveType('custom')}
                    />
                    <div className="flex-1">
                      <div className="font-medium">Custom Amount</div>
                      <div className="text-sm text-muted-foreground">Enter specific amount</div>
                    </div>
                  </div>
                </div>

                {/* Custom Amount Input */}
                {approveType === 'custom' && (
                  <div className="pl-7 pt-2">
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={approveAmount}
                      onChange={(e) => setApproveAmount(e.target.value)}
                      className="w-full"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Preview Total After Approval */}
            {(() => {
              // ✅ FIXED: Include PVC fee in preview calculation
              const courseFee = discountApplied !== null ? discountApplied : (trainee?.training_fee || 0);
              const pvcFee = trainee.add_pvc_id ? 150 : 0;
              const totalFee = courseFee + pvcFee;
              const remainingBalance = totalFee - totalPaid;
              const approvalAmount = 
                approveType === 'full' 
                  ? remainingBalance
                  : approveType === 'half'
                  ? remainingBalance / 2
                  : Number(approveAmount) || 0;
              
              return (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-300 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-700 dark:text-green-400">
                        This Payment:
                      </span>
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {formatCurrency(approvalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="font-medium text-green-800 dark:text-green-400">
                        Total After Approval:
                      </span>
                      <span className="font-bold text-green-800 dark:text-green-400">
                        {formatCurrency(totalPaid + approvalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 dark:text-gray-400">
                        Remaining After:
                      </span>
                      <span className="font-medium text-gray-600 dark:text-gray-400">
                        {formatCurrency(remainingBalance - approvalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowApproveDialog(false);
                setSelectedPaymentId(null);
                setApproveAmount('');
                setApproveType('full');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApprovePayment} 
              disabled={saving || (approveType === 'custom' && !approveAmount)}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve & Notify Client'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
