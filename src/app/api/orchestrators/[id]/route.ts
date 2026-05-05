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
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId)
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const { data, error } = await supabase
      .from("orchestrators")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .single();

    if (error) throw error;
    return NextResponse.json({ orchestrator: data });
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
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId)
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", id)
      .eq("project_id", projectId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const projectId = new URL(req.url).searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const { name, description, agents, status, system_prompt } = body;

    const { data, error } = await supabase
      .from("orchestrators")
      .update({
        name,
        description,
        agents,
        status,
        system_prompt,
      })
      .eq("id", id)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, orchestrator: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
