// app/api/client/upload-receipt/route.ts - FIXED VERSION
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const referenceNumber = formData.get('referenceNumber') as string;

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!referenceNumber) {
      return NextResponse.json(
        { error: 'Booking reference number is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // 1. Find the booking summary
    const { data: bookingSummary, error: bookingError } = await supabase
      .from('booking_summary')
      .select('id, training_id')
      .eq('reference_number', referenceNumber)
      .single();

    if (bookingError || !bookingSummary) {
      return NextResponse.json(
        { error: 'Booking not found. Please check your reference number.' },
        { status: 404 }
      );
    }
    // 2. Get training details (without training_fee - it's in courses table)
    const { data: training, error: trainingError } = await supabase
    .from('trainings')
    .select('id, first_name, last_name, email, payment_method, course_id')
    .eq('id', bookingSummary.training_id)
    .single();

    if (trainingError || !training) {
      return NextResponse.json(
        { error: 'Training record not found' },
        { status: 404 }
      );
    }


    // Get course details to retrieve training_fee
    const { data: course } = await supabase
    .from('courses')
    .select('training_fee')
    .eq('id', training.course_id)
    .single();

    const trainingFee = course?.training_fee || 0;

    // 3. Upload file using your existing FTP upload API
    const uploadFormData = new FormData();
    uploadFormData.append('receipt', file);

    const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/upload-receipt`, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to upload file. Please try again.' },
        { status: 500 }
      );
    }

    const { url: publicUrl } = await uploadResponse.json();

    console.log('✅ File uploaded to:', publicUrl);

    // 4. Check if a payment record already exists for this training
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('training_id', bookingSummary.training_id)
      .single();

    if (existingPayment) {
      // Update existing payment record
      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          receipt_link: publicUrl,
          receipt_uploaded_by: 'client',
          receipt_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id);

      if (paymentUpdateError) {
        console.error('❌ Payment update error:', paymentUpdateError);
      } else {
        console.log('✅ Payment record updated with receipt');
      }
    } else {
      // Create new payment record with pending status
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          training_id: bookingSummary.training_id,
          payment_method: training.payment_method || 'BPI',
          payment_status: 'pending', // Pending until admin approves
          amount_paid: 0, // Will be set by admin when approving
          receipt_link: publicUrl,
          receipt_uploaded_by: 'client',
          receipt_uploaded_at: new Date().toISOString(),
          total_due: trainingFee,
        });

      if (paymentInsertError) {
        console.error('❌ Payment insert error:', paymentInsertError);
      } else {
        console.log('✅ New payment record created with receipt');
      }
    }

    // 5. Also update trainings table
    await supabase
      .from('trainings')
      .update({
        receipt_link: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingSummary.training_id);

    console.log('✅ Training record updated with receipt');

    // 6. Create a notification for admin
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        title: `New receipt uploaded for ${referenceNumber}`,
        trainee_name: `${training.first_name} ${training.last_name}`,
        photo_url: publicUrl,
        read: false,
        created_at: new Date().toISOString(),
      });

    if (notificationError) {
      console.error('❌ Notification error:', notificationError);
    } else {
      console.log('✅ Notification created');
    }

    // 7. Send confirmation email to trainee
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-receipt-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: training.email,
          name: `${training.first_name} ${training.last_name}`,
          referenceNumber,
        }),
      });
      console.log('✅ Confirmation email sent');
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt uploaded successfully',
      receiptUrl: publicUrl,
    });

  } catch (error) {
    console.error('❌ Upload receipt error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}