// app/api/course-materials/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "tms" } }
  );
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

// GET — list materials for a course
export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("course_materials")
    .select("id, course_id, title, file_url, file_type, is_active, created_at, updated_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST — create a new material
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { course_id, title, file_url, file_type, password } = body;

  if (!course_id || !title || !file_url || !password) {
    return NextResponse.json(
      { error: "course_id, title, file_url, and password are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const password_hash = hashPassword(password);

  const { data, error } = await supabase
    .from("course_materials")
    .insert([{ course_id, title, file_url, file_type: file_type || "pdf", password_hash }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE — remove a material
export async function DELETE(req: NextRequest) {
  const materialId = req.nextUrl.searchParams.get("id");

  if (!materialId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("course_materials")
    .delete()
    .eq("id", materialId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH — toggle active status or update password
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, is_active, password, title } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const updateData: any = { updated_at: new Date().toISOString() };

  if (typeof is_active === "boolean") updateData.is_active = is_active;
  if (password) updateData.password_hash = hashPassword(password);
  if (title) updateData.title = title;

  const { data, error } = await supabase
    .from("course_materials")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
