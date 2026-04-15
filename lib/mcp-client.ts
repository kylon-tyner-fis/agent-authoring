// lib/mcp-client.ts
import { MCPServerConfig } from "./constants";

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
   * Executes a tool on the remote MCP server.
   */
  async callTool(toolName: string, args: Record<string, any>) {
    // SIMULATION MODE: Use this if you don't have a live server
    if (this.config.url === "simulation://local") {
      console.log(`[MCP SIMULATOR] Intercepted call to: ${toolName}`);
      return this.generateSimulatedResponse(toolName, args);
    }

    // REAL PROTOCOL MODE
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.auth_type === "api_key")
      headers["X-API-Key"] = "simulated_key";

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

    if (!response.ok) throw new Error(`MCP Error: ${response.status}`);
    const data = await response.json();
    return data.result.content;
  }

  private generateSimulatedResponse(
    toolName: string,
    args: Record<string, any>,
  ) {
    // Basic mock logic for common tool patterns
    if (toolName.includes("search") || toolName.includes("research")) {
      return {
        research_summary: `Simulated research results for "${args.search_query || args.query || "topic"}"`,
        source_urls: ["https://example.com/simulated-source"],
      };
    }
    return {
      status: "success",
      message: `Simulated output for ${toolName}`,
      received_args: args,
    };
  }

  /**
   * Fetches available tools from the server (for future tool discovery feature).
   */
  async listTools() {
    const response = await fetch(`${this.config.url}/tools/list`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return response.json();
  }
}
