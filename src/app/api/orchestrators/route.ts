import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("orchestrators")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ orchestrators: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const orchestrator = await req.json();
    const normalizedId =
      typeof orchestrator.id === "string" && orchestrator.id.trim().length > 0
        ? orchestrator.id.trim()
        : randomUUID();
    const normalizedProjectId =
      typeof orchestrator.project_id === "string"
        ? orchestrator.project_id.trim()
        : "";

    if (!normalizedProjectId) {
      return NextResponse.json(
        { error: "project_id is required to save an orchestrator." },
        { status: 400 },
      );
    }

    const payload = {
      ...orchestrator,
      id: normalizedId,
      project_id: normalizedProjectId,
    };

    const { data, error } = await supabase
      .from("orchestrators")
      .upsert([payload], { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, orchestrator: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
