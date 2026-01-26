// app/api/email-templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
).schema("tms");

// GET - Fetch all email templates
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching email templates:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// POST - Create new email template
export async function POST(req: NextRequest) {
  try {
    const { name, subject, message, created_by, is_default } = await req.json();

    if (!name || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Name, subject, and message are required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from("email_templates")
        .update({ is_default: false })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all
    }

    const { data, error } = await supabase
      .from("email_templates")
      .insert({
        name,
        subject,
        message,
        created_by,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating email template:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// PUT - Update email template
export async function PUT(req: NextRequest) {
  try {
    const { id, name, subject, message, is_default } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from("email_templates")
        .update({ is_default: false })
        .neq("id", id);
    }

    const { data, error } = await supabase
      .from("email_templates")
      .update({
        name,
        subject,
        message,
        is_default: is_default || false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating email template:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete email template
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting email template:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}