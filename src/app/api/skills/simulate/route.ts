import { NextResponse } from "next/server";
import { compileAndRunAgent } from "@/src/lib/runtime/manifest-compiler";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { config, input, thread_id, resume_value } = await req.json();

    if (!config) {
      return NextResponse.json(
        { error: "Missing Skill Configuration" },
        { status: 400 },
      );
    }

    if (process.env.LANGCHAIN_API_KEY) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
      process.env.LANGCHAIN_PROJECT = config.skill_id || "Agent_Studio_Project";
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // ACTION: Fetch both tools and mcp_servers concurrently
    const [toolsRes, serversRes] = await Promise.all([
      supabase.from("tools").select("*"), // Was "skills"
      supabase.from("mcp_servers").select("*"),
    ]);

    if (toolsRes.error) {
      throw new Error(
        `Failed to fetch tool dependencies: ${toolsRes.error.message}`,
      );
    }
    if (serversRes.error) {
      throw new Error(
        `Failed to fetch MCP server dependencies: ${serversRes.error.message}`,
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reporter = {
          onNodeStart: (nodeId: string, modelName?: string) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "node_start", node: nodeId, modelName })}\n\n`,
              ),
            );
          },
          onNodeEnd: (
            nodeId: string,
            stateUpdates: any,
            reasoning?: string,
            fullState?: any,
            modelName?: string,
          ) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "node_end", node: nodeId, stateUpdates, reasoning, fullState, modelName })}\n\n`,
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
                `data: ${JSON.stringify({ type: "edge_traversal", source: sourceId, target: targetId, condition, reasoning })}\n\n`,
              ),
            );
          },
          onToolStart: (toolName: string, args: Record<string, any>) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "tool_start", toolName, args })}\n\n`,
              ),
            );
          },
          onToolEnd: (toolName: string, result: any) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "tool_end", toolName, result })}\n\n`,
              ),
            );
          },
        };

        try {
          const result = await compileAndRunAgent(
            config,
            toolsRes.data || [],
            serversRes.data || [],
            input,
            reporter,
            thread_id,
            resume_value,
          );

          if (result.__interrupted__) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "interrupt", node: result.__active_node__, state: result })}\n\n`,
              ),
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "final", result })}\n\n`,
              ),
            );
          }
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
