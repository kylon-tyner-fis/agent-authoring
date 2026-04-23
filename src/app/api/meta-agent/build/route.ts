// src/app/api/meta-agent/build/route.ts
import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";

const MetaAgentState = Annotation.Root({
  prompt: Annotation<string>(),
  currentConfig: Annotation<any>(),
  skillsContext: Annotation<any[]>(),
  plan: Annotation<string>(),
  nodes: Annotation<any[]>(),
  edges: Annotation<any[]>(),
  state_schema: Annotation<any>(),
  message: Annotation<string>(),
});

// Helper for the node 'data' schema to force the LLM to structure it correctly
const nodeDataSchema = {
  type: "object",
  properties: {
    label: { type: "string", description: "A readable name for the node" },
    skillId: {
      type: "string",
      description: "REQUIRED for skill nodes only. The UUID of the skill.",
    },
    initialization_mapping: { type: "object" },
    input_mapping: { type: "object" },
    output_mapping: { type: "object" },
    extraction_mapping: { type: "object" },
    expected_payload: { type: "object" },
    response_payload: { type: "object" },
  },
};

const topologySchema = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          position: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"],
          },
          data: nodeDataSchema,
        },
        required: ["id", "type", "position", "data"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          target: { type: "string" },
          type: { type: "string" },
          data: { type: "object" },
        },
        required: ["id", "source", "target"],
      },
    },
  },
  required: ["nodes", "edges"],
};

const schemaManagerSchema = {
  type: "object",
  properties: {
    analysis: {
      type: "array",
      description:
        "Step-by-step extraction of every global_state_key found in the topology mappings.",
      items: {
        type: "object",
        properties: {
          node_id: { type: "string" },
          mapping_type: {
            type: "string",
            description: "e.g., initialization_mapping, input_mapping",
          },
          global_state_key: { type: "string" },
          inferred_data_type: { type: "string" },
        },
        required: [
          "node_id",
          "mapping_type",
          "global_state_key",
          "inferred_data_type",
        ],
      },
    },
    message: {
      type: "string",
      description: "A friendly message to the user explaining what you built.",
    },
    state_schema: {
      type: "object",
      description:
        "The global state schema tracking all variables mapped across the graph.",
    },
    nodes: {
      type: "array",
      description:
        "The updated array of nodes, now including expected_payload and response_payload.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          position: { type: "object" },
          data: nodeDataSchema,
        },
        required: ["id", "type", "position", "data"],
      },
    },
  },
  required: ["analysis", "message", "state_schema", "nodes"],
};

