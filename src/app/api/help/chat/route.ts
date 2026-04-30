// src/app/api/help/chat/route.ts
import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";

const HELP_DOCS = `
AGENTIC TAXONOMY
- Orchestrator: Delegates incoming tasks to the most suitable agent. High-level coordination layer acting as a traffic controller.
- Agent: Plans and makes autonomous decisions. A runtime instance defined by a specific persona and configuration that delegates tasks to skills.
- Skill: Executes deterministic, step-by-step workflows. A pre-defined capability represented by a graph manifest of nodes and edges.
- Tool: Provides a standardized interface for agents to call capabilities. Uses a defined name and schema.
- MCP (Model Context Protocol): Connects the system to externally hosted capabilities securely mapping remote functions.

QUICK START
1. Building a Skill: Define State Schema -> Drop a Trigger node -> Drop Tool nodes and map inputs -> Drop a Response node -> Connect with edges.
2. Creating an Agent: Assign Skills -> Write System Prompt defining persona and rules -> Test in Sandbox.
3. Setting up an Orchestrator: Link multiple Agents under a single Orchestrator to act as the master traffic controller.

CANVAS & EDITOR
- Trigger (API Input): Initiates the graph. Uses Initialization Mapping.
- Response (API Output): Terminates the graph. Uses Extraction Mapping.
- Tool / MCP Nodes: Action nodes using Input Mapping (pulls from state) and Output Mapping (saves to state).
- Interrupt (Human-in-the-Loop): Pauses execution to wait for human feedback. Resumes using the __human_feedback__ channel.

STATE & SCHEMA MANAGEMENT
- Global State: The JSON schema defined in the "State Schema" tab acts as the memory for the entire graph.
- Data Flow: Input Mapping pulls data from Global State. Output Mapping saves data to Global State.
- Types & Arrays: Primitives overwrite. Objects merge. Arrays append.

PROMPT ENGINEERING
- Role Definition: Set clear boundaries, persona, and rules.
- Tool Delegation: Remind agents they are managers and should delegate complex tasks to Skills.
- Routing Logic: Write natural language conditions for edges (e.g., "priority == 'high'").

API & INTEGRATION
- Endpoints: POST to /api/skills/[id]/run, /api/agents/[id]/run, /api/orchestrators/[id]/run
- Payload: { "input": "...", "threadId": "..." }
- Streaming: Returns Server-Sent Events (SSE).

TROUBLESHOOTING
- Skill won't save: Every valid graph must contain exactly one Trigger node and at least one Response node connected properly.
- MCP Error/Offline: Ensure URL is reachable, API key/Bearer token is valid, and CORS/network bindings are configured.
- Infinite Loop: Update Agent's System Prompt to forbid repeating actions if they fail twice. Ensure Skill conditional edges have a fallback.

SHORTCUTS
- Delete: Backspace / Delete
- Copy/Paste: Ctrl/Cmd + C / V
- Undo: Ctrl/Cmd + Z
- Pan: Space + Drag
`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.4, // Increased slightly to allow for creative application of concepts
    });

    const systemPrompt =
      new SystemMessage(`You are a helpful, expert AI assistant for the Agent Studio application. 
Your job is to help users understand the platform and apply its concepts to their specific goals. 
Use the documentation context below as your source of truth for how the platform works. 

If a user asks how to build a specific use case (like an applied programming exercise, a research agent, etc.), DO NOT refuse to answer. Instead, infer how they could build it using Agent Studio's primitives (Triggers, Tools, Responses, Agents, Orchestrators, State Schema). Provide step-by-step guidance applying our taxonomy to their goal, suggesting what tools they might need and how to wire them up in the canvas.

Keep answers friendly, constructive, practical, and formatted in markdown.

--- DOCUMENTATION CONTEXT ---
${HELP_DOCS}
`);

    const formattedMessages = messages.map((m: any) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = await llm.stream([
            systemPrompt,
            ...formattedMessages,
          ]);
          for await (const chunk of llmStream) {
            if (chunk.content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: chunk.content })}\n\n`,
                ),
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`),
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
