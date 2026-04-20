// lib/compiler.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, ToolMessage } from "@langchain/core/messages"; // IMPORTED CORE MESSAGES
import { AgentConfig, SkillConfig, MCPServerConfig } from "./constants";
import { McpClient } from "./mcp-client"; // IMPORTED MCP CLIENT
import { Pool } from "pg";

// ACTION A2: Extend ExecutionReporter
export interface ExecutionReporter {
  onNodeStart?: (nodeId: string) => void;
  onNodeEnd?: (
    nodeId: string,
    stateUpdates: any,
    reasoning?: string,
    fullState?: any,
  ) => void;
  onEdgeTraversal?: (
    sourceId: string,
    targetId: string,
    condition?: string,
    reasoning?: string,
  ) => void;
  onToolStart?: (toolName: string, args: Record<string, any>) => void;
  onToolEnd?: (toolName: string, result: any) => void;
}

// 1. Initialize Postgres Pool and Checkpointer
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

// ACTION B1: Update signature to accept servers
export async function compileAndRunAgent(
  config: AgentConfig,
  skills: SkillConfig[],
  servers: MCPServerConfig[],
  userInput: string,
  reporter?: ExecutionReporter,
  threadId: string = "default-thread",
  resumeValue?: any,
) {
  console.log(`\n--- [DEBUG] AGENT EXECUTION (Thread: ${threadId}) ---`);
  await ensureDbSetup();

  const nodes = config.orchestration?.nodes || [];
  const edges = config.orchestration?.edges || [];

  const triggerNodes = nodes.filter((n: any) => n.type === "trigger");
  const responseNodes = nodes.filter((n: any) => n.type === "response");

  if (triggerNodes.length === 0 || responseNodes.length === 0) {
    throw new Error(
      "Graph must have at least one Trigger node and one Response node.",
    );
  }

  const triggerNode = triggerNodes[0];

  const globalPersona = config.system_prompt?.trim()
    ? `\n--- GLOBAL AGENT INSTRUCTIONS ---\n${config.system_prompt}\n`
    : "";

  if (reporter?.onNodeStart && !resumeValue)
    reporter.onNodeStart(triggerNode.id);

  // 1. SMART INPUT EXTRACTION
  let parsedInput: any = {};
  try {
    parsedInput = JSON.parse(userInput);
  } catch (e) {
    if (process.env.OPENAI_API_KEY && !resumeValue && userInput) {
      try {
        const extractionLlm = new ChatOpenAI({
          modelName: config.model.model_name || "gpt-4o-mini",
          temperature: 0,
          modelKwargs: { response_format: { type: "json_object" } },
        });

        const schemaString = JSON.stringify(
          triggerNode.data.expected_payload || {},
        );

        const triggerInstructions = triggerNode.data.custom_instructions?.trim()
          ? `\n--- TRIGGER-SPECIFIC INSTRUCTIONS ---\n${triggerNode.data.custom_instructions}\n`
          : "";

        const extractionPrompt = PromptTemplate.fromTemplate(`
          {__persona__}{__trigger_instructions__}
          You are an API payload extractor. Extract the user's intent into the following JSON schema: {__schema__}
          
          User Input: {__input__}
          
          Return ONLY valid JSON. If a field is not explicitly mentioned but can be logically inferred, do so. Otherwise, leave it null.
        `);

        const formatted = await extractionPrompt.format({
          __persona__: globalPersona,
          __trigger_instructions__: triggerInstructions,
          __schema__: schemaString,
          __input__: userInput,
        });

        const response = await extractionLlm.invoke(formatted);
        let cleanStr = response.content.toString().trim();
        if (cleanStr.startsWith("```json")) {
          cleanStr = cleanStr
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        }

        parsedInput = JSON.parse(cleanStr);
      } catch (extError) {
        const expectedKeys = Object.keys(
          triggerNode.data.expected_payload || {},
        );
        if (expectedKeys.length > 0)
          parsedInput = { [expectedKeys[0]]: userInput };
      }
    } else {
      const expectedKeys = Object.keys(triggerNode.data.expected_payload || {});
      if (expectedKeys.length > 0)
        parsedInput = { [expectedKeys[0]]: userInput };
    }
  }

  // 2. PRE-FLIGHT VALIDATION: Check for Missing Required Fields
  const expectedPayload = triggerNode.data.expected_payload || {};
  const missingKeys: string[] = [];

  if (!resumeValue) {
    for (const [key, typeHint] of Object.entries(expectedPayload)) {
      const isOptional = String(typeHint).endsWith("?");
      const val = parsedInput[key];
      if (!isOptional && (val === undefined || val === null || val === "")) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      const errMsg = `Missing required input fields: ${missingKeys.join(", ")}`;
      console.log(`[DEBUG] Validation Failed: ${errMsg}`);

      const errorPayload = { error: errMsg };
      if (reporter?.onNodeEnd)
        reporter.onNodeEnd(
          triggerNode.id,
          errorPayload,
          `Validation failed. The user input was missing required fields defined in the Trigger schema.`,
          { ...parsedInput, ...errorPayload },
        );

      return {
        extracted_data: errorPayload,
        __error__: errMsg,
        ...parsedInput,
      };
    }
  }

  // 3. INITIALIZE STATE
  const initialState: Record<string, any> = {};
  const initMap = triggerNode.data.initialization_mapping || {};

  for (const payloadKey of Object.keys(expectedPayload)) {
    const stateKey = initMap[payloadKey] || payloadKey;
    if (parsedInput[payloadKey] !== undefined) {
      initialState[stateKey] = parsedInput[payloadKey];
    }
  }

  if (reporter?.onNodeEnd && !resumeValue) {
    reporter.onNodeEnd(
      triggerNode.id,
      initialState,
      `Successfully extracted user input and mapped it to the initial graph state.`,
      initialState,
    );
  }

  // 4. DEFINE STATEGRAPH CHANNELS
  const channels: Record<string, any> = {
    __final_payload__: {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    },
    __error__: {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    },
    __human_feedback__: {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    },
  };

  Object.keys(config.state_schema || {}).forEach((key) => {
    channels[key] = {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    };
  });

  Object.keys(initialState).forEach((key) => {
    if (!channels[key]) {
      channels[key] = {
        value: (prev: any, next: any) => (next !== undefined ? next : prev),
        default: () => null,
      };
    }
  });

  const workflow = new StateGraph<any>({ channels });
  const skillNodes = nodes.filter((n: any) => n.type === "skill");
  const interruptNodes = nodes.filter((n: any) => n.type === "interrupt");

  // 5. ADD SKILL NODES (With Tool Binding & Execution Loop)
  for (const node of skillNodes) {
    const skill = skills.find((s) => s.id === node.data.skillId);
    if (!skill) continue;

    workflow.addNode(node.id, async (state: any) => {
      if (state.__error__) return {};

      if (reporter?.onNodeStart) reporter.onNodeStart(node.id);

      const localInputs: Record<string, any> = {};
      const inMap = node.data.input_mapping || {};
      for (const localKey of Object.keys(skill.input_schema || {})) {
        const globalKey = inMap[localKey] || localKey;
        localInputs[localKey] =
          state[globalKey] !== undefined ? state[globalKey] : "";
      }

      let outputData: Record<string, any> = {};
      const stateUpdates: Record<string, any> = {};

      if (process.env.OPENAI_API_KEY) {
        try {
          const llm = new ChatOpenAI({
            modelName: config.model.model_name || "gpt-4o-mini",
            temperature: config.model.temperature || 0.7,
            modelKwargs: { response_format: { type: "json_object" } },
          });

          // ACTION B3: Aggregate McpClients
          const mcpDependencies = skill.mcp_dependencies || [];
          const requiredServers = servers.filter((s) =>
            mcpDependencies.includes(s.id),
          );
          const mcpClients = requiredServers.map((s) => new McpClient(s));

          // ACTION B4: Fetch and map tools
          const openAiTools: any[] = [];
          const toolNameToClient = new Map<string, McpClient>();

          for (const client of mcpClients) {
            try {
              const { tools } = await client.listTools();
              for (const tool of tools) {
                openAiTools.push({
                  type: "function",
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                  },
                });
                toolNameToClient.set(tool.name, client);
              }
            } catch (err) {
              console.error(`[DEBUG] Failed to list tools for server`, err);
            }
          }

          // Bind tools to the model if any exist
          const modelWithTools =
            openAiTools.length > 0 ? llm.bindTools(openAiTools) : llm;

          const schemaString = JSON.stringify(skill.output_schema || {});
          const inputsString = JSON.stringify(localInputs, null, 2);

          const nodeInstructions = node.data.custom_instructions?.trim()
            ? `\n--- STEP-SPECIFIC INSTRUCTIONS ---\n${node.data.custom_instructions}\n`
            : "";

          const systemInstruction = `\n\n{__persona__}{__node_instructions__}\n--- SYSTEM INSTRUCTIONS ---\n1. Task Inputs:\n{__inputsString__}\n\n2. If you have tools available, use them to gather required information.\n3. Return your final response as a valid JSON object matching this exact schema: {__schema__}. Return ONLY raw JSON.`;

          const prompt = PromptTemplate.fromTemplate(
            skill.prompt_template + systemInstruction,
          );
          const formatted = await prompt.format({
            ...localInputs,
            __persona__: globalPersona,
            __node_instructions__: nodeInstructions,
            __schema__: schemaString,
            __inputsString__: inputsString,
          });

          // ACTION B5: The Multi-turn Execution Loop
          const messages: any[] = [new HumanMessage(formatted)];
          let maxTurns = 5;

          while (maxTurns > 0) {
            maxTurns--;
            const response = await modelWithTools.invoke(messages);
            messages.push(response);

            // If the model decides to call a tool
            if (response.tool_calls && response.tool_calls.length > 0) {
              for (const toolCall of response.tool_calls) {
                // ACTION B6: Fire start event
                if (reporter?.onToolStart)
                  reporter.onToolStart(toolCall.name, toolCall.args);

                const client = toolNameToClient.get(toolCall.name);
                let rawResult = null;
                let toolResultStr = "";

                if (client) {
                  try {
                    rawResult = await client.callTool(
                      toolCall.name,
                      toolCall.args,
                    );
                    toolResultStr =
                      typeof rawResult === "string"
                        ? rawResult
                        : JSON.stringify(rawResult);
                  } catch (err: any) {
                    toolResultStr = `Error calling tool: ${err.message}`;
                  }
                } else {
                  toolResultStr = `Error: Tool ${toolCall.name} not found on attached servers.`;
                }

                // ACTION B6: Fire end event
                if (reporter?.onToolEnd)
                  reporter.onToolEnd(toolCall.name, rawResult || toolResultStr);

                // Push tool result back to the LLM
                messages.push(
                  new ToolMessage({
                    content: toolResultStr,
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
                  }),
                );
              }
            } else {
              // Final answer generation
              try {
                let cleanStr = response.content.toString().trim();
                if (cleanStr.startsWith("```json"))
                  cleanStr = cleanStr
                    .replace(/^```json/, "")
                    .replace(/```$/, "")
                    .trim();

                const parsedResponse = JSON.parse(cleanStr);
                for (const key of Object.keys(skill.output_schema || {})) {
                  outputData[key] = parsedResponse[key];
                }
              } catch (parseErr) {
                stateUpdates["__error__"] =
                  `Skill '${skill.name}' failed to generate a valid JSON structure.`;
              }
              break;
            }
          }

          if (maxTurns === 0) {
            stateUpdates["__error__"] =
              `Skill '${skill.name}' exceeded maximum tool iterations.`;
          }
        } catch (e: any) {
          stateUpdates["__error__"] =
            `Skill '${skill.name}' encountered an execution error: ${e.message}`;
        }
      }

      const outMap = node.data.output_mapping || {};
      for (const localKey of Object.keys(outputData)) {
        const globalKey = outMap[localKey] || localKey;
        stateUpdates[globalKey] = outputData[localKey];
      }

      if (reporter?.onNodeEnd)
        reporter.onNodeEnd(node.id, stateUpdates, undefined, {
          ...state,
          ...stateUpdates,
        });

      if (!stateUpdates.__error__) {
        const outgoingEdges = edges.filter((e: any) => e.source === node.id);
        if (
          outgoingEdges.length === 1 &&
          !outgoingEdges[0].data?.label?.trim()
        ) {
          if (reporter?.onEdgeTraversal)
            reporter.onEdgeTraversal(node.id, outgoingEdges[0].target);
        }
      }

      return stateUpdates;
    });
  }

  // 6. ADD INTERRUPT NODES
  for (const intNode of interruptNodes) {
    workflow.addNode(intNode.id, async (state: any) => {
      if (state.__error__) return {};
      if (reporter?.onNodeStart) reporter.onNodeStart(intNode.id);

      const feedback = state.__human_feedback__ || "";
      const stateUpdates: Record<string, any> = {};

      const outMap = intNode.data.output_mapping || {};
      if (outMap["human_input"]) {
        stateUpdates[outMap["human_input"]] = feedback;
      }

      if (reporter?.onNodeEnd) {
        reporter.onNodeEnd(
          intNode.id,
          { __human_feedback__: feedback, ...stateUpdates },
          `Human responded with: ${feedback}`,
          { ...state, __human_feedback__: feedback, ...stateUpdates },
        );
      }

      const outgoingEdges = edges.filter((e: any) => e.source === intNode.id);
      if (outgoingEdges.length === 1 && !outgoingEdges[0].data?.label?.trim()) {
        if (reporter?.onEdgeTraversal) {
          reporter.onEdgeTraversal(intNode.id, outgoingEdges[0].target);
        }
      }

      return stateUpdates;
    });
  }

  // 7. ADD RESPONSE NODES
  for (const resNode of responseNodes) {
    workflow.addNode(resNode.id, async (state: any) => {
      if (reporter?.onNodeStart) reporter.onNodeStart(resNode.id);

      const responsePayload: Record<string, any> = {};
      const extMap = resNode.data.extraction_mapping || {};
      const expectedOutputKeys = Object.keys(
        resNode.data.response_payload || {},
      );

      for (const payloadKey of expectedOutputKeys) {
        const stateKey = extMap[payloadKey] || payloadKey;
        responsePayload[payloadKey] =
          state[stateKey] !== undefined ? state[stateKey] : null;
      }

      if (expectedOutputKeys.length === 0) {
        const { __final_payload__, __error__, ...rest } = state;
        Object.assign(responsePayload, rest);
      }

      let finalResponsePayload = responsePayload;
      let reasoningStr = `Graph execution finished. Extracted the final payload from the state to return to the user.`;

      const responseInstructions = resNode.data.custom_instructions?.trim();
      if (responseInstructions && process.env.OPENAI_API_KEY) {
        try {
          const llm = new ChatOpenAI({
            modelName: config.model.model_name || "gpt-4o-mini",
            temperature: config.model.temperature || 0.7,
            modelKwargs: { response_format: { type: "json_object" } },
          });

          const schemaString = JSON.stringify(
            expectedOutputKeys.length > 0
              ? resNode.data.response_payload
              : { final_output: "any" },
          );

          const prompt = PromptTemplate.fromTemplate(`
            {__persona__}
            --- NODE-SPECIFIC INSTRUCTIONS ---
            {__response_instructions__}

            --- SYSTEM INSTRUCTIONS ---
            You are the final response formatter for an AI workflow.
            Take the raw extracted data below and format, summarize, or modify it exactly according to the node-specific instructions above.

            Raw Extracted Data:
            {__raw_data__}

            Return ONLY a valid JSON object matching this exact schema: {__schema__}
          `);

          const formatted = await prompt.format({
            __persona__: globalPersona,
            __response_instructions__: responseInstructions,
            __raw_data__: JSON.stringify(responsePayload),
            __schema__: schemaString,
          });

          const response = await llm.invoke(formatted);
          let cleanStr = response.content.toString().trim();
          if (cleanStr.startsWith("```json"))
            cleanStr = cleanStr
              .replace(/^```json/, "")
              .replace(/```$/, "")
              .trim();

          finalResponsePayload = JSON.parse(cleanStr);
          reasoningStr = `Graph execution finished. Formatted the final payload using the node-specific instructions provided.`;
        } catch (err) {
          console.error("[DEBUG] Response formatter LLM failed:", err);
          reasoningStr = `Graph execution finished, but the response formatting LLM failed. Returning raw mapped payload instead.`;
        }
      }

      if (reporter?.onNodeEnd) {
        reporter.onNodeEnd(resNode.id, finalResponsePayload, reasoningStr, {
          ...state,
          __final_payload__: finalResponsePayload,
        });
      }

      return { __final_payload__: finalResponsePayload };
    });

    workflow.addEdge(resNode.id, END);
  }

  // 8. ADVANCED EDGE ROUTING
  const edgesBySource: Record<string, any[]> = {};
  for (const edge of edges) {
    const sourceNode = nodes.find((n: any) => n.id === edge.source);
    if (!sourceNode) continue;

    const actualSource = sourceNode.type === "trigger" ? START : edge.source;

    if (!edgesBySource[actualSource]) edgesBySource[actualSource] = [];
    edgesBySource[actualSource].push(edge);
  }

  const triggerOutEdges = edgesBySource[START] || [];
  if (triggerOutEdges.length === 1 && !triggerOutEdges[0].data?.label?.trim()) {
    if (reporter?.onEdgeTraversal && !resumeValue)
      reporter.onEdgeTraversal(triggerNode.id, triggerOutEdges[0].target);
  }

  for (const [sourceId, outgoingEdges] of Object.entries(edgesBySource)) {
    const hasConditions = outgoingEdges.some((e: any) => e.data?.label?.trim());

    const possibleTargets = outgoingEdges.map((e: any) => e.target);
    possibleTargets.push(END);

    if (hasConditions) {
      workflow.addConditionalEdges(
        sourceId,
        async (state: any) => {
          if (state.__error__) return END;

          const expectedInputStateKeys = Object.keys(
            triggerNode.data.expected_payload || {},
          ).map(
            (payloadKey) =>
              triggerNode.data.initialization_mapping?.[payloadKey] ||
              payloadKey,
          );

          for (const edge of outgoingEdges) {
            const condition = edge.data?.label?.trim();
            const actualTarget = edge.target;

            if (!condition) {
              if (reporter?.onEdgeTraversal)
                reporter.onEdgeTraversal(
                  edge.source,
                  edge.target,
                  "Default Fallback",
                );
              return actualTarget;
            }

            if (process.env.OPENAI_API_KEY) {
              try {
                const llm = new ChatOpenAI({
                  modelName: config.model.model_name || "gpt-4o-mini",
                  temperature: 0,
                  modelKwargs: { response_format: { type: "json_object" } },
                });

                const prompt = PromptTemplate.fromTemplate(`
                {__persona__}
                You are a logic router for an AI agent. 
                Evaluate if the following condition is TRUE based on the current state.
                
                Current State:
                {__state__}
                
                Condition to evaluate:
                {__condition__}
                
                IMPORTANT CONTEXT FOR EVALUATION:
                - Expected Initial Inputs: {__expected_inputs__}
                If evaluating whether the user provided enough information, look STRICTLY at these Expected Initial Inputs. If any of these are null or empty, information is missing.
                - Downstream Outputs: Any other variables in the state are outputs to be computed later.
                - Human Feedback: The '__human_feedback__' field contains the user's recent input during an interrupt. This could be detailed feedback, instructions for rework, or answers to a prompt (like a quiz). Rely on this heavily to determine if the condition is met.
                
                Return a JSON object with exactly two keys:
                1. "reasoning" (string): Explanation of your logic.
                2. "is_true" (boolean): true if the condition is met, false otherwise.
              `);

                const formatted = await prompt.format({
                  __persona__: globalPersona,
                  __state__: JSON.stringify(state),
                  __condition__: condition,
                  __expected_inputs__: JSON.stringify(expectedInputStateKeys),
                });

                const response = await llm.invoke(formatted);
                let cleanStr = response.content.toString().trim();
                if (cleanStr.startsWith("```json"))
                  cleanStr = cleanStr
                    .replace(/^```json/, "")
                    .replace(/```$/, "")
                    .trim();

                const result = JSON.parse(cleanStr);

                if (result.is_true) {
                  if (reporter?.onEdgeTraversal)
                    reporter.onEdgeTraversal(
                      edge.source,
                      edge.target,
                      condition,
                      result.reasoning,
                    );
                  return actualTarget;
                }
              } catch (err) {
                console.error(`[DEBUG] Router failed:`, err);
              }
            } else {
              if (reporter?.onEdgeTraversal)
                reporter.onEdgeTraversal(edge.source, edge.target, condition);
              return actualTarget;
            }
          }
          return END;
        },
        possibleTargets,
      );
    } else {
      workflow.addConditionalEdges(
        sourceId,
        (state: any) => {
          if (state.__error__) return END;

          const targets = outgoingEdges.map((edge: any) => edge.target);
          return targets.length === 1 ? targets[0] : targets;
        },
        possibleTargets,
      );
    }
  }

  const hasStartEdge = edges.some((e: any) => {
    const src = nodes.find((n: any) => n.id === e.source);
    return src?.type === "trigger";
  });

  if (!hasStartEdge && skillNodes.length > 0) {
    workflow.addConditionalEdges(
      START,
      (state: any) => (state.__error__ ? END : skillNodes[0].id),
      [skillNodes[0].id, END],
    );
    if (responseNodes.length > 0) {
      workflow.addConditionalEdges(
        skillNodes[skillNodes.length - 1].id,
        (state: any) => (state.__error__ ? END : responseNodes[0].id),
        [responseNodes[0].id, END],
      );
    }
  }

  // 9. COMPILE WITH CHECKPOINTER & INTERRUPTS
  const app = workflow.compile({
    checkpointer,
    interruptBefore: interruptNodes.map((n: any) => n.id),
  });

  const executionConfig = { configurable: { thread_id: threadId } };

  // 10. RUN OR RESUME
  let finalState;

  if (resumeValue) {
    console.log(`[DEBUG] Resuming thread ${threadId} with value:`, resumeValue);
    await app.updateState(executionConfig, { __human_feedback__: resumeValue });

    finalState = await app.invoke(null, {
      ...executionConfig,
      resume: resumeValue,
    });
  } else {
    finalState = await app.invoke(initialState, executionConfig);
  }

  // 11. CHECK FOR INTERRUPT STATE
  const threadState = await app.getState(executionConfig);
  const isInterrupted = threadState.next && threadState.next.length > 0;

  if (isInterrupted) {
    console.log(
      `[DEBUG] Execution Interrupted at node: ${threadState.next[0]}`,
    );
    return {
      __interrupted__: true,
      __active_node__: threadState.next[0],
      ...threadState.values,
    };
  }

  // 12. HANDLE GENERIC ERROR OVERRIDE
  if (finalState.__error__) {
    const errorPayload = { error: finalState.__error__ };

    if (reporter?.onNodeStart) reporter.onNodeStart("System Error Handler");
    if (reporter?.onNodeEnd)
      reporter.onNodeEnd(
        "System Error Handler",
        errorPayload,
        `Graph execution was aborted early due to a system or skill error.`,
        { ...finalState, ...errorPayload },
      );

    console.log("--- [DEBUG] AGENT EXECUTION COMPLETE (WITH ERRORS) ---\n");
    return {
      extracted_data: errorPayload,
      ...finalState,
    };
  }

  console.log("--- [DEBUG] AGENT EXECUTION COMPLETE ---\n");

  return {
    extracted_data: finalState.__final_payload__ || {},
    ...finalState,
  };
}

