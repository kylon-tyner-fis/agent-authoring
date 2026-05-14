import { McpClient, JsonValue } from "../../api-clients/mcp-client";
import { MCPServerConfig } from "../../types/constants";
import { ManifestNode, NodeContext, GraphState } from "../types";

type McpToolSchema = {
  properties: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toJsonValue = (value: unknown): JsonValue => value as JsonValue;

const getToolList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.tools)) return value.tools;
  return [];
};

const getToolSchema = async (
  client: McpClient,
  toolName: string,
): Promise<McpToolSchema | null> => {
  const toolsResult = await client.listTools();
  if (!toolsResult.success) return null;

  const toolDefinition = getToolList(toolsResult.data).find(
    (tool) => isRecord(tool) && tool.name === toolName,
  );

  if (!isRecord(toolDefinition)) return null;

  const schema = toolDefinition.inputSchema || toolDefinition.input_schema;
  if (!isRecord(schema) || !isRecord(schema.properties)) return null;

  return { properties: schema.properties };
};

const shouldWrapAsArray = (propertySchema: unknown) =>
  isRecord(propertySchema) && propertySchema.type === "array";

const getAliasKeys = (inputKey: string) => {
  const aliases = new Set([inputKey]);

  if (inputKey.endsWith("ies")) {
    aliases.add(`${inputKey.slice(0, -3)}y`);
  }

  if (inputKey.endsWith("es")) {
    aliases.add(inputKey.slice(0, -2));
  }

  if (inputKey.endsWith("s")) {
    aliases.add(inputKey.slice(0, -1));
  } else {
    aliases.add(`${inputKey}s`);
  }

  return [...aliases].filter(Boolean);
};

const coerceValueForSchema = (value: JsonValue, propertySchema: unknown) =>
  shouldWrapAsArray(propertySchema) && !Array.isArray(value) ? [value] : value;

const getMappedValue = (
  inputKey: string,
  rawInputs: Record<string, JsonValue>,
  propertySchema: unknown,
): JsonValue | undefined => {
  for (const aliasKey of getAliasKeys(inputKey)) {
    const mappedValue = rawInputs[aliasKey];
    if (mappedValue !== undefined) {
      return coerceValueForSchema(mappedValue, propertySchema);
    }
  }

  return undefined;
};

const normalizeMcpArguments = (
  rawInputs: Record<string, JsonValue>,
  schema: McpToolSchema | null,
) => {
  if (!schema) return rawInputs;

  const normalizedInputs: Record<string, JsonValue> = {};

  for (const [inputKey, propertySchema] of Object.entries(schema.properties)) {
    const mappedValue = getMappedValue(inputKey, rawInputs, propertySchema);
    if (mappedValue !== undefined) {
      normalizedInputs[inputKey] = mappedValue;
    }
  }

  return normalizedInputs;
};

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
    // --- ADD THESE LOGS ---
    console.log(`[NODE DEBUG] Executing Node: ${node.id}`);
    console.log(`[NODE DEBUG] Server ID: ${serverId}`);
    console.log(`[NODE DEBUG] Config Found: ${!!serverConfig}`);
    if (serverConfig) {
      console.log(`[NODE DEBUG] Config URL: ${serverConfig.url}`);
      console.log(`[NODE DEBUG] Auth Type: ${serverConfig.auth_type}`);
      console.log(`[NODE DEBUG] Secret: ${serverConfig.auth_token}`);
    }

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
    const client = new McpClient(serverConfig as MCPServerConfig);
    const toolSchema = await getToolSchema(client, toolName);
    const toolArguments = normalizeMcpArguments(localInputs, toolSchema);
    reporter?.onToolStart?.(toolName, toolArguments);

    const result = await client.callTool(toolName, toolArguments);

    // 3. Output Mapping & Error Handling
    if (!result.success) {
      // TypeScript knows `result.error` is guaranteed to be a string here
      stateUpdates["__error__"] =
        `MCP Tool '${toolName}' execution failed: ${result.error}`;
      reporter?.onToolEnd?.(toolName, { error: result.error });
    } else {
      // TypeScript knows `result.data` is safely available here
      reporter?.onToolEnd?.(toolName, toJsonValue(result.data));

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
