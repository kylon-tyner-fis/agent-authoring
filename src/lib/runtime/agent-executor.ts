import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { AgentConfig, SkillConfig } from "../types/constants";
import { executeAgentManifest } from "./skill-executor";
import { checkpointer, ensureDbSetup } from "../db/checkpointer";
import { mapSchemaToZod } from "../utils/schema-mapper";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { ManifestNode } from "./types";

/**
 * Generates a safe, alphanumeric tool name for LangChain compatibility.
 * Appends a short hash to prevent naming collisions between similarly named tools.
 */
const generateSafeToolName = (name: string, id: string) => {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const shortHash = id.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6);
  return `${safeName}_${shortHash}`;
};

export interface AgentExecutionReporter {
  onMessageChunk?: (chunk: string) => void;
  onSkillStart?: (skillName: string, args: Record<string, unknown>) => void;
  onSkillEnd?: (skillName: string, result: unknown) => void;
  onSkillNodeStart?: (skillName: string, nodeName: string) => void;
  onSkillNodeEnd?: (
    skillName: string,
    nodeName: string,
    stateUpdates: Record<string, unknown>,
    reasoning?: string,
    fullState?: Record<string, unknown>,
  ) => void;
  onSkillEdgeTraversal?: (
    skillName: string,
    sourceName: string,
    targetName: string,
    condition?: string,
    reasoning?: string,
  ) => void;
  onSkillToolStart?: (
    skillName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => void;
  onSkillToolEnd?: (
    skillName: string,
    toolName: string,
    result: unknown,
  ) => void;
}

/**
 * Custom LangChain callback handler to pipe a sub-agent's internal
 * LLM streaming tokens up to the parent agent's reporter.
 */
class SubAgentReporter extends BaseCallbackHandler {
  name = "SubAgentReporter";

  constructor(private reporter?: AgentExecutionReporter) {
    super();
  }

