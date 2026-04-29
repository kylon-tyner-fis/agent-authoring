import { StateGraph, START, END, StateGraphArgs } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { checkpointer, ensureDbSetup } from "../db/checkpointer";
import { mapSchemaToZod } from "../utils/schema-mapper";

import {
  GraphState,
  CompiledManifest,
  ManifestExecutionReporter,
  NodeContext,
  ManifestEdge,
  InternalGraphState,
  ManifestNode,
} from "./types";
import { createToolNode } from "./nodes/tool-node";
import { createMcpNode } from "./nodes/mcp-node";
import { createInterruptNode } from "./nodes/interrupt-node";
import { createResponseNode } from "./nodes/response-node";
import { createEdgeRouter } from "./edges/router";

/**
 * Standardized type for LangGraph state channel reducers.
 */
type ChannelReducer = {
  value: (prev: unknown, next: unknown) => unknown;
  default: () => unknown;
};

/**
 * Extracts and validates the user input against the trigger node's expected payload.
 * Attempts to parse as JSON first, then gracefully falls back to an LLM to extract
 * the required fields from natural language.
 */
async function extractInputPayload(
  userInput: string,
  triggerNode: ManifestNode,
  context: NodeContext,
): Promise<{ parsedInput?: GraphState; errorPayload?: { error: string } }> {
  const { llm, manifest, globalPersona, reporter, getLabel } = context;
  const expectedPayload = (triggerNode.data.expected_payload || {}) as Record<
    string,
    string
  >;

  reporter?.onNodeStart?.(getLabel(triggerNode.id));

  const parsedInput: GraphState = await Promise.resolve()
    .then(() => JSON.parse(userInput) as GraphState)
    .catch(async () => {
      // Fallback 1: If input is not valid JSON, use the LLM to extract the data
      if (userInput && process.env.OPENAI_API_KEY) {
        const extractionPrompt = PromptTemplate.fromTemplate(
          manifest.engine_prompts.trigger_extractor,
        );
        const formattedPrompt = await extractionPrompt.format({
          __persona__: globalPersona,
          __trigger_instructions__:
            (triggerNode.data.custom_instructions as string) || "",
          __input__: userInput,
        });

        const extractionZodSchema = mapSchemaToZod(expectedPayload);
        const extractor = llm.withStructuredOutput(extractionZodSchema, {
          name: "input_extractor",
        });

        // Fallback 2: If LLM extraction fails, map raw string to the first expected key
        return extractor.invoke(formattedPrompt).catch(() => {
          const expectedKeys = Object.keys(expectedPayload);
          return expectedKeys.length > 0
            ? { [expectedKeys[0]]: userInput }
            : {};
        }) as Promise<GraphState>;
      }
      return {};
    });

  // Validate that all required (non-optional) keys are present
  const missingKeys = Object.entries(expectedPayload)
    .filter(([k, hint]) => !String(hint).endsWith("?") && !parsedInput[k])
    .map(([k]) => k);

  if (missingKeys.length > 0) {
    const errorPayload = {
      error: `Missing required input fields: ${missingKeys.join(", ")}`,
    };
    reporter?.onNodeEnd?.(
      getLabel(triggerNode.id),
      errorPayload,
      `Validation failed`,
      { ...parsedInput, ...errorPayload },
    );
    return { errorPayload };
  }

  return { parsedInput };
}

/**
 * Constructs the LangGraph channel reducers.
 * Ensures arrays are appended and objects are merged properly during concurrent execution,
 * preventing race conditions or "last-write-wins" data loss.
 */
