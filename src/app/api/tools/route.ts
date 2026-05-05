import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  try {
    const projectId = new URL(req.url).searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    let query = supabase
      .from("tools") // <-- Updated table
      .select("*");

    query = query.eq("project_id", projectId);

    const { data, error } = await query.order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ tools: data }); // <-- Updated key
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tool = await req.json();
    const { data, error } = await supabase
      .from("tools") // <-- Updated table
      .upsert([tool], { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, tool: data }); // <-- Updated key
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
