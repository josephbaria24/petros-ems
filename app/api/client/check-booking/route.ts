// app/api/client/check-booking/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms");

export async function POST(req: Request) {
  try {
    const { referenceNumber } = await req.json();

    if (!referenceNumber) {
      return NextResponse.json(
        { found: false, error: 'Reference number is required' },
        { status: 400 }
      );
    }

    // 1. Find the booking summary
    const { data: bookingSummary, error: bookingError } = await supabase
      .from('booking_summary')
      .select(`
        id,
        reference_number,
        booking_date,
        training_id
      `)
      .eq('reference_number', referenceNumber.toUpperCase())
      .single();

    if (bookingError || !bookingSummary) {
      return NextResponse.json(
        { found: false, error: 'Booking not found. Please check your reference number.' },
        { status: 404 }
      );
    }

// 2. Get training details
const { data: training, error: trainingError } = await supabase
  .from('trainings')
  .select(`
    id,
    first_name,
    last_name,
    email,
    payment_method,
    payment_status,
    receipt_link,
    amount_paid,
    course_id,
    schedule_id,
    discounted_fee,
    has_discount,
    add_pvc_id,
    pvc_fee,
    status
  `)
  .eq('id', bookingSummary.training_id)
  .single();

    if (trainingError || !training) {
      return NextResponse.json(
        { found: false, error: 'Training record not found' },
        { status: 404 }
      );
    }

    // 3. Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('name, training_fee')
      .eq('id', training.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { found: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // 4. Get schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id,
        schedule_type,
        schedule_dates (date),
        schedule_ranges (start_date, end_date)
      `)
      .eq('id', training.schedule_id)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { found: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Format schedule range
    let scheduleRange = '';
    if (schedule.schedule_type === 'regular' && schedule.schedule_ranges?.[0]) {
      const { start_date, end_date } = schedule.schedule_ranges[0];
      scheduleRange = `${new Date(start_date).toLocaleDateString()} - ${new Date(end_date).toLocaleDateString()}`;
    } else if (schedule.schedule_type === 'staggered' && schedule.schedule_dates) {
      const dates = schedule.schedule_dates
        .map((d: any) => new Date(d.date).toLocaleDateString())
        .join(', ');
      scheduleRange = dates;
    }

    // 5. Get all payments for this training
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_paid, receipt_link, receipt_uploaded_by')
      .eq('training_id', training.id)
      .order('payment_date', { ascending: false });

    // Calculate total paid
    const totalPaid = payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || training.amount_paid || 0;

    // ✅ Determine the training fee (discounted if applicable)
    // ✅ Determine the training fee (discounted if applicable) - FIXED for free vouchers
    const originalFee = Number(course.training_fee) || 0;
    const hasDiscount = training.has_discount || false;
    const discountedFee = training.discounted_fee !== null && training.discounted_fee !== undefined 
      ? Number(training.discounted_fee) 
      : null;
    const actualFee = hasDiscount && discountedFee !== null ? discountedFee : originalFee;

     return NextResponse.json({
  found: true,
  data: {
    referenceNumber: bookingSummary.reference_number,
    traineeName: `${training.first_name} ${training.last_name}`,
    courseName: course.name,
    scheduleRange,
    paymentMethod: training.payment_method || 'N/A',
    paymentStatus: training.status || 'Pending Payment',
    
    // ✅ Add discount-related fields
    originalFee: originalFee,
    hasDiscount: hasDiscount,
    discountedFee: discountedFee,
    trainingFee: actualFee, // The actual fee to pay (discounted or original)
    
    amountPaid: totalPaid,
    receiptLink: payments?.[0]?.receipt_link || training.receipt_link,
    receiptUploadedBy: payments?.[0]?.receipt_uploaded_by || null,
    bookingDate: new Date(bookingSummary.booking_date).toLocaleDateString(),
    trainingId: training.id,
    
    // ✅ PVC ID fields
    addPvcId: training.add_pvc_id || false,
    pvcFee: training.pvc_fee || null,  // ✅ NEW: Include stored PVC fee
  },
});

  } catch (error) {
    console.error('Check booking error:', error);
    return NextResponse.json(
      { found: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}