function buildGraphChannels(
  manifest: CompiledManifest,
  initialState: GraphState,
) {
  const channels: Record<string, ChannelReducer> = {
    __final_payload__: {
      value: (prev: unknown, next: unknown) =>
        next !== undefined ? next : prev,
      default: () => null,
    },
    __error__: {
      value: (prev: unknown, next: unknown) =>
        next !== undefined ? next : prev,
      default: () => null,
    },
    __human_feedback__: {
      value: (prev: unknown, next: unknown) =>
        next !== undefined ? next : prev,
      default: () => null,
    },
  };

  Object.entries(manifest.engine.state_schema || {}).forEach(
    ([key, typeHint]) => {
      const typeStr = String(typeHint).toLowerCase();
      const isArray = typeStr.includes("array") || typeStr.includes("[]");

      channels[key] = {
        value: (prev: unknown, next: unknown) => {
          if (next === undefined) return prev;

          // Append arrays safely
          if (isArray) {
            const prevArr = Array.isArray(prev)
              ? prev
              : prev != null
                ? [prev]
                : [];
            const nextArr = Array.isArray(next) ? next : [next];
            return [...prevArr, ...nextArr];
          }

          // Merge objects
          if (
            typeof prev === "object" &&
            prev !== null &&
            typeof next === "object" &&
            next !== null &&
            !Array.isArray(prev)
          ) {
            return { ...prev, ...next };
          }

          // Replace primitive values
          return next;
        },
        default: () => (isArray ? [] : null),
      };
    },
  );

  // Ensure any initial keys not in schema have a basic reducer
  Object.keys(initialState).forEach((key) => {
    if (!channels[key]) {
      channels[key] = {
        value: (prev: unknown, next: unknown) =>
          next !== undefined ? next : prev,
        default: () => null,
      };
    }
  });

  return channels;
}

/**
 * Populates the StateGraph with the workflow nodes and routes the edges.
 */
function attachNodesAndEdges(
  workflow: StateGraph<InternalGraphState>,
  nodes: ManifestNode[],
  edges: ManifestEdge[],
  triggerNode: ManifestNode,
  responseNodes: ManifestNode[],
  context: NodeContext,
) {
  // 1. Attach Nodes
  for (const node of nodes.filter((n) => n.type === "tool"))
    workflow.addNode(node.id, createToolNode(node, context));
  for (const node of nodes.filter((n) => n.type === "mcp_node"))
    workflow.addNode(node.id, createMcpNode(node, context));
  for (const node of nodes.filter((n) => n.type === "interrupt"))
    workflow.addNode(node.id, createInterruptNode(node, context));
  for (const node of responseNodes)
    workflow.addNode(node.id, createResponseNode(node, context));

  // 2. Map edges by their source node
  const edgesBySource: Record<string, ManifestEdge[]> = {};
  for (const edge of edges) {
    const actualSource =
      nodes.find((n) => n.id === edge.source)?.type === "trigger"
        ? START
        : edge.source;
    if (!edgesBySource[actualSource]) edgesBySource[actualSource] = [];
    edgesBySource[actualSource].push(edge);
  }

  // 3. Attach Routing Edges
  for (const [sourceId, outgoingEdges] of Object.entries(edgesBySource)) {
    const possibleTargets = outgoingEdges.map((e) => e.target).concat(END);

    if (outgoingEdges.some((e) => e.data?.label?.trim())) {
      const expectedInputStateKeys = Object.keys(
        (triggerNode.data.expected_payload || {}) as Record<string, string>,
      ).map(
        (payloadKey) =>
          (
            (triggerNode.data.initialization_mapping || {}) as Record<
              string,
              string
            >
          )?.[payloadKey] || payloadKey,
      );

      workflow.addConditionalEdges(
        // Casting to START cleanly bypasses strict node name checks without using 'any'
        sourceId as typeof START,
        createEdgeRouter(
          sourceId,
          outgoingEdges,
          expectedInputStateKeys,
          context,
        ),
        possibleTargets as (typeof END)[],
      );
    } else {
      const targets = outgoingEdges.map((edge) => edge.target);
      workflow.addConditionalEdges(
        sourceId as typeof START,
        (state: GraphState) =>
          state.__error__ ? END : targets.length === 1 ? targets[0] : targets,
        possibleTargets as (typeof END)[],
      );
    }
  }

  // 4. Default execution pathing if no explicit edges start from the trigger
  const executionNodes = nodes.filter(
    (n) => n.type === "tool" || n.type === "mcp_node",
  );
  if (
    !edges.some(
      (e) => nodes.find((n) => n.id === e.source)?.type === "trigger",
    ) &&
    executionNodes.length > 0
  ) {
    workflow.addConditionalEdges(
      START,
      (state: GraphState) => (state.__error__ ? END : executionNodes[0].id),
      [executionNodes[0].id, END] as (typeof END)[],
    );
    if (responseNodes.length > 0) {
      workflow.addConditionalEdges(
        executionNodes[executionNodes.length - 1].id as typeof START,
        (state: GraphState) => (state.__error__ ? END : responseNodes[0].id),
        [responseNodes[0].id, END] as (typeof END)[],
      );
    }
  }
}

/**
 * Main execution lifecycle for an Agent Skill Workflow.
 * Coordinates input validation, graph assembly, and LangGraph execution.
 */
