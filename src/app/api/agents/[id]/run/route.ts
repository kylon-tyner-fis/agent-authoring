import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runExecutiveAgent } from "@/src/lib/runtime/agent-runtime";

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

    // 1. Fetch the Agent configuration
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

    // NEW: Fetch assigned Sub-Agents
    const { data: assignedSubAgents } = await supabase
      .from("agents")
      .select("*")
      .in("id", agentConfig.sub_agents || []);

    // NEW: Gather ALL skill IDs needed (Parent Agent + Sub-Agents)
    const allRequiredSkillIds = new Set<string>(agentConfig.skills || []);
    (assignedSubAgents || []).forEach((sub) => {
      (sub.skills || []).forEach((sId: string) => allRequiredSkillIds.add(sId));
    });

    // 2. Fetch the Skills assigned to this Agent and its Sub-Agents
    const { data: assignedSkills, error: skillsError } = await supabase
      .from("skills")
      .select("*")
      .in("id", Array.from(allRequiredSkillIds));

    if (skillsError) {
      throw new Error(`Failed to load assigned skills: ${skillsError.message}`);
    }

    // 3. Set up the Server-Sent Events (SSE) Stream for the frontend app
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reporter = {
          // Streams the conversational text (e.g., "I'm generating a quiz for you now...")
          onMessageChunk: (chunk: string) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "message", chunk })}\n\n`,
              ),
            );
          },
          // Streams the exact moment a Skill starts
          onSkillStart: (skillName: string, args: Record<string, any>) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_start", skillName, args })}\n\n`,
              ),
            );
          },
          // Streams the RAW JSON payload when the skill finishes
          onSkillEnd: (skillName: string, result: any) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "skill_end", skillName, result })}\n\n`,
              ),
            );
          },
        };

        try {
          await runExecutiveAgent(
            agentConfig,
            assignedSkills || [],
            assignedSubAgents || [], // FIXED: Added the 3rd parameter here!
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
