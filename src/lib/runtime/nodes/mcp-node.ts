import { McpClient } from "../../api-clients/mcp-client";
import { ManifestNode, NodeContext, GraphState } from "../types";

export function createMcpNode(node: ManifestNode, context: NodeContext) {
  const { manifest, reporter, edges, getLabel } = context;
  const serverId = node.data.serverId as string;
  const toolName = node.data.toolName as string;
  const serverConfig = manifest.resolved_mcp_servers[serverId];

  return async (state: GraphState): Promise<GraphState> => {
    if (state.__error__) return {};
    if (!serverConfig || !toolName) return {};

    reporter?.onNodeStart?.(getLabel(node.id));

    const stateUpdates: GraphState = {};
    const localInputs: GraphState = {};
    const inMap = (node.data.input_mapping || {}) as Record<
      string,
      string | string[]
    >;

    for (const [inputKey, mapping] of Object.entries(inMap)) {
      if (Array.isArray(mapping)) {
        const aggregated = mapping
          .map((globalKey) => state[globalKey])
          .filter((val) => val !== undefined && val !== null);
        localInputs[inputKey] = aggregated.reduce(
          (acc: unknown[], val) => acc.concat(Array.isArray(val) ? val : [val]),
          [],
        );
      } else {
        localInputs[inputKey] =
          state[mapping as string] !== undefined
            ? state[mapping as string]
            : "";
      }
    }

    reporter?.onToolStart?.(toolName, localInputs);
    const client = new McpClient(serverConfig);

    try {
      const rawResult = await client.callTool(toolName, localInputs);
      reporter?.onToolEnd?.(toolName, rawResult);

      const outputTarget = (
        node.data.output_mapping as Record<string, string>
      )?.[`mcp_response`];
      if (outputTarget) {
        stateUpdates[outputTarget] = rawResult;
      }
    } catch (err: any) {
      stateUpdates["__error__"] =
        `MCP Tool '${toolName}' execution failed: ${err.message}`;
    }

    reporter?.onNodeEnd?.(getLabel(node.id), stateUpdates, undefined, {
      ...state,
      ...stateUpdates,
    });

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
