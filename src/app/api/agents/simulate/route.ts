import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runExecutiveAgent } from "@/src/lib/runtime/agent-executor";

export async function POST(req: Request) {
  try {
    const { config, agentConfig, input, thread_id } = await req.json();
    const targetConfig = config || agentConfig;

    if (!targetConfig) {
      return NextResponse.json(
        { error: "Missing Agent Config" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const allRequiredSkillIds = new Set(targetConfig.skills || []);

    const { data: allSkills, error: skillsError } = await supabase
      .from("skills")
      .select("*")
      .in("id", Array.from(allRequiredSkillIds));

    if (skillsError) {
      throw new Error(`Failed to load assigned skills: ${skillsError.message}`);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reporter = {
          onMessageChunk: (chunk: string) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "chunk", chunk })}\n\n`,
              ),
            ),
          onSkillStart: (skillName: string, args: Record<string, any>) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_start", skillName, args })}\n\n`,
              ),
            ),
          onSkillEnd: (skillName: string, result: any) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_end", skillName, result })}\n\n`,
              ),
            ),
          onSkillNodeStart: (
            skillName: string,
            nodeId: string,
            modelName?: string,
          ) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_node_start", skillName, nodeId, modelName })}\n\n`,
              ),
            ),
          onSkillNodeEnd: (
            skillName: string,
            nodeId: string,
            updates: any,
            reasoning?: string,
            fullState?: any,
            modelName?: string,
          ) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_node_end", skillName, nodeId, updates, reasoning, fullState, modelName })}\n\n`,
              ),
            ),
          onSkillEdgeTraversal: (
            skillName: string,
            source: string,
            target: string,
            condition?: string,
            reasoning?: string,
          ) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_edge_traversal", skillName, source, target, condition, reasoning })}\n\n`,
              ),
            ),
          onSkillToolStart: (
            skillName: string,
            toolName: string,
            args: Record<string, any>,
          ) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_tool_start", skillName, toolName, args })}\n\n`,
              ),
            ),
          onSkillToolEnd: (skillName: string, toolName: string, result: any) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_tool_end", skillName, toolName, result })}\n\n`,
              ),
            ),
        };

        try {
          await runExecutiveAgent(
            targetConfig,
            allSkills || [],
            [], // No sub-agents permitted
            input,
            thread_id,
            reporter,
          );

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "final" })}\n\n`),
          );
          controller.close();
        } catch (e: any) {
          console.error("\n🔥 [FATAL] AGENT EXECUTION CRASHED:", e);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: e.message })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Agent Simulation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
