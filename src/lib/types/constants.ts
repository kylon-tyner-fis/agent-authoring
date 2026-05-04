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

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  input_schema: Record<string, string>;
  output_schema: Record<string, string>;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  health_url?: string;
  auth_type: "none" | "api_key" | "bearer";
  auth_token?: string;
  status: "Active" | "Inactive" | "Error";
}

export interface GraphNode {
  type: string;
  skill_id?: string;
  toolId?: string;
  serverId?: string;
  toolName?: string;
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

export interface SkillConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  model: ModelConfig;
  mcp_servers: string[];
  system_prompt: string;
  state_schema: Record<string, string>;
  custom_types?: Record<string, Record<string, string>>;
  graph: GraphConfig;
  subgraphs?: SubgraphConfig[];
  persistence?: PersistenceConfig;
  interrupts?: Record<string, InterruptConfig>;
  orchestration?: OrchestrationConfig;
  compiled_manifest?: any;
}

export interface Message {
  role: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface AgentConfig {
  id: string;
  project_id: string;
  name: string;
  description: string;
  skills: string[];
  status: "active" | "inactive";
  system_prompt?: string;
}

export interface OrchestratorConfig {
  id: string;
  project_id: string;
  name: string;
  description: string;
  agents: string[];
  status: "active" | "inactive";
  system_prompt?: string;
}

export const DEFAULT_SKILL_CONFIG: SkillConfig = {
  id: "",
  name: "",
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
