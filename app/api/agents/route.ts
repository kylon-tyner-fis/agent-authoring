// app/api/agents/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AgentConfig, SkillConfig, MCPServerConfig } from "@/lib/constants";
import { generateManifest } from "@/lib/compiler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const config: AgentConfig = await req.json();

    // 1. Fetch full dependencies for the compiled manifest
    const [skillsResponse, serversResponse] = await Promise.all([
      supabase.from("skills").select("*"),
      supabase.from("mcp_servers").select("*"),
    ]);

    if (skillsResponse.error) throw skillsResponse.error;
    if (serversResponse.error) throw serversResponse.error;

    const allSkills: SkillConfig[] = skillsResponse.data || [];
    const allServers: MCPServerConfig[] = serversResponse.data || [];

    // 2. Generate the standalone compiled manifest
    const compiledManifest = generateManifest(config, allSkills, allServers);

    // 3. Save the agent config along with the new manifest
    const { data, error } = await supabase
      .from("agents")
      .upsert(
        [
          {
            agent_id: config.agent_id,
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
            compiled_manifest: compiledManifest, // NEW field mapped here
          },
        ],
        { onConflict: "agent_id" },
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, agent: data });
  } catch (error: any) {
    console.error("Save Agent Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("agents")
      .select(
        "agent_id, version, description, provider, model_name, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ agents: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
