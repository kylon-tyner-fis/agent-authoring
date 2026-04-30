import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      .from("mcp_servers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    // Apply Real-Time Health Check
    if (data.status !== "inactive" && data.health_url) {
      try {
        const res = await fetch(data.health_url, {
          method: "GET",
          signal: AbortSignal.timeout(3000), // Enforce 3 second max timeout
        });
        data.status = res.ok ? "active" : "error";
      } catch (err) {
        data.status = "error";
      }
    }

    return NextResponse.json({ server: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { error } = await supabase.from("mcp_servers").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
