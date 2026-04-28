import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runExecutiveAgent } from "@/src/lib/runtime/agent-runtime";

export async function POST(req: Request) {
  try {
    const { agentConfig, input, thread_id } = await req.json();

    if (!agentConfig) {
      return NextResponse.json(
        { error: "Missing Agent Config" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Fetch assigned Sub-Agents
    const { data: assignedSubAgents } = await supabase
      .from("agents")
      .select("*")
      .in("id", agentConfig.sub_agents || []);

    // Gather ALL skill IDs needed (Parent Agent + Sub-Agents)
    const allRequiredSkillIds = new Set(agentConfig.skills || []);
    (assignedSubAgents || []).forEach((sub) => {
      (sub.skills || []).forEach((sId: string) => allRequiredSkillIds.add(sId));
    });

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
          onMessageChunk: (chunk: string) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "chunk", chunk })}\n\n`,
              ),
            );
          },
          onSkillStart: (skillName: string, args: Record<string, any>) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_start", skillName, args })}\n\n`,
              ),
            );
          },
          onSkillEnd: (skillName: string, result: any) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_end", skillName, result })}\n\n`,
              ),
            );
          },
          onSkillNodeStart: (skillName: string, nodeId: string) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_node_start", skillName, nodeId })}\n\n`,
              ),
            );
          },
          onSkillNodeEnd: (
            skillName: string,
            nodeId: string,
            updates: any,
            reasoning?: string,
            fullState?: any,
          ) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_node_end", skillName, nodeId, updates, reasoning, fullState })}\n\n`,
              ),
            );
          },
          onSkillEdgeTraversal: (
            skillName: string,
            source: string,
            target: string,
            condition?: string,
            reasoning?: string,
          ) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_edge_traversal", skillName, source, target, condition, reasoning })}\n\n`,
              ),
            );
          },
          onSkillToolStart: (
            skillName: string,
            toolName: string,
            args: Record<string, any>,
          ) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_tool_start", skillName, toolName, args })}\n\n`,
              ),
            );
          },
          onSkillToolEnd: (
            skillName: string,
            toolName: string,
            result: any,
          ) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_tool_end", skillName, toolName, result })}\n\n`,
              ),
            );
          },
        };

        try {
          await runExecutiveAgent(
            agentConfig,
            allSkills || [],
            assignedSubAgents || [],
            input,
            thread_id,
            reporter,
          );

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "final" })}\n\n`),
          );
          controller.close();
        } catch (e: any) {
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
