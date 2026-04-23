import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SkillConfig,
  ToolConfig,
  MCPServerConfig,
} from "@/src/lib/types/constants";
import { generateManifest } from "@/src/lib/runtime/authoring-runtime";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const config: SkillConfig = await req.json();

    // 1. Fetch full dependencies from the renamed 'tools' table
    const [toolsResponse, serversResponse] = await Promise.all([
      supabase.from("tools").select("*"), // Was "skills"
      supabase.from("mcp_servers").select("*"),
    ]);

    if (toolsResponse.error) throw toolsResponse.error;
    if (serversResponse.error) throw serversResponse.error;

    const allTools: ToolConfig[] = toolsResponse.data || [];
    const allServers: MCPServerConfig[] = serversResponse.data || [];

    // 2. Generate the standalone compiled manifest
    const compiledManifest = generateManifest(config, allTools, allServers);

    // 3. Save the orchestration config to the renamed 'skills' table
    const { data, error } = await supabase
      .from("skills") // Was "agents"
      .upsert(
        [
          {
            skill_id: config.id, // Was agent_id
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
        { onConflict: "id" }, // Was agent_id
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
      .from("skills") // Was "agents"
      .select(
        "id, version, description, provider, model_name, updated_at", // Was agent_id
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ skills: data }); // Was agents
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
