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

export interface AgentConfig {
  agent_id: string;
  version: string;
  description: string;
  model: ModelConfig;
  tools: string[];
  system_prompt: string;
  state_schema: Record<string, string>;
  graph: GraphConfig;
  subgraphs?: SubgraphConfig[];
  persistence?: PersistenceConfig;
  interrupts?: Record<string, InterruptConfig>;
}

export interface Message {
  role: string;
  content: string;
}

export const MOCK_PROVIDERS = ["openai", "anthropic"];
export const MOCK_MODELS = {
  openai: ["gpt-4o-mini", "gpt-4o", "o1-preview"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

// --- ENTERPRISE DEFAULT TEMPLATE ---
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agent_id: "enterprise-customer-support-bot",
  version: "1.0",
  description:
    "Multi-stage customer support with handoffs, research subgraph, HITL, billing tools",
  model: {
    provider: "anthropic",
    model_name: "claude-3-5-sonnet-20240620",
    temperature: 0.1,
    max_tokens: 4096,
  },
  tools: [
    "search_knowledge_base",
    "check_inventory",
    "create_ticket",
    "update_billing",
  ],
  system_prompt:
    "You are an enterprise customer support specialist. Triage issues and handoff to specialists. Escalate high-priority to human.",
  state_schema: {
    messages: "array<BaseMessage>",
    current_stage: "string",
    research_results: "object|null",
    user_priority: "string|null",
    handoff_to: "string|null",
    memory: "object",
  },
  graph: {
    nodes: {
      triage: {
        type: "agent",
        prompt:
          "Classify issue and decide next stage: research|billing|escalate|respond",
        tools: ["create_ticket"],
        interrupt_before: ["escalate"],
      },
      research: {
        type: "subgraph",
        subgraph_id: "knowledge-research-subgraph",
        tools: ["search_knowledge_base", "check_inventory"],
      },
      billing: {
        type: "agent",
        prompt: "Handle billing/payment issues only",
        tools: ["update_billing"],
      },
      human_review: {
        type: "interrupt",
        prompt: "Waiting for human approval on escalation",
      },
      responder: {
        type: "agent",
        prompt: "Write final customer response summarizing resolution",
      },
    },
    edges: [
      { from: "START", to: "triage" },
      { from: "triage", to: "research", condition: "handoff_to=='research'" },
      { from: "triage", to: "billing", condition: "handoff_to=='billing'" },
      {
        from: "triage",
        to: "human_review",
        condition: "user_priority=='high'",
      },
      { from: "research", to: "responder" },
      { from: "billing", to: "responder" },
      { from: "human_review", to: "responder" },
    ],
    conditional_functions: {
      triage_router: "should_handoff_or_escalate",
    },
  },
  subgraphs: [
    {
      subgraph_id: "knowledge-research-subgraph",
      nodes: {
        research_agent: {
          type: "agent",
          tools: ["search_knowledge_base"],
          max_iterations: 3,
        },
      },
      checkpointer: "separate_thread",
    },
  ],
  persistence: {
    checkpointer: "postgres",
    ttl_seconds: 2592000,
    store_ttl: 604800,
  },
  interrupts: {
    high_priority: {
      before: ["human_review"],
      metadata: { requires_approval: true },
    },
  },
};
