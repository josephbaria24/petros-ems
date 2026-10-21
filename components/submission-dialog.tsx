//components/submission-dialog.tsx - FIXED FLOW (Part 1 - Replace entire component)
"use client";

import { useState, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner"
import { ImageCropDialog } from '@/components/image-crop-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
import { Plus, Download, Trash2, ChevronDown, Edit, User, RefreshCw, AlertCircle, CheckCircle2, XCircle, X, Briefcase, CreditCard } from "lucide-react"
import { tmsDb } from "@/lib/supabase-client";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Checkbox } from "./ui/checkbox";

/** Composite key for files inside email "upload bin" (`custom_data.__custom_upload_*`). */
const EMAIL_UPLOAD_FILE_KEY_SEP = "::";

function parseEmailUploadCompositeKey(
  fileKey: string
): { bundleKey: string; fileBlockId: string } | null {
  if (!fileKey.includes(EMAIL_UPLOAD_FILE_KEY_SEP)) return null;
  const i = fileKey.indexOf(EMAIL_UPLOAD_FILE_KEY_SEP);
  const bundleKey = fileKey.slice(0, i);
  const fileBlockId = fileKey.slice(i + EMAIL_UPLOAD_FILE_KEY_SEP.length);
  if (!bundleKey.startsWith("__custom_upload_") || !fileBlockId) return null;
  return { bundleKey, fileBlockId };
}

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
  /** When opening from a deep link (e.g. receipt notification), start on Payment Details. */
  initialTab?: "info" | "payment";
}

export function SubmissionDialog({
  open,
  onOpenChange,
  trainee,
  onVerify,
  onDecline, // Will be used to open decline photo dialog
  initialTab = "info",
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
  const supabase = tmsDb;
  const [isDiscounted, setIsDiscounted] = useState(false);
  const [discountPrice, setDiscountPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [discountApplied, setDiscountApplied] = useState<number | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);



  const [show2x2CropDialog, setShow2x2CropDialog] = useState(false); 
  const [showIdCropDialog, setShowIdCropDialog] = useState(false);

  // Add these new state variables after the existing ones (around line 85)
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [decliningPayment, setDecliningPayment] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);


  const [voucherInput, setVoucherInput] = useState("")
const [isVerifyingVoucher, setIsVerifyingVoucher] = useState(false)
const [voucherError, setVoucherError] = useState("")
const [discountMode, setDiscountMode] = useState<'voucher' | 'manual'>('voucher')

  const [voucherInfo, setVoucherInfo] = useState<any>(null);
  
  const [pvcIdFee, setPvcIdFee] = useState<number>(0);

const [newDetails, setNewDetails] = useState({
  professional_title: trainee?.professional_title || "",
  first_name: trainee?.first_name || "",
  middle_initial: trainee?.middle_initial || "",
  last_name: trainee?.last_name || "",
  suffix: trainee?.suffix || "",
  email: trainee?.email || "",
  phone_number: trainee?.phone_number || "",
  gender: trainee?.gender || "",
  age: trainee?.age || "",
  employment_status: trainee?.employment_status || "",
  company_name: trainee?.company_name || "",
  company_position: trainee?.company_position || "",
  company_industry: trainee?.company_industry || "",
  company_email: trainee?.company_email || "",
  company_landline: trainee?.company_landline || "",
  company_city: trainee?.company_city || "",
  company_region: trainee?.company_region || "",
  total_workers: trainee?.total_workers || "",
  food_restriction: trainee?.food_restriction || "",
  is_student: trainee?.is_student || false,
  school_name: trainee?.school_name || "",
});


const [activeTab, setActiveTab] = useState<"info" | "payment">("info");
useEffect(() => {
  if (open) setActiveTab(initialTab);
}, [open, initialTab]);


useEffect(() => {
  if (trainee) {
    setNewDetails({
      professional_title: trainee.professional_title || "",
      first_name: trainee.first_name || "",
      middle_initial: trainee.middle_initial || "",
      last_name: trainee.last_name || "",
      suffix: trainee.suffix || "",
      email: trainee.email || "",
      phone_number: trainee.phone_number || "",
      gender: trainee.gender || "",
      age: trainee.age || "",
      employment_status: trainee.employment_status || "",
      company_name: trainee.company_name || "",
      company_position: trainee.company_position || "",
      company_industry: trainee.company_industry || "",
      company_email: trainee.company_email || "",
      company_landline: trainee.company_landline || "",
      company_city: trainee.company_city || "",
      company_region: trainee.company_region || "",
      total_workers: trainee.total_workers || "",
      food_restriction: trainee.food_restriction || "",
      is_student: trainee.is_student || false,
      school_name: trainee.school_name || "",
    });
  }
}, [trainee, open]); 


  const [show2x2ViewModal, setShow2x2ViewModal] = useState(false);
  const [showIdViewModal, setShowIdViewModal] = useState(false);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [markingPendingVerification, setMarkingPendingVerification] = useState(false);
  const [customFieldLabels, setCustomFieldLabels] = useState<Record<string, string>>({});
  const [fileReviewStatuses, setFileReviewStatuses] = useState<Record<string, "approved" | "declined" | "pending">>({});
  const [fileUrlOverrides, setFileUrlOverrides] = useState<Record<string, string>>({});
  const [updatingFileKey, setUpdatingFileKey] = useState<string | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const replacingFileKeyRef = useRef<string | null>(null);


  const [cropExisting2x2, setCropExisting2x2] = useState(false);
const [cropExistingId, setCropExistingId] = useState(false);

  const [newAddress, setNewAddress] = useState({
    mailing_street: trainee?.mailing_street || "",
    mailing_city: trainee?.mailing_city || "",
    mailing_province: trainee?.mailing_province || "",
  });

  useEffect(() => {
    const loadCustomFieldLabels = async () => {
      if (!trainee?.course_id) {
        setCustomFieldLabels({});
        return;
      }

      const { data, error } = await tmsDb
        .from("courses")
        .select("registration_config")
        .eq("id", trainee.course_id)
        .single();

      if (error || !data?.registration_config) {
        setCustomFieldLabels({});
        return;
      }

      const labelMap: Record<string, string> = {};
      (data.registration_config as any[]).forEach((component: any) => {
        if (component?.id && component?.label) {
          labelMap[component.id] = component.label;
        }
      });

      setCustomFieldLabels(labelMap);
    };

    if (open) {
      loadCustomFieldLabels();
    }
  }, [open, trainee?.course_id]);

  useEffect(() => {
    if (!open) return;
    setFileUrlOverrides({});
    const reviewStatuses = trainee?.custom_data?.__file_review_statuses || {};
    setFileReviewStatuses(reviewStatuses);
  }, [open, trainee?.id, trainee?.custom_data]);

  const isFileUrl = (value: unknown) =>
    typeof value === "string" && /^https?:\/\//i.test(value);

  const formatFileLabel = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const getUploadedFiles = () => {
    const files: Array<{
      key: string;
      label: string;
      url: string;
      status: "approved" | "declined" | "pending";
      source: "standard" | "custom";
      fromEmail?: boolean;
    }> = [];

    const pushFile = (
      key: string,
      label: string,
      rawUrl: unknown,
      source: "standard" | "custom",
      fromEmail?: boolean
    ) => {
      const url = fileUrlOverrides[key] || rawUrl;
      if (isFileUrl(url)) {
        files.push({
          key,
          label,
          url,
          status: fileReviewStatuses[key] || "pending",
          source,
          ...(fromEmail ? { fromEmail: true } : {}),
        });
      }
    };

    pushFile("id_picture_url", "Government ID", trainee?.id_picture_url, "standard");
    pushFile("picture_2x2_url", "2x2 Picture", trainee?.picture_2x2_url, "standard");
    pushFile("prc_license_url", "PRC License", trainee?.prc_license_url, "standard");
    pushFile("signature_url", "Signature", trainee?.signature_url, "standard");

    const customData = trainee?.custom_data || {};
    Object.entries(customData).forEach(([key, value]) => {
      if (key === "__file_review_statuses") return;

      // Email template "upload bin" — stored as { submitted_at, files: [{ blockId, label, url }] }
      if (
        key.startsWith("__custom_upload_") &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Array.isArray((value as { files?: unknown }).files)
      ) {
        const entries = (value as { files: Array<{ blockId?: string; label?: string; url?: string }> }).files;
        entries.forEach((entry, idx) => {
          const innerId = entry.blockId || `file-${idx}`;
          const compositeKey = `${key}${EMAIL_UPLOAD_FILE_KEY_SEP}${innerId}`;
          pushFile(
            compositeKey,
            entry.label || formatFileLabel(String(innerId)),
            entry.url,
            "custom",
            true
          );
        });
        return;
      }

      pushFile(key, customFieldLabels[key] || formatFileLabel(key), value, "custom");
    });

    const unique = new Map<string, (typeof files)[number]>();
    files.forEach((f) => {
      if (!unique.has(f.key)) unique.set(f.key, f);
    });

    return Array.from(unique.values());
  };

  const updateFileReviewStatus = async (fileKey: string, status: "approved" | "declined") => {
    if (!trainee?.id) return;
    setUpdatingFileKey(fileKey);
    const currentCustomData = { ...(trainee?.custom_data || {}) };
    const reviewStatuses = {
      ...(currentCustomData.__file_review_statuses || {}),
      [fileKey]: status,
    };
    currentCustomData.__file_review_statuses = reviewStatuses;

    const { error } = await tmsDb
      .from("trainings")
      .update({ custom_data: currentCustomData })
      .eq("id", trainee.id);

    if (error) {
      console.error("Failed to update file review status:", error);
      setUpdatingFileKey(null);
      return;
    }

    setFileReviewStatuses(reviewStatuses);
    setUpdatingFileKey(null);
  };

  const triggerReplaceFile = (fileKey: string) => {
    replacingFileKeyRef.current = fileKey;
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const fileKey = replacingFileKeyRef.current;
    if (!file || !fileKey || !trainee?.id) return;

    setUpdatingFileKey(fileKey);
    const data = new FormData();
    data.append("image", file);

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok || !uploadResult?.url) {
        throw new Error(uploadResult?.error || "Upload failed");
      }

      const uploadedUrl = uploadResult.url as string;
      const standardKeys = ["id_picture_url", "picture_2x2_url", "prc_license_url", "signature_url"];
      const currentCustomData = { ...(trainee?.custom_data || {}) };
      const reviewStatuses = {
        ...(currentCustomData.__file_review_statuses || {}),
        [fileKey]: "pending",
      };
      currentCustomData.__file_review_statuses = reviewStatuses;

      const emailComposite = parseEmailUploadCompositeKey(fileKey);

      let payload: Record<string, unknown> = { custom_data: currentCustomData };
      if (standardKeys.includes(fileKey)) {
        payload[fileKey] = uploadedUrl;
      } else if (emailComposite) {
        const { bundleKey, fileBlockId } = emailComposite;
        const bundle = currentCustomData[bundleKey] as
          | { files?: Array<{ blockId: string; label?: string; url: string }> }
          | undefined;
        const fileList = bundle?.files;
        if (!Array.isArray(fileList)) {
          throw new Error("Email upload bundle missing files");
        }
        const newFiles = fileList.map((f) =>
          f.blockId === fileBlockId ? { ...f, url: uploadedUrl } : f
        );
        currentCustomData[bundleKey] = { ...bundle, files: newFiles };
        payload = { custom_data: currentCustomData };
      } else {
        payload = {
          ...payload,
          custom_data: {
            ...currentCustomData,
            [fileKey]: uploadedUrl,
            __file_review_statuses: reviewStatuses,
          },
        };
      }

      const { error } = await tmsDb
        .from("trainings")
        .update(payload)
        .eq("id", trainee.id);

      if (error) throw error;

      setFileUrlOverrides((prev) => ({ ...prev, [fileKey]: uploadedUrl }));
      setFileReviewStatuses(reviewStatuses);
    } catch (error) {
      console.error("Failed to replace file:", error);
    } finally {
      setUpdatingFileKey(null);
      replacingFileKeyRef.current = null;
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = "";
      }
    }
  };

