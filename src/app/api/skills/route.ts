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

    // 1. Fetch full dependencies from the renamed 'tools' table
    const [toolsResponse, serversResponse] = await Promise.all([
      supabase.from("tools").select("*"),
      supabase.from("mcp_servers").select("*"),
    ]);

    if (toolsResponse.error) throw toolsResponse.error;
    if (serversResponse.error) throw serversResponse.error;

    const allTools: ToolConfig[] = toolsResponse.data || [];
    const allServers: MCPServerConfig[] = serversResponse.data || [];

    // 2. Generate the standalone compiled manifest
    const compiledManifest = generateManifest(config, allTools, allServers);

    const payload = {
      ...config,
      id: normalizedId,
      project_id: normalizedProjectId,
    };

    // 3. Save the orchestration config to the renamed 'skills' table
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
            provider: payload.model.provider,
            model_name: payload.model.model_name,
            temperature: payload.model.temperature,
            max_tokens: payload.model.max_tokens,
            mcp_servers: payload.mcp_servers,
            system_prompt: payload.system_prompt,
            state_schema: payload.state_schema,
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
  } catch (error: any) {
    console.error("Save Skill Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
