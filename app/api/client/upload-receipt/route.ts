// app/api/client/upload-receipt/route.ts - FIXED VERSION
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ENV guards
if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL is not defined');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
}

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: Request) {
  try {
    // Parse formData with error handling
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (parseError) {
      console.error('❌ FormData parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid request format. Please try again.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    const referenceNumber = formData.get('referenceNumber') as string | null;

    console.log('📝 Received:', { 
      hasFile: !!file, 
      fileName: file?.name,
      fileSize: file?.size,
      referenceNumber 
    });

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
      console.error('❌ Booking not found:', bookingError);
      return NextResponse.json(
        { error: 'Booking not found. Please check your reference number.' },
        { status: 404 }
      );
    }

    // 2. Get training details
    const { data: training, error: trainingError } = await supabase
      .from('trainings')
      .select('id, first_name, last_name, email, payment_method, course_id')
      .eq('id', bookingSummary.training_id)
      .single();

    if (trainingError || !training) {
      console.error('❌ Training not found:', trainingError);
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

    // 3. Upload file - Use 'receipt' field name to match admin API
    const uploadFormData = new FormData();
    
    // Convert File to Blob and append with 'receipt' field name
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
    uploadFormData.append('receipt', fileBlob, file.name);

    console.log('📤 Uploading file to FTP with field name "receipt"...');

    const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/upload-receipt`, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'Failed to upload file' };
      }
      
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
          payment_status: 'pending',
          amount_paid: 0,
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

    // 5. Update trainings table
    await supabase
      .from('trainings')
      .update({
        receipt_link: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingSummary.training_id);

    console.log('✅ Training record updated with receipt');

    // 6. Create notification for admin
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
      // Don't fail the request if email fails
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