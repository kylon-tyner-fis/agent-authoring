import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("mcp_servers")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    // Apply Real-Time Health Checks
    const serversWithHealth = await Promise.all(
      data.map(async (server) => {
        // Only run a check if it hasn't been purposefully disabled and a URL exists
        if (server.status !== "inactive" && server.health_url) {
          try {
            const res = await fetch(server.health_url, {
              method: "GET",
              signal: AbortSignal.timeout(3000), // Enforce 3 second max timeout
            });
            server.status = res.ok ? "active" : "error";
          } catch (err) {
            server.status = "error";
          }
        }
        return server;
      }),
    );

    return NextResponse.json({ servers: serversWithHealth });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const server = await req.json();
    const { data, error } = await supabase
      .from("mcp_servers")
      .upsert([server], { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, server: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
