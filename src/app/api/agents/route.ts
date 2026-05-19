import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

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
      .from("agents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ agents: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const agent = await req.json();
    const normalizedId =
      typeof agent.id === "string" && agent.id.trim().length > 0
        ? agent.id.trim()
        : randomUUID();
    const normalizedProjectId =
      typeof agent.project_id === "string" ? agent.project_id.trim() : "";

    if (!normalizedProjectId) {
      return NextResponse.json(
        { error: "project_id is required to save an agent." },
        { status: 400 },
      );
    }

    const payload = {
      ...agent,
      id: normalizedId,
      project_id: normalizedProjectId,
    };

    const { data, error } = await supabase
      .from("agents")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An agent with this id already exists." },
          { status: 409 },
        );
      }

      throw error;
    }
    return NextResponse.json({ success: true, agent: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
