import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AgentConfig } from "@/lib/constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const config: AgentConfig = await req.json();

    // Upsert allows us to overwrite the config if the agent_id already exists
    const { data, error } = await supabase
      .from("agents")
      .upsert(
        [
          {
            agent_id: config.agent_id,
            provider: config.model.provider,
            model_name: config.model.model_name,
            temperature: config.model.temperature,
            max_tokens: config.model.max_tokens,
            tools: config.tools,
            system_prompt: config.system_prompt,
            state_schema: config.state_schema,
            graph: config.graph,
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
