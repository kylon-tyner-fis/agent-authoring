import { McpClient, JsonValue } from "../../api-clients/mcp-client";
import { MCPServerConfig } from "../../types/constants";
import { ManifestNode, NodeContext, GraphState } from "../types";

/**
 * Creates an MCP (Model Context Protocol) Node for the LangGraph workflow.
 * This node acts as a bridge to execute tools on remote external servers.
 *
 * @param node - The manifest definition for this MCP node.
 * @param context - Shared execution context (reporter, manifest, edges, etc.).
 * @returns An asynchronous LangGraph node execution function.
 */
export function createMcpNode(node: ManifestNode, context: NodeContext) {
  const { manifest, reporter, edges, getLabel } = context;

  const serverId = node.data.serverId as string;
  const toolName = node.data.toolName as string;
  const serverConfig = manifest.resolved_mcp_servers[serverId];

  return async (state: GraphState): Promise<GraphState> => {
    if (state.__error__) return {};
    if (!serverConfig || !toolName) {
      console.warn(
        `[DEBUG] MCP Node missing server config or tool name: ${node.id}`,
      );
      return {};
    }

    const nodeLabel = getLabel(node.id);
    reporter?.onNodeStart?.(nodeLabel);

    const stateUpdates: GraphState = {};
    // Type this strictly as the JSON arguments payload expected by the client
    const localInputs: Record<string, JsonValue> = {};

    const inMap = (node.data.input_mapping || {}) as Record<
      string,
      string | string[]
    >;

    // 1. Input Mapping
    for (const [inputKey, mapping] of Object.entries(inMap)) {
      if (Array.isArray(mapping)) {
        const aggregated = mapping
          .map((globalKey) => state[globalKey])
          .filter((val) => val !== undefined && val !== null);

        localInputs[inputKey] = aggregated.reduce(
          (acc: unknown[], val) => acc.concat(Array.isArray(val) ? val : [val]),
          [],
        ) as JsonValue;
      } else {
        localInputs[inputKey] = (
          state[mapping as string] !== undefined ? state[mapping as string] : ""
        ) as JsonValue;
      }
    }

    // 2. Execution (No try/catch needed!)
    // Note: Record<string, JsonValue> implicitly satisfies the GraphState type
    // expected by the reporter, so no casting is needed here.
    reporter?.onToolStart?.(toolName, localInputs);

    const client = new McpClient(serverConfig as MCPServerConfig);
    const result = await client.callTool(toolName, localInputs);

    // 3. Output Mapping & Error Handling
    if (!result.success) {
      // TypeScript knows `result.error` is guaranteed to be a string here
      stateUpdates["__error__"] =
        `MCP Tool '${toolName}' execution failed: ${result.error}`;
      reporter?.onToolEnd?.(toolName, { error: result.error });
    } else {
      // TypeScript knows `result.data` is safely available here
      reporter?.onToolEnd?.(toolName, result.data);

      const outputTarget = (
        node.data.output_mapping as Record<string, string>
      )?.[`mcp_response`];

      if (outputTarget) {
        stateUpdates[outputTarget] = result.data;
      }
    }

    // 4. Finalize node execution
    reporter?.onNodeEnd?.(nodeLabel, stateUpdates, undefined, {
      ...state,
      ...stateUpdates,
    });

    // Look ahead to report unconditional edge traversal
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    if (outgoingEdges.length === 1 && !outgoingEdges[0].data?.label?.trim()) {
      reporter?.onEdgeTraversal?.(nodeLabel, getLabel(outgoingEdges[0].target));
    }

    return stateUpdates;
  };
}
