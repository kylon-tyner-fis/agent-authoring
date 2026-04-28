import { ManifestNode, NodeContext, GraphState } from "../types";

/**
 * Creates an Interrupt Node for the LangGraph workflow.
 * This node acts as a pause point for human-in-the-loop (HITL) interactions.
 * During graph execution, LangGraph will halt BEFORE this node executes.
 * When execution resumes, it expects the user's input to have been injected
 * into the `__human_feedback__` state channel. This node then maps that feedback
 * into the user-defined target state variable.
 * @param node - The manifest definition for the interrupt node.
 * @param context - Shared execution context (reporter, edges, getLabel, etc.).
 * @returns An asynchronous LangGraph node execution function.
 */
export function createInterruptNode(node: ManifestNode, context: NodeContext) {
  const { reporter, edges, getLabel } = context;

  return async (state: GraphState): Promise<GraphState> => {
    // 1. Halt execution immediately if a system error was flagged previously
    if (state.__error__) return {};

    const nodeLabel = getLabel(node.id);
    reporter?.onNodeStart?.(nodeLabel);

    // 2. Extract and safely format the human feedback provided during the resume call
    const rawFeedback = state.__human_feedback__;
    const feedbackString =
      typeof rawFeedback === "object"
        ? JSON.stringify(rawFeedback)
        : String(rawFeedback || "");

    const stateUpdates: GraphState = {};

    // 3. Route the raw feedback into the specific state variable designated
    // by the author in the UI (via output_mapping["human_input"])
    const outMap = (node.data.output_mapping || {}) as Record<string, string>;
    const targetStateKey = outMap["human_input"];

    if (targetStateKey) {
      // Preserve the raw feedback type (e.g. if the user submitted JSON)
      stateUpdates[targetStateKey] =
        rawFeedback !== undefined ? rawFeedback : "";
    }

    // 4. Report the successful processing of the human input
    reporter?.onNodeEnd?.(
      nodeLabel,
      stateUpdates,
      `Human responded with: ${feedbackString}`,
      { ...state, ...stateUpdates },
    );

    // 5. Look ahead to report unconditional edge traversal (for UI visual tracking)
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    if (outgoingEdges.length === 1 && !outgoingEdges[0].data?.label?.trim()) {
      reporter?.onEdgeTraversal?.(nodeLabel, getLabel(outgoingEdges[0].target));
    }

    return stateUpdates;
  };
}
