import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("tools") // <-- Updated table
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ tools: data }); // <-- Updated key
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tool = await req.json();
    const normalizedId =
      typeof tool.id === "string" && tool.id.trim().length > 0
        ? tool.id.trim()
        : randomUUID();
    const normalizedProjectId =
      typeof tool.project_id === "string" ? tool.project_id.trim() : "";

    if (!normalizedProjectId) {
      return NextResponse.json(
        { error: "project_id is required to save a tool." },
        { status: 400 },
      );
    }

    const payload = {
      ...tool,
      id: normalizedId,
      project_id: normalizedProjectId,
    };

    const { data, error } = await supabase
      .from("tools") // <-- Updated table
      .upsert([payload], { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, tool: data }); // <-- Updated key
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