export async function POST(req: Request) {
  try {
    const { prompt, currentConfig, skills } = await req.json();

    const availableSkillsContext = skills.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      input_schema: s.input_schema,
      output_schema: s.output_schema,
    }));

    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
    });

    // --- NODE 1: THE PLANNER ---
    const plannerNode = async (state: typeof MetaAgentState.State) => {
      const sysPrompt = `
        You are the Planner for a LangGraph Meta-Agent.
        Analyze the user's request and output a concise, logical step-by-step plan for the workflow.
        
        AVAILABLE SKILLS:
        ${JSON.stringify(state.skillsContext, null, 2)}
        
        CURRENT GRAPH NODES: ${JSON.stringify(state.currentConfig.orchestration?.nodes || [])}
        
        OUTPUT: A text-based plan only. Do not write JSON. Do not write schemas. Just logic steps.
        CRITICAL: If the workflow requires pausing for human input (like waiting for a user to answer a quiz, provide feedback, or give approval), explicitly specify a "Human-in-the-Loop Interrupt" step.
      `;
      const res = await llm.invoke([
        { role: "system", content: sysPrompt },
        { role: "user", content: state.prompt },
      ]);
      return { plan: res.content as string };
    };

    // --- NODE 2: TOPOLOGY BUILDER ---
    const topologyNode = async (state: typeof MetaAgentState.State) => {
      const structuredLlm = llm.withStructuredOutput(topologySchema, {
        name: "topology",
        strict: false,
      });
      const sysPrompt = `
        You are the Topology Builder for a LangGraph Meta-Agent.
        Convert the following Plan into a visual graph topology (nodes and edges).
        
        AVAILABLE SKILLS (CRITICAL FOR IDs):
        ${JSON.stringify(state.skillsContext, null, 2)}
        
        PLAN:
        ${state.plan}
        
        INSTRUCTIONS:
        1. Include exactly one Trigger node (type: "trigger").
        2. Add Skill nodes (type: "skill") logically. 
           CRITICAL: For every skill node, set "skillId": "<exact_uuid>" and "label": "<skill_name>". DO NOT hallucinate skills that are not in the AVAILABLE SKILLS list!
        3. Add Interrupt nodes (type: "interrupt") if the workflow needs to pause and wait for the user to provide input. NEVER hallucinate a skill node for collecting human input.
        4. Include exactly one Response node (type: "response").
        5. Add edges (type: "shiftEdge") to connect them logically.
        6. Position nodes cleanly (e.g., x: 0, y: 200; x: 350, y: 200; x: 700, y: 200).
        7. Define the mappings VERY CAREFULLY inside the 'data' object. All mappings follow the format: { "local_node_key": "global_state_key" }.
           - Trigger 'initialization_mapping': { "api_input_key": "global_state_key" } -> MUST NOT BE EMPTY! Map all incoming request values to state.
           - Skill 'input_mapping': { "skill_input_schema_key": "global_state_key" }
           - Skill 'output_mapping': { "skill_output_schema_key": "global_state_key" } -> CRITICAL: Use the EXACT keys from the skill's output_schema as the local keys.
           - Interrupt 'output_mapping': { "human_input": "global_state_key" } -> CRITICAL: Always use exactly "human_input" as the local key for interrupt nodes.
           - Response 'extraction_mapping': { "api_output_key": "global_state_key" }
      `;
      const res = await structuredLlm.invoke([
        { role: "system", content: sysPrompt },
      ]);
      return { nodes: res.nodes, edges: res.edges };
    };

    // --- NODE 3: SCHEMA MANAGER ---
    const schemaNode = async (state: typeof MetaAgentState.State) => {
      const structuredLlm = llm.withStructuredOutput(schemaManagerSchema, {
        name: "schemas",
        strict: false,
      });
      const sysPrompt = `
        You are the Schema Manager for a LangGraph Meta-Agent.
        Review the visual graph topology generated by the Topology Builder and finalize the data contracts.
        
        AVAILABLE SKILLS (CRITICAL FOR SCHEMAS):
        ${JSON.stringify(state.skillsContext, null, 2)}
        
        CURRENT TOPOLOGY NODES:
        ${JSON.stringify(state.nodes, null, 2)}
        
        INSTRUCTIONS:
        1. ANALYSIS FIRST: You MUST populate the 'analysis' array first. Scan every node's 'data' object. Extract EVERY "global_state_key" found in 'initialization_mapping', 'input_mapping', 'output_mapping', and 'extraction_mapping'. 
        2. GLOBALS: Using your 'analysis', create a complete 'state_schema' object. EVERY key identified in your analysis MUST be defined here with a type (e.g., "string", "number", "array<string>", "any"). Do not add variables that are not in your analysis.
        3. TRIGGER: Locate the Trigger node and ensure 'expected_payload' is defined, perfectly matching the local keys in its 'initialization_mapping'.
        4. RESPONSE: Locate the Response node and ensure 'response_payload' is defined, perfectly matching the local keys in its 'extraction_mapping'.
        5. CLEANUP: Ensure Skill and Interrupt nodes DO NOT have 'expected_payload' or 'response_payload' fields. Remove them if they exist. Make sure all output_mappings on skills map EXACT keys from the skill's output_schema.
        6. MESSAGE: Write a friendly conversational message explaining the workflow.
      `;
      const res = await structuredLlm.invoke([
        { role: "system", content: sysPrompt },
      ]);

      return {
        state_schema: res.state_schema,
        nodes: res.nodes,
        message: res.message,
      };
    };

    // --- COMPILE THE GRAPH ---
    const workflow = new StateGraph(MetaAgentState)
      .addNode("planner", plannerNode)
      .addNode("topologyBuilder", topologyNode)
      .addNode("schemaManager", schemaNode)
      .addEdge(START, "planner")
      .addEdge("planner", "topologyBuilder")
      .addEdge("topologyBuilder", "schemaManager")
      .addEdge("schemaManager", END);

    const app = workflow.compile();

    const initialState = {
      prompt,
      currentConfig,
      skillsContext: availableSkillsContext,
    };

    const finalState = await app.invoke(initialState);

    return NextResponse.json({
      success: true,
      message: finalState.message,
      plan: finalState.plan, // <--- ADD THIS LINE
      state_schema: finalState.state_schema,
      nodes: finalState.nodes,
      edges: finalState.edges,
    });
  } catch (error: any) {
    console.error("Meta-Agent Build Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
