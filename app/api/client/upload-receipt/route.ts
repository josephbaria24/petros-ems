// app/api/client/upload-receipt/route.ts - FIXED TO ALWAYS CREATE NEW PAYMENT
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IncomingForm, Files, Fields } from 'formidable';
import { Readable } from 'stream';
import * as ftp from 'basic-ftp';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ENV guards
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
}

if (!process.env.HOSTINGER_SFTP_HOST || !process.env.HOSTINGER_SFTP_USER || !process.env.HOSTINGER_SFTP_PASS) {
  throw new Error('FTP credentials are not defined');
}

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
).schema("tms");

// Convert NextRequest → Node Request
function toNodeRequest(req: NextRequest): any {
  const readable = new Readable({ read() {} });

  req.arrayBuffer().then((buffer) => {
    readable.push(Buffer.from(buffer));
    readable.push(null);
  });

  (readable as any).headers = Object.fromEntries(req.headers);
  (readable as any).method = req.method;
  (readable as any).url = req.url;

  return readable;
}

export async function POST(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const form = new IncomingForm({ multiples: false });
    const nodeReq = toNodeRequest(req);

    form.parse(nodeReq, async (err, fields: Fields, files: Files) => {
      if (err) {
        console.error('❌ Formidable parse error:', err);
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        return;
      }

      console.log('📝 Parsed fields:', fields);
      console.log('📝 Parsed files:', Object.keys(files));

      // Get the file - try both 'file' and 'receipt' field names
      let receiptFile;
      if (files.file) {
        receiptFile = Array.isArray(files.file) ? files.file[0] : files.file;
      } else if (files.receipt) {
        receiptFile = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;
      }

      if (!receiptFile) {
        resolve(NextResponse.json({ error: 'No file uploaded' }, { status: 400 }));
        return;
      }

      // Get reference number
      const referenceNumber = Array.isArray(fields.referenceNumber)
        ? fields.referenceNumber[0]
        : fields.referenceNumber;

      if (!referenceNumber) {
        resolve(NextResponse.json({ error: 'Booking reference number is required' }, { status: 400 }));
        return;
      }

      console.log('📝 Processing:', {
        fileName: receiptFile.originalFilename,
        fileSize: receiptFile.size,
        referenceNumber,
      });

      try {
        // 1. Find the booking summary
        console.log('🔍 Looking up booking:', referenceNumber);
        const { data: bookingSummary, error: bookingError } = await supabase
          .from('booking_summary')
          .select('id, training_id')
          .eq('reference_number', referenceNumber)
          .single();

        if (bookingError || !bookingSummary) {
          console.error('❌ Booking not found:', bookingError);
          resolve(NextResponse.json(
            { error: 'Booking not found. Please check your reference number.' },
            { status: 404 }
          ));
          return;
        }

        console.log('✅ Booking found:', bookingSummary.id);

        // 2. Get training details
        const { data: training, error: trainingError } = await supabase
          .from('trainings')
          .select('id, first_name, last_name, email, payment_method, course_id, has_discount, discounted_fee, schedule_id')
          .eq('id', bookingSummary.training_id)
          .single();

        if (trainingError || !training) {
          console.error('❌ Training not found:', trainingError);
          resolve(NextResponse.json(
            { error: 'Training record not found' },
            { status: 404 }
          ));
          return;
        }

        console.log('✅ Training found:', training.id);

        // Get course details to retrieve training_fee
        const { data: course } = await supabase
          .from('courses')
          .select('training_fee')
          .eq('id', training.course_id)
          .single();

        // Determine the actual training fee (with discount if applicable)
        const actualFee = training.has_discount && training.discounted_fee 
          ? training.discounted_fee 
          : (course?.training_fee || 0);

        // 3. Upload file to FTP
        console.log('📤 Uploading to FTP...');
        const ftpClient = new ftp.Client();

        try {
          await ftpClient.access({
            host: process.env.HOSTINGER_SFTP_HOST!,
            user: process.env.HOSTINGER_SFTP_USER!,
            password: process.env.HOSTINGER_SFTP_PASS!,
            port: 21,
            secure: false,
          });

          // Generate unique filename
          const ext = receiptFile.originalFilename?.split('.').pop()?.toLowerCase() || 'jpg';
          const newFileName = `receipt_${randomUUID()}.${ext}`;

          // Upload to receipts folder
          await ftpClient.uploadFrom(receiptFile.filepath, `receipts/${newFileName}`);
          ftpClient.close();

          const publicUrl = `https://petrosphere.com.ph/uploads/trainees/receipts/${newFileName}`;
          console.log('✅ File uploaded to:', publicUrl);

          // ✅ FIXED: Always create a NEW payment record (don't update existing)
          const { error: paymentInsertError } = await supabase
            .from('payments')
            .insert({
              training_id: bookingSummary.training_id,
              payment_method: training.payment_method || 'BPI',
              payment_status: 'pending',
              amount_paid: 0, // Will be set when admin approves
              receipt_link: publicUrl,
              receipt_uploaded_by: 'client',
              receipt_uploaded_at: new Date().toISOString(),
              total_due: actualFee,
            });

          if (paymentInsertError) {
            console.error('❌ Payment insert error:', paymentInsertError);
            resolve(NextResponse.json(
              { error: 'Failed to create payment record' },
              { status: 500 }
            ));
            return;
          }

          console.log('✅ New payment record created with receipt');

          // 5. Update trainings table with latest receipt (for backward compatibility)
          await supabase
            .from('trainings')
            .update({
              receipt_link: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingSummary.training_id);

          console.log('✅ Training record updated with latest receipt');

          // 6. Create notification for admin
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              title: `New receipt uploaded for ${referenceNumber}`,
              trainee_name: `${training.first_name} ${training.last_name}`,
              photo_url: publicUrl,
              read: false,
              created_at: new Date().toISOString(),
              training_id: bookingSummary.training_id,
              schedule_info: training.schedule_id
                ? { schedule_id: training.schedule_id }
                : null,
            });

          if (notificationError) {
            console.error('❌ Notification error:', notificationError);
          } else {
            console.log('✅ Notification created');
          }

          // 7. Send confirmation email to trainee (optional - don't fail if it errors)
          try {
            const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-receipt-confirmation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: training.email,
                name: `${training.first_name} ${training.last_name}`,
                referenceNumber,
              }),
            });

            if (emailResponse.ok) {
              console.log('✅ Confirmation email sent');
            } else {
              console.log('⚠️ Email send failed, but continuing...');
            } 
          } catch (emailError) {
            console.error('❌ Email error:', emailError);
            // Don't fail the request if email fails
          }

          resolve(NextResponse.json({
            success: true,
            message: 'Receipt uploaded successfully',
            receiptUrl: publicUrl,
          }));

        } catch (ftpError: any) {
          console.error('❌ FTP upload error:', ftpError);
          ftpClient.close();
          resolve(NextResponse.json(
            { error: 'Failed to upload file to server. Please try again.' },
            { status: 500 }
          ));
        }

      } catch (error: any) {
        console.error('❌ Upload receipt error:', error);
        resolve(NextResponse.json(
          { error: 'An unexpected error occurred. Please try again.' },
          { status: 500 }
        ));
      }
    });
  });
}