export async function executeAgentManifest(
  manifest: CompiledManifest,
  userInput: string,
  threadId: string,
  resumeData?: unknown,
  reporter?: ManifestExecutionReporter,
) {
  await ensureDbSetup();

  // --- 1. SETUP & CONTEXT ---
  const llm = new ChatOpenAI({
    modelName: manifest.engine.model.model_name || "gpt-4o-mini",
    temperature: manifest.engine.model.temperature || 0.7,
  });

  console.log(
    `[SKILL EXECUTOR DEBUG] Model "${manifest.engine.model.model_name}"`,
  );

  const globalPersona = manifest.engine.system_prompt
    ? `\n--- GLOBAL INSTRUCTIONS ---\n${manifest.engine.system_prompt}\n`
    : "";

  const nodes = manifest.graph_topology.nodes;
  const edges = manifest.graph_topology.edges;

  const triggerNode = nodes.find((n) => n.type === "trigger");
  const responseNodes = nodes.filter((n) => n.type === "response");

  if (!triggerNode) throw new Error("Manifest is missing a trigger node.");

  const getLabel = (id: string) => {
    if (id === START) return "START";
    if (id === END) return "END";
    return (nodes.find((n) => n.id === id)?.data?.label as string) || id;
  };

  const context: NodeContext = {
    manifest,
    llm,
    reporter,
    edges,
    getLabel,
    globalPersona,
  };
  const initialState: GraphState = {};

  // --- 2. INPUT EXTRACTION & VALIDATION ---
  if (!resumeData) {
    const { parsedInput, errorPayload } = await extractInputPayload(
      userInput,
      triggerNode,
      context,
    );
    if (errorPayload) return { status: "completed", result: errorPayload };

    // --- 3. STATE INITIALIZATION ---
    const initMap = (triggerNode.data.initialization_mapping || {}) as Record<
      string,
      string
    >;
    for (const payloadKey of Object.keys(
      triggerNode.data.expected_payload || {},
    )) {
      if (parsedInput && parsedInput[payloadKey] !== undefined) {
        initialState[initMap[payloadKey] || payloadKey] =
          parsedInput[payloadKey];
      }
    }

    reporter?.onNodeEnd?.(
      getLabel(triggerNode.id),
      initialState,
      "Extracted user input and initialized state",
      initialState,
    );
  }

  // --- 4. GRAPH COMPILATION ---
  const channels = buildGraphChannels(manifest, initialState);
  const workflow = new StateGraph<InternalGraphState>({
    channels: channels as StateGraphArgs<InternalGraphState>["channels"],
  });

  attachNodesAndEdges(
    workflow,
    nodes,
    edges,
    triggerNode,
    responseNodes,
    context,
  );

  const app = workflow.compile({
    checkpointer,
    interruptBefore: nodes
      .filter((n) => n.type === "interrupt")
      .map((n) => n.id) as (typeof START)[],
  });

  // --- 5. EXECUTION ---
  const executionConfig = {
    configurable: { thread_id: threadId },
    callbacks: [],
  };
  let finalState: GraphState;

  if (resumeData) {
    // Resuming from an interrupt
    await app.updateState(executionConfig, { __human_feedback__: resumeData });
    finalState = (await app.invoke(null, executionConfig)) as GraphState;
  } else {
    // Initial start
    const triggerOutEdges = edges.filter(
      (e) => nodes.find((n) => n.id === e.source)?.type === "trigger",
    );
    if (
      triggerOutEdges.length === 1 &&
      !triggerOutEdges[0].data?.label?.trim()
    ) {
      reporter?.onEdgeTraversal?.(
        getLabel(triggerNode.id),
        getLabel(triggerOutEdges[0].target),
      );
    }
    finalState = (await app.invoke(
      initialState,
      executionConfig,
    )) as GraphState;
  }

  // --- 6. RESULT HANDLING ---
  const threadState = await app.getState(executionConfig);
  if (threadState.next && threadState.next.length > 0) {
    return {
      status: "interrupted",
      node: threadState.next[0],
      state: threadState.values,
    };
  }

  if (finalState.__error__) {
    reporter?.onNodeEnd?.(
      "System Error Handler",
      { error: finalState.__error__ },
      `Execution aborted early.`,
      finalState,
    );
    return { status: "completed", result: { error: finalState.__error__ } };
  }

  return { status: "completed", result: finalState.__final_payload__ || {} };
}
