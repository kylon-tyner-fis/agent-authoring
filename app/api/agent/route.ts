import { NextResponse } from "next/server";
import { compileAndRunAgent } from "@/lib/compiler";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { config, input } = await req.json();

    if (!config) {
      return NextResponse.json(
        { error: "Missing Agent Configuration" },
        { status: 400 },
      );
    }

    if (process.env.LANGCHAIN_API_KEY) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
      process.env.LANGCHAIN_PROJECT = config.agent_id || "Agent_Studio_Project";
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: skills, error } = await supabase.from("skills").select("*");

    if (error) {
      throw new Error(`Failed to fetch skills dependencies: ${error.message}`);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reporter = {
          onNodeStart: (nodeId: string) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "node_start", node: nodeId })}\n\n`,
              ),
            );
          },
          onNodeEnd: (nodeId: string, stateUpdates: any) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "node_end", node: nodeId, stateUpdates })}\n\n`,
              ),
            );
          },
          onEdgeTraversal: (
            sourceId: string,
            targetId: string,
            condition?: string,
            reasoning?: string,
          ) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "edge_traversal",
                  source: sourceId,
                  target: targetId,
                  condition,
                  reasoning,
                })}\n\n`,
              ),
            );
          },
        };

        try {
          const result = await compileAndRunAgent(
            config,
            skills || [],
            input,
            reporter,
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "final", result })}\n\n`,
            ),
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
    console.error("Execution Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
