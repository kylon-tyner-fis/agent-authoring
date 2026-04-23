// lib/constants.ts

// --- TYPES ---
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "array_string"
  | "array_object";

export interface SchemaField {
  id: string;
  name: string;
  typeHint: string;
}

export interface ModelConfig {
  provider: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
}

// NEW: Skill Definition
export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  input_schema: Record<string, string>;
  output_schema: Record<string, string>;
  mcp_dependencies: string[];
}

// NEW: MCP Server Definition
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  auth_type: "none" | "api_key" | "bearer";
  status: "active" | "inactive" | "error";
}

// UPDATED: GraphNode now maps state rather than holding prompts directly
export interface GraphNode {
  type: string; // e.g., "skill", "subgraph", "interrupt"
  skill_id?: string;
  input_mapping?: Record<string, string | string[]>;
  output_mapping?: Record<string, string>;
  custom_instructions?: string;
  interrupt_before?: string[];
  subgraph_id?: string;
  max_iterations?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface GraphConfig {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  conditional_functions?: Record<string, string>;
}

export interface SubgraphConfig {
  subgraph_id: string;
  nodes: Record<string, GraphNode>;
  checkpointer?: string;
}

export interface PersistenceConfig {
  checkpointer: string;
  ttl_seconds: number;
  store_ttl: number;
}

export interface InterruptConfig {
  before: string[];
  metadata: Record<string, any>;
}

export interface OrchestrationConfig {
  nodes: Record<string, any>[];
  edges: Record<string, any>[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

// UPDATED: AgentConfig now links to MCP servers, removes raw 'skills' array,
// and includes compiled_manifest for standalone execution.
export interface AgentConfig {
  agent_id: string;
  version: string;
  description: string;
  model: ModelConfig;
  mcp_servers: string[]; // Linked MCP Server IDs
  system_prompt: string;
  state_schema: Record<string, string>;
  custom_types?: Record<string, Record<string, string>>;
  graph: GraphConfig;
  subgraphs?: SubgraphConfig[];
  persistence?: PersistenceConfig;
  interrupts?: Record<string, InterruptConfig>;
  orchestration?: OrchestrationConfig;
  compiled_manifest?: any; // NEW: Standalone execution manifest
}

export interface Message {
  role: string;
  content: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agent_id: "",
  version: "1.0.0",
  description: "",
  model: {
    provider: "openai",
    model_name: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 4096,
  },
  mcp_servers: [],
  system_prompt: "",
  state_schema: {},
  custom_types: {},
  graph: {
    nodes: {},
    edges: [],
    conditional_functions: {},
  },
  subgraphs: [],
  persistence: undefined,
  interrupts: {},
  orchestration: undefined,
};
