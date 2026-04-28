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
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

// Strict interfaces for expected JSON-RPC shapes
interface McpErrorResponse {
  error?: { message?: string; code?: number };
}

interface McpRpcResponse {
  jsonrpc: "2.0";
  id: string;
  error?: { message: string; code: number };
  result?: any;
}

export class McpClient {
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Helper to perform authenticated JSON-RPC POST requests to the MCP server.
   * Handles both standard JSON and SSE (Server-Sent Events) stream responses.
   */
  private async postRequest(
    method: string,
    params: Record<string, any> = {},
  ): Promise<Result<any, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };

    // Authentication Logic
    if (this.config.auth_type === "api_key" && this.config.auth_token) {
      headers["X-API-Key"] = this.config.auth_token;
    } else if (this.config.auth_type === "bearer" && this.config.auth_token) {
      headers["Authorization"] = `Bearer ${this.config.auth_token}`;
    }

    // --- DEBUG: LOG REQUEST ---
    console.log(`\n--- [MCP ${method.toUpperCase()} START] ---`);
    console.log(`[MCP DEBUG] Target: ${this.config.url}`);
    console.log(`[MCP DEBUG] Payload:`, JSON.stringify(params, null, 2));
    console.log(`[MCP DEBUG] Headers:`, {
      ...headers,
      Authorization: headers.Authorization ? "REDACTED" : "NONE",
    });

    try {
      const response = await fetch(`${this.config.url}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method,
          params,
        }),
      });

      console.log(
        `[MCP DEBUG] HTTP Status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        const errData = (await response
          .json()
          .catch(() => ({}))) as McpErrorResponse;
        const msg = errData?.error?.message || response.statusText;
        console.error(`[MCP DEBUG] HTTP Error: ${msg}`);
        return { success: false, error: `HTTP ${response.status}: ${msg}` };
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle SSE Streams
      if (contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader)
          return { success: false, error: "No stream reader available" };

        const decoder = new TextDecoder();
        let finalResult: any = null;
        let lineBuffer = ""; // NEW: Buffer for partial lines

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new data to the buffer
          lineBuffer += decoder.decode(value, { stream: true });

          // Process all complete lines in the buffer
          let lineEndIndex;
          while ((lineEndIndex = lineBuffer.indexOf("\n")) !== -1) {
            const line = lineBuffer.slice(0, lineEndIndex).trim();
            lineBuffer = lineBuffer.slice(lineEndIndex + 1);

            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              try {
                const parsed = JSON.parse(dataStr);
                console.log(`[MCP DEBUG] SSE Data Received:`, !!parsed.result);

                if (parsed.result !== undefined) {
                  finalResult = parsed.result;
                }
                if (parsed.error) {
                  return { success: false, error: parsed.error.message };
                }
              } catch (e) {
                // If JSON.parse fails here, it means we have a truly malformed
                // line, not just a partial one, since we are buffering correctly.
                console.warn(
                  "[MCP DEBUG] Failed to parse SSE data line:",
                  dataStr,
                );
              }
            }
          }
        }

        if (finalResult !== null) return { success: true, data: finalResult };
        return { success: false, error: "Stream ended without a result" };
      }

      // Handle Standard JSON
      const data = (await response.json()) as McpRpcResponse;
      if (data.error) {
        console.error(
          `[MCP DEBUG] RPC Error: ${data.error.message} (Code: ${data.error.code})`,
        );
        return { success: false, error: data.error.message };
      }

      console.log(`[MCP DEBUG] RPC Success: Data received.`);
      return { success: true, data: data.result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[MCP DEBUG] Connection Failure: ${errorMessage}`);
      return { success: false, error: `Connection failed: ${errorMessage}` };
    }
  }

  /**
   * Executes a specific tool on the remote server.
   */
  async callTool(
    toolName: string,
    args: Record<string, JsonValue>,
  ): Promise<Result<JsonValue, string>> {
    console.log(`[MCP DEBUG] Action: CALLING TOOL "${toolName}"`);
    const result = await this.postRequest("tools/call", {
      name: toolName,
      arguments: args,
    });

    if (result.success) {
      const output = result.data.content || result.data;
      console.log(`[MCP DEBUG] Tool "${toolName}" returned successfully.`);
      console.log(`[MCP DEBUG] Tool Data ${output}`);
      console.log(`--- [MCP CALL_TOOL END] ---\n`);
      return { success: true, data: output };
    }

    console.error(`[MCP DEBUG] Tool "${toolName}" failed.`);
    console.log(`--- [MCP CALL_TOOL END] ---\n`);
    return result;
  }

  /**
   * Fetches the list of available tools.
   */
  async listTools(): Promise<Result<JsonValue, string>> {
    console.log(`[MCP DEBUG] Action: FETCHING TOOL LIST`);
    const result = await this.postRequest("tools/list", {});

    if (result.success) {
      const tools = result.data.tools || result.data;
      console.log(
        `[MCP DEBUG] Server provided ${Array.isArray(tools) ? tools.length : "unknown"} tools.`,
      );
      console.log(`--- [MCP LIST_TOOLS END] ---\n`);
      return { success: true, data: tools };
    }

    console.error(`[MCP DEBUG] Tool listing failed.`);
    console.log(`--- [MCP LIST_TOOLS END] ---\n`);
    return result;
  }
}
