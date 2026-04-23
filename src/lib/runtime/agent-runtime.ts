import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { AgentConfig, SkillConfig } from "../types/constants";
import { executeAgentManifest } from "./manifest-executor";

export interface AgentExecutionReporter {
  onMessageChunk?: (chunk: string) => void;
  onSkillStart?: (skillName: string, args: Record<string, any>) => void;
  onSkillEnd?: (skillName: string, result: any) => void;
}

// 1. Initialize Postgres Pool and Checkpointer for the Agent's memory
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
const checkpointer = new PostgresSaver(pool);

let isDbSetup = false;
async function ensureDbSetup() {
  if (!isDbSetup) {
    await checkpointer.setup();
    isDbSetup = true;
  }
}

// Utility to convert our custom schema hints into Zod schemas for the LLM
function mapSchemaToZod(customSchema: Record<string, any>) {
  const shape: any = {};
  for (const [key, typeHint] of Object.entries(customSchema)) {
    const isOptional = String(typeHint).endsWith("?");
    const cleanType = String(typeHint).replace("?", "").toLowerCase();

    let zType;
    if (cleanType === "number") zType = z.number();
    else if (cleanType === "boolean") zType = z.boolean();
    else if (cleanType.includes("array")) zType = z.array(z.any());
    else if (cleanType === "object" || cleanType === "dict")
      zType = z.record(z.any());
    else zType = z.string();

    shape[key] = isOptional ? zType.optional() : zType;
  }
  return z.object(shape);
}

export async function runExecutiveAgent(
  agentConfig: AgentConfig,
  assignedSkills: SkillConfig[],
  userInput: string,
  threadId: string,
  reporter?: AgentExecutionReporter,
) {
  console.log(`\n--- [DEBUG] EXECUTIVE AGENT RUN (Thread: ${threadId}) ---`);

  // Ensure the database is ready for memory storage
  await ensureDbSetup();

  // 2. Convert assigned Skills into standard tools the Executive LLM can call
  const agentTools = assignedSkills.map((skill) => {
    const manifest = skill.compiled_manifest;
    const triggerNode = manifest?.graph_topology?.nodes?.find(
      (n: any) => n.type === "trigger",
    );
    const expectedPayload = triggerNode?.data?.expected_payload || {};

    return new DynamicStructuredTool({
      // OpenAI requires alphanumeric/underscores for tool names
      name: skill.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
      description: skill.description || `Execute the ${skill.id} workflow.`,
      schema: mapSchemaToZod(expectedPayload),
      func: async (input) => {
        if (reporter?.onSkillStart) reporter.onSkillStart(skill.id, input);

        // Execute the underlying compiled graph for the Skill
        // We append the skill ID to the thread ID so the skill has its own sub-memory thread
        const result = await executeAgentManifest(
          manifest,
          JSON.stringify(input),
          `${threadId}_${skill.id}`,
        );

        if (reporter?.onSkillEnd) reporter.onSkillEnd(skill.id, result);
        return JSON.stringify(result);
      },
    });
  });

  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.2, // Low temperature for reliable routing
  });

  const systemMessage = `
    You are an autonomous executive AI agent named "${agentConfig.name}".
    Description: ${agentConfig.description}
    
    You have access to specialized Skills (workflows). Your job is to reason about the user's request, determine which Skills need to be executed to accomplish the goal, and call them with the correct parameters. 
    
    If multiple steps are required, call the necessary skills in order. Once you have all the information needed, summarize the final results for the user.
  `;

  // 3. Create the ReAct Supervisor WITH MEMORY
  const agent = createReactAgent({
    llm,
    tools: agentTools,
    messageModifier: systemMessage,
    checkpointSaver: checkpointer, // <-- THIS IS THE FIX: The agent now remembers the conversation
  });

  // 4. Execute and Stream Events
  // LangGraph automatically appends the new message to the history loaded from the checkpointer
  const stream = await agent.streamEvents(
    { messages: [["user", userInput]] },
    { version: "v2", configurable: { thread_id: threadId } },
  );

  for await (const event of stream) {
    if (event.event === "on_chat_model_stream" && event.data.chunk?.content) {
      if (reporter?.onMessageChunk) {
        reporter.onMessageChunk(event.data.chunk.content);
      }
    }
  }

  console.log("--- [DEBUG] EXECUTIVE AGENT RUN COMPLETE ---\n");
  return { success: true };
}
