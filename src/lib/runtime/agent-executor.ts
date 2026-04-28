import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { AgentConfig, SkillConfig } from "../types/constants";
import { executeAgentManifest } from "./skill-executor";
import { checkpointer, ensureDbSetup } from "../db/checkpointer";
import { mapSchemaToZod } from "../utils/schema-mapper";

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

  // FIX #2: Instantiate LLM exactly once and share it
  const sharedLlm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.2,
  });

  const buildToolsForAgent = (skillIds: string[]) => {
    return allSkills
      .filter((s) => skillIds.includes(s.id))
      .map((skill) => {
        const manifest = skill.compiled_manifest;
        const triggerNode = manifest?.graph_topology?.nodes?.find(
          (n: any) => n.type === "trigger",
        );
        const expectedPayload = triggerNode?.data?.expected_payload || {};

        return new DynamicStructuredTool({
          name: skill.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
          description: skill.description || `Execute the ${skill.id} workflow.`,
          // FIX #3: Shared Zod Schema Mapper
          schema: mapSchemaToZod(expectedPayload) as z.ZodObject<any, any>,
          func: async (input: Record<string, unknown>) => {
            if (reporter?.onSkillStart)
              reporter.onSkillStart(skill.name || skill.id, input);

            const uniqueExecutionId = crypto.randomUUID();

            const result = await executeAgentManifest(
              manifest,
              JSON.stringify(input),
              `${threadId}_${skill.id}_${uniqueExecutionId}`,
              undefined,
              {
                onNodeStart: (nodeName) =>
                  reporter?.onSkillNodeStart?.(
                    skill.name || skill.id,
                    nodeName,
                  ),
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

            if (reporter?.onSkillEnd)
              reporter.onSkillEnd(skill.name || skill.id, result);
            return JSON.stringify(result);
          },
        });
      });
  };

  const parentTools = buildToolsForAgent(agentConfig.skills || []);

  // FIX #4: Instantiate Sub-Agents OUTSIDE the tool callback execution path
  const subAgentInstances = assignedSubAgents.map((subAgent) => {
    const subTools = buildToolsForAgent(subAgent.skills || []);
    const subCustomPersona = subAgent.system_prompt?.trim()
      ? `\n--- AGENT ROLE & CUSTOM INSTRUCTIONS ---\n${subAgent.system_prompt}\n`
      : "";

    const compiledSubAgent = createDeepAgent({
      model: sharedLlm,
      tools: subTools,
      systemPrompt: `You are an autonomous sub-agent named "${subAgent.name}".\nDescription: ${subAgent.description}${subCustomPersona}`,
      checkpointer: checkpointer,
    });

    return { subAgentConfig: subAgent, compiledSubAgent };
  });

  const subAgentTools = subAgentInstances.map(
    ({ subAgentConfig, compiledSubAgent }) => {
      return new DynamicStructuredTool({
        name: subAgentConfig.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
        description: `Delegate a complex task to ${subAgentConfig.name}. Description: ${subAgentConfig.description}`,
        schema: z.object({
          request: z
            .string()
            .describe(
              "The detailed task, goal, or question to give to this sub-agent.",
            ),
        }),
        func: async (input: { request: string }) => {
          if (reporter?.onSkillStart)
            reporter.onSkillStart(subAgentConfig.name, input);

          const result = await compiledSubAgent.invoke(
            { messages: [["user", input.request]] },
            {
              configurable: {
                thread_id: `${threadId}_sub_${subAgentConfig.id}`,
              },
              callbacks: [], // Prevent bleeding streams to parent Orchestrator
            },
          );

          const finalMessage =
            result.messages[result.messages.length - 1].content;
          if (reporter?.onSkillEnd)
            reporter.onSkillEnd(subAgentConfig.name, {
              response: finalMessage,
            });

          return finalMessage as string;
        },
      });
    },
  );

  const allParentTools = [...parentTools, ...subAgentTools];

  const customPersona = agentConfig.system_prompt?.trim()
    ? `\n--- AGENT ROLE & CUSTOM INSTRUCTIONS ---\n${agentConfig.system_prompt}\n`
    : "";

  const systemMessage = `
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

  const agent = createDeepAgent({
    model: sharedLlm,
    tools: allParentTools,
    systemPrompt: systemMessage,
    checkpointer: checkpointer,
  });

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