export function generateManifest(
  config: AgentConfig,
  allSkills: SkillConfig[],
  allServers: MCPServerConfig[],
) {
  const nodes = config.orchestration?.nodes || [];
  const usedSkillIds = new Set<string>();

  nodes.forEach((n: any) => {
    if (n.type === "skill" && n.data?.skillId) {
      usedSkillIds.add(n.data.skillId);
    }
  });

  const resolvedSkills = allSkills
    .filter((skill) => usedSkillIds.has(skill.id))
    .reduce(
      (acc, skill) => {
        acc[skill.id] = {
          name: skill.name,
          prompt_template: skill.prompt_template,
          input_schema: skill.input_schema,
          output_schema: skill.output_schema,
          mcp_dependencies: skill.mcp_dependencies,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

  const requiredServerIds = new Set<string>(config.mcp_servers || []);
  allSkills.forEach((skill) => {
    if (usedSkillIds.has(skill.id) && skill.mcp_dependencies) {
      skill.mcp_dependencies.forEach((dep) => requiredServerIds.add(dep));
    }
  });

  const resolvedServers = allServers
    .filter((server) => requiredServerIds.has(server.id))
    .reduce(
      (acc, server) => {
        acc[server.id] = {
          name: server.name,
          url: server.url,
          auth_type: server.auth_type,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

  const manifest = {
    metadata: {
      agent_id: config.agent_id,
      version: config.version,
      description: config.description,
    },
    engine: {
      model: config.model,
      system_prompt: config.system_prompt,
      state_schema: config.state_schema,
    },
    engine_prompts: {
      trigger_extractor:
        "{__persona__}{__trigger_instructions__}\nYou are an API payload extractor. Extract the user's intent into the following JSON schema: {__schema__}\n\nUser Input: {__input__}\n\nReturn ONLY valid JSON. If a field is not explicitly mentioned but can be logically inferred, do so. Otherwise, leave it null.",

      skill_system_wrapper:
        "\n\n{__persona__}{__node_instructions__}\n--- SYSTEM INSTRUCTIONS ---\n1. Task Inputs:\n{__inputsString__}\n\n2. Return your response as a valid JSON object matching this exact schema: {__schema__}. Return ONLY raw JSON.",

      edge_router:
        '{__persona__}\nYou are a logic router for an AI agent. \nEvaluate if the following condition is TRUE based on the current state.\n\nCurrent State:\n{__state__}\n\nCondition to evaluate:\n{__condition__}\n\nIMPORTANT CONTEXT FOR EVALUATION:\n- Expected Initial Inputs: {__expected_inputs__}\nIf evaluating whether the user provided enough information, look STRICTLY at these Expected Initial Inputs. If any of these are null or empty, information is missing.\n- Downstream Outputs: Any other variables in the state are outputs to be computed later.\n- Human Feedback: The \'__human_feedback__\' field contains the user\'s recent input during an interrupt. This could be detailed feedback, instructions for rework, or answers to a prompt (like a quiz). Rely on this heavily to determine if the condition is met.\n\nReturn a JSON object with exactly two keys:\n1. "reasoning" (string): Explanation of your logic.\n2. "is_true" (boolean): true if the condition is met, false otherwise.',

      response_formatter:
        "{__persona__}\n--- NODE-SPECIFIC INSTRUCTIONS ---\n{__response_instructions__}\n\n--- SYSTEM INSTRUCTIONS ---\nYou are the final response formatter for an AI workflow.\nTake the raw extracted data below and format, summarize, or modify it exactly according to the node-specific instructions above.\n\nRaw Extracted Data:\n{__raw_data__}\n\nReturn ONLY a valid JSON object matching this exact schema: {__schema__}",
    },
    resolved_skills: resolvedSkills,
    resolved_mcp_servers: resolvedServers,
    graph_topology: {
      nodes: config.orchestration?.nodes || [],
      edges: config.orchestration?.edges || [],
    },
  };

  return manifest;
}