const fetchPayments = async () => {
  if (!trainee?.id) return;
  
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("training_id", trainee.id)
    .order("payment_date", { ascending: false });

  if (!error && data) {
    setPayments(data);
    
    // ✅ FIXED: Use getPvcFee helper
    const pvcFee = getPvcFee(trainee);
    setPvcIdFee(pvcFee);
    
    // Update total amount paid
    const paymentTotal = data.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    await supabase
      .from("trainings")
      .update({ amount_paid: paymentTotal })
      .eq("id", trainee.id);
  }
};


const checkAndUpdatePaymentStatus = async (totalPaid: number) => {
  if (!trainee?.id || !trainee?.training_fee) return;

  const originalFee = getTrainingFee();
  const discountedFee = discountApplied !== null ? Number(discountApplied) : null;
  const pvcFee = getPvcFee(trainee); // ✅ FIXED: Use getPvcFee


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

  // ✅ Use data from props - no refetching needed
  const hasDiscount = trainee.has_discount ?? false;
  const discountedFee = trainee.discounted_fee ?? null;

  setIsDiscounted(hasDiscount);
  setDiscountApplied(discountedFee);
  setDiscountPrice(discountedFee !== null ? String(discountedFee) : "");

  // Calculate discount percentage
  const originalFee = getTrainingFee() || 0;
  
  if (hasDiscount && discountedFee !== null && originalFee > 0) {
    const percent = ((originalFee - discountedFee) / originalFee) * 100;
    setDiscountPercent(Math.round(percent));
  } else {
    setDiscountPercent(null);
  }

  // ✅ Set payments from trainee prop (already loaded)
  setPayments(trainee.payments || []);

  // ✅ FIXED: Always set voucher info from trainee prop
  setVoucherInfo(trainee.voucherInfo || null);

  // Calculate PVC fee
  const pvcFee = trainee.add_pvc_id ? 150 : 0;
  setPvcIdFee(pvcFee);

  // ✅ Log for debugging
  console.log("Dialog opened with trainee data:", {
    hasDiscount,
    discountedFee,
    voucherInfo: trainee.voucherInfo
  });

}, [open, trainee?.id, trainee?.has_discount, trainee?.discounted_fee, trainee?.payments, trainee?.voucherInfo, trainee?.courses?.training_fee]);




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



const handleVerifyVoucher = async () => {
  if (!voucherInput.trim()) {
    setVoucherError("Please enter a voucher code")
    return
  }

  setIsVerifyingVoucher(true)
  setVoucherError("")

  try {
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", voucherInput.trim().toUpperCase())
      .single()

    if (error || !data) {
      setVoucherError("This voucher code does not exist.")
      setIsVerifyingVoucher(false)
      return
    }

    // Check expiry
    const isExpired = data.expiry_date && new Date(data.expiry_date) < new Date()
    
    // Check if voucher is fully used
    const isFullyUsed = data.is_batch 
      ? data.batch_remaining <= 0 
      : data.is_used

    if (isFullyUsed) {
      setVoucherError(
        data.is_batch 
          ? "This batch voucher has no remaining uses." 
          : "This voucher has already been used."
      )
      setIsVerifyingVoucher(false)
      return
    }

    if (isExpired) {
      setVoucherError("This voucher has expired.")
      setIsVerifyingVoucher(false)
      return
    }

    // Check if voucher is for the correct course (skip if service_id is null = all services)
    if (data.service_id && trainee.course_id !== data.service_id) {
      setVoucherError("This voucher is not valid for this course.")
      setIsVerifyingVoucher(false)
      return
    }

    // Voucher is valid - set voucher info and calculate discount
    setVoucherInfo(data)
    
    let discountAmount = 0
    const originalFee = getTrainingFee() || 0
    
    if (data.voucher_type === "Free") {
      discountAmount = originalFee
    } else {
      const amountStr = data.amount.replace(/₱/g, "").trim()
      if (amountStr.includes("%")) {
        const percentage = parseFloat(amountStr.replace("%", ""))
        discountAmount = (originalFee * percentage) / 100
      } else {
        discountAmount = parseFloat(amountStr) || 0
      }
    }
    
    const discountedPrice = originalFee - discountAmount
    setDiscountPrice(String(discountedPrice))
    
    // Don't auto-apply, just show preview
    alert(`Voucher verified! Save to apply discount of ₱${discountAmount.toLocaleString()}`)
  } catch (err) {
    console.error("Voucher verification error:", err)
    setVoucherError("Failed to verify voucher. Please try again.")
  } finally {
    setIsVerifyingVoucher(false)
  }
}

const handleSaveVoucher = async () => {
  if (!voucherInfo) return

  setApplyingDiscount(true)
  try {
    const originalFee = getTrainingFee() || 0
    const discounted = Number(discountPrice)

    // Update training record with voucher info
    const { error } = await supabase
      .from("trainings")
      .update({
        has_discount: true,
        discounted_fee: discounted,
      })
      .eq("id", trainee.id)

    if (error) throw error

    // Create voucher usage record
    const { error: usageError } = await supabase
      .from("voucher_usage")
      .insert([{
        voucher_id: voucherInfo.id,
        used_by: `${trainee.first_name} ${trainee.last_name}`,
        training_id: trainee.id
      }])

    if (usageError) {
      console.error("Failed to log voucher usage:", usageError)
    }

    // Update voucher remaining count
    if (voucherInfo.is_batch) {
      const newRemaining = voucherInfo.batch_remaining - 1
      const newUsed = (voucherInfo.batch_used || 0) + 1
      const isFullyUsed = newRemaining <= 0

      await supabase
        .from("vouchers")
        .update({ 
          batch_remaining: newRemaining,
          batch_used: newUsed,
          is_used: isFullyUsed
        })
        .eq("id", voucherInfo.id)
    } else {
      await supabase
        .from("vouchers")
        .update({ is_used: true })
        .eq("id", voucherInfo.id)
    }

    setDiscountApplied(discounted)
    setIsDiscounted(true)
    
    // Recalculate payment status
    const totalPaidNow = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0)
    await checkAndUpdatePaymentStatus(totalPaidNow)

    alert("Voucher applied successfully!")
    fetchPayments() // Refresh data
  } catch (err) {
    console.error("Error applying voucher:", err)
    alert("Failed to apply voucher.")
  } finally {
    setApplyingDiscount(false)
  }
}

