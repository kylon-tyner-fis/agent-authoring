import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents"; // NEW: Using Deep Agents SDK
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

// 1. Initialize Postgres Pool and Checkpointer for the Agent's deep memory
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
      zType = z.record(z.string(), z.any());
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
  console.log(
    `\n--- [DEBUG] EXECUTIVE DEEP AGENT RUN (Thread: ${threadId}) ---`,
  );

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

  const customPersona = agentConfig.system_prompt?.trim()
    ? `\n--- AGENT ROLE & CUSTOM INSTRUCTIONS ---\n${agentConfig.system_prompt}\n`
    : "";

  const systemMessage = `
    You are an autonomous executive AI agent named "${agentConfig.name}".
    Description: ${agentConfig.description}

    Do not attempt to respond to any user queries that do not directly relate to YOUR JOB or YOUR SKILLS.

    YOUR JOB:
    ${customPersona}
    
    You have access to specialized Skills (workflows). Your job is to reason about the user's request, determine which Skills need to be executed to accomplish the goal, and call them with the correct parameters. 
    
    CRITICAL RULES FOR GENERATION & MODIFICATION:
    1. YOU ARE A MANAGER, NOT A CREATOR. NEVER generate, draft, or modify complex artifacts (like quizzes, lesson plans, or documents) directly in your conversational text output.
    2. ALWAYS delegate the creation or modification of these items to the appropriate Skill.
    3. If a user asks to modify an existing artifact (e.g., "Add 2 more questions to this quiz", "Make this harder"), you MUST invoke the relevant Skill again, passing the existing artifact into the 'existing_quiz' (or equivalent) parameter and their request into the 'human_feedback' parameter.
    4. STRICT SUMMARIZATION: When summarizing the results of a Skill, you MUST ONLY reflect the exact data returned in the JSON payload. Do not add, hallucinate, or 'fill in' missing information. If the user asked for 2 items but the Skill only returned 1, simply explain that only 1 was generated based on the available source facts.
    
    If the task is complex, use your built-in planning tools to write a to-do list before executing the skills. Once you have all the information needed, summarize the final results for the user, but rely on the Skills to output the actual structured data.
  `;

  // 3. Create the Deep Agent WITH MEMORY
  // createDeepAgent wraps LangGraph, providing built-in planning and subagent features
  const agent = createDeepAgent({
    model: llm,
    tools: agentTools,
    systemPrompt: systemMessage,
    checkpointer: checkpointer, // Persists long-term memory across sessions
  });

  // 4. Execute and Stream Events
  // Since Deep Agents run on LangGraph, streamEvents works exactly the same way!
  const stream = await agent.streamEvents(
    { messages: [["user", userInput]] },
    { version: "v2", configurable: { thread_id: threadId } },
  );

  for await (const event of stream) {
    // We listen to chat model stream chunks just like before
    if (event.event === "on_chat_model_stream" && event.data.chunk?.content) {
      if (reporter?.onMessageChunk) {
        reporter.onMessageChunk(event.data.chunk.content);
      }
    }
  }

  console.log("--- [DEBUG] EXECUTIVE DEEP AGENT RUN COMPLETE ---\n");
  return { success: true };
}
