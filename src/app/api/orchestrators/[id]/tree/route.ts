import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SystemTreeNode } from "@/src/lib/contexts/WorkspaceContext";

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

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // 1. Fetch Orchestrator
    const { data: orch, error: orchError } = await supabase
      .from("orchestrators")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .single();

    if (orchError) throw orchError;

    // 2. Fetch Agents for this Orchestrator
    // Assuming agents have an orchestrator_id. If they are stored as an array of IDs
    // on the orchestrator, change this to: .in("id", orch.agents || [])
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("*")
      .eq("project_id", projectId);
    // .eq("orchestrator_id", id); // Add this if you have the foreign key

    if (agentsError) throw agentsError;

    // 3. Fetch Skills, Tools, and MCP Servers
    // In a real production app, you might fetch these based on the specific agent IDs.
    // For now, we'll fetch project-wide and filter them in memory to assemble the tree.
    const [skillsRes, toolsRes, mcpRes] = await Promise.all([
      supabase.from("skills").select("*").eq("project_id", projectId),
      supabase.from("tools").select("*").eq("project_id", projectId),
      supabase.from("mcp_servers").select("*").eq("project_id", projectId),
    ]);

    // 4. Assemble the Tree
    const tree: SystemTreeNode = {
      id: orch.id,
      type: "orchestrator",
      name: orch.name || "Untitled Orchestrator",
      data: orch,
      children: (agents || []).map((agent) => {
        // Find skills assigned to this agent (assuming agent.skills is an array of IDs)
        // Change logic based on your exact DB relations
        const agentSkillIds = agent.skills || [];
        const assignedSkills = (skillsRes.data || []).filter((s) =>
          agentSkillIds.includes(s.id),
        );

        return {
          id: agent.id,
          type: "agent",
          name: agent.name || "Untitled Agent",
          data: agent,
          children: assignedSkills.map((skill) => {
            // Find tools and MCPs assigned to this skill
            const skillToolIds = skill.tools || [];
            const skillMcpIds = skill.mcp_servers || [];

            const assignedTools = (toolsRes.data || []).filter((t) =>
              skillToolIds.includes(t.id),
            );
            const assignedMcps = (mcpRes.data || []).filter((m) =>
              skillMcpIds.includes(m.id),
            );

            // Find all versions for this skill head (or find the head if this is a snapshot)
            const isSnapshot = !!skill.parent_id;
            const headId = isSnapshot ? skill.parent_id : skill.id;
            const allVersions = (skillsRes.data || [])
              .filter((s) => s.id === headId || s.parent_id === headId)
              .map((v) => ({
                id: v.id,
                version: v.version,
                status: v.status,
                updated_at: v.updated_at,
              }))
              .sort((a, b) => b.version.localeCompare(a.version));

            return {
              id: skill.id,
              type: "skill",
              name: skill.name || "Untitled Skill",
              data: {
                ...skill,
                allVersions, // Attach version history to each skill node
              },
              children: [
                {
                  id: `${skill.id}-tools`,
                  type: "group",
                  name: "Tools",
                  data: { groupType: "tool" },
                  children: assignedTools.map((t) => ({
                    id: t.id,
                    type: "tool",
                    name: t.name || "Untitled Tool",
                    data: t,
                  })),
                },
                {
                  id: `${skill.id}-mcps`,
                  type: "group",
                  name: "MCP Servers",
                  data: { groupType: "mcp_server" },
                  children: assignedMcps.map((m) => ({
                    id: m.id,
                    type: "mcp_server",
                    name: m.name || "Untitled Server",
                    data: m,
                  })),
                },
              ],
            };
          }),
        };
      }),
    };

    return NextResponse.json({ tree });
  } catch (error: any) {
    console.error("Tree Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