const handleRemoveVoucher = async () => {
  if (!voucherInfo) {
    setVoucherInput("")
    setVoucherError("")
    setDiscountPrice("")
    return
  }

  const confirm = window.confirm("Are you sure you want to remove this voucher? This action cannot be undone.")
  if (!confirm) return

  setApplyingDiscount(true)
  try {
    // Remove discount from training
    const { error } = await supabase
      .from("trainings")
      .update({
        has_discount: false,
        discounted_fee: null,
      })
      .eq("id", trainee.id)

    if (error) throw error

    // Delete voucher usage record
    await supabase
      .from("voucher_usage")
      .delete()
      .eq("training_id", trainee.id)
      .eq("voucher_id", voucherInfo.id)

    // Restore voucher count
    if (voucherInfo.is_batch) {
      await supabase
        .from("vouchers")
        .update({ 
          batch_remaining: voucherInfo.batch_remaining + 1,
          batch_used: Math.max(0, (voucherInfo.batch_used || 1) - 1),
          is_used: false
        })
        .eq("id", voucherInfo.id)
    } else {
      await supabase
        .from("vouchers")
        .update({ is_used: false })
        .eq("id", voucherInfo.id)
    }

    setVoucherInput("")
    setVoucherInfo(null)
    setVoucherError("")
    setDiscountPrice("")
    setDiscountApplied(null)
    setIsDiscounted(false)

    alert("Voucher removed successfully!")
    fetchPayments() // Refresh data
  } catch (err) {
    console.error("Error removing voucher:", err)
    alert("Failed to remove voucher.")
  } finally {
    setApplyingDiscount(false)
  }
}



// ✅ SIMPLIFIED: Get PVC fee from stored value or calculate
const getPvcFee = (trainee: any) => {
  // First try to use stored pvc_fee (most accurate)
  if (trainee?.pvc_fee !== null && trainee?.pvc_fee !== undefined) {
    return Number(trainee.pvc_fee);
  }

  // Fallback: Calculate based on course settings
  if (!trainee?.courses?.has_pvc_id || !trainee?.add_pvc_id) return 0;

  const course = trainee.courses;
  
  // PVC included without discount = free (already in price)
  if (course.pvc_id_type === 'included' && !trainee.has_discount) {
    return 0;
  }

  // Calculate based on employment status
  const isStudent = trainee.employment_status === 'Unemployed' && trainee.is_student;
  const isUnemployed = trainee.employment_status === 'Unemployed';
  
  if (isStudent || isUnemployed) {
    return course.pvc_student_price || 150;
  }
  
  return course.pvc_professional_price || 150;
};

// Helper to display PVC status text
const getPvcDisplayText = (trainee: any) => {
  if (!trainee?.courses?.has_pvc_id) {
    return "N/A (Course doesn't offer PVC)";
  }

  const course = trainee.courses;

  // PVC included without discount
  if (course.pvc_id_type === 'included' && !trainee.has_discount) {
    return "Included in Course Fee";
  }

  // User opted for PVC
  if (trainee.add_pvc_id) {
    const fee = getPvcFee(trainee);
    const employmentLabel = trainee.employment_status === 'Unemployed' ? 'Student/Unemployed' : 'Professional';
    return `Yes - ₱${fee.toLocaleString()} (${employmentLabel} Rate)`;
  }

  return "No (Digital ID Only)";
};


// Helper function to get the correct fee based on event type
const getTrainingFee = () => {
  if (!trainee?.courses) return 0;
  
  const eventType = trainee.schedules?.event_type?.toLowerCase();
  
  if (eventType === 'online') {
    return Number(trainee.courses.online_fee) || 0;
  } else if (eventType === 'face-to-face') {
    return Number(trainee.courses.face_to_face_fee) || 0;
  } else if (eventType === 'elearning') {
    return Number(trainee.courses.elearning_fee) || 0;
  }
  
  return Number(trainee.courses.training_fee) || 0;
};

const getEventTypeLabel = () => {
  const eventType = trainee?.schedules?.event_type;
  if (!eventType) return "N/A";
  
  const typeMap: { [key: string]: string } = {
    'online': 'Online',
    'face-to-face': 'Face-to-Face',
    'elearning': 'E-Learning'
  };
  
  return typeMap[eventType.toLowerCase()] || eventType;
};


// ✅ PVC AUTO RULE (UI): if no discount -> PVC is automatically YES
const isPvcAutoYes = (t: any) => !t?.has_discount;

// ✅ Actual PVC "effective" value used in computations/UI
const getEffectivePvcId = (t: any) => {
  // User must have discount AND explicitly opt-in for PVC
  return !!(t?.has_discount && t?.add_pvc_id);
};

// ✅ Label for admin clarity
const getPvcDisplayLabel = (t: any) => {
  if (!t?.has_discount) {
    return "N/A (No Discount)";
  }
  return t?.add_pvc_id ? "Yes (User Selected)" : "No";
};

// ✅ Fee based on effective PVC
const getEffectivePvcFee = (t: any) => {
  // Only charge PVC fee if user has discount AND opted for it
  return (t?.has_discount && t?.add_pvc_id) ? 150 : 0;
};



