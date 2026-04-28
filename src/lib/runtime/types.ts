import { ChatOpenAI } from "@langchain/openai";

export type GraphState = Record<string, unknown>;

export interface ManifestNode {
  id: string;
  type: "trigger" | "response" | "tool" | "mcp_node" | "interrupt";
  data: Record<string, unknown>;
}

export interface ManifestEdge {
  source: string;
  target: string;
  data?: { label?: string };
}

export interface CompiledManifest {
  metadata: {
    skill_id: string;
    version: string;
    description: string;
  };
  engine: {
    model: { model_name: string; temperature: number };
    system_prompt: string;
    state_schema: Record<string, string>;
  };
  engine_prompts: Record<string, string>;
  resolved_skills: Record<string, any>;
  resolved_mcp_servers: Record<string, any>;
  graph_topology: {
    nodes: ManifestNode[];
    edges: ManifestEdge[];
  };
}

export interface ManifestExecutionReporter {
  onNodeStart?: (nodeName: string) => void;
  onNodeEnd?: (
    nodeName: string,
    stateUpdates: GraphState,
    reasoning?: string,
    fullState?: GraphState,
  ) => void;
  onEdgeTraversal?: (
    sourceName: string,
    targetName: string,
    condition?: string,
    reasoning?: string,
  ) => void;
  onToolStart?: (toolName: string, args: GraphState) => void;
  onToolEnd?: (toolName: string, result: unknown) => void;
}

// Passed into the node factories so they have all the context they need to execute
export interface NodeContext {
  manifest: CompiledManifest;
  llm: ChatOpenAI;
  reporter?: ManifestExecutionReporter;
  edges: ManifestEdge[];
  getLabel: (id: string) => string;
  globalPersona: string;
}
