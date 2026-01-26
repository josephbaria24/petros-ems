'use client';

import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect } from 'react';
import { Search, Download, CheckCircle2, Circle, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, FileText, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tmsDb } from '@/lib/supabase-client';

type StageStatus = 'completed' | 'in-progress' | 'pending';
type CertificateType = 'e-certificate' | 'id' | 'physical';

interface Stage {
  name: string;
  status: StageStatus;
  date: string | null;
}

interface ProcessedTrainee {
  id: string;
  name: string;
  email: string | null;
  course: string;
  courseId: string | null;
  batch: string;
  batchNumber: number | null;
  certificateNumber: string | null;
  paymentStatus: string;
  amountPaid: number;
  totalDue: number;
  physicalCertStatus: string | null;
  eIdStatus: string | null;
  stages: Stage[];
  eIdStages: Stage[];
  physicalStages: Stage[];
}

const CertificateTracker = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [trainees, setTrainees] = useState<ProcessedTrainee[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [certificateTab, setCertificateTab] = useState<Record<string, CertificateType>>({});
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean, 
    traineeId: string | null,
    type: 'physical' | 'id' | null
  }>({
    open: false,
    traineeId: null,
    type: null
  });
  const [newStatus, setNewStatus] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch trainings with related schedule, course, and payment data
      const { data, error: fetchError } = await tmsDb
        .from('trainings')
        .select(`
          *,
          schedules (
            id,
            batch_number,
            status,
            courses (
              id,
              name
            )
          ),
          payments (
            payment_status,
            amount_paid,
            total_due
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Process the data
      const processedData: ProcessedTrainee[] = data.map(trainee => {
        const payment = trainee.payments?.[0];
        const schedule = trainee.schedules;
        const course = schedule?.courses;
        
        // Determine payment status - use payment_status from trainee or payments table
        const rawPaymentStatus = trainee.payment_status || payment?.payment_status || 'Pending Payment';
        const paymentStatus = rawPaymentStatus.toLowerCase();
        
        // Check if payment is completed (any variation)
        const isPaymentCompleted = paymentStatus.includes('payment completed');
        const isPartiallyPaid = paymentStatus.includes('partially paid');
        const isDiscounted = paymentStatus.includes('discounted');

        // Build timeline stages for e-certificate
        const stages: Stage[] = [
          {
            name: 'Enrolled',
            status: 'completed' as StageStatus,
            date: trainee.created_at
          },
          {
            name: 'Payment Verified',
            status: (isPaymentCompleted ? 'completed' : 
                    isPartiallyPaid ? 'in-progress' : 'pending') as StageStatus,
            date: isPaymentCompleted ? payment?.payment_date || trainee.updated_at : null
          },
          {
            name: 'Training Completed',
            status: (schedule?.status === 'finished' ? 'completed' : 
                   schedule?.status === 'ongoing' ? 'in-progress' : 'pending') as StageStatus,
            date: schedule?.status === 'finished' ? trainee.updated_at : null
          },
          {
            name: 'E-Certificate Generated',
            status: (trainee.certificate_number ? 'completed' : 
                   (schedule?.status === 'finished' && isPaymentCompleted) ? 'in-progress' : 'pending') as StageStatus,
            date: trainee.certificate_number ? trainee.updated_at : null
          },
          {
            name: 'E-Certificate Sent',
            status: (trainee.certificate_number ? 'completed' : 'pending') as StageStatus,
            date: trainee.certificate_number ? trainee.updated_at : null
          }
        ];

        // Build timeline stages for physical certificate
        const physicalCertStatus = trainee.physical_cert_status || 'pending';
        const physicalStages: Stage[] = [
          {
            name: 'Enrolled',
            status: 'completed' as StageStatus,
            date: trainee.created_at
          },
          {
            name: 'Payment Verified',
            status: (isPaymentCompleted ? 'completed' : 
                    isPartiallyPaid ? 'in-progress' : 'pending') as StageStatus,
            date: isPaymentCompleted ? payment?.payment_date || trainee.updated_at : null
          },
          {
            name: 'Training Completed',
            status: (schedule?.status === 'finished' ? 'completed' : 
                   schedule?.status === 'ongoing' ? 'in-progress' : 'pending') as StageStatus,
            date: schedule?.status === 'finished' ? trainee.updated_at : null
          },
          {
            name: 'Certificate Printed',
            status: (['shipped', 'delivered'].includes(physicalCertStatus.toLowerCase()) ? 'completed' : 
                   physicalCertStatus.toLowerCase() === 'printing' ? 'in-progress' : 'pending') as StageStatus,
            date: ['shipped', 'delivered', 'printing'].includes(physicalCertStatus.toLowerCase()) ? trainee.updated_at : null
          },
          {
            name: 'Shipped',
            status: (physicalCertStatus.toLowerCase() === 'delivered' ? 'completed' :
                   physicalCertStatus.toLowerCase() === 'shipped' ? 'in-progress' : 'pending') as StageStatus,
            date: ['shipped', 'delivered'].includes(physicalCertStatus.toLowerCase()) ? trainee.updated_at : null
          },
          {
            name: 'Delivered',
            status: (physicalCertStatus.toLowerCase() === 'delivered' ? 'completed' : 'pending') as StageStatus,
            date: physicalCertStatus.toLowerCase() === 'delivered' ? trainee.updated_at : null
          }
        ];

        // Build timeline stages for e-ID
        const eIdStatus = trainee.e_id_status || 'pending';
        const eIdStages: Stage[] = [
          {
            name: 'Enrolled',
            status: 'completed' as StageStatus,
            date: trainee.created_at
          },
          {
            name: 'Payment Verified',
            status: (isPaymentCompleted ? 'completed' : 
                    isPartiallyPaid ? 'in-progress' : 'pending') as StageStatus,
            date: isPaymentCompleted ? payment?.payment_date || trainee.updated_at : null
          },
          {
            name: 'Training Completed',
            status: (schedule?.status === 'finished' ? 'completed' : 
                   schedule?.status === 'ongoing' ? 'in-progress' : 'pending') as StageStatus,
            date: schedule?.status === 'finished' ? trainee.updated_at : null
          },
          {
            name: 'ID Generated',
            status: (['sent', 'delivered'].includes(eIdStatus.toLowerCase()) ? 'completed' : 
                   eIdStatus.toLowerCase() === 'generating' ? 'in-progress' : 'pending') as StageStatus,
            date: ['sent', 'delivered', 'generating'].includes(eIdStatus.toLowerCase()) ? trainee.updated_at : null
          },
          {
            name: 'ID Sent',
            status: (eIdStatus.toLowerCase() === 'sent' || eIdStatus.toLowerCase() === 'delivered' ? 'completed' : 'pending') as StageStatus,
            date: ['sent', 'delivered'].includes(eIdStatus.toLowerCase()) ? trainee.updated_at : null
          }
        ];

        return {
          id: trainee.id,
          name: `${trainee.first_name} ${trainee.middle_initial ? trainee.middle_initial + ' ' : ''}${trainee.last_name}${trainee.suffix ? ' ' + trainee.suffix : ''}`,
          email: trainee.email,
          course: course?.name || 'N/A',
          courseId: course?.id || null,
          batch: schedule?.batch_number ? `Batch ${schedule.batch_number}` : 'No Batch',
          batchNumber: schedule?.batch_number,
          certificateNumber: trainee.certificate_number,
          paymentStatus: rawPaymentStatus,
          amountPaid: trainee.amount_paid || payment?.amount_paid || 0,
          totalDue: payment?.total_due || 0,
          physicalCertStatus: trainee.physical_cert_status || 'pending',
          eIdStatus: trainee.e_id_status || 'pending',
          stages,
          eIdStages,
          physicalStages
        };
      });

      setTrainees(processedData);

      // Extract unique batches
      const uniqueBatches = [...new Set(
        processedData
          .map(t => t.batch)
          .filter(b => b !== 'No Batch')
      )].sort();
      setBatches(uniqueBatches);

      // Extract unique courses
      const uniqueCourses = [...new Map(
        processedData
          .filter(t => t.courseId)
          .map(t => [t.courseId, { id: t.courseId!, name: t.course }])
      ).values()].sort((a, b) => a.name.localeCompare(b.name));
      setCourses(uniqueCourses);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };// Filter trainees
  const filteredTrainees = trainees.filter(trainee => {
    const matchesSearch = trainee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trainee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trainee.certificateNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBatch = selectedBatch === 'all' || trainee.batch === selectedBatch;
    const matchesCourse = selectedCourse === 'all' || trainee.courseId === selectedCourse;
    
    // Handle payment status filter with all variations
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'paid' && trainee.paymentStatus.toLowerCase().includes('payment completed')) ||
      (selectedStatus === 'pending' && !trainee.paymentStatus.toLowerCase().includes('payment completed'));
    
    return matchesSearch && matchesBatch && matchesCourse && matchesStatus;
  });

  const toggleCard = (traineeId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(traineeId)) {
        newSet.delete(traineeId);
      } else {
        newSet.add(traineeId);
      }
      return newSet;
    });
  };

  const getCertificateTab = (traineeId: string): CertificateType => {
    return certificateTab[traineeId] || 'e-certificate';
  };

  const setCertTab = (traineeId: string, tab: CertificateType) => {
    setCertificateTab(prev => ({ ...prev, [traineeId]: tab }));
  };

  const handleUpdatePhysicalStatus = async () => {
    if (!statusDialog.traineeId || !newStatus || !statusDialog.type) return;

    try {
      const updateField = statusDialog.type === 'physical' ? 'physical_cert_status' : 'e_id_status';
      
      const { error } = await tmsDb
        .from('trainings')
        .update({ [updateField]: newStatus })
        .eq('id', statusDialog.traineeId);

      if (error) throw error;

      // Update local state
      setTrainees(prev => prev.map(t => 
        t.id === statusDialog.traineeId 
          ? { 
              ...t, 
              ...(statusDialog.type === 'physical' 
                ? { physicalCertStatus: newStatus }
                : { eIdStatus: newStatus }
              )
            }
          : t
      ));

      setStatusDialog({ open: false, traineeId: null, type: null });
      setNewStatus('');
      
      // Refresh data to update timeline
      fetchData();
    } catch (err) {
      console.error('Error updating status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const getOverallStatus = (stages: Stage[]) => {
    if (stages.every(s => s.status === 'completed')) return 'Completed';
    if (stages.some(s => s.status === 'in-progress')) return 'In Progress';
    return 'Pending';
  };

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    
    if (normalized.includes('payment completed')) {
      if (normalized.includes('discounted')) {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Payment Completed (Discounted)
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Payment Completed
        </span>
      );
    }
    
    if (normalized.includes('partially paid')) {
      if (normalized.includes('discounted')) {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Clock className="w-3 h-3 mr-1" />
            Partially Paid (Discounted)
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          Partially Paid
        </span>
      );
    }
    
    if (normalized === 'discounted') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Discounted
        </span>
      );
    }
    
    if (normalized.includes('pending')) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Pending Payment
        </span>
      );
    }
    
    if (normalized === 'declined') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Declined
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {status}
      </span>
    );
  };

  const getStatusIcon = (status: StageStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <Circle className="w-4 h-4 text-gray-300" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading certificate data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Alert className="max-w-2xl mx-auto border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Error loading data: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Certificate Tracker</h1>
          <p className="">Track certificate generation and delivery status</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or certificate number..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Course Filter */}
              <div>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

              </div>

              {/* Batch Filter */}
              <div>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {batches.map(batch => (
                      <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

              </div>

              {/* Payment Status Filter */}
              <div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payment Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredTrainees.length} of {trainees.length} trainees
            </div>
          </CardContent>
        </Card>

        {/* Trainees List */}
        <div className="space-y-2">
          {filteredTrainees.map(trainee => {
            const isExpanded = expandedCards.has(trainee.id);
            const currentTab = getCertificateTab(trainee.id);
            const currentStages = currentTab === 'e-certificate' ? trainee.stages : 
                                 currentTab === 'id' ? trainee.eIdStages :
                                 trainee.physicalStages;return (
              <Card key={trainee.id} className="overflow-hidden">
                <CardHeader className="bg-card border-b py-3 px-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-semibold">{trainee.name}</CardTitle>
                        {getStatusBadge(trainee.paymentStatus)}
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-600">
                        <span>{trainee.email || 'No email provided'}</span>
                        <span>•</span>
                        <span>{trainee.course}</span>
                        <span>•</span>
                        <span>{trainee.batch}</span>
                        {trainee.certificateNumber && (
                          <>
                            <span>•</span>
                            <span className="font-medium">{trainee.certificateNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right flex items-center gap-2">
                        {getOverallStatus(currentStages) === 'Completed' && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        {getOverallStatus(currentStages) === 'In Progress' && (
                          <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                        )}
                        {getOverallStatus(currentStages) === 'Pending' && (
                          <Circle className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="text-xs font-medium">
                          {getOverallStatus(currentStages)}
                        </div>
                      </div>
                      {/* Toggle Button */}
                      <button
                        onClick={() => toggleCard(trainee.id)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                        aria-label={isExpanded ? "Collapse timeline" : "Expand timeline"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <AnimatePresence>
                {isExpanded && (
                  <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                  <CardContent className="py-4 px-4">
                    {/* Certificate Type Tabs */}
                    <div className="flex gap-2 mb-4 border-b">
                      <button
                        onClick={() => setCertTab(trainee.id, 'e-certificate')}
                        className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                          currentTab === 'e-certificate'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 inline mr-1" />
                        E-Certificate
                      </button>
                      <button
                        onClick={() => setCertTab(trainee.id, 'id')}
                        className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                          currentTab === 'id'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 inline mr-1" />
                        ID
                      </button>
                      <button
                        onClick={() => setCertTab(trainee.id, 'physical')}
                        className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                          currentTab === 'physical'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5 inline mr-1" />
                        Physical Certificate
                      </button>
                    </div>

                    {/* Timeline */}
                    <div className="relative">
                      {currentStages.map((stage, index) => (
                        <div key={index} className="flex items-start mb-4 last:mb-0">
                          {/* Timeline line */}
                          {index < currentStages.length - 1 && (
                            <div className="absolute left-[7px] top-6 w-0.5 h-8 bg-gray-200" />
                          )}
                          
                          {/* Icon */}
                          <div className="relative z-10 mr-3">
                            {getStatusIcon(stage.status)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 pt-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className={`text-sm font-medium ${
                                  stage.status === 'completed' ? 'text-gray-900' :
                                  stage.status === 'in-progress' ? 'text-blue-600' :
                                  'text-gray-400'
                                }`}>
                                  {stage.name}
                                </h4>
                                {stage.date && (
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {formatDate(stage.date)}
                                  </p>
                                )}
                              </div>
                              
                              {stage.status === 'completed' && 
                               (stage.name === 'E-Certificate Sent' || stage.name === 'ID Sent') && 
                               (currentTab === 'e-certificate' || currentTab === 'id') && (
                                <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                  <Download className="w-3 h-3" />
                                  Download
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Update Status Button */}
                    {(currentTab === 'physical' || currentTab === 'id') && (
                      <div className="mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setStatusDialog({ 
                              open: true, 
                              traineeId: trainee.id,
                              type: currentTab === 'physical' ? 'physical' : 'id'
                            });
                            setNewStatus(
                              currentTab === 'physical' 
                                ? trainee.physicalCertStatus || 'pending'
                                : trainee.eIdStatus || 'pending'
                            );
                          }}
                          className="w-full"
                        >
                          Update {currentTab === 'physical' ? 'Physical Certificate' : 'ID'} Status
                        </Button>
                      </div>
                    )}

                    {/* Warning for pending payment */}
                    {!trainee.paymentStatus.toLowerCase().includes('completed') && (
                      <Alert className="mt-3 border-yellow-200 bg-yellow-50 py-2">
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
                        <AlertDescription className="text-xs text-yellow-800">
                          Certificate generation is on hold until payment is verified.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                   </motion.div>
                )}
                </AnimatePresence>
              </Card>
            );
          })}

          {filteredTrainees.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No trainees found matching your filters.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Update Status Dialog */}
        <Dialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog({ open, traineeId: null, type: null })}>
          <DialogContent className='lg:w-[40vw]'>
            <DialogHeader>
              <DialogTitle>
                Update {statusDialog.type === 'physical' ? 'Physical Certificate' : 'ID'} Status
              </DialogTitle>
              <DialogDescription>
                Change the status of the {statusDialog.type === 'physical' ? 'physical certificate delivery' : 'E-ID generation and delivery'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusDialog.type === 'physical' ? (
                      <>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="printing">Printing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="generating">Generating</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setStatusDialog({ open: false, traineeId: null, type: null })}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdatePhysicalStatus}>
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CertificateTracker;

