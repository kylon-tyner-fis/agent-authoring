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

    // Fetch the actual Skills assigned to this Agent
    const { data: assignedSkills, error } = await supabase
      .from("skills")
      .select("*")
      .in("id", agentConfig.skills || []);

    if (error) {
      throw new Error(`Failed to load assigned skills: ${error.message}`);
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
        };

        try {
          await runExecutiveAgent(
            agentConfig,
            assignedSkills || [],
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
