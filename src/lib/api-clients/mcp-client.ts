import { MCPServerConfig } from "../types/constants";

/**
 * A strict type representing any valid JSON value.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * A standard Result type for predictable error handling.
 * Forces the consumer to check `.success` before accessing `.data`.
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface McpToolCall {
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, JsonValue>;
  };
}

// Strict interfaces for expected JSON-RPC shapes
interface McpErrorResponse {
  error?: { message?: string };
}

interface McpRpcResponse {
  error?: { message: string };
  result?: { content: JsonValue };
}

export class McpClient {
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Executes a tool on the remote (or local mock) MCP server.
   * Uses the Result pattern to safely encapsulate network or API errors.
   */
  async callTool(
    toolName: string,
    args: Record<string, JsonValue>,
  ): Promise<Result<JsonValue, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.auth_type === "api_key") {
      headers["X-API-Key"] = "your_api_key_here";
    } else if (this.config.auth_type === "bearer") {
      headers["Authorization"] = "Bearer your_token_here";
    }

    try {
      const response = await fetch(`${this.config.url}/tools/call`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method: "tools/call",
          params: { name: toolName, arguments: args },
        }),
      });

      // Safely handle HTTP errors with strict response typing
      if (!response.ok) {
        const errData = (await response
          .json()
          .catch(() => ({}))) as McpErrorResponse;
        const msg = errData?.error?.message || response.statusText;
        return {
          success: false,
          error: `MCP Error ${response.status}: ${msg}`,
        };
      }

      const data = (await response.json()) as McpRpcResponse;

      // Safely handle JSON-RPC protocol errors
      if (data.error) {
        return {
          success: false,
          error: `MCP JSON-RPC Error: ${data.error.message}`,
        };
      }

      // Safely handle missing result objects
      if (!data.result) {
        return {
          success: false,
          error: "MCP Error: Invalid JSON-RPC response format (missing result)",
        };
      }

      return { success: true, data: data.result.content };
    } catch (err) {
      // Safely handle catastrophic network failures (e.g. DNS resolution failed)
      // `err` is implicitly unknown in strict TS, we safely narrow it here
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Network/Execution failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Fetches available tools from the server.
   */
  async listTools(): Promise<Result<JsonValue, string>> {
    try {
      const response = await fetch(`${this.config.url}/tools/list`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to list tools: ${response.status}`,
        };
      }

      const data = (await response.json()) as JsonValue;
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Failed to connect to server: ${errorMessage}`,
      };
    }
  }
}
