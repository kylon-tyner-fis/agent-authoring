import { SkillConfig, ToolConfig, MCPServerConfig } from "../types/constants";
import { executeAgentManifest } from "./skill-executor";
import {
  CompiledManifest,
  ManifestEdge,
  ManifestExecutionReporter,
  ManifestNode,
} from "./types";

export interface ExecutionReporter extends ManifestExecutionReporter {}

export async function compileAndRunAgent(
  config: SkillConfig,
  tools: ToolConfig[],
  servers: MCPServerConfig[],
  userInput: string,
  reporter?: ExecutionReporter,
  threadId: string = "default-thread",
  resumeValue?: any,
) {
  console.log(`\n--- [DEBUG] AGENT EXECUTION (Thread: ${threadId}) ---`);

  // 1. Generate the unified manifest (Compiler Phase)
  const manifest: CompiledManifest = generateManifest(config, tools, servers);

  // 2. Delegate execution to the unified Manifest Executor
  const result = await executeAgentManifest(
    manifest,
    userInput,
    threadId,
    resumeValue,
    reporter,
  );

  // 3. Map the unified response back to the specific shapes expected by the API/Playground
  if (result.status === "interrupted") {
    console.log(`[DEBUG] Execution Interrupted at node: ${result.node}`);
    return {
      __interrupted__: true,
      __active_node__: result.node,
      ...result.state,
    };
  }

  // safely cast to check for the error property
  const finalResult = result.result as Record<string, any>;

  if (finalResult?.error) {
    console.log("--- [DEBUG] AGENT EXECUTION COMPLETE (WITH ERRORS) ---\n");
    return {
      extracted_data: { error: finalResult.error },
      __error__: finalResult.error,
    };
  }

  console.log("--- [DEBUG] AGENT EXECUTION COMPLETE ---\n");
  return {
    extracted_data: finalResult || {},
  };
}

export function generateManifest(
  config: SkillConfig,
  allTools: ToolConfig[],
  allServers: MCPServerConfig[],
): CompiledManifest {
  const nodes = config.orchestration?.nodes || [];
  const usedToolIds = new Set<string>();

  nodes.forEach((n: any) => {
    if (n.type === "tool" && n.data?.toolId) {
      usedToolIds.add(n.data.toolId);
    }
  });

  const resolvedTools = allTools
    .filter((tool) => usedToolIds.has(tool.id))
    .reduce(
      (acc, tool) => {
        acc[tool.id] = {
          name: tool.name,
          prompt_template: tool.prompt_template,
          input_schema: tool.input_schema,
          output_schema: tool.output_schema,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

  const resolvedServers = allServers
    .filter((server) => (config.mcp_servers || []).includes(server.id))
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

  const manifest: CompiledManifest = {
    metadata: {
      skill_id: config.id,
      version: config.version,
      description: config.description,
    },
    engine: {
      model: {
        model_name: config.model.model_name,
        temperature: config.model.temperature,
      },
      system_prompt: config.system_prompt,
      state_schema: config.state_schema,
    },
    engine_prompts: {
      trigger_extractor:
        "{__persona__}{__trigger_instructions__}\nExtract the user's intent based on their input.\n\nUser Input: {__input__}",

      skill_system_wrapper:
        "\n\n{__persona__}{__node_instructions__}\n--- SYSTEM INSTRUCTIONS ---\nTask Inputs:\n{__inputsString__}",

      edge_router:
        "{__persona__}\nYou are a logic router for an AI agent. \nEvaluate if the following condition is TRUE based on the current state.\n\nCurrent State:\n{__state__}\n\nCondition to evaluate:\n{__condition__}\n\nIMPORTANT CONTEXT FOR EVALUATION:\n- Expected Initial Inputs: {__expected_inputs__}\n- Human Feedback: Rely heavily on the '__human_feedback__' field if present to determine if the condition is met.",

      response_formatter:
        "{__persona__}\n--- NODE-SPECIFIC INSTRUCTIONS ---\n{__response_instructions__}\n\nRaw Extracted Data:\n{__raw_data__}",
    },
    resolved_skills: resolvedTools,
    resolved_mcp_servers: resolvedServers,
    graph_topology: {
      nodes: (config.orchestration?.nodes || []) as ManifestNode[],
      edges: (config.orchestration?.edges || []) as ManifestEdge[],
    },
  };

  return manifest;
}
