import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  SkillConfig,
  ToolConfig,
  MCPServerConfig,
} from "@/src/lib/types/constants";
import { generateManifest } from "@/src/lib/runtime/manifest-compiler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function collectReferencedIds(config: SkillConfig) {
  const toolIds = new Set<string>();
  const serverIds = new Set<string>(config.mcp_servers || []);

  const graphNodes = Object.values(config.graph?.nodes || {});
  for (const node of graphNodes) {
    if (node.toolId) toolIds.add(node.toolId);
    if (node.serverId) serverIds.add(node.serverId);
  }

  const orchestrationNodes = (config.orchestration?.nodes || []) as Array<{
    data?: { toolId?: string; serverId?: string };
  }>;
  for (const node of orchestrationNodes) {
    const data = node?.data || {};
    if (data.toolId) toolIds.add(data.toolId);
    if (data.serverId) serverIds.add(data.serverId);
  }

  return { toolIds, serverIds };
}

export async function POST(req: Request) {
  try {
    const config: SkillConfig = await req.json();
    const normalizedId =
      typeof config.id === "string" && config.id.trim().length > 0
        ? config.id.trim()
        : randomUUID();
    const normalizedProjectId =
      typeof config.project_id === "string" ? config.project_id.trim() : "";

    if (!normalizedProjectId) {
      return NextResponse.json(
        { error: "project_id is required to save a skill." },
        { status: 400 },
      );
    }

    if (!normalizedProjectId) {
      return NextResponse.json(
        { error: "Missing required field: project_id" },
        { status: 400 },
      );
    }

    // Fetch dependencies scoped to project
    const [toolsResponse, serversResponse] = await Promise.all([
      supabase.from("tools").select("*").eq("project_id", normalizedProjectId),
      supabase
        .from("mcp_servers")
        .select("*")
        .eq("project_id", normalizedProjectId),
    ]);

    if (toolsResponse.error) throw toolsResponse.error;
    if (serversResponse.error) throw serversResponse.error;

    const projectTools: ToolConfig[] = toolsResponse.data || [];
    const projectServers: MCPServerConfig[] = serversResponse.data || [];

    // Validate referenced dependencies exist within project-scoped sets
    const { toolIds, serverIds } = collectReferencedIds(config);
    const toolIdSet = new Set(projectTools.map((tool) => tool.id));
    const serverIdSet = new Set(projectServers.map((server) => server.id));

    const missing_tool_ids = [...toolIds].filter((id) => !toolIdSet.has(id));
    const missing_mcp_server_ids = [...serverIds].filter(
      (id) => !serverIdSet.has(id),
    );

    const payload = {
      ...config,
      id: normalizedId,
      project_id: normalizedProjectId,
    };

    // 3. Save the orchestration config to the renamed 'skills' table
    if (missing_tool_ids.length > 0 || missing_mcp_server_ids.length > 0) {
      return NextResponse.json(
        {
          error: "Referenced dependencies were not found in this project.",
          missing_tool_ids,
          missing_mcp_server_ids,
        },
        { status: 400 },
      );
    }

    // Generate manifest from project-scoped dependencies only
    const compiledManifest = generateManifest(
      config,
      projectTools,
      projectServers,
    );

    // Persist skill and enforce project invariant
    // Replace the manual mapping in the upsert block
    const { data, error } = await supabase
      .from("skills")
      .upsert(
        [
          {
            id: payload.id,
            project_id: payload.project_id,
            name: payload.name,
            version: payload.version,
            description: payload.description,
            model: payload.model, // Store the whole object
            mcp_servers: payload.mcp_servers,
            system_prompt: payload.system_prompt,
            state_schema: payload.state_schema,
            custom_types: payload.custom_types, // Ensure this is included
            graph: payload.graph,
            subgraphs: payload.subgraphs,
            persistence: payload.persistence,
            interrupts: payload.interrupts,
            orchestration: payload.orchestration,
            compiled_manifest: compiledManifest,
          },
        ],
        { onConflict: "id" },
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, skill: data });
  } catch (error: unknown) {
    console.error("Save Skill Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const statusFilter = url.searchParams.get("status"); // NEW: Get status param

    if (!projectId)
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );

    const query = supabase
      .from("skills")
      .select(
        "id, name, version, description, model, updated_at, status, parent_id",
      )
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    // --- NEW: If requesting published skills (for the Agent Editor) ---
    if (statusFilter === "published") {
      const { data, error } = await query.eq("status", "published");
      if (error) throw error;
      return NextResponse.json({ skills: data }); // Return flat list of snapshots
    }

    // --- EXISTING: Dashboard Grouping Logic (Drafts + Nested History) ---
    const { data, error } = await query;
    if (error) throw error;

    const { data: agents } = await supabase
      .from("agents")
      .select("skills")
      .eq("project_id", projectId);
    const usedSkillIds = new Set<string>();
    if (agents) {
      agents.forEach((agent: any) => {
        if (Array.isArray(agent.skills))
          agent.skills.forEach((id: string) => usedSkillIds.add(id));
      });
    }

    const heads = data.filter((s) => s.parent_id === null);
    const groupedSkills = heads.map((head) => {
      const snapshots = data.filter((s) => s.parent_id === head.id);
      snapshots.sort((a, b) => b.version.localeCompare(a.version));

      const processedSnapshots = snapshots.map((snap) => ({
        ...snap,
        in_use: usedSkillIds.has(snap.id),
      }));

      const isHeadUsed = usedSkillIds.has(head.id);
      const isAnySnapshotUsed = processedSnapshots.some((v) => v.in_use);

      return {
        ...head,
        in_use: isHeadUsed || isAnySnapshotUsed,
        versions: processedSnapshots,
      };
    });

    return NextResponse.json({ skills: groupedSkills });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
