// app/upload-receipt/page.tsx - FIXED: Only show PVC fee when user has discount AND opted for PVC
'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, Search, Eye, X, Clock, Download, History } from 'lucide-react';

interface Payment {
  id: string;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  receipt_link: string | null;
  receipt_uploaded_by: string | null;
  receipt_uploaded_at: string | null;
}

interface BookingStatus {
  found: boolean;
  data?: {
    referenceNumber: string;
    traineeName: string;
    courseName: string;
    scheduleRange: string;
    paymentMethod: string;
    paymentStatus: string;
    trainingFee: number;
    amountPaid: number;
    receiptLink: string | null;
    bookingDate: string;
    trainingId: string;
    // Discount fields
    hasDiscount: boolean;
    discountedFee: number | null;
    originalFee: number;
    // PVC ID field
    addPvcId: boolean;
    pvcFee: number | null;
  };
  error?: string;
}

export default function UploadReceiptPage() {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(null);
  
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const fetchPaymentHistory = async (trainingId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/client/payment-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId }),
      });

      const data = await response.json();
      if (response.ok && data.payments) {
        setPaymentHistory(data.payments);
        setShowHistory(true);
      }
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setMessage('Please upload an image file (JPG, PNG, etc.)');
        setUploadStatus('error');
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setMessage('File size must be less than 5MB');
        setUploadStatus('error');
        return;
      }

      setFile(selectedFile);
      setUploadStatus('idle');
      setMessage('');

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleCheckStatus = async () => {
    if (!referenceNumber.trim()) {
      setMessage('Please enter your booking reference number');
      setUploadStatus('error');
      return;
    }

    setCheckingStatus(true);
    setShowStatus(false);
    setBookingStatus(null);
    setShowHistory(false);
    setPaymentHistory([]);

    try {
      const response = await fetch('/api/client/check-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNumber: referenceNumber.trim().toUpperCase() }),
      });

      const data = await response.json();
      setBookingStatus(data);
      setShowStatus(true);

      if (!data.found) {
        setMessage(data.error || 'Booking not found');
        setUploadStatus('error');
      } else {
        setUploadStatus('idle');
        setMessage('');
        if (data.data?.trainingId) {
          await fetchPaymentHistory(data.data.trainingId);
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
      setMessage('Failed to check booking status. Please try again.');
      setUploadStatus('error');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!referenceNumber.trim()) {
      setMessage('Please enter your booking reference number');
      setUploadStatus('error');
      return;
    }

    if (!file) {
      setMessage('Please select a receipt image to upload');
      setUploadStatus('error');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessage('File size must be less than 5MB');
      setUploadStatus('error');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('referenceNumber', referenceNumber.trim().toUpperCase());

      const response = await fetch('/api/client/upload-receipt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus('success');
        setMessage('Receipt uploaded successfully! Our team will verify your payment shortly.');
        setFile(null);
        setPreview(null);
        
        if (bookingStatus?.data?.trainingId) {
          await fetchPaymentHistory(bookingStatus.data.trainingId);
        }
        
        const fileInput = document.getElementById('receipt-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setUploadStatus('error');
        setMessage(data.error || 'Failed to upload receipt. Please try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setMessage('An error occurred while uploading. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (value: number) => 
    value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadgeClass = (status: string) => {
    const normalized = status?.toLowerCase();
    if (normalized?.includes('completed')) {
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    } else if (normalized?.includes('partially')) {
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    } else if (normalized?.includes('pending')) {
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    }
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  // ✅ FIXED: Calculate total required amount (only add PVC if user has discount AND opted for it)
  // ✅ NEW VERSION
const calculateTotalRequired = () => {
  if (!bookingStatus?.data) return 0;
  
  // Use discounted fee if available, otherwise use training fee
  const courseFee = bookingStatus.data.hasDiscount && bookingStatus.data.discountedFee !== null
    ? bookingStatus.data.discountedFee
    : bookingStatus.data.trainingFee;
  
  // ✅ FIXED: Use stored PVC fee from database instead of hardcoded 150
  const pvcFee = bookingStatus.data.addPvcId && bookingStatus.data.pvcFee 
    ? bookingStatus.data.pvcFee 
    : 0;
  
  return courseFee + pvcFee;
};

  // ✅ Calculate remaining balance
  const calculateBalance = () => {
    if (!bookingStatus?.data) return 0;
    const totalRequired = calculateTotalRequired();
    return totalRequired - bookingStatus.data.amountPaid;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-7 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-3">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-500/10 rounded-2xl">
              <img src="/trans-logo.png" alt="logo petros" className="w-80"/>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Payment Receipt</h1>
          <p className="text-slate-400">Submit your payment proof for verification</p>
        </div>

        {/* Main Form Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Reference Number Input */}
            <div>
              <label htmlFor="reference" className="block text-sm font-medium text-slate-300 mb-2">
                Booking Reference Number *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="reference"
                  value={referenceNumber}
                  onChange={(e) => {
                    setReferenceNumber(e.target.value.toUpperCase());
                    setShowStatus(false);
                    setBookingStatus(null);
                    setShowHistory(false);
                  }}
                  placeholder="e.g., BK-2024-XXXXX"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={20}
                />
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={checkingStatus || !referenceNumber.trim()}
                  className="absolute right-3 top-2.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors flex items-center gap-2"
                >
                  {checkingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Check Status
                    </>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Enter the reference number from your confirmation email
              </p>
            </div>

            {/* Booking Status Display */}
            {showStatus && bookingStatus?.found && bookingStatus.data && (
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    Booking Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowStatus(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 w-4" />
                  </button>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name:</span>
                    <span className="text-white font-medium">{bookingStatus.data.traineeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Course:</span>
                    <span className="text-white">{bookingStatus.data.courseName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Schedule:</span>
                    <span className="text-white">{bookingStatus.data.scheduleRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Method:</span>
                    <span className="text-white">{bookingStatus.data.paymentMethod}</span>
                  </div>
                  
               {/* ✅ FIXED: Show PVC section whenever user opted for it */}
{bookingStatus.data.addPvcId && bookingStatus.data.pvcFee && (
  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-2">
    <div className="flex items-center gap-2 mb-1">
      <CheckCircle className="w-4 h-4 text-blue-400" />
      <span className="text-xs font-semibold text-blue-400">Physical PVC ID Added</span>
    </div>
    <p className="text-xs text-blue-300">
      You've opted for a Physical PVC ID card in addition to your Digital ID
    </p>
    <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-500/20">
      <span className="text-xs text-blue-300">PVC ID Fee:</span>
      <span className="text-sm text-blue-400 font-bold">
        {formatCurrency(bookingStatus.data.pvcFee)}
      </span>
    </div>
  </div>
)}

                  {/* ✅ Discount Display */}
                  {bookingStatus.data.hasDiscount && bookingStatus.data.discountedFee !== null && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-400">Discount Applied!</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-emerald-300">Original Price:</span>
                          <span className="text-sm text-slate-400 line-through">
                            {formatCurrency(bookingStatus.data.originalFee)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-emerald-300">Discounted Price:</span>
                          <span className="text-sm text-emerald-400 font-bold">
                            {formatCurrency(bookingStatus.data.discountedFee)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20">
                          <span className="text-xs text-emerald-300">You Save:</span>
                          <span className="text-sm text-emerald-400 font-semibold">
                            {formatCurrency(bookingStatus.data.originalFee - bookingStatus.data.discountedFee)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ✅ FIXED: Training Fee Breakdown */}
                  <div className="border-t border-slate-600 pt-2 mt-2 space-y-2">
                    {/* Course Fee */}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Course Fee:</span>
                      {bookingStatus.data.hasDiscount && bookingStatus.data.discountedFee !== null ? (
                        <div className="flex flex-col items-end">
                          <span className="text-slate-500 line-through text-xs">
                            {formatCurrency(bookingStatus.data.originalFee)}
                          </span>
                          <span className="text-emerald-400 font-semibold">
                            {formatCurrency(bookingStatus.data.discountedFee)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white font-semibold">
                          {formatCurrency(bookingStatus.data.trainingFee)}
                        </span>
                      )}
                    </div>

                    {/* ✅ FIXED: Show PVC fee whenever user opted for it */}
                    {bookingStatus.data.addPvcId && bookingStatus.data.pvcFee && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">+ PVC ID Fee:</span>
                        <span className="text-blue-400 font-semibold">
                          {formatCurrency(bookingStatus.data.pvcFee)}
                        </span>
                      </div>
                    )}

                    {/* Total Required */}
                    <div className="flex justify-between border-t border-slate-600 pt-2 font-semibold">
                      <span className="text-slate-300">Total Required:</span>
                      <span className="text-white text-base">
                        {formatCurrency(calculateTotalRequired())}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Paid:</span>
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(bookingStatus.data.amountPaid)}
                    </span>
                  </div>
                  
                  {/* ✅ Balance Calculation - Hide if less than 1 peso */}
                  {(() => {
                    const balance = calculateBalance();
                    if (Math.abs(balance) < 1) return null;
                    
                    return (
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          {balance < 0 ? 'Overpaid:' : 'Balance:'}
                        </span>
                        <span className={`font-semibold ${balance < 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          {formatCurrency(Math.abs(balance))}
                        </span>
                      </div>
                    );
                  })()}
                  
                  <div className="flex justify-between items-center border-t border-slate-600 pt-2 mt-2">
                    <span className="text-slate-400">Payment Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusBadgeClass(bookingStatus.data.paymentStatus)}`}>
                      {bookingStatus.data.paymentStatus || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment History */}
            {showHistory && paymentHistory.length > 0 && (
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-400" />
                    Payment History ({paymentHistory.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowHistory(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {paymentHistory.map((payment, index) => (
                    <div 
                      key={payment.id}
                      className={`p-3 rounded-lg border ${
                        payment.payment_status?.toLowerCase() === 'pending'
                          ? 'bg-orange-500/10 border-orange-500/30'
                          : payment.payment_status?.toLowerCase().includes('completed')
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-slate-600/30 border-slate-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400">
                            #{paymentHistory.length - index}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeClass(payment.payment_status)}`}>
                            {payment.payment_status}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div>
                          <span className="text-slate-400">Method:</span>
                          <span className="ml-1 text-white">{payment.payment_method}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Amount:</span>
                          <span className="ml-1 text-green-400 font-semibold">
                            {payment.amount_paid > 0 
                              ? formatCurrency(payment.amount_paid)
                              : 'Pending Approval'
                            }
                          </span>
                        </div>
                      </div>

                      {payment.receipt_uploaded_at && (
                        <div className="text-xs text-slate-400 mb-2">
                          Uploaded: {new Date(payment.receipt_uploaded_at).toLocaleString()}
                          {payment.receipt_uploaded_by === 'client' && (
                            <span className="ml-1 text-blue-400">(by you)</span>
                          )}
                        </div>
                      )}

                      {payment.receipt_link && (
                        <div className="mt-2">
                          <img 
                            src={payment.receipt_link}
                            alt={`Receipt ${index + 1}`}
                            className="w-full h-32 object-cover rounded border border-slate-500 cursor-pointer hover:opacity-80 transition"
                            onClick={() => window.open(payment.receipt_link!, '_blank')}
                          />
                          <button
                            type="button"
                            onClick={() => window.open(payment.receipt_link!, '_blank')}
                            className="mt-2 w-full px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded flex items-center justify-center gap-2 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            View Full Receipt
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label htmlFor="receipt-file" className="block text-sm font-medium text-slate-300 mb-2">
                Receipt Image *
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="receipt-file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="receipt-file"
                  className="flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-slate-900/30"
                >
                  {preview ? (
                    <div className="space-y-4 w-full">
                      <img
                        src={preview}
                        alt="Receipt preview"
                        className="max-h-64 mx-auto rounded-lg"
                      />
                      <div className="text-center space-y-1">
                        <p className="text-sm text-slate-400">{file?.name}</p>
                        <p className="text-xs text-slate-500">
                          {file && formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFile(null);
                          setPreview(null);
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 mx-auto block"
                      >
                        Change image
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-500 mb-3" />
                      <p className="text-sm text-slate-400 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-slate-500">
                        PNG, JPG or JPEG (max. 5MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Status Messages */}
            {uploadStatus === 'success' && (
              <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">Success!</p>
                  <p className="text-sm text-emerald-300/80 mt-1">{message}</p>
                </div>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Error</p>
                  <p className="text-sm text-red-300/80 mt-1">{message}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Receipt
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-medium text-blue-400 mb-2">Important Notes:</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Make sure the receipt image is clear and readable</li>
              <li>• File size must be less than 5MB (compress large images if needed)</li>
              <li>• Include transaction details (amount, date, reference number)</li>
              <li>• You can upload multiple receipts for partial payments</li>
              <li>• Payment verification typically takes 1-2 business days</li>
              <li>• You'll receive an email once your payment is confirmed</li>
            </ul>
          </div>
        </div>

        {/* Check Booking Link */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            Don't have a receipt yet?{' '}
            <button
              onClick={handleCheckStatus}
              disabled={!referenceNumber.trim()}
              className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-2 disabled:text-slate-600 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              Check booking status first
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}