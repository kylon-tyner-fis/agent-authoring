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
      .from("skills")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ skill: data });
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

    if (!projectId)
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    // 1. Gather the ID of the skill and all its snapshots
    const { data: family } = await supabase
      .from("skills")
      .select("id")
      .or(`id.eq.${id},parent_id.eq.${id}`);

    const familyIds = family?.map((f) => f.id) || [id];

    // 2. Check if ANY of these IDs are currently used by an Agent
    const { data: agents } = await supabase
      .from("agents")
      .select("name, skills")
      .eq("project_id", projectId);

    const conflictingAgents = agents?.filter((agent) => {
      if (!Array.isArray(agent.skills)) return false;
      // Does this agent's skill array contain any ID from our skill family?
      return agent.skills.some((skillId) => familyIds.includes(skillId));
    });

    if (conflictingAgents && conflictingAgents.length > 0) {
      const agentNames = conflictingAgents.map((a) => a.name).join(", ");
      return NextResponse.json(
        {
          error: `Cannot delete. This skill or its published versions are actively used by: ${agentNames}`,
        },
        { status: 409 }, // 409 Conflict
      );
    }

    // 3. Safe to delete (Make sure your Supabase schema has ON DELETE CASCADE for parent_id)
    const { data, error } = await supabase
      .from("skills")
      .delete()
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