// ✅ Simple required-field validator
const validateRequired = (fields: { key: string; label: string; value: any }[]) => {
  const missing = fields
    .filter((f) => {
      if (typeof f.value === "string") return !f.value.trim();
      if (typeof f.value === "number") return Number.isNaN(f.value);
      if (typeof f.value === "boolean") return f.value === false; // only use for required booleans
      return f.value === null || f.value === undefined;
    })
    .map((f) => f.label);

  if (missing.length) {
    alert(`Please fill in the required fields:\n• ${missing.join("\n• ")}`);
    return false;
  }
  return true;
};





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

  const handleMarkPendingVerification = async () => {
    if (!trainee?.id) return;

    const confirmed = window.confirm(
      "Mark this trainee as pending verification?\n\nThis cancels waiting for photo resubmission and moves them back into the photo review queue using their current photos on file."
    );
    if (!confirmed) return;

    setMarkingPendingVerification(true);
    try {
      const { error } = await supabase
        .from("trainings")
        .update({
          status: "Resubmitted (Pending Verification)",
          declined_photos: null,
        })
        .eq("id", trainee.id);

      if (error) throw error;

      alert("Status updated to pending verification. Reopen this submission to review photos.");
      onOpenChange(false);
    } catch (error) {
      console.error("Error marking pending verification:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setMarkingPendingVerification(false);
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

    // ✅ Required fields before saving payment
if (
  !validateRequired([
    { key: "amountPaid", label: "Amount Paid", value: amountPaid },
  ])
) return;

const amt = Number(amountPaid);
if (!Number.isFinite(amt) || amt <= 0) {
  alert("Please enter a valid amount greater than 0.");
  return;
}

// If sending classroom URL, require URL
if (sendClassroom && !validateRequired([
  { key: "onlineClassroomUrl", label: "Online Classroom URL", value: onlineClassroomUrl },
])) return;

// Optional: require receipt file/link for non-counter uploads
// (You can remove this if you allow saving without receipt)
if (!uploadedReceiptUrl) {
  alert("Please upload a receipt first.");
  return;
}



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

      const { data, error } = await tmsDb
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

  const originalFee = getTrainingFee();
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

  const currentPayment = payments.find(p => p.id === selectedPaymentId);
  if (!currentPayment) {
    alert('Payment not found');
    return;
  }

  // ✅ FIXED: Calculate with correct PVC fee
  const courseFee = discountApplied !== null ? Number(discountApplied) : getTrainingFee();
  const pvcFee = getPvcFee(trainee); // ✅ NEW - Use helper
  const totalRequired = courseFee + pvcFee;
  const remainingBalance = totalRequired - totalPaid;

  let finalAmount = 0;

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
    
    // ✅ FIXED: Use totalRequired instead of discountedFee
    const remainingBalanceAfter = totalRequired - newTotal;
    const isPaymentComplete = newTotal >= totalRequired;

    // ✅ FIXED: Determine status based on totalRequired (includes PVC)
    let finalStatus = 'completed';
    let trainingStatus = '';
    let paymentStatus = '';

    if (newTotal >= totalRequired) {
      finalStatus = 'completed';
      trainingStatus = 'Payment Completed';
      
      if (isDiscounted && trainee.add_pvc_id) {
        paymentStatus = 'Payment Completed (Discounted + PVC)';
      } else if (isDiscounted) {
        paymentStatus = 'Payment Completed (Discounted)';
      } else if (trainee.add_pvc_id) {
        paymentStatus = 'Payment Completed (with PVC)';
      } else {
        paymentStatus = 'Payment Completed';
      }
    } else if (newTotal > 0) {
  finalStatus = 'completed'; // ✅ CHANGED: Set to 'completed' instead of 'pending'
  trainingStatus = 'Partially Paid';
      
      if (isDiscounted && trainee.add_pvc_id) {
        paymentStatus = 'Partially Paid (Discounted + PVC)';
      } else if (isDiscounted) {
        paymentStatus = 'Partially Paid (Discounted)';
      } else if (trainee.add_pvc_id) {
        paymentStatus = 'Partially Paid (with PVC)';
      } else {
        paymentStatus = 'Partially Paid';
      }
    }

    // Update payment status
    const { error: updateError } = await tmsDb
      .from('payments')
      .update({
        payment_status: finalStatus,
        amount_paid: finalAmount,
        receipt_uploaded_by: currentPayment.receipt_uploaded_by, // ✅ FIXED: Preserve original value
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedPaymentId);

    if (updateError) throw updateError;

    // Update training record
    await tmsDb
      .from('trainings')
      .update({
        amount_paid: newTotal,
        payment_status: paymentStatus,
        status: trainingStatus,
      })
      .eq('id', trainee.id);

    // Get course details for email
    const { data: courseData } = await tmsDb
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
                  <span class="label">Course Fee:</span>
                  <span class="value">₱${courseFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>

                ${pvcFee > 0 ? `
                <div class="info-row">
                  <span class="label">PVC ID Fee:</span>
                  <span class="value">₱${pvcFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                ` : ''}

                <div class="info-row">
                  <span class="label">Total Required:</span>
                  <span class="value">₱${totalRequired.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>

                <div class="info-row">
                  <span class="label">Remaining Balance:</span>
                  <span class="value">₱${Math.max(0, remainingBalanceAfter).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>

                <div class="info-row">
                  <span class="label">Status:</span>
                  <span class="value" style="color: #10b981; font-weight: bold;">${paymentStatus}</span>
                </div>
              </div>
              
              ${isPaymentComplete
                  ? `<p style="color: #10b981; font-weight: bold; text-align: center; font-size: 18px;">
                      🎊 Congratulations! Your payment is now complete!
                    </p>`
                  : `<p style="color: #f59e0b; font-weight: 600;">
                      Please note: You still have a remaining balance of ₱${Math.max(0, remainingBalanceAfter).toLocaleString('en-PH', { minimumFractionDigits: 2 })}.
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
    
    // ✅ FIXED: Reset all approval-related state first
    setShowApproveDialog(false);
    setSelectedPaymentId(null);
    setApproveAmount('');
    setApproveType('full');
    setSaving(false); // Ensure saving state is reset
    
    // Then refresh payments
    await fetchPayments();

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
    if (!validateRequired([{ key: "amountPaid", label: "Amount Paid", value: amountPaid }])) return;

      const amt = Number(amountPaid);
      if (!Number.isFinite(amt) || amt <= 0) {
        alert("Please enter a valid amount greater than 0.");
        return;
      }

    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const { error } = await tmsDb
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
  // ✅ Required personal fields
  if (!validateRequired([
    { key: "first_name", label: "First Name", value: newDetails.first_name },
    { key: "last_name", label: "Last Name", value: newDetails.last_name },
    { key: "email", label: "Email", value: newDetails.email },
    { key: "phone_number", label: "Phone Number", value: newDetails.phone_number },
    { key: "gender", label: "Gender", value: newDetails.gender },
    { key: "age", label: "Age", value: newDetails.age },
  ])) return;

  const ageNum = Number(newDetails.age);
  if (!Number.isFinite(ageNum) || ageNum <= 0) {
    alert("Please enter a valid Age.");
    return;
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newDetails.email.trim());
  if (!emailOk) {
    alert("Please enter a valid Email.");
    return;
  }

  setUpdatingDetails(true);
  try {
    // ✅ Helper function to convert empty strings to null for numeric fields
    const parseNumeric = (value: any) => {
      if (value === "" || value === null || value === undefined) return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };

    const { error } = await supabase
      .from("trainings")
      .update({
        professional_title: newDetails.professional_title || null,
        first_name: newDetails.first_name,
        middle_initial: newDetails.middle_initial || null,
        last_name: newDetails.last_name,
        suffix: newDetails.suffix || null,
        email: newDetails.email,
        phone_number: newDetails.phone_number,
        gender: newDetails.gender,
        age: parseNumeric(newDetails.age), // Convert to number or null
        employment_status: newDetails.employment_status || null,
        company_name: newDetails.company_name || null,
        company_position: newDetails.company_position || null,
        company_industry: newDetails.company_industry || null,
        company_email: newDetails.company_email || null,
        company_landline: newDetails.company_landline || null,
        company_city: newDetails.company_city || null,
        company_region: newDetails.company_region || null,
        total_workers: parseNumeric(newDetails.total_workers), // ✅ Convert to bigint or null
        food_restriction: newDetails.food_restriction || null,
        is_student: newDetails.is_student,
        school_name: newDetails.school_name || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", trainee.id);
      
    if (error) {
      console.error("Update error:", error);
      alert("Failed to update personal details.");
      return;
    }
    
    setIsEditingDetails(false);
    alert("Personal details updated successfully.");
    
  } catch (err) {
    console.error("Error updating details:", err);
    alert("Failed to update personal details.");
  } finally {
    setUpdatingDetails(false);
  }
};

const handleSaveAddress = async () => {
  if (!validateRequired([
    { key: "mailing_street", label: "Street", value: newAddress.mailing_street },
    { key: "mailing_city", label: "City", value: newAddress.mailing_city },
    { key: "mailing_province", label: "Province", value: newAddress.mailing_province },
  ])) return;

  setUpdatingAddress(true);
  try {
    // ✅ Only update address fields that exist in trainings table
    const { error } = await supabase
      .from("trainings")
      .update({
        mailing_street: newAddress.mailing_street,
        mailing_city: newAddress.mailing_city,
        mailing_province: newAddress.mailing_province,
        updated_at: new Date().toISOString()
      })
      .eq("id", trainee.id);
      
    if (error) {
      console.error("Update error:", error);
      alert("Failed to update address.");
      return;
    }
    
    setIsEditingAddress(false);
    alert("Address updated successfully.");
    
  } catch (err) {
    console.error("Error updating address:", err);
    alert("Failed to update address.");
  } finally {
    setUpdatingAddress(false);
  }
};

const handleUpdate2x2Photo = () => {
  const shouldReplace = window.confirm(
    '📷 Update 2x2 Photo\n\n' +
    'Click OK to REPLACE with a new image\n' +
    'Click Cancel to CROP the current image'
  );
  
  if (shouldReplace) {
    // Replace with new image
    setCropExisting2x2(false);
    setShow2x2CropDialog(true);
  } else {
    // Crop existing image
    setCropExisting2x2(true);
    setShow2x2CropDialog(true);
  }
};

const handleUpdateIdPhoto = () => {
  const shouldReplace = window.confirm(
    '🪪 Update ID Photo\n\n' +
    'Click OK to REPLACE with a new image\n' +
    'Click Cancel to CROP the current image'
  );
  
  if (shouldReplace) {
    // Replace with new image
    setCropExistingId(false);
    setShowIdCropDialog(true);
  } else {
    // Crop existing image
    setCropExistingId(true);
    setShowIdCropDialog(true);
  }
};

const handleSave2x2Photo = async (croppedUrl: string, originalUrl: string) => {
  setUpdatingPhoto(true);
  try {
    const { error } = await supabase
      .from('trainings')
      .update({
        picture_2x2_url: croppedUrl,
        picture_2x2_original: originalUrl,
      })
      .eq('id', trainee.id);

    if (error) throw error;
    alert('2x2 photo updated successfully!');
    window.location.reload();
  } catch (error) {
    console.error('Error updating 2x2 photo:', error);
    alert('Failed to update photo.');
  } finally {
    setUpdatingPhoto(false);
  }
};

const handleSaveIdPhoto = async (croppedUrl: string, originalUrl: string) => {
  setUpdatingPhoto(true);
  try {
    const { error } = await supabase
      .from('trainings')
      .update({
        id_picture_url: croppedUrl,
        id_picture_original: originalUrl,
      })
      .eq('id', trainee.id);

    if (error) throw error;
    alert('ID photo updated successfully!');
    window.location.reload();
  } catch (error) {
    console.error('Error updating ID photo:', error);
    alert('Failed to update photo.');
  } finally {
    setUpdatingPhoto(false);
  }
};

const handleRestore2x2Original = async () => {
  if (!trainee.picture_2x2_original) {
    alert('No original photo backup found.');
    return;
  }

  const confirm = window.confirm(
    'Restore original 2x2 photo? This will replace the current version.'
  );

  if (!confirm) return;

  setUpdatingPhoto(true);
  try {
    const { error } = await supabase
      .from('trainings')
      .update({ picture_2x2_url: trainee.picture_2x2_original })
      .eq('id', trainee.id);

    if (error) throw error;
    alert('Original 2x2 photo restored!');
    window.location.reload();
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to restore.');
  } finally {
    setUpdatingPhoto(false);
  }
};

const handleRestoreIdOriginal = async () => {
  if (!trainee.id_picture_original) {
    alert('No original ID photo backup found.');
    return;
  }

  const confirm = window.confirm(
    'Restore original ID photo? This will replace the current version.'
  );

  if (!confirm) return;

  setUpdatingPhoto(true);
  try {
    const { error } = await supabase
      .from('trainings')
      .update({ id_picture_url: trainee.id_picture_original })
      .eq('id', trainee.id);

    if (error) throw error;
    alert('Original ID photo restored!');
    window.location.reload();
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to restore.');
  } finally {
    setUpdatingPhoto(false);
  }
};


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* ✅ VIEW 1: PHOTO VERIFICATION - For Pending/Resubmitted */}
        {needsPhotoVerification ? (
  <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100%-0.75rem)] max-w-2xl flex-col gap-3 overflow-hidden p-3 sm:w-[90vw] sm:gap-4 sm:p-6 lg:w-[40vw]">
    <DialogHeader className="space-y-1 pr-8 text-left">
      <DialogTitle className="text-base sm:text-lg">
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

    <ScrollArea className="min-h-0 flex-1 overflow-y-auto pr-2 sm:pr-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {/* ID Picture */}
        <div className="relative cursor-pointer" onClick={() => setShowIdViewModal(true)}>
          <h4 className="mb-1.5 text-xs font-semibold sm:mb-2 sm:text-sm">
            ID Picture
            {trainee.declined_photos?.id_picture && (
              <span className="ml-2 text-xs text-red-600">(Was Declined)</span>
            )}
          </h4>
          <img
            src={trainee.id_picture_url}
            alt="ID Picture"
            className={`w-full max-h-[200px] rounded border object-contain transition hover:opacity-80 sm:max-h-[300px] ${
              trainee.declined_photos?.id_picture ? 'border-2 border-red-400' : ''
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
          {/* ✅ FIXED: Added max-height and object-contain */}
          <img
            src={trainee.picture_2x2_url}
            alt="2x2 Photo"
            className={`w-full max-h-[200px] rounded border object-contain transition hover:opacity-80 sm:max-h-[300px] ${
              trainee.declined_photos?.picture_2x2 ? 'border-2 border-red-400' : ''
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
              <Spinner size={14} />
            ) : (
              <Edit className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </ScrollArea>
    
    <DialogFooter className="mt-3 flex-col gap-2 border-t pt-3 sm:mt-4 sm:flex-row sm:pt-4">
      <Button 
        variant="destructive"
        className="w-full sm:w-auto"
        onClick={onDecline}
        disabled={saving}
      >
        {saving ? (
          <>
            <Spinner size={18} className="mr-2" />
            Processing...
          </>
        ) : (
          'Decline'
        )}
      </Button>
      <Button 
        className="w-full sm:w-auto"
        onClick={onVerify}
        disabled={saving}
      >
        {saving ? (
          <>
            <Spinner size={18} className="mr-2" />
            Verifying...
          </>
        ) : (
          <>
            <span className="sm:hidden">Verify</span>
            <span className="hidden sm:inline">Verify & Proceed to Payment</span>
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
)
        // Complete Return Block - Part 2 of 5
// This continues directly after Part 1 (after the photo verification view closing)

        //* ✅ VIEW 2: DECLINED WAITING VIEW - Shows when status is "Declined (Waiting for Resubmission)" */}
        : isDeclinedAwaitingResubmission ? (
          <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100%-0.75rem)] max-w-2xl flex-col gap-3 overflow-hidden p-3 sm:w-[90vw] sm:gap-4 sm:p-6 lg:w-[50vw]">
            <DialogHeader className="space-y-1 pr-8 text-left">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                Waiting for Photo Resubmission
              </DialogTitle>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-4">
              <div className="space-y-3 sm:space-y-4">
                {/* Status Banner */}
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 sm:h-5 sm:w-5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-800 sm:text-base">Declined — awaiting resubmission</p>
                      <p className="mt-1 text-xs text-red-600 sm:text-sm">
                        The trainee has been notified via email to resubmit their photos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trainee Info */}
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 sm:gap-4 sm:p-4 dark:bg-muted/40">
                  <Avatar className="h-12 w-12 shrink-0 sm:h-16 sm:w-16">
                    <AvatarImage src={trainee.picture_2x2_url} />
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold sm:text-lg">{trainee.first_name} {trainee.last_name}</p>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">{trainee.email}</p>
                    <p className="text-xs text-muted-foreground sm:text-sm">{trainee.phone_number}</p>
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
            <DialogFooter className="mt-2 flex-col gap-2 sm:mt-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleFollowUp}
                disabled={sendingFollowUp || markingPendingVerification}
              >
                {sendingFollowUp ? (
                  <>
                    <Spinner size={18} className="mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span className="sm:hidden">Follow-Up</span>
                    <span className="hidden sm:inline">Send Follow-Up Email</span>
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={handleMarkPendingVerification}
                disabled={markingPendingVerification || sendingFollowUp}
              >
                {markingPendingVerification ? (
                  <>
                    <Spinner size={18} className="mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    <span className="sm:hidden">Mark Pending</span>
                    <span className="hidden sm:inline">Mark as Pending Verification</span>
                  </>
                )}
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
                disabled={markingPendingVerification || sendingFollowUp}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )
        
    
        //* ✅ VIEW 3: FULL DETAILS VIEW - For Pending Payment, Partially Paid, Payment Completed, etc. */}
        : showFullDetailsView ? (
  <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100%-0.75rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-[92vw] lg:w-[70vw]">
    <ScrollArea className="custom-scrollbar h-[min(92dvh,880px)] max-h-[min(92dvh,880px)]">
      <div className="space-y-3 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-4 sm:p-6">
      <DialogHeader className="space-y-1 pr-8 text-left">
        <DialogTitle className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 sm:text-sm">
          <span className="text-muted-foreground">Submission ID</span>
          <span className="mt-0.5 block break-all font-mono text-[11px] font-medium tracking-tight sm:text-sm">
            {trainee?.id}
          </span>
        </DialogTitle>
        <p className="text-right text-[11px] text-muted-foreground sm:text-sm">
          {new Date().toLocaleDateString()}
        </p>
      </DialogHeader>

     {/* Tabs */}
<Tabs
  value={activeTab}
  onValueChange={(v) => setActiveTab(v as "info" | "payment")}
  className="w-full min-w-0"
>
  <div className="flex justify-center">
    <TabsList className="mb-3 grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1 sm:mb-4 sm:inline-flex sm:w-fit sm:gap-2">
      <TabsTrigger
        value="info"
        className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-primary/60 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
      >
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="sm:hidden">Info</span>
        <span className="hidden sm:inline">User Info</span>
      </TabsTrigger>

      <TabsTrigger
        value="payment"
        className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-primary/60 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
      >
        <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="sm:hidden">Payment</span>
        <span className="hidden sm:inline">Payment Details</span>
      </TabsTrigger>
    </TabsList>
  </div>



        {/* ===================== TAB 1: USER INFO ===================== */}
        <TabsContent value="info" className="mt-0 space-y-3 sm:space-y-4">
          {/* Photo Section */}
          <div className="flex flex-col items-center gap-1.5 py-2 sm:gap-2 sm:py-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Label className="text-[10px] text-muted-foreground sm:text-xs">2x2 Photo</Label>
                <div className="relative cursor-pointer" onClick={() => setShow2x2ViewModal(true)}>
                  <div className="rounded-lg border-2 border-primary p-0.5 sm:p-1">
                    <Avatar className="h-16 w-16 sm:h-24 sm:w-24">
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

              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <Label className="text-[10px] text-muted-foreground sm:text-xs">ID Picture</Label>
                <div className="relative cursor-pointer" onClick={() => setShowIdViewModal(true)}>
                  <div className="h-16 w-24 overflow-hidden rounded-lg border-2 border-primary p-0.5 sm:h-24 sm:w-32 sm:p-1">
                    <img
                      src={trainee?.id_picture_url}
                      alt="ID"
                      className="h-full w-full rounded object-cover"
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
                      <Spinner size={14} />
                    ) : (
                      <Edit className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <span className="text-center text-base font-bold text-indigo-900 dark:text-indigo-200 sm:text-lg">
              {trainee?.first_name} {trainee?.last_name}
            </span>
            <span className="max-w-full truncate px-2 text-center text-xs italic text-muted-foreground sm:text-sm">
              {trainee?.email}
            </span>
          </div>

          {/* Personal Details */}
          <section className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between bg-card px-3 py-1.5 text-sm font-semibold sm:px-4 sm:py-2 sm:text-base sm:font-black">
              Personal Details
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setIsEditingDetails(!isEditingDetails)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            {/* KEEP YOUR EXISTING Personal Details CONTENT EXACTLY */}
            {isEditingDetails ? (

    <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
      {/* Name Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label htmlFor="professional_title" className="text-xs">
            Professional Title <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="professional_title"
            value={newDetails.professional_title}
            onChange={(e) => setNewDetails(prev => ({ ...prev, professional_title: e.target.value }))}
            placeholder="e.g. RN, MD, Engr."
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground leading-snug">
            Appears at the end of the name on the certificate (e.g. Juan Dela Cruz, RN).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="first_name" className="text-xs">First Name *</Label>
          <Input
            id="first_name"
            value={newDetails.first_name}
            onChange={(e) => setNewDetails(prev => ({ ...prev, first_name: e.target.value }))}
            placeholder="First name"
            className="h-9"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="middle_initial" className="text-xs">M.I.</Label>
          <Input
            id="middle_initial"
            value={newDetails.middle_initial}
            onChange={(e) => setNewDetails(prev => ({ ...prev, middle_initial: e.target.value }))}
            placeholder="M.I."
            maxLength={1}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="text-xs">Last Name *</Label>
          <Input
            id="last_name"
            value={newDetails.last_name}
            onChange={(e) => setNewDetails(prev => ({ ...prev, last_name: e.target.value }))}
            placeholder="Last name"
            className="h-9"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label htmlFor="suffix" className="text-xs">Suffix</Label>
          <Input
            id="suffix"
            value={newDetails.suffix}
            onChange={(e) => setNewDetails(prev => ({ ...prev, suffix: e.target.value }))}
            placeholder="Jr., Sr., III"
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender" className="text-xs">Gender *</Label>
          <Input
            id="gender"
            value={newDetails.gender}
            onChange={(e) => setNewDetails(prev => ({ ...prev, gender: e.target.value }))}
            placeholder="Male/Female"
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age" className="text-xs">Age *</Label>
          <Input
            id="age"
            type="number"
            value={newDetails.age}
            onChange={(e) => setNewDetails(prev => ({ ...prev, age: e.target.value }))}
            placeholder="Age"
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employment_status" className="text-xs">Employment Status</Label>
          <Input
            id="employment_status"
            value={newDetails.employment_status}
            onChange={(e) => setNewDetails(prev => ({ ...prev, employment_status: e.target.value }))}
            placeholder="Employed/Unemployed"
            className="h-9"
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs">Email *</Label>
          <Input
            id="email"
            type="email"
            value={newDetails.email}
            onChange={(e) => setNewDetails(prev => ({ ...prev, email: e.target.value }))}
            placeholder="email@example.com"
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone_number" className="text-xs">Phone Number *</Label>
          <Input
            id="phone_number"
            value={newDetails.phone_number}
            onChange={(e) => setNewDetails(prev => ({ ...prev, phone_number: e.target.value }))}
            placeholder="+63 912 345 6789"
            className="h-9"
          />
        </div>
      </div>

      {/* Student Information (if unemployed) */}
      {newDetails.employment_status === "Unemployed" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_student"
              checked={newDetails.is_student}
              onCheckedChange={(checked) => 
                setNewDetails(prev => ({ ...prev, is_student: !!checked }))
              }
            />
            <Label htmlFor="is_student" className="text-sm cursor-pointer">
              Student
            </Label>
          </div>
          
          {newDetails.is_student && (
            <div className="space-y-2">
              <Label htmlFor="school_name" className="text-xs">School/University Name</Label>
              <Input
                id="school_name"
                value={newDetails.school_name}
                onChange={(e) => setNewDetails(prev => ({ ...prev, school_name: e.target.value }))}
                placeholder="Enter school or university"
                className="h-9"
              />
            </div>
          )}
        </div>
      )}

      {/* Company Information (if employed) */}
      {newDetails.employment_status === "Employed" && (
        <div className="space-y-3 p-3 bg-card border border-slate-200 rounded">
          <h4 className="font-semibold text-sm">Company Details</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="text-xs">Company Name</Label>
              <Input
                id="company_name"
                value={newDetails.company_name}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Company name"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_position" className="text-xs">Position</Label>
              <Input
                id="company_position"
                value={newDetails.company_position}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_position: e.target.value }))}
                placeholder="Job position"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_industry" className="text-xs">Industry</Label>
              <Input
                id="company_industry"
                value={newDetails.company_industry}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_industry: e.target.value }))}
                placeholder="Industry"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_email" className="text-xs">Company Email</Label>
              <Input
                id="company_email"
                type="email"
                value={newDetails.company_email}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_email: e.target.value }))}
                placeholder="company@example.com"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_landline" className="text-xs">Company Landline</Label>
              <Input
                id="company_landline"
                value={newDetails.company_landline}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_landline: e.target.value }))}
                placeholder="(02) 1234-5678"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_city" className="text-xs">Company City</Label>
              <Input
                id="company_city"
                value={newDetails.company_city}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_city: e.target.value }))}
                placeholder="City"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_region" className="text-xs">Company Region</Label>
              <Input
                id="company_region"
                value={newDetails.company_region}
                onChange={(e) => setNewDetails(prev => ({ ...prev, company_region: e.target.value }))}
                placeholder="Region"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_workers" className="text-xs">Total Workers</Label>
              <Input
                id="total_workers"
                type="number"
                value={newDetails.total_workers}
                onChange={(e) => setNewDetails(prev => ({ ...prev, total_workers: e.target.value }))}
                placeholder="Number of workers"
                className="h-9"
              />
            </div>
          </div>
        </div>
      )}

      {/* Food Restriction */}
      <div className="space-y-2">
        <Label htmlFor="food_restriction" className="text-xs">Food Restriction/Allergies</Label>
        <Input
          id="food_restriction"
          value={newDetails.food_restriction}
          onChange={(e) => setNewDetails(prev => ({ ...prev, food_restriction: e.target.value }))}
          placeholder="Any food restrictions or allergies"
          className="h-9"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => setIsEditingDetails(false)}
          disabled={updatingDetails}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSavePersonalDetails} 
          disabled={updatingDetails}
        >
          {updatingDetails ? (
            <>
              <Spinner size={18} className="mr-2" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  ) : (
    /* VIEW MODE - Display all data */
    <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
      {/* Full Name Display */}
      <div className="border-b pb-2 sm:pb-3">
        <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Full Name</div>
        <div className="text-sm font-semibold sm:text-base">
          {[
            trainee?.first_name,
            trainee?.middle_initial && trainee?.middle_initial + '.',
            trainee?.last_name,
            trainee?.suffix,
            trainee?.professional_title && `, ${trainee.professional_title}`,
          ].filter(Boolean).join(' ').replace(/\s+,/g, ',') || 'N/A'}
        </div>
      </div>

      {/* Basic Information Grid */}
      <div className="grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Gender</div>
          <div className="text-xs font-medium sm:text-sm">{trainee?.gender || 'N/A'}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Age</div>
          <div className="text-xs font-medium sm:text-sm">{trainee?.age || 'N/A'}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Employment</div>
          <div className="text-xs font-medium sm:text-sm">{trainee?.employment_status || 'N/A'}</div>
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Email</div>
          <div className="break-all text-[11px] font-medium sm:text-xs">{trainee?.email || 'N/A'}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Phone</div>
          <div className="text-xs font-medium sm:text-sm">{trainee?.phone_number || 'N/A'}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Food Restriction</div>
          <div className="text-xs font-medium sm:text-sm">{trainee?.food_restriction || 'None'}</div>
        </div>
      </div>

      {/* Student Information (if applicable) */}
      {trainee?.employment_status === "Unemployed" && trainee?.is_student && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-xs text-muted-foreground mb-1">Student Information</div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm">Currently a Student</span>
          </div>
          {trainee?.school_name && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground">School/University</div>
              <div className="font-medium text-sm">{trainee.school_name}</div>
            </div>
          )}
        </div>
      )}

      {/* Company Information (if employed) */}
      {trainee?.employment_status === "Employed" && (
        <div className="p-3 bg-card border border-slate-200 rounded space-y-3">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Company Information
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Company Name</div>
              <div className="font-medium">{trainee?.company_name || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Position</div>
              <div className="font-medium">{trainee?.company_position || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Industry</div>
              <div className="font-medium">{trainee?.company_industry || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Company Email</div>
              <div className="font-medium text-xs break-all">{trainee?.company_email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Landline</div>
              <div className="font-medium">{trainee?.company_landline || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Company City</div>
              <div className="font-medium">{trainee?.company_city || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Company Region</div>
              <div className="font-medium">{trainee?.company_region || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Workers</div>
              <div className="font-medium">{trainee?.total_workers || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files from Registration */}
      <div className="p-3 bg-card border border-slate-200 rounded space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2">
          <Download className="h-4 w-4" />
          Uploaded Files
        </div>
        {getUploadedFiles().length === 0 ? (
          <div className="text-xs text-muted-foreground">No uploaded files found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {getUploadedFiles().map((file) => (
              <div key={file.key} className="border rounded px-3 py-2">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{file.label}</div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline break-all"
                    >
                      Open File
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {file.fromEmail && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                        From email
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        file.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : file.status === "declined"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {file.status === "approved" ? "Approved" : file.status === "declined" ? "Declined" : "Pending"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px]"
                    disabled={updatingFileKey === file.key}
                    onClick={() => updateFileReviewStatus(file.key, "approved")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px]"
                    disabled={updatingFileKey === file.key}
                    onClick={() => updateFileReviewStatus(file.key, "declined")}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1 text-red-600" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px]"
                    disabled={updatingFileKey === file.key}
                    onClick={() => triggerReplaceFile(file.key)}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Replace
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <input
          ref={replaceFileInputRef}
          type="file"
          className="hidden"
          onChange={handleReplaceFileUpload}
          accept="*/*"
        />
      </div>
    </div>
  )}
</section>
                {/* Mailing Address */}
          <section className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between bg-card px-3 py-1.5 text-sm font-semibold sm:px-4 sm:py-2 sm:text-base sm:font-bold">
              Mailing Address
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsEditingAddress(!isEditingAddress)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-3 text-sm sm:p-4">
              {isEditingAddress ? (
                <>
                  <Label>Street</Label>
                  <Input value={newAddress.mailing_street} onChange={e => setNewAddress(prev => ({ ...prev, mailing_street: e.target.value }))} />
                  <Label className="mt-2">City</Label>
                  <Input value={newAddress.mailing_city} onChange={e => setNewAddress(prev => ({ ...prev, mailing_city: e.target.value }))} />
                  <Label className="mt-2">Province</Label>
                  <Input value={newAddress.mailing_province} onChange={e => setNewAddress(prev => ({ ...prev, mailing_province: e.target.value }))} />
                  <Button onClick={handleSaveAddress} className="mt-2" disabled={updatingAddress}>
                    {updatingAddress ? (
                      <>
                        <Spinner size={18} className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <strong>Address</strong>
                  <div>
                    {[trainee?.mailing_street, trainee?.mailing_city, trainee?.mailing_province]
                      .filter(Boolean)
                      .join(", ") || "N/A"}
                  </div>
                </>
              )}
            </div>
          </section>
        </TabsContent>

                {/* ===================== TAB 2: PAYMENT ===================== */}
        <TabsContent value="payment" className="mt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {/* Payment Details Section */}
            <section className="overflow-hidden rounded-lg border">
              <div className="border border-green-300 bg-green-100 px-3 py-1.5 text-sm font-semibold dark:text-blue-950 sm:px-4 sm:py-2 sm:text-base sm:font-bold">
                Payment Details
              </div>

              <div className="space-y-2 p-3 text-xs sm:p-4 sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">Training Fee ({getEventTypeLabel()}):</span>
                  <span className="shrink-0 font-medium">{formatCurrency(getTrainingFee())}</span>
                </div>

                {/* ✅ FIXED JSX COMMENT */}
                {/* PVC ID Add-on Display */}
           

{trainee.courses?.has_pvc_id && (
  <div className={`p-3 border rounded-lg space-y-2 ${
    // If PVC included without discount, show green
    trainee.courses.pvc_id_type === 'included' && !trainee.has_discount
      ? 'bg-green-50 dark:bg-green-950/20 border-green-300'
      // If user opted for PVC, show blue
      : trainee.add_pvc_id 
      ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300'
      // Otherwise gray
      : 'bg-gray-50 dark:bg-gray-900 border-gray-300'
  }`}>
    <div className="flex items-center gap-2">
      {trainee.courses.pvc_id_type === 'included' && !trainee.has_discount ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="font-semibold text-green-800 dark:text-green-200">
            Physical PVC ID Included
          </span>
        </>
      ) : trainee.add_pvc_id ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-blue-800 dark:text-blue-200">
            Physical PVC ID Added
          </span>
        </>
      ) : (
        <>
          <XCircle className="w-4 h-4 text-gray-600" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            Digital ID Only
          </span>
        </>
      )}
      
      <span className="ml-auto text-[11px] px-2 py-0.5 rounded bg-white/70 border text-gray-800">
        {getPvcDisplayText(trainee)}
      </span>
    </div>

    {/* Show fee breakdown if applicable */}
    {getPvcFee(trainee) > 0 && (
      <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300 pt-2 border-t border-blue-200">
        <span>PVC ID Fee:</span>
        <span className="font-semibold">₱{getPvcFee(trainee).toLocaleString()}</span>
      </div>
    )}

    {/* Explanation text */}
    <p className="text-xs text-gray-600 dark:text-gray-400">
      {trainee.courses.pvc_id_type === 'included' && !trainee.has_discount
        ? "Physical PVC ID is included in the course fee at no extra charge"
        : trainee.courses.pvc_id_type === 'included' && trainee.has_discount
        ? trainee.add_pvc_id
          ? "Trainee opted to add Physical PVC ID to discounted package"
          : "Discounted package includes Digital ID only"
        : trainee.courses.pvc_id_type === 'optional'
        ? trainee.add_pvc_id
          ? "Trainee opted for optional Physical PVC ID"
          : "Trainee chose Digital ID only"
        : "No PVC option available"}
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
                            {/* ✅ Show if batch or single use */}
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                              voucherInfo.is_batch 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            }`}>
                              {voucherInfo.is_batch ? 'Batch Voucher' : 'Single Use'}
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
                            {/* ✅ Show batch details if it's a batch voucher */}
                            {voucherInfo.is_batch && voucherInfo.batch_count && (
                              <>
                                <div className="flex justify-between pt-1 border-t border-emerald-200">
                                  <span>Total Codes:</span>
                                  <span className="font-semibold">{voucherInfo.batch_count}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Used:</span>
                                  <span className="font-semibold">{voucherInfo.batch_used || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Remaining:</span>
                                  <span className="font-semibold text-emerald-600">
                                    {voucherInfo.batch_remaining || 0}
                                  </span>
                                </div>
                              </>
                            )}
                            {voucherInfo.expiry_date && (
                              <div className="flex justify-between pt-1 border-t border-emerald-200">
                                <span>Expires:</span>
                                <span>{new Date(voucherInfo.expiry_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                        
                        {/* Discount Mode Selection */}
<div className="space-y-3 pt-2">
  <Label className="text-sm font-medium">Apply Discount</Label>
  
  <RadioGroup
    value={discountMode}
    onValueChange={(val: 'voucher' | 'manual') => {
      setDiscountMode(val)
      if (val === 'voucher') {
        setIsDiscounted(true)
      }
    }}
    className="flex gap-4"
  >
    <div className="flex items-center gap-2">
      <RadioGroupItem value="manual" id="discount-manual" />
      <Label htmlFor="discount-manual" className="cursor-pointer">Manual Discount</Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="voucher" id="discount-voucher" />
      <Label htmlFor="discount-voucher" className="cursor-pointer">Voucher Code</Label>
    </div>
  </RadioGroup>

  {/* Manual Discount Input */}
  {discountMode === 'manual' && (
    <div className="space-y-2 p-3 border rounded bg-background">
      <div className="flex items-center gap-2 mb-2">
        <Checkbox
          id="manual-discount-toggle"
          checked={isDiscounted}
          onCheckedChange={(checked) => {
            setIsDiscounted(!!checked)
            if (!checked) {
              setDiscountPrice("")
              setDiscountApplied(null)
            }
          }}
        />
        <Label htmlFor="manual-discount-toggle">Apply Manual Discount</Label>
      </div>
      
      {isDiscounted && (
        <>
          <Label>Discounted Price</Label>
          <Input
            type="number"
            placeholder="Enter discounted price"
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
          />
          {discountPercent !== null && (
            <p className="text-sm text-green-700 font-semibold">
              Discount Applied: {discountPercent}% off
            </p>
          )}
          <Button
            onClick={handleApplyDiscount}
            disabled={applyingDiscount}
            className="w-full"
          >
            {applyingDiscount ? (
              <>
                <Spinner size={18} className="mr-2" />
                Applying...
              </>
            ) : (
              'Apply Discount'
            )}
          </Button>
        </>
      )}
    </div>
  )}

  {/* Voucher Code Input */}
{discountMode === 'voucher' && (
  <div className="space-y-3 p-3 border rounded bg-background">
    {!voucherInfo ? (
      <>
        <Label htmlFor="voucher_input">Voucher Code</Label>
        <div className="flex gap-2">
          <Input
            id="voucher_input"
            placeholder="Enter voucher code"
            value={voucherInput}
            onChange={(e) => {
              setVoucherInput(e.target.value.toUpperCase())
              setVoucherError("")
            }}
            className="font-mono"
            maxLength={14}
            disabled={isVerifyingVoucher}
          />
          <Button
            type="button"
            onClick={handleVerifyVoucher}
            disabled={isVerifyingVoucher || !voucherInput.trim()}
            variant="outline"
          >
            {isVerifyingVoucher ? (
              <>
                <Spinner size={18} className="mr-2" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
        </div>
        
        {voucherError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {voucherError}
          </p>
        )}
      </>
    ) : (
      <>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-md px-3 py-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  {voucherInfo.code}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {voucherInfo.service || voucherInfo.description}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${
              voucherInfo.is_batch 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-purple-100 text-purple-800'
            }`}>
              {voucherInfo.is_batch ? 'Batch Voucher' : 'Single Use'}
            </span>
          </div>

          {/* Voucher Details */}
          <div className="text-xs space-y-1 bg-white dark:bg-gray-900 p-2 rounded border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{voucherInfo.voucher_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount:</span>
              <span className="font-semibold text-emerald-600">{voucherInfo.amount}</span>
            </div>
            {voucherInfo.is_batch && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Codes:</span>
                  <span className="font-medium">{voucherInfo.batch_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-semibold text-blue-600">{voucherInfo.batch_remaining}</span>
                </div>
              </>
            )}
            {voucherInfo.expiry_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span className="text-xs">{new Date(voucherInfo.expiry_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Discount Preview */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 p-2 rounded">
            <p className="text-xs text-amber-800 dark:text-amber-200 mb-1">
              <strong>New Price Preview:</strong>
            </p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground line-through">
                ₱{(Number(trainee.courses?.training_fee) || 0).toLocaleString()}
              </span>
              <span className="text-lg font-bold text-emerald-600">
                ₱{Number(discountPrice).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {!discountApplied || discountApplied !== Number(discountPrice) ? (
            <Button
              type="button"
              onClick={handleSaveVoucher}
              disabled={applyingDiscount}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {applyingDiscount ? (
                <>
                  <Spinner size={18} className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save & Apply Voucher
                </>
              )}
            </Button>
          ) : (
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Voucher Applied</span>
            </div>
          )}
          
          <Button
            type="button"
            onClick={handleRemoveVoucher}
            variant="outline"
            disabled={applyingDiscount}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {applyingDiscount ? (
              <Spinner size={18} />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </>
    )}
  </div>
)}
</div>
                      {discountApplied !== null && (() => {
                        // ✅ FIXED: Always use courses.training_fee as the original fee
                        const originalFee = getTrainingFee() || 0;
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
                                                
                       {/* Totals */}
                
                  
<div className="border-t pt-2 mt-2 space-y-1">
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>Course Fee:</span>
    <span>
      {formatCurrency(
        (discountApplied !== null ? discountApplied : getTrainingFee()) as number
      )}
    </span>
  </div>
  
  {/* Show PVC fee if applicable */}
  {getPvcFee(trainee) > 0 && (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>+ PVC ID:</span>
      <span>₱{getPvcFee(trainee).toLocaleString()}</span>
    </div>
  )}

  {/* Show if PVC is included */}
  {trainee.courses?.pvc_id_type === 'included' && !trainee.has_discount && (
    <div className="flex justify-between text-xs text-green-600">
      <span>Physical PVC:</span>
      <span className="font-medium">Included ✓</span>
    </div>
  )}
  
  <div className="flex justify-between font-semibold text-base text-gray-900 dark:text-gray-100 pt-1 border-t">
    <span>Total Required:</span>
    <span>
      {formatCurrency(
        ((discountApplied !== null ? discountApplied : getTrainingFee()) as number) +
        getPvcFee(trainee)
      )}
    </span>
  </div>
</div>
                <div className="flex justify-between font-semibold text-green-700">
                  <span>Total Amount Paid</span>
                  <span>{formatCurrency(totalPaid)}</span>
                </div>

                {(() => {
                  const courseFee = discountApplied !== null ? Number(discountApplied) : getTrainingFee();
                  const pvcFee = getPvcFee(trainee);
                  const requiredFee = courseFee + pvcFee;
                  const currentPaid = Number(totalPaid) || 0;
                  const balance = requiredFee - currentPaid;

                  if (Math.abs(balance) < 1) return null;

                  if (balance < 0) {
                    return (
                      <div className="flex justify-between font-semibold text-blue-700">
                        <span>Exceeded Amount</span>
                        <span>{formatCurrency(Math.abs(balance))}</span>
                      </div>
                    );
                  }

                  return (
                    <div className="flex justify-between font-semibold text-red-700">
                      <span>Remaining Balance</span>
                      <span>{formatCurrency(balance)}</span>
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* Payment History Section */}
            <section className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border border-yellow-300 bg-yellow-100 px-3 py-1.5 text-sm font-semibold dark:text-blue-950 sm:px-4 sm:py-2 sm:text-base sm:font-bold">
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
                      <Spinner size={18} />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {hasPayments && isCounterPayment && (
                  <Button size="sm" variant="default" onClick={() => setShowPaidConfirm(true)}>
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
                                    <Spinner size={14} />
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
                                          <Spinner size={14} className="mr-1" />
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
                                          <Spinner size={14} className="mr-1" />
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
               </TabsContent>
      </Tabs>

             {isPending && (
        <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:pt-4">
          <Button variant="destructive" className="w-full sm:w-auto" onClick={onDecline} disabled={saving}>
            {saving ? (
              <>
                <Spinner size={18} className="mr-2" />
                Processing...
              </>
            ) : (
              "Decline"
            )}
          </Button>
          <Button className="w-full sm:w-auto" onClick={onVerify} disabled={saving}>
            {saving ? (
              <>
                <Spinner size={18} className="mr-2" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </DialogFooter>
      )}
      </div>
    </ScrollArea>
  </DialogContent>
) : null}
      
      
      </Dialog>
      {/* Supporting Dialogs - Photo Viewers */}
      
      {/* 2x2 Photo Viewer Dialog */}
      <Dialog open={show2x2ViewModal} onOpenChange={setShow2x2ViewModal}>
        <DialogContent className="w-[calc(100%-0.75rem)] max-w-3xl p-3 sm:w-[90vw] sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-base sm:text-lg">2x2 Photo Viewer</DialogTitle>
          </DialogHeader>
          <div className="w-full text-center">
            <img
              src={trainee.picture_2x2_url}
              alt="2x2 Full View"
              className="mx-auto max-h-[70dvh] max-w-full rounded border shadow sm:max-h-[80vh]"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ID Photo Viewer Dialog */}
      <Dialog open={showIdViewModal} onOpenChange={setShowIdViewModal}>
        <DialogContent className="w-[calc(100%-0.75rem)] max-w-3xl p-3 sm:w-[90vw] sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-base sm:text-lg">ID Picture Viewer</DialogTitle>
          </DialogHeader>
          <div className="w-full text-center">
            <img
              src={trainee.id_picture_url}
              alt="ID Full View"
              className="mx-auto max-h-[70dvh] max-w-full rounded border shadow sm:max-h-[80vh]"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog for Receipt Upload */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="w-[calc(100%-0.75rem)] max-w-lg p-3 sm:w-[80vw] sm:p-6 lg:w-[40vw]">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-base sm:text-lg">Receipt Preview</DialogTitle>
          </DialogHeader>
          
          {previewImage && (
            <div className="rounded border p-2 sm:p-4">
              <img src={previewImage} alt="Receipt" className="mx-auto max-h-56 sm:max-h-96" />
            </div>
          )}
          
          <div className="space-y-3 sm:space-y-4">
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

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full sm:w-auto" disabled={saving}>
                  {saving ? (
                    <>
                      <Spinner size={18} className="mr-2" />
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
                  <Spinner size={18} className="mr-2" />
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
                    <Spinner size={18} className="mr-2" />
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
                const pvcFee = getPvcFee(trainee); // ✅ NEW - Use helper
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
             {/* Preview Total After Approval */}
              {(() => {
                // ✅ FIXED: Include correct PVC fee in preview calculation
                const courseFee = discountApplied !== null ? discountApplied : (trainee?.training_fee || 0);
                const pvcFee = getPvcFee(trainee); // ✅ NEW - Use helper
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

           {(() => {
              // ✅ FIXED: Include correct PVC fee in total calculation
              const courseFee = discountApplied !== null ? discountApplied : (trainee?.training_fee || 0);
              const pvcFee = getPvcFee(trainee); // ✅ NEW - Use helper
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
                  <Spinner size={18} className="mr-2" />
                  Approving...
                </>
              ) : (
                'Approve & Notify Client'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Image Crop Dialogs */}
      {/* Image Crop Dialogs */}
      <ImageCropDialog
        open={show2x2CropDialog}
        onOpenChange={setShow2x2CropDialog}
        imageType="2x2"
        onSave={handleSave2x2Photo}
        existingImageUrl={cropExisting2x2 ? trainee.picture_2x2_url : undefined}
      />

      <ImageCropDialog
        open={showIdCropDialog}
        onOpenChange={setShowIdCropDialog}
        imageType="id"
        onSave={handleSaveIdPhoto}
        existingImageUrl={cropExistingId ? trainee.id_picture_url : undefined}
      />
    </>
  );
}
