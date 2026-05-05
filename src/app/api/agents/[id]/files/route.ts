import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DocumentService } from "@/src/lib/storage/DocumentService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from("agent_files")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ files: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await req.formData();

    const file = formData.get("file") as File;
    const usageType = formData.get("usageType") as "instruction" | "reference";

    if (!file || !usageType) {
      return NextResponse.json(
        { error: "File and usageType are required" },
        { status: 400 },
      );
    }

    // Pass everything to the abstraction service we built in Step 2
    const fileRecord = await DocumentService.uploadFile(file, id, usageType);

    return NextResponse.json({ success: true, file: fileRecord });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
