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
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required query param: projectId" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("mcp_servers")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
      }
      throw error;
    }

    // Apply Real-Time Health Check
    if (data.status !== "Inactive" && data.health_url) {
      try {
        const res = await fetch(data.health_url, {
          method: "GET",
          signal: AbortSignal.timeout(3000), // Enforce 3 second max timeout
        });
        data.status = res.ok ? "Active" : "Error";
      } catch (err) {
        data.status = "Error";
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
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required query param: projectId" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("mcp_servers")
      .delete()
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
