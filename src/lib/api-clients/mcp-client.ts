// lib/mcp-client.ts

import { MCPServerConfig } from "../types/constants";

export interface McpToolCall {
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export class McpClient {
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Executes a tool on the remote (or local mock) MCP server.
   */
  async callTool(toolName: string, args: Record<string, any>) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Apply auth if required by the configuration
    if (this.config.auth_type === "api_key") {
      headers["X-API-Key"] = "your_api_key_here"; // To be replaced with real secret management later
    } else if (this.config.auth_type === "bearer") {
      headers["Authorization"] = "Bearer your_token_here";
    }

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

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `MCP Error ${response.status}: ${errData?.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`MCP JSON-RPC Error: ${data.error.message}`);
    }

    return data.result.content;
  }

  /**
   * Fetches available tools from the server.
   */
  async listTools() {
    const response = await fetch(`${this.config.url}/tools/list`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.status}`);
    }

    return response.json();
  }
}
