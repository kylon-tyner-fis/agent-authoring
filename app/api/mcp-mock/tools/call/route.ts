import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // MCP client sends: { jsonrpc: "2.0", id: "...", method: "tools/call", params: { name, arguments } }
    const { id, params } = body;
    const { name, arguments: args } = params || {};

    // Validate request
    if (!name) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Invalid params: missing tool name" },
        },
        { status: 400 },
      );
    }

    let content: any = null;

    // --- MOCK TOOL LOGIC ---
    if (name === "web_search") {
      const query = args?.query || "unknown";
      content = {
        summary: `Mocked search results for "${query}". Found 3 relevant articles.`,
        source_urls: [
          "https://example.com/mock-result-1",
          "https://example.com/mock-result-2",
        ],
      };
    } else if (name === "get_source_material") {
      const topic = (args?.topic || "General Knowledge").toLowerCase();
      const difficulty = args?.difficulty || "intermediate";

      if (topic.includes("elephant")) {
        // Highly specific, realistic data for the elephants query
        content = {
          topic_queried: topic,
          difficulty_level: difficulty,
          source_excerpts: [
            "Elephants are the largest existing land animals. Three living species are currently recognized: the African bush elephant, the African forest elephant, and the Asian elephant.",
            "They are known for their highly developed brain and complex social structures. Elephant societies are matriarchal, meaning they are led by the oldest and often largest female in the herd, known as the matriarch.",
            "Elephants communicate through a variety of sounds, including infrasound, which are low-frequency rumbles that can travel over long distances through the ground, allowing herds to communicate across several kilometers.",
            "Their diet is strictly herbivorous, consisting of grasses, leaves, bamboo, bark, and roots. Adult elephants can consume up to 300 pounds of food in a single day.",
          ],
          key_terms: [
            {
              term: "Matriarch",
              definition:
                "The female leader of an elephant herd, usually the oldest and most experienced.",
            },
            {
              term: "Infrasound",
              definition:
                "Low-frequency sounds (below human hearing) used by elephants for long-distance communication.",
            },
            {
              term: "African bush elephant",
              definition:
                "The largest of the three currently recognized, living elephant species.",
            },
          ],
          related_graph_nodes: [
            "Proboscidea (Taxonomic Order)",
            "Keystone Species Ecology",
            "Infrasonic Communication",
          ],
        };
      } else {
        // Generic realistic fallback for other topics
        content = {
          topic_queried: topic,
          difficulty_level: difficulty,
          source_excerpts: [
            `The study of ${topic} is a foundational concept in its respective field. It involves the interaction of multiple complex systems and historical context.`,
            `Recent advancements in ${topic} have shown significant breakthroughs, particularly in how it applies to practical, real-world scenarios.`,
          ],
          key_terms: [
            {
              term: `${topic} Dynamics`,
              definition: `The mechanics of how ${topic} changes and adapts over time.`,
            },
            {
              term: `Core ${topic} Principles`,
              definition: `The fundamental rules and axioms governing ${topic}.`,
            },
          ],
          related_graph_nodes: [
            `Advanced ${topic}`,
            `History of ${topic}`,
            `Practical Applications of ${topic}`,
          ],
        };
      }
    } else {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool not found: ${name}` },
        },
        { status: 404 },
      );
    }

    // Return the successful JSON-RPC response expected by lib/mcp-client.ts
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        content,
      },
    });
  } catch (error: any) {
    console.error("MCP Mock Error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
      },
      { status: 500 },
    );
  }
}
