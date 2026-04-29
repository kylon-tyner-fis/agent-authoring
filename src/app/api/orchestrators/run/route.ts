import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runExecutiveAgent } from "@/src/lib/runtime/agent-executor";

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

    const { data: agentConfig, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (agentError || !agentConfig) {
      return NextResponse.json(
        { error: "Agent not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    const allRequiredSkillIds = new Set<string>(agentConfig.skills || []);
    const { data: assignedSkills, error: skillsError } = await supabase
      .from("skills")
      .select("*")
      .in("id", Array.from(allRequiredSkillIds));

    if (skillsError) {
      throw new Error(`Failed to load assigned skills: ${skillsError.message}`);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // FULL REPORTER INSTALLED HERE AS WELL
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
            agentConfig,
            assignedSkills || [],
            [], // No sub-agents
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
    console.error("Agent Execution Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
