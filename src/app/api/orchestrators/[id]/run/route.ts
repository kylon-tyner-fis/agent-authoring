import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runExecutiveAgent } from "@/src/lib/runtime/agent-executor";
import { AgentConfig } from "@/src/lib/types/constants";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { input, threadId } = await req.json();

    if (!input || !threadId) {
      return NextResponse.json(
        { error: "Missing input or threadId." },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 1. Fetch the Orchestrator
    const { data: orchConfig, error: orchError } = await supabase
      .from("orchestrators")
      .select("*")
      .eq("id", id)
      .single();

    if (orchError || !orchConfig) {
      return NextResponse.json(
        { error: "Orchestrator not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    // 2. Fetch the assigned Agents
    const { data: assignedAgents, error: agentsError } = await supabase
      .from("agents")
      .select("*")
      .in("id", orchConfig.agents || []);

    if (agentsError) {
      throw new Error(`Failed to load assigned agents: ${agentsError.message}`);
    }

    // 3. Gather ALL skill IDs needed by the sub-agents
    const allRequiredSkillIds = new Set<string>();
    (assignedAgents || []).forEach((agent) => {
      (agent.skills || []).forEach((sId: string) =>
        allRequiredSkillIds.add(sId),
      );
    });

    const { data: allSkills, error: skillsError } = await supabase
      .from("skills")
      .select("*")
      .in("id", Array.from(allRequiredSkillIds));

    if (skillsError) {
      throw new Error(`Failed to load skills: ${skillsError.message}`);
    }

    // Map orchestrator to AgentConfig format to reuse the runner
    const orchestratorAsAgent: AgentConfig = {
      id: orchConfig.id,
      project_id: orchConfig.project_id,
      name: orchConfig.name,
      description: orchConfig.description,
      skills: [], // Orchestrators don't use skills directly
      status: orchConfig.status,
      system_prompt: orchConfig.system_prompt,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // FULL REPORTER
        const reporter = {
          onMessageChunk: (chunk: string) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "message", chunk })}\n\n`,
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
          onSkillNodeStart: (skillName: string, nodeId: string) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_node_start", skillName, nodeId })}\n\n`,
              ),
            ),
          onSkillNodeEnd: (
            skillName: string,
            nodeId: string,
            updates: any,
            reasoning?: string,
            fullState?: any,
          ) =>
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_node_end", skillName, nodeId, updates, reasoning, fullState })}\n\n`,
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
            orchestratorAsAgent,
            allSkills || [],
            assignedAgents || [], // Pass the sub-agents so the orchestrator can use them!
            input,
            threadId,
            reporter,
          );

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
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
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