  handleLLMNewToken(token: string) {
    if (this.reporter?.onMessageChunk) {
      this.reporter.onMessageChunk(token);
    }
  }
}

/**
 * Factory to build LangChain DynamicStructuredTools out of standard SkillConfigs.
 * Wraps the skill-executor manifest execution in a tool interface the agent can call.
 */
function buildSkillTools(
  skillIds: string[],
  allSkills: SkillConfig[],
  threadId: string,
  reporter?: AgentExecutionReporter,
): DynamicStructuredTool[] {
  return allSkills
    .filter((s) => skillIds.includes(s.id))
    .map((skill) => {
      const manifest = skill.compiled_manifest;
      const triggerNode = manifest?.graph_topology?.nodes?.find(
        (n: ManifestNode) => n.type === "trigger",
      );
      const expectedPayload =
        (triggerNode?.data?.expected_payload as Record<string, string>) || {};

      return new DynamicStructuredTool({
        name: generateSafeToolName(skill.name || "Skill", skill.id),
        description: skill.description || `Execute the ${skill.id} workflow.`,
        schema: mapSchemaToZod(expectedPayload) as z.ZodObject,
        func: async (input: Record<string, unknown>) => {
          if (reporter?.onSkillStart) {
            reporter.onSkillStart(skill.name || skill.id, input);
          }

          const uniqueExecutionId = crypto.randomUUID();

          // Delegate to the graph executor, piping state updates to the parent reporter
          const result = await executeAgentManifest(
            manifest,
            JSON.stringify(input),
            `${threadId}_${skill.id}_${uniqueExecutionId}`,
            undefined,
            {
              onNodeStart: (nodeName) =>
                reporter?.onSkillNodeStart?.(skill.name || skill.id, nodeName),
              onNodeEnd: (nodeName, updates, reasoning, fullState) =>
                reporter?.onSkillNodeEnd?.(
                  skill.name || skill.id,
                  nodeName,
                  updates,
                  reasoning,
                  fullState,
                ),
              onEdgeTraversal: (src, tgt, cond, reason) =>
                reporter?.onSkillEdgeTraversal?.(
                  skill.name || skill.id,
                  src,
                  tgt,
                  cond,
                  reason,
                ),
              onToolStart: (toolName, args) =>
                reporter?.onSkillToolStart?.(
                  skill.name || skill.id,
                  toolName,
                  args,
                ),
              onToolEnd: (toolName, res) =>
                reporter?.onSkillToolEnd?.(
                  skill.name || skill.id,
                  toolName,
                  res,
                ),
            },
          );

          if (reporter?.onSkillEnd) {
            reporter.onSkillEnd(skill.name || skill.id, result);
          }
          return JSON.stringify(result);
        },
      });
    });
}

/**
 * Factory to compile sub-agents and wrap them in LangChain tools so the parent
 * agent can delegate complex reasoning tasks to them dynamically.
 */
function buildSubAgentTools(
  assignedSubAgents: AgentConfig[],
  allSkills: SkillConfig[],
  sharedLlm: ChatOpenAI,
  threadId: string,
  reporter?: AgentExecutionReporter,
): DynamicStructuredTool[] {
  return assignedSubAgents.map((subAgentConfig) => {
    const subTools = buildSkillTools(
      subAgentConfig.skills || [],
      allSkills,
      threadId,
      reporter,
    );

    const subCustomPersona = subAgentConfig.system_prompt?.trim()
      ? `\n--- AGENT ROLE & CUSTOM INSTRUCTIONS ---\n${subAgentConfig.system_prompt}\n`
      : "";

    // NEW: Extract the names of the skills assigned to this sub-agent
    const assignedSkillNames = allSkills
      .filter((s) => (subAgentConfig.skills || []).includes(s.id))
      .map((s) => s.name)
      .join(", ");

    // NEW: Inject those capabilities into the tool description
    const enhancedDescription = assignedSkillNames
      ? `Delegate a complex task to ${subAgentConfig.name}. Description: ${subAgentConfig.description} It has access to the following skills/tools: [${assignedSkillNames}].`
      : `Delegate a complex task to ${subAgentConfig.name}. Description: ${subAgentConfig.description}`;

    const compiledSubAgent = createDeepAgent({
      model: sharedLlm,
      tools: subTools,
      systemPrompt: `You are an autonomous sub-agent named "${subAgentConfig.name}".\nDescription: ${subAgentConfig.description}${subCustomPersona}`,
      checkpointer: checkpointer,
    });

    return new DynamicStructuredTool({
      name: generateSafeToolName(
        subAgentConfig.name || "Agent",
        subAgentConfig.id,
      ),
      description: enhancedDescription, // <-- Use enhanced description here
      schema: z.object({
        request: z
          .string()
          .describe(
            "The detailed task, goal, or question to give to this sub-agent.",
          ),
      }),
      func: async (input: { request: string }) => {
        if (reporter?.onSkillStart) {
          reporter.onSkillStart(subAgentConfig.name, input);
        }
        if (reporter?.onMessageChunk) {
          reporter.onMessageChunk(
            `\n\n*(Delegating to ${subAgentConfig.name}...)*\n\n`,
          );
        }

        const result = await compiledSubAgent.invoke(
          { messages: [["user", input.request]] },
          {
            configurable: {
              thread_id: `${threadId}_sub_${subAgentConfig.id}`,
            },
            callbacks: [new SubAgentReporter(reporter)], // Proxy the stream
          },
        );

        const finalMessage =
          result.messages[result.messages.length - 1].content;

        if (reporter?.onSkillEnd) {
          reporter.onSkillEnd(subAgentConfig.name, { response: finalMessage });
        }

        return finalMessage as string;
      },
    });
  });
}

/**
 * Formats the strict system instructions governing the Executive Agent's behavior.
 */
function generateSystemPrompt(agentConfig: AgentConfig): string {
  const customPersona = agentConfig.system_prompt?.trim()
    ? `\n--- AGENT ROLE & CUSTOM INSTRUCTIONS ---\n${agentConfig.system_prompt}\n`
    : "";

  return `
    You are an autonomous executive AI agent named "${agentConfig.name}".
    Description: ${agentConfig.description}
    ${customPersona}
    
    You have access to specialized Skills (workflows) and Sub-Agents. Your job is to reason about the user's request, determine which resources need to be executed to accomplish the goal, and call them with the correct parameters. 
    
    CRITICAL RULES FOR GENERATION & MODIFICATION:
    1. YOU ARE A MANAGER, NOT A CREATOR. NEVER generate, draft, or modify complex artifacts (like quizzes, lesson plans, or documents) directly in your conversational text output.
    2. ALWAYS delegate the creation or modification of these items to the appropriate Skill or Sub-Agent.
    3. If a user asks to modify an existing artifact (e.g., "Add 2 more questions to this quiz", "Make this harder"), you MUST invoke the relevant Skill again, passing the existing artifact into the 'existing_quiz' (or equivalent) parameter and their request into the 'human_feedback' parameter.
    4. STRICT SUMMARIZATION: When summarizing the results of a Skill, you MUST ONLY reflect the exact data returned in the JSON payload. Do not add, hallucinate, or 'fill in' missing information.
    
    If the task is complex, use your built-in planning tools to write a to-do list before executing the skills. Once you have all the information needed, summarize the final results for the user, but rely on the Skills to output the actual structured data.
  `;
}

/**
 * Main entry point for executing the top-level Orchestrator Agent.
 */
export async function runExecutiveAgent(
  agentConfig: AgentConfig,
  allSkills: SkillConfig[],
  assignedSubAgents: AgentConfig[],
  userInput: string,
  threadId: string,
  reporter?: AgentExecutionReporter,
) {
  console.log(
    `\n--- [DEBUG] EXECUTIVE DEEP AGENT RUN (Thread: ${threadId}) ---`,
  );

  await ensureDbSetup();

  // Instantiate LLM exactly once to be shared across the parent and all sub-agents
  const sharedLlm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.2,
  });

  // 1. Build tool wrappers for directly assigned Skills
  const parentTools = buildSkillTools(
    agentConfig.skills || [],
    allSkills,
    threadId,
    reporter,
  );

  // 2. Build tool wrappers for assigned Sub-Agents
  const subAgentTools = buildSubAgentTools(
    assignedSubAgents,
    allSkills,
    sharedLlm,
    threadId,
    reporter,
  );

  // 3. Compile the Executive Agent
  const agent = createDeepAgent({
    model: sharedLlm,
    tools: [...parentTools, ...subAgentTools],
    systemPrompt: generateSystemPrompt(agentConfig),
    checkpointer: checkpointer,
  });

  // 4. Execute and stream events back to the client
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

  console.log("--- [DEBUG] EXECUTIVE DEEP AGENT RUN COMPLETE ---\n");
  return { success: true };
}
