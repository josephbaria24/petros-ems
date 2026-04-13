// app/api/course-materials/verify/route.ts
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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { materialId, password } = body;

  if (!materialId || !password) {
    return NextResponse.json(
      { error: "materialId and password are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { data: material, error } = await supabase
    .from("course_materials")
    .select("id, password_hash, is_active, title, file_url, file_type")
    .eq("id", materialId)
    .single();

  if (error || !material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  if (!material.is_active) {
    return NextResponse.json({ error: "This material is currently unavailable" }, { status: 403 });
  }

  const inputHash = createHash("sha256").update(password).digest("hex");
  const valid = inputHash === material.password_hash;

  if (!valid) {
    return NextResponse.json({ valid: false, error: "Incorrect password" }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    material: {
      id: material.id,
      title: material.title,
      file_url: material.file_url,
      file_type: material.file_type,
    },
  });
}
