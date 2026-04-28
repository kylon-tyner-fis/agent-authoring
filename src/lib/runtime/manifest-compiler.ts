import { SkillConfig, ToolConfig, MCPServerConfig } from "../types/constants";
import { executeAgentManifest } from "./skill-executor";
import {
  CompiledManifest,
  ManifestEdge,
  ManifestExecutionReporter,
  ManifestNode,
  ResolvedServerConfig,
} from "./types";

/**
 * Standard engine prompts used by the LLM during different phases of graph execution.
 * Extracted here to keep compilation logic clean and allow easy prompt tuning.
 */
const ENGINE_PROMPTS = {
  trigger_extractor:
    "{__persona__}{__trigger_instructions__}\nExtract the user's intent based on their input.\n\nUser Input: {__input__}",

  skill_system_wrapper:
    "\n\n{__persona__}{__node_instructions__}\n--- SYSTEM INSTRUCTIONS ---\nTask Inputs:\n{__inputsString__}",

  edge_router:
    "{__persona__}\nYou are a logic router for an AI agent. \nEvaluate if the following condition is TRUE based on the current state.\n\nCurrent State:\n{__state__}\n\nCondition to evaluate:\n{__condition__}\n\nIMPORTANT CONTEXT FOR EVALUATION:\n- Expected Initial Inputs: {__expected_inputs__}\n- Human Feedback: Rely heavily on the '__human_feedback__' field if present to determine if the condition is met.",

  response_formatter:
    "{__persona__}\n--- NODE-SPECIFIC INSTRUCTIONS ---\n{__response_instructions__}\n\nRaw Extracted Data:\n{__raw_data__}",
};

type ResolvedSkillConfig = Pick<
  ToolConfig,
  "name" | "prompt_template" | "input_schema" | "output_schema"
>;

/**
 * Helper function to resolve and format only the tools and servers
 * actually used within the graph topology.
 */
function resolveDependencies(
  nodes: ManifestNode[],
  allTools: ToolConfig[],
  allServers: MCPServerConfig[],
  configMcpServers: string[] = [],
) {
  const usedToolIds = new Set<string>();

  // Determine which specific tools are used by the graph nodes
  nodes.forEach((n) => {
    if (n.type === "tool" && n.data?.toolId) {
      usedToolIds.add(n.data.toolId as string);
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
      {} as Record<string, ResolvedSkillConfig>,
    );

  const resolvedServers = allServers
    .filter((server) => configMcpServers.includes(server.id))
    .reduce(
      (acc, server) => {
        acc[server.id] = {
          name: server.name,
          url: server.url,
          auth_type: server.auth_type,
          auth_token: server.auth_token,
        };
        return acc;
      },
      {} as Record<string, ResolvedServerConfig>,
    );

  return { resolvedTools, resolvedServers };
}

/**
 * Compiles a SkillConfig and its dependencies into a static Manifest,
 * then executes it using the unified skill executor.
 * * @param config - The core skill configuration (nodes, edges, model settings).
 * @param tools - Available LLM tools to resolve dependencies against.
 * @param servers - Available MCP servers to resolve dependencies against.
 * @param userInput - The starting input from the user.
 * @param reporter - Optional callback handler for execution events.
 * @param threadId - Unique thread identifier for state persistence.
 * @param resumeValue - Value injected when resuming from an interrupted state.
 */
export async function compileAndRunAgent(
  config: SkillConfig,
  tools: ToolConfig[],
  servers: MCPServerConfig[],
  userInput: string,
  reporter?: ManifestExecutionReporter,
  threadId: string = "default-thread",
  resumeValue?: unknown,
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

  // Safely cast to check for the error property using unknown
  const finalResult = result.result as Record<string, unknown>;

  if (
    finalResult &&
    typeof finalResult === "object" &&
    "error" in finalResult
  ) {
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

/**
 * Converts a dynamic SkillConfig and global dependencies into a standalone,
 * static CompiledManifest that provides all the execution context needed by the runtime.
 */
export function generateManifest(
  config: SkillConfig,
  allTools: ToolConfig[],
  allServers: MCPServerConfig[],
): CompiledManifest {
  const nodes = (config.orchestration?.nodes || []) as ManifestNode[];
  const edges = (config.orchestration?.edges || []) as ManifestEdge[];

  // Resolve only the subset of tools and servers required by this graph
  const { resolvedTools, resolvedServers } = resolveDependencies(
    nodes,
    allTools,
    allServers,
    config.mcp_servers,
  );

  return {
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
    engine_prompts: ENGINE_PROMPTS,
    resolved_skills: resolvedTools,
    resolved_mcp_servers: resolvedServers,
    graph_topology: {
      nodes,
      edges,
    },
  };
}
