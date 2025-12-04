// File: /types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      booking_summary: {
        Row: {
          id: string;
          training_id: string;
          reference_number: string;
          booking_date: string | null;
        };
        Insert: {
          id?: string;
          training_id: string;
          reference_number: string;
          booking_date?: string | null;
        };
        Update: {
          id?: string;
          training_id?: string;
          reference_number?: string;
          booking_date?: string | null;
        };
      };

      certificate_templates: {
        Row: {
          id: number;
          image_url: string;
          fields: Json;
          created_at: string | null;
          updated_at: string | null;
          template_type: string | null;
          course_id: string | null;
        };
        Insert: {
          id?: number;
          image_url: string;
          fields?: Json;
          created_at?: string | null;
          updated_at?: string | null;
          template_type?: string | null;
          course_id?: string | null;
        };
        Update: {
          id?: number;
          image_url?: string;
          fields?: Json;
          created_at?: string | null;
          updated_at?: string | null;
          template_type?: string | null;
          course_id?: string | null;
        };
      };

      courses: {
        Row: {
          id: string;
          name: string;
          created_at: string | null;
          training_fee: number | null;
          description: string | null;
          serial_number: number | null;
          title: string | null;
          serial_number_pad: number | null;
          pretest_link: string | null;
          posttest_link: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string | null;
          training_fee?: number | null;
          description?: string | null;
          serial_number?: number | null;
          title?: string | null;
          serial_number_pad?: number | null;
          pretest_link?: string | null;
          posttest_link?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string | null;
          training_fee?: number | null;
          description?: string | null;
          serial_number?: number | null;
          title?: string | null;
          serial_number_pad?: number | null;
          pretest_link?: string | null;
          posttest_link?: string | null;
        };
      };

      evaluations: {
        Row: {
          id: number;
          answers: Json;
          refid: string;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          answers: Json;
          refid: string;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          answers?: Json;
          refid?: string;
          created_at?: string | null;
        };
      };

      news_items: {
        Row: {
          id: string;
          title: string;
          image: string;
          date: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          image: string;
          date: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          image?: string;
          date?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      notifications: {
        Row: {
          id: string;
          title: string;
          read: boolean | null;
          created_at: string | null;
          trainee_name: string | null;
          photo_url: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          read?: boolean | null;
          created_at?: string | null;
          trainee_name?: string | null;
          photo_url?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          read?: boolean | null;
          created_at?: string | null;
          trainee_name?: string | null;
          photo_url?: string | null;
        };
      };

      payments: {
        Row: {
          id: string;
          training_id: string;
          payment_date: string | null;
          payment_method: string;
          payment_status: string | null;
          amount_paid: number;
          receipt_link: string | null;
          online_classroom_url: string | null;
          confirmation_email_sent: boolean | null;
          classroom_url_sent: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          total_due: number | null;
        };
        Insert: {
          id?: string;
          training_id: string;
          payment_date?: string | null;
          payment_method: string;
          payment_status?: string | null;
          amount_paid: number;
          receipt_link?: string | null;
          online_classroom_url?: string | null;
          confirmation_email_sent?: boolean | null;
          classroom_url_sent?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          total_due?: number | null;
        };
        Update: {
          id?: string;
          training_id?: string;
          payment_date?: string | null;
          payment_method?: string;
          payment_status?: string | null;
          amount_paid?: number;
          receipt_link?: string | null;
          online_classroom_url?: string | null;
          confirmation_email_sent?: boolean | null;
          classroom_url_sent?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          total_due?: number | null;
        };
      };

      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone_number: string | null;
          company: string | null;
          position: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone_number?: string | null;
          company?: string | null;
          position?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone_number?: string | null;
          company?: string | null;
          position?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      schedules: {
        Row: {
          id: string;
          course_id: string;
          schedule_type: string;
          created_at: string | null;
          event_type: string;
          branch: string;
          status: string | null;
          batch_number: number | null;
        };
        Insert: {
          id?: string;
          course_id: string;
          schedule_type: string;
          created_at?: string | null;
          event_type?: string;
          branch?: string;
          status?: string | null;
          batch_number?: number | null;
        };
        Update: {
          id?: string;
          course_id?: string;
          schedule_type?: string;
          created_at?: string | null;
          event_type?: string;
          branch?: string;
          status?: string | null;
          batch_number?: number | null;
        };
      };

      schedule_dates: {
        Row: {
          id: string;
          schedule_id: string;
          date: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          date: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          date?: string;
        };
      };

      schedule_ranges: {
        Row: {
          id: string;
          schedule_id: string;
          start_date: string;
          end_date: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          start_date: string;
          end_date: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          start_date?: string;
          end_date?: string;
        };
      };

      trainings: {
        Row: {
          id: string;
          schedule_id: string;
          first_name: string;
          last_name: string;
          certificate_number: string | null;
          training_provider: string | null;
          training_type: string | null;
          status: string | null;
          uploaded_by: string | null;
          created_at: string | null;
          updated_at: string | null;
          middle_initial: string | null;
          suffix: string | null;
          email: string | null;
          phone_number: string | null;
          gender: string | null;
          age: number | null;
          mailing_street: string | null;
          mailing_city: string | null;
          mailing_province: string | null;
          employment_status: string | null;
          company_name: string | null;
          company_position: string | null;
          company_industry: string | null;
          company_email: string | null;
          company_landline: string | null;
          company_city: string | null;
          company_region: string | null;
          id_picture_url: string | null;
          picture_2x2_url: string | null;
          total_workers: number | null;
          course_id: string | null;
          payment_method: string | null;
          payment_status: string | null;
          receipt_link: string | null;
          amount_paid: number | null;
          food_restriction: string | null;
          batch_number: number | null;
          courtesy_title: string | null;
          physical_cert_status: string | null;
          e_id_status: string | null;
          discounted_fee: number | null;
          has_discount: boolean | null;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          first_name: string;
          last_name: string;
          certificate_number?: string | null;
          training_provider?: string | null;
          training_type?: string | null;
          status?: string | null;
          uploaded_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          middle_initial?: string | null;
          suffix?: string | null;
          email?: string | null;
          phone_number?: string | null;
          gender?: string | null;
          age?: number | null;
          mailing_street?: string | null;
          mailing_city?: string | null;
          mailing_province?: string | null;
          employment_status?: string | null;
          company_name?: string | null;
          company_position?: string | null;
          company_industry?: string | null;
          company_email?: string | null;
          company_landline?: string | null;
          company_city?: string | null;
          company_region?: string | null;
          id_picture_url?: string | null;
          picture_2x2_url?: string | null;
          total_workers?: number | null;
          course_id?: string | null;
          payment_method?: string | null;
          payment_status?: string | null;
          receipt_link?: string | null;
          amount_paid?: number | null;
          food_restriction?: string | null;
          batch_number?: number | null;
          courtesy_title?: string | null;
          physical_cert_status?: string | null;
          e_id_status?: string | null;
          discounted_fee?: number | null;
          has_discount?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["trainings"]["Insert"]>;
      };

      training_sessions_summary: {
        Row: {
          id: string;
          cert: boolean | null;
          ptr: boolean | null;
          month: string | null;
          course: string | null;
          type: string | null;
          start_date: string | null;
          end_date: string | null;
          participants: number | null;
          male: number | null;
          female: number | null;
          company: number | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          cert?: boolean | null;
          ptr?: boolean | null;
          month?: string | null;
          course?: string | null;
          type?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          participants?: number | null;
          male?: number | null;
          female?: number | null;
          company?: number | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["training_sessions_summary"]["Insert"]>;
      };
    };
  };
}
