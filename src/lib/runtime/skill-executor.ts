import { StateGraph, START, END } from "@langchain/langgraph";
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
} from "./types";
import { createToolNode } from "./nodes/tool-node";
import { createMcpNode } from "./nodes/mcp-node";
import { createInterruptNode } from "./nodes/interrupt-node";
import { createResponseNode } from "./nodes/response-node";
import { createEdgeRouter } from "./edges/router";

export async function executeAgentManifest(
  manifest: CompiledManifest,
  userInput: string,
  threadId: string,
  resumeData?: unknown,
  reporter?: ManifestExecutionReporter,
) {
  await ensureDbSetup();

  const llm = new ChatOpenAI({
    modelName: manifest.engine.model.model_name || "gpt-4o-mini",
    temperature: manifest.engine.model.temperature || 0.7,
  });

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

  // --- 1. SHARED NODE CONTEXT ---
  const context: NodeContext = {
    manifest,
    llm,
    reporter,
    edges,
    getLabel,
    globalPersona,
  };

  // --- 2. EXTRACTION & VALIDATION ---
  let parsedInput: GraphState = {};
  if (!resumeData) {
    reporter?.onNodeStart?.(getLabel(triggerNode.id));
    const expectedPayload = (triggerNode.data.expected_payload || {}) as Record<
      string,
      string
    >;

    try {
      parsedInput = JSON.parse(userInput);
    } catch (e) {
      if (userInput && process.env.OPENAI_API_KEY) {
        try {
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
          const extractor = llm.withStructuredOutput(extractionZodSchema);
          parsedInput = (await extractor.invoke(formattedPrompt)) as GraphState;
        } catch (parseErr) {
          const expectedKeys = Object.keys(expectedPayload);
          if (expectedKeys.length > 0)
            parsedInput = { [expectedKeys[0]]: userInput };
        }
      }
    }

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
      return { status: "completed", result: errorPayload };
    }
  }

  // --- 3. STATE INITIALIZATION ---
  const initialState: GraphState = {};
  if (!resumeData) {
    const initMap = (triggerNode.data.initialization_mapping || {}) as Record<
      string,
      string
    >;
    for (const payloadKey of Object.keys(
      triggerNode.data.expected_payload || {},
    )) {
      if (parsedInput[payloadKey] !== undefined) {
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

  const channels: Record<string, any> = {
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

  Object.keys(manifest.engine.state_schema || {}).forEach((key) => {
    channels[key] = {
      value: (prev: unknown, next: unknown) =>
        next !== undefined ? next : prev,
      default: () => null,
    };
  });
  Object.keys(initialState).forEach((key) => {
    if (!channels[key])
      channels[key] = {
        value: (prev: unknown, next: unknown) =>
          next !== undefined ? next : prev,
        default: () => null,
      };
  });

  // THE MAGIC FIX: Cast the instance to 'any' to bypass strict compile-time node name checks
  const workflow = new StateGraph<GraphState>({ channels }) as any;

  // --- 4. ATTACH GRAPH NODES ---
  for (const node of nodes.filter((n) => n.type === "tool"))
    workflow.addNode(node.id, createToolNode(node, context));
  for (const node of nodes.filter((n) => n.type === "mcp_node"))
    workflow.addNode(node.id, createMcpNode(node, context));
  for (const node of nodes.filter((n) => n.type === "interrupt"))
    workflow.addNode(node.id, createInterruptNode(node, context));
  for (const node of responseNodes)
    workflow.addNode(node.id, createResponseNode(node, context));

  // --- 5. EDGES & ROUTING ---
  const edgesBySource: Record<string, ManifestEdge[]> = {};
  for (const edge of edges) {
    const actualSource =
      nodes.find((n) => n.id === edge.source)?.type === "trigger"
        ? START
        : edge.source;
    if (!edgesBySource[actualSource]) edgesBySource[actualSource] = [];
    edgesBySource[actualSource].push(edge);
  }

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
        sourceId,
        createEdgeRouter(
          sourceId,
          outgoingEdges,
          expectedInputStateKeys,
          context,
        ),
        possibleTargets,
      );
    } else {
      const targets = outgoingEdges.map((edge) => edge.target);
      workflow.addConditionalEdges(
        sourceId,
        (state: GraphState) =>
          state.__error__ ? END : targets.length === 1 ? targets[0] : targets,
        possibleTargets,
      );
    }
  }

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
      [executionNodes[0].id, END],
    );
    if (responseNodes.length > 0)
      workflow.addConditionalEdges(
        executionNodes[executionNodes.length - 1].id,
        (state: GraphState) => (state.__error__ ? END : responseNodes[0].id),
        [responseNodes[0].id, END],
      );
  }

  // --- 6. EXECUTION ---
  const app = workflow.compile({
    checkpointer,
    interruptBefore: nodes
      .filter((n) => n.type === "interrupt")
      .map((n) => n.id),
  });

  const executionConfig = {
    configurable: { thread_id: threadId },
    callbacks: [],
  };
  let finalState: GraphState;

  if (resumeData) {
    await app.updateState(executionConfig, { __human_feedback__: resumeData });
    finalState = (await app.invoke(null, executionConfig)) as GraphState;
  } else {
    const triggerOutEdges = edgesBySource[START] || [];
    if (triggerOutEdges.length === 1 && !triggerOutEdges[0].data?.label?.trim())
      reporter?.onEdgeTraversal?.(
        getLabel(triggerNode.id),
        getLabel(triggerOutEdges[0].target),
      );
    finalState = (await app.invoke(
      initialState,
      executionConfig,
    )) as GraphState;
  }

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
