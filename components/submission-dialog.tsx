//components\submission-dialog.tsx
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
import { Plus, Loader2, Download, Trash2, ChevronDown, Pen, Edit } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

interface Payment {
  id: string;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  receipt_link: string | null;
  online_classroom_url: string | null;
}

interface SubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainee: any;
  onVerify: () => void;
  onDecline: () => void;
}

export function SubmissionDialog({
  open,
  onOpenChange,
  trainee,
  onVerify,
  onDecline,
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
  const [newDetails, setNewDetails] = useState({
    company_name: trainee?.company_name || "",
    gender: trainee?.gender || "",
    age: trainee?.age || "",
    phone_number: trainee?.phone_number || "",
    food_restriction: trainee?.food_restriction || "",
  });
  const [show2x2ViewModal, setShow2x2ViewModal] = useState(false);
  const [showIdViewModal, setShowIdViewModal] = useState(false);


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
      
      // Calculate total amount paid
      const total = data.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      
      // Update trainings table with total
      await supabase
        .from("trainings")
        .update({ amount_paid: total })
        .eq("id", trainee.id);
      await checkAndUpdatePaymentStatus(total);
    }
  };

  // Check and update payment status
const checkAndUpdatePaymentStatus = async (totalPaid: number) => {
  if (!trainee?.id || !trainee?.training_fee) return;

  const originalFee = Number(trainee.training_fee);
  const discountedFee = discountApplied !== null ? Number(discountApplied) : null;

  let newStatus = "";
  let newPaymentStatus: string | null = null;

  // If discount applied
  if (discountedFee !== null) {
    if (totalPaid >= discountedFee) {
      newStatus = "Payment Completed";
      newPaymentStatus = "Payment Completed (Discounted)";
    } else if (totalPaid > 0) {
      newStatus = "Partially Paid";
      newPaymentStatus = "Partially Paid (Discounted)";
    } else {
      newStatus = "Pending Payment";
      newPaymentStatus = null;
    }
  }

  // No discount
  else {
    if (totalPaid >= originalFee) {
      newStatus = "Payment Completed";
      newPaymentStatus = "Payment Completed";
    } else if (totalPaid > 0) {
      newStatus = "Partially Paid";
      newPaymentStatus = "Partially Paid";
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
  if (open && trainee) {
    // 👇 initialize discount UI state from database field
    setIsDiscounted(trainee.has_discount ?? false);
    setDiscountPrice("");
    setDiscountPercent(null);
    setDiscountApplied(trainee.discounted_fee ?? null);
  }
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

  if (!trainee) return null;

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-PH", { style: "currency", currency: "PHP" });

  const isPending = trainee.status?.toLowerCase() === "pending";
  const isCounterPayment = trainee.payment_method?.toUpperCase() === "COUNTER";
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const hasPayments = payments.length > 0;

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
        
        // Show preview dialog
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
};
  
      console.log("🧾 Inserting payment payload:", payload);

        if (isNaN(finalAmount) || finalAmount <= 0) {
        alert("Invalid amount. Please enter a valid number.");
        return;
      }
      const { data, error } = await supabase
        .from("payments")
        .insert(payload)
        .select();
  
      console.log("💾 Supabase insert result:", { data, error });
  
      if (error) throw error;

      // Calculate new total and check if payment is complete
      const newTotalPaid = totalPaid + parseFloat(amountPaid);
        await checkAndUpdatePaymentStatus(newTotalPaid);




      // ✅ Trigger email notifications after successful save
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
      
          const notifyData = await notifyRes.json();
          console.log("📧 Email notification result:", notifyData);
      
          if (notifyRes.ok) {
            alert("Payment saved and email sent successfully!");
          } else {
            alert("Payment saved, but email failed to send.");
          }
        } catch (emailError) {
          console.error("❌ Error sending email notification:", emailError);
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
      console.error("❌ Error saving payment:", error);
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
          has_discount: true, // ✅ flag it as discounted
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
          has_discount: true, // ✅
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
          has_discount: true, // ✅ still store discount even if not paid
        })
        .eq("id", trainee.id);
    }

    alert("Discount applied successfully!");

    setDiscountApplied(discounted);
    fetchPayments();
  } catch (err) {
    console.error("Error applying discount:", err);
    alert("Failed to apply discount.");
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
        });

      if (error) throw error;

      // Calculate new total and check if payment is complete
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

  try {
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", deleteId);

    if (error) throw error;

    // Check remaining payments
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
          <p>Petrosphere Training Center</p>
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
  const { error } = await supabase
    .from("trainings")
    .update(newDetails)
    .eq("id", trainee.id);
  if (error) return alert("Failed to update personal details.");
  setIsEditingDetails(false);
  alert("Personal details updated.");
};

const handleSaveAddress = async () => {
  const { error } = await supabase
    .from("trainings")
    .update(newAddress)
    .eq("id", trainee.id);
  if (error) return alert("Failed to update address.");
  setIsEditingAddress(false);
  alert("Address updated.");
};


