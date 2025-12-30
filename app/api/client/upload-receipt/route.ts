// app/api/client/upload-receipt/route.ts - FIXED FOR VERCEL
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Disable body parsing for Vercel
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Increase body size limit for Vercel (up to 4.5MB for hobby plan, 50MB for pro)
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

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
    console.log('📥 Starting upload receipt process...');
    
    // Parse formData with better error handling for Vercel
    let formData: FormData;
    try {
      // Clone the request to avoid consumption issues
      const clonedReq = req.clone();
      formData = await clonedReq.formData();
    } catch (parseError: any) {
      console.error('❌ FormData parse error:', parseError);
      console.error('Error details:', {
        message: parseError.message,
        stack: parseError.stack,
        name: parseError.name,
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to parse upload data. Please ensure your file is less than 4.5MB and try again.',
          details: parseError.message 
        },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    const referenceNumber = formData.get('referenceNumber') as string | null;

    console.log('📝 Received:', { 
      hasFile: !!file, 
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
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

    // Validate file size (4.5MB max for Vercel Hobby, adjust if needed)
    const maxSize = 4.5 * 1024 * 1024; // 4.5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      );
    }

    // 1. Find the booking summary
    console.log('🔍 Looking up booking:', referenceNumber);
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

    console.log('✅ Booking found:', bookingSummary.id);

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

    console.log('✅ Training found:', training.id);

    // Get course details to retrieve training_fee
    const { data: course } = await supabase
      .from('courses')
      .select('training_fee')
      .eq('id', training.course_id)
      .single();

    const trainingFee = course?.training_fee || 0;

    // 3. Upload file to FTP
    console.log('📤 Preparing file upload...');
    
    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create new FormData for upload
    const uploadFormData = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    uploadFormData.append('receipt', blob, file.name);

    console.log('📤 Uploading to FTP with field name "receipt"...');

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

  } catch (error: any) {
    console.error('❌ Upload receipt error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred. Please try again.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}