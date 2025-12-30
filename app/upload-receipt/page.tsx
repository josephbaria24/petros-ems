// app/upload-receipt/page.tsx - FIXED FOR VERCEL
'use client';

import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Search, Eye, X } from 'lucide-react';

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
  
  // Booking status check
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(null);

  // Max file size (same as your working upload API)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setMessage('Please upload an image file (JPG, PNG, etc.)');
        setUploadStatus('error');
        return;
      }

      // Validate file size (5MB max)
      if (selectedFile.size > MAX_FILE_SIZE) {
        setMessage('File size must be less than 5MB');
        setUploadStatus('error');
        return;
      }

      setFile(selectedFile);
      setUploadStatus('idle');
      setMessage('');

      // Create preview
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

    // Double-check file size before upload
    if (file.size > MAX_FILE_SIZE) {
      setMessage('File size must be less than 5MB');
      setUploadStatus('error');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setMessage('');

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('referenceNumber', referenceNumber.trim().toUpperCase());

      console.log('Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        referenceNumber: referenceNumber.trim().toUpperCase(),
      });

      // Upload receipt using client upload API
      const response = await fetch('/api/client/upload-receipt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('Upload response:', data);

      if (response.ok) {
        setUploadStatus('success');
        setMessage('Receipt uploaded successfully! Our team will verify your payment shortly.');
        setFile(null);
        setPreview(null);
        setReferenceNumber('');
        setShowStatus(false);
        setBookingStatus(null);
        
        // Reset file input
        const fileInput = document.getElementById('receipt-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setUploadStatus('error');
        const errorMessage = data.error || 'Failed to upload receipt. Please try again.';
        setMessage(errorMessage);
        
        // Log detailed error for debugging
        console.error('Upload failed:', {
          status: response.status,
          error: data.error,
          details: data.details,
        });
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
                    <X className="w-4 h-4" />
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
                  <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
                    <span className="text-slate-400">Training Fee:</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(bookingStatus.data.trainingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Paid:</span>
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(bookingStatus.data.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balance:</span>
                    <span className="text-red-400 font-semibold">
                      {formatCurrency(bookingStatus.data.trainingFee - bookingStatus.data.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-600 pt-2 mt-2">
                    <span className="text-slate-400">Payment Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      bookingStatus.data.paymentStatus?.includes('Completed') 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : bookingStatus.data.paymentStatus?.includes('Partially')
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {bookingStatus.data.paymentStatus || 'Pending'}
                    </span>
                  </div>
                  {bookingStatus.data.receiptLink && (
                    <div className="flex justify-between items-center border-t border-slate-600 pt-2 mt-2">
                      <span className="text-slate-400">Receipt:</span>
                      <a
                        href={bookingStatus.data.receiptLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs underline"
                      >
                        View Uploaded Receipt
                      </a>
                    </div>
                  )}
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
            <h3 className="text-sm font-medium text-blue-400 mb-2">📌 Important Notes:</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Make sure the receipt image is clear and readable</li>
              <li>• File size must be less than 5MB (compress large images if needed)</li>
              <li>• Include transaction details (amount, date, reference number)</li>
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