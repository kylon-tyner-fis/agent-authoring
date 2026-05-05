import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  const orchestrationNodes = (config.orchestration?.nodes || []) as Array<{ data?: { toolId?: string; serverId?: string } }>;
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
    const projectId = config?.project_id;

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: project_id" },
        { status: 400 },
      );
    }

    // Fetch dependencies scoped to project
    const [toolsResponse, serversResponse] = await Promise.all([
      supabase.from("tools").select("*").eq("project_id", projectId),
      supabase.from("mcp_servers").select("*").eq("project_id", projectId),
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
    const compiledManifest = generateManifest(config, projectTools, projectServers);

    // Persist skill and enforce project invariant
    const { data, error } = await supabase
      .from("skills")
      .upsert(
        [
          {
            id: config.id,
            project_id: projectId,
            name: config.name,
            version: config.version,
            description: config.description,
            provider: config.model.provider,
            model_name: config.model.model_name,
            temperature: config.model.temperature,
            max_tokens: config.model.max_tokens,
            mcp_servers: config.mcp_servers,
            system_prompt: config.system_prompt,
            state_schema: config.state_schema,
            graph: config.graph,
            subgraphs: config.subgraphs,
            persistence: config.persistence,
            interrupts: config.interrupts,
            orchestration: config.orchestration,
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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("skills")
      .select(
        "id, name, version, description, provider, model_name, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ skills: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
