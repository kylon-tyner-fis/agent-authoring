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

export interface GraphNode {
  type: string; // e.g., "agent", "subgraph", "interrupt"
  prompt?: string;
  tools?: string[];
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

export interface AgentConfig {
  agent_id: string;
  version: string;
  description: string;
  model: ModelConfig;
  skills: string[];
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

export const MOCK_SKILLS = [
  {
    id: "search_web",
    label: "Web Search",
    description: "Search Google/Bing for real-time data",
  },
  {
    id: "query_db",
    label: "Database Query",
    description: "Execute read-only SQL queries",
  },
  {
    id: "send_email",
    label: "Email Dispatcher",
    description: "Send automated emails via SendGrid",
  },
  {
    id: "summarize_pdf",
    label: "PDF Summarizer",
    description: "Extract key points from uploaded documents",
  },
  {
    id: "generate_image",
    label: "Image Generator",
    description: "Create visuals using DALL-E 3",
  },
  {
    id: "check_stock",
    label: "Inventory Check",
    description: "Real-time stock level verification",
  },
];

export const MOCK_PROVIDERS = ["openai", "anthropic"];
export const MOCK_MODELS = {
  openai: ["gpt-4o-mini", "gpt-4o", "o1-preview"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

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
  skills: [],
  system_prompt: "",
  state_schema: {
    // We leave this empty or with a very basic 'messages' key
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
