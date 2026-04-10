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
  input_mapping?: Record<string, string>; // e.g., { "query": "ticket_description" }
  output_mapping?: Record<string, string>; // e.g., { "summary": "research_notes" }
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

// UPDATED: AgentConfig now links to MCP servers and removes raw 'skills' array
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
}

export interface Message {
  role: string;
  content: string;
}

// --- MOCK DATA ---

export const MOCK_PROVIDERS = ["openai", "anthropic"];
export const MOCK_MODELS = {
  openai: ["gpt-4o-mini", "gpt-4o", "o1-preview"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

// NEW: Rich Mock Skills
export const MOCK_SKILLS: SkillConfig[] = [
  {
    id: "skill_web_research",
    name: "Web Researcher",
    description:
      "Searches the web for real-time data and summarizes the findings.",
    prompt_template:
      "Using the search query '{{search_query}}', find the most relevant information and provide a concise summary.",
    input_schema: { search_query: "string" },
    output_schema: { research_summary: "string", source_urls: "array<string>" },
    mcp_dependencies: ["mcp_brave_search"],
  },
  {
    id: "skill_sql_query",
    name: "Database Query",
    description:
      "Translates natural language to SQL and executes read-only queries.",
    prompt_template:
      "Convert the following question into a secure read-only PostgreSQL query and return the results: '{{user_question}}'. The database schema is: {{db_schema}}.",
    input_schema: { user_question: "string", db_schema: "string" },
    output_schema: { query_results: "array<object>", sql_used: "string" },
    mcp_dependencies: ["mcp_internal_db"],
  },
  {
    id: "skill_email_draft",
    name: "Email Drafter",
    description:
      "Drafts a professional email based on context and recipient info.",
    prompt_template:
      "Draft a professional email to {{recipient_name}} regarding {{topic}}. Here is the background context: {{context}}.",
    input_schema: {
      recipient_name: "string",
      topic: "string",
      context: "string",
    },
    output_schema: { email_subject: "string", email_body: "string" },
    mcp_dependencies: [],
  },
];

// NEW: Mock MCP Servers
export const MOCK_MCP_SERVERS: MCPServerConfig[] = [
  {
    id: "mcp_brave_search",
    name: "Brave Search API",
    url: "https://mcp.internal/brave-search",
    auth_type: "api_key",
    status: "active",
  },
  {
    id: "mcp_internal_db",
    name: "Core Database Connector",
    url: "https://mcp.internal/pg-read-replica",
    auth_type: "bearer",
    status: "active",
  },
];

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
  state_schema: {
    messages: "array<any>",
  },
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
