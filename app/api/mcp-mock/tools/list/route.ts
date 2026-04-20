// app/api/mcp-mock/tools/list/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const tools = [
    {
      name: "get_source_material",
      description:
        "Retrieves related source material from the knowledge graph for a given topic to generate learning tools like quizzes.",
      inputSchema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "The educational topic or concept to fetch material for",
          },
          difficulty: {
            type: "string",
            description:
              "Optional target difficulty level (e.g., beginner, intermediate, advanced)",
          },
        },
        required: ["topic"],
      },
    },
    // Leaving a secondary tool here so you can test having multiple tools
    {
      name: "web_search",
      description: "Searches the web for real-time information.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  ];

  return NextResponse.json({ tools });
}
