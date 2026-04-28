import { ManifestNode, NodeContext, GraphState } from "../types";

export function createInterruptNode(node: ManifestNode, context: NodeContext) {
  const { reporter, edges, getLabel } = context;

  return async (state: GraphState): Promise<GraphState> => {
    if (state.__error__) return {};

    reporter?.onNodeStart?.(getLabel(node.id));

    const feedback = state.__human_feedback__ || "";
    const stateUpdates: GraphState = {};
    const outMap = (node.data.output_mapping || {}) as Record<string, string>;

    if (outMap["human_input"]) {
      stateUpdates[outMap["human_input"]] = feedback;
    }

    reporter?.onNodeEnd?.(
      getLabel(node.id),
      stateUpdates,
      `Human responded with: ${feedback}`,
      { ...state, ...stateUpdates },
    );

    const outgoingEdges = edges.filter((e) => e.source === node.id);
    if (outgoingEdges.length === 1 && !outgoingEdges[0].data?.label?.trim()) {
      reporter?.onEdgeTraversal?.(
        getLabel(node.id),
        getLabel(outgoingEdges[0].target),
      );
    }

    return stateUpdates;
  };
}