const handleUpdate2x2Photo = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

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
      window.location.reload(); // or re-fetch trainee info
    } else {
      alert("Upload failed.");
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
    };
    input.click();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {isPending ? (
          <DialogContent className="w-[40vw]">
            <DialogHeader>
              <DialogTitle>Review Submission</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">ID Picture</h4>
                <img
                  src={trainee.id_picture_url}
                  alt="ID Picture"
                  className="w-full rounded border"
                />
              </div>
              <div className="relative">
                <h4 className="text-sm font-semibold mb-2">2x2 Photo</h4>
                <div className="relative cursor-pointer" onClick={() => setShow2x2ViewModal(true)}>
                  <img
                    src={trainee.picture_2x2_url}
                    alt="2x2 Photo"
                    className="w-full rounded border hover:opacity-80 transition"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdate2x2Photo();
                    }}
                  >
                    <Edit />
                  </Button>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 text-sm"
                  onClick={handleUpdate2x2Photo}
                >
                  <Edit/>
                </Button>
              </div>

            </div>

            <DialogFooter className="pt-4">
              <Button variant="destructive" onClick={onDecline}>
                Decline
              </Button>
              <Button onClick={onVerify}>Verify</Button>
            </DialogFooter>
          </DialogContent>
        ) : (
          <DialogContent className="w-[70vw] p-0">
            <ScrollArea className="h-[90vh] p-6">
              <DialogHeader>
                <DialogTitle className="text-indigo-900 text-sm">
                  Submission ID: {trainee?.id}
                </DialogTitle>
              </DialogHeader>

              <div className="text-right text-sm text-muted-foreground mb-2">
                {new Date().toLocaleDateString()}
              </div>

               {/* Updated photo section with both 2x2 and ID */}
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex gap-4 items-start">
                  {/* 2x2 Photo */}
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

                  {/* ID Picture */}
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
                      >
                        <Edit className="h-3 w-3" />
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
                        <Button onClick={handleSavePersonalDetails} className="col-span-6">💾 Save</Button>
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

                        <Button onClick={handleSaveAddress} className="mt-2">💾 Save</Button>
                      </>
                    ) : (
                      <>
                        <strong>Address</strong>
                        <div>{[trainee?.mailing_street, trainee?.mailing_city, trainee?.mailing_province].filter(Boolean).join(", ") || "N/A"}</div>
                      </>
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <section className="border rounded overflow-hidden">
                    <div className="font-bold px-4 py-2 bg-green-100 dark:text-blue-950 rounded border border-green-300">
                      Payment Details
                    </div>
                    <div className="p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Training Fee</span>
                        <span>{formatCurrency(trainee?.training_fee || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Method</span>
                        <span>{trainee?.payment_method || "N/A"}</span>
                      </div>
                      {/* DISCOUNT SWITCH */}
  {/* DISCOUNT SWITCH */}
  <div className="flex items-center gap-2 pt-2">
    <Label>Discounted?</Label>
   <input 
  type="checkbox" 
  checked={isDiscounted}
  onChange={async (e) => {
    const checked = e.target.checked;
    setIsDiscounted(checked);

    // ✅ update Supabase on toggle
    const { error } = await supabase
      .from("trainings")
      .update({ has_discount: checked })
      .eq("id", trainee.id);

    if (error) {
      alert("Failed to update discount status.");
      console.error("Update discount toggle error:", error);
    }
  }}
/>

  </div>

  {/* DISCOUNT PRICE INPUT */}
  {isDiscounted && (
    <div className="space-y-2 p-3 border rounded bg-background">
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
    </div>
  )}
  {discountApplied !== null && (
  <div className="p-2 rounded bg-green-50 border border-green-300 text-green-800 text-sm">
    <strong>Discount Applied:</strong> {formatCurrency(discountApplied)}
    {discountPercent !== null && (
      <> ({discountPercent}% off)</>
    )}
  </div>
)}

  {isDiscounted && (
  <Button
    className="w-full mt-2"
    onClick={handleApplyDiscount}
    disabled={!discountPrice || Number(discountPrice) <= 0}
  >
    Apply Discount
  </Button>
)}


                      <div className="flex justify-between font-semibold text-green-700">
                        <span>Total Amount Paid</span>
                        <span>{formatCurrency(totalPaid)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-red-700">
                        <span>Remaining Balance</span>
                          <span>
                            {discountApplied !== null
                              ? formatCurrency(discountApplied - totalPaid)
                              : formatCurrency((trainee?.training_fee || 0) - totalPaid)
                            }
                          </span>

                      </div>
                    </div>
                  </section>

                  <div className="space-y-4">
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
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2">Date</th>
                                <th className="text-left py-2">Method</th>
                                <th className="text-left py-2">Status</th>
                                <th className="text-right py-2">Amount</th>
                                <th className="text-center py-2">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map((payment) => (
                                <tr key={payment.id} className="border-b">
                                  <td className="py-2">
                                    {new Date(payment.payment_date).toLocaleDateString()}
                                  </td>
                                  <td className="py-2">{payment.payment_method}</td>
                                  <td className="py-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                                      {payment.payment_status}
                                    </span>
                                  </td>
                                  <td className="text-right py-2">
                                    {formatCurrency(payment.amount_paid)}
                                  </td>
                                  <td className="text-center py-2">
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() =>
                                          payment.receipt_link
                                            ? window.open(payment.receipt_link, "_blank")
                                            : generateCounterReceipt(payment)
                                        }
                                      >
                                        <Download className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => {
                                          setDeleteId(payment.id);
                                          setShowDeleteConfirm(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              {isPending && (
                <DialogFooter className="pt-4">
                  <Button variant="destructive" onClick={onDecline}>
                    Decline
                  </Button>
                  <Button onClick={onVerify}>Verify</Button>
                </DialogFooter>
              )}
            </ScrollArea>
          </DialogContent>
        )}
      </Dialog>


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

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}