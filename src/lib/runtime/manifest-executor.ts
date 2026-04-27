// lib/runtime/manifest-executor.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Pool } from "pg";
import { McpClient } from "../api-clients/mcp-client"; // NEW: Import the MCP Client

// 1. Initialize Postgres Pool and Checkpointer for Serverless persistence
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
const checkpointer = new PostgresSaver(pool);

let isDbSetup = false;
async function ensureDbSetup() {
  if (!isDbSetup) {
    await checkpointer.setup();
    isDbSetup = true;
  }
}

export async function executeAgentManifest(
  manifest: any,
  userInput: string,
  threadId: string,
  resumeData?: any,
) {
  await ensureDbSetup();

  const llm = new ChatOpenAI({
    modelName: manifest.engine.model.model_name || "gpt-4o-mini",
    temperature: manifest.engine.model.temperature || 0.7,
    modelKwargs: { response_format: { type: "json_object" } },
  });

  const globalPersona = manifest.engine.system_prompt
    ? `\n--- GLOBAL INSTRUCTIONS ---\n${manifest.engine.system_prompt}\n`
    : "";

  const nodes = manifest.graph_topology.nodes;
  const edges = manifest.graph_topology.edges;

  const triggerNode = nodes.find((n: any) => n.type === "trigger");
  const responseNodes = nodes.filter((n: any) => n.type === "response");
  const toolNodes = nodes.filter((n: any) => n.type === "tool"); // UPDATED: Was "skill"
  const mcpNodes = nodes.filter((n: any) => n.type === "mcp_node"); // NEW: Explicit MCP support
  const interruptNodes = nodes.filter((n: any) => n.type === "interrupt");

  if (!triggerNode) throw new Error("Manifest is missing a trigger node.");

  // ==========================================
  // 1. BUILD THE GRAPH
  // ==========================================

  const channels: any = {
    __final_payload__: {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    },
    __error__: {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    },
    __human_feedback__: {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    },
  };
  Object.keys(manifest.engine.state_schema || {}).forEach((key) => {
    channels[key] = {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    };
  });

  const workflow = new StateGraph<any>({ channels });

  // Add Custom LLM Tool Nodes
  for (const node of toolNodes) {
    const tool = manifest.resolved_skills[node.data.toolId]; // UPDATED: Use toolId
    if (!tool) continue;

    workflow.addNode(node.id, async (state: any) => {
      if (state.__error__) return {};

      const localInputs: any = {};
      const inMap = node.data.input_mapping || {};
      for (const localKey of Object.keys(tool.input_schema || {})) {
        const mapping = inMap[localKey];

        if (Array.isArray(mapping)) {
          const aggregated = mapping
            .map((globalKey) => state[globalKey])
            .filter((val) => val !== undefined && val !== null);

          localInputs[localKey] = aggregated.reduce(
            (acc, val) => acc.concat(Array.isArray(val) ? val : [val]),
            [],
          );
        } else {
          const globalKey = (mapping as string) || localKey;
          localInputs[localKey] =
            state[globalKey] !== undefined ? state[globalKey] : "";
        }
      }

      const prompt = PromptTemplate.fromTemplate(
        tool.prompt_template + manifest.engine_prompts.skill_system_wrapper,
      );
      const formatted = await prompt.format({
        ...localInputs,
        __persona__: globalPersona,
        __node_instructions__: node.data.custom_instructions || "",
        __schema__: JSON.stringify(tool.output_schema || {}),
        __inputsString__: JSON.stringify(localInputs, null, 2),
      });

      const res = await llm.invoke(formatted);
      let outputData: any = {};
      const stateUpdates: any = {};

      try {
        let cleanStr = res.content.toString().trim();
        if (cleanStr.startsWith("```json"))
          cleanStr = cleanStr
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        outputData = JSON.parse(cleanStr);
      } catch (e: any) {
        stateUpdates["__error__"] =
          `Tool ${tool.name} failed to return valid JSON.`;
      }

      const outMap = node.data.output_mapping || {};
      for (const localKey of Object.keys(outputData)) {
        const globalKey = outMap[localKey] || localKey;
        stateUpdates[globalKey] = outputData[localKey];
      }
      return stateUpdates;
    });
  }

  // Add MCP Nodes (Direct Execution)
  for (const node of mcpNodes) {
    const serverConfig = manifest.resolved_mcp_servers[node.data.serverId];
    const toolName = node.data.toolName;

    if (!serverConfig || !toolName) continue;

    workflow.addNode(node.id, async (state: any) => {
      if (state.__error__) return {};

      const stateUpdates: Record<string, any> = {};
      const localInputs: Record<string, any> = {};
      const inMap = node.data.input_mapping || {};

      // Map global state variables to MCP arguments
      for (const [inputKey, mapping] of Object.entries(inMap)) {
        if (Array.isArray(mapping)) {
          const aggregated = mapping
            .map((globalKey) => state[globalKey])
            .filter((val) => val !== undefined && val !== null);
          localInputs[inputKey] = aggregated.reduce(
            (acc, val) => acc.concat(Array.isArray(val) ? val : [val]),
            [],
          );
        } else {
          localInputs[inputKey] =
            state[mapping as string] !== undefined
              ? state[mapping as string]
              : "";
        }
      }

      const client = new McpClient(serverConfig);

      try {
        const rawResult = await client.callTool(toolName, localInputs);
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

      return stateUpdates;
    });
  }

  // Add Interrupt Nodes
  for (const intNode of interruptNodes) {
    workflow.addNode(intNode.id, async (state: any) => {
      if (state.__error__) return {};
      const feedback = state.__human_feedback__ || "";
      const stateUpdates: any = {};
      const outMap = intNode.data.output_mapping || {};
      if (outMap["human_input"]) {
        stateUpdates[outMap["human_input"]] = feedback;
      }
      return stateUpdates;
    });
  }

  // Add Response Nodes
  for (const resNode of responseNodes) {
    workflow.addNode(resNode.id, async (state: any) => {
      const responsePayload: any = {};
      const extMap = resNode.data.extraction_mapping || {};
      for (const payloadKey of Object.keys(
        resNode.data.response_payload || {},
      )) {
        const stateKey = extMap[payloadKey] || payloadKey;
        responsePayload[payloadKey] =
          state[stateKey] !== undefined ? state[stateKey] : null;
      }

      if (resNode.data.custom_instructions) {
        const prompt = PromptTemplate.fromTemplate(
          manifest.engine_prompts.response_formatter,
        );
        const formatted = await prompt.format({
          __persona__: globalPersona,
          __response_instructions__: resNode.data.custom_instructions,
          __raw_data__: JSON.stringify(responsePayload),
          __schema__: JSON.stringify(resNode.data.response_payload),
        });
        const res = await llm.invoke(formatted);
        let cleanStr = res.content.toString().trim();
        if (cleanStr.startsWith("```json"))
          cleanStr = cleanStr
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        return { __final_payload__: JSON.parse(cleanStr) };
      }

      return { __final_payload__: responsePayload };
    });
    workflow.addEdge(resNode.id, END);
  }

  // Add Edges & Routing
  const edgesBySource: Record<string, any[]> = {};
  for (const edge of edges) {
    const sourceNode = nodes.find((n: any) => n.id === edge.source);
    const actualSource = (
      sourceNode?.type === "trigger" ? START : edge.source
    ) as string;
    if (!edgesBySource[actualSource]) edgesBySource[actualSource] = [];
    edgesBySource[actualSource].push(edge);
  }

  for (const [sourceId, outgoingEdges] of Object.entries(edgesBySource)) {
    const hasConditions = outgoingEdges.some((e: any) => e.data?.label?.trim());
    const possibleTargets = outgoingEdges.map((e: any) => e.target).concat(END);

    if (hasConditions) {
      workflow.addConditionalEdges(
        sourceId as any,
        async (state: any) => {
          if (state.__error__) return END;
          for (const edge of outgoingEdges) {
            const condition = edge.data?.label?.trim();
            if (!condition) return edge.target; // Default fallback

            const prompt = PromptTemplate.fromTemplate(
              manifest.engine_prompts.edge_router,
            );
            const formatted = await prompt.format({
              __persona__: globalPersona,
              __state__: JSON.stringify(state),
              __condition__: condition,
              __expected_inputs__: JSON.stringify(
                Object.values(triggerNode.data.initialization_mapping || {}),
              ),
            });

            const res = await llm.invoke(formatted);
            let cleanStr = res.content.toString().trim();
            if (cleanStr.startsWith("```json"))
              cleanStr = cleanStr
                .replace(/^```json/, "")
                .replace(/```$/, "")
                .trim();

            if (JSON.parse(cleanStr).is_true) return edge.target;
          }
          return END;
        },
        possibleTargets,
      );
    } else {
      workflow.addEdge(sourceId as any, outgoingEdges[0].target);
    }
  }

  const executionNodes = [...toolNodes, ...mcpNodes];
  const hasStartEdge = edges.some((e: any) => {
    const src = nodes.find((n: any) => n.id === e.source);
    return src?.type === "trigger";
  });

  if (!hasStartEdge && executionNodes.length > 0) {
    workflow.addConditionalEdges(
      START,
      (state: any) => (state.__error__ ? END : executionNodes[0].id),
      [executionNodes[0].id, END],
    );
    if (responseNodes.length > 0) {
      workflow.addConditionalEdges(
        executionNodes[executionNodes.length - 1].id,
        (state: any) => (state.__error__ ? END : responseNodes[0].id),
        [responseNodes[0].id, END],
      );
    }
  }

  const app = workflow.compile({
    checkpointer,
    interruptBefore: interruptNodes.map((n: any) => n.id),
  });

  const executionConfig = { configurable: { thread_id: threadId } };
  let finalState: any;

  // ==========================================
  // 2. EXECUTION LOGIC (Start vs Resume)
  // ==========================================

  if (resumeData) {
    await app.updateState(executionConfig, { __human_feedback__: resumeData });
    finalState = await app.invoke(null, executionConfig);
  } else {
    // 1. Extract input using the LLM
    const extractionPrompt = PromptTemplate.fromTemplate(
      manifest.engine_prompts.trigger_extractor,
    );
    const extractionFormatted = await extractionPrompt.format({
      __persona__: globalPersona,
      __trigger_instructions__: triggerNode.data.custom_instructions || "",
      __schema__: JSON.stringify(triggerNode.data.expected_payload || {}),
      __input__: userInput,
    });

    const extractionRes = await llm.invoke(extractionFormatted);
    let parsedInput = {};
    try {
      let cleanStr = extractionRes.content.toString().trim();
      if (cleanStr.startsWith("```json"))
        cleanStr = cleanStr
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim();
      parsedInput = JSON.parse(cleanStr);
    } catch (e: any) {
      console.error("Extraction failed, using raw input.");
    }

    // 2. Map input to initial state
    const initialState: any = {};
    const initMap = triggerNode.data.initialization_mapping || {};
    for (const [payloadKey, stateKey] of Object.entries(initMap)) {
      if ((parsedInput as any)[payloadKey] !== undefined) {
        initialState[stateKey as string] = (parsedInput as any)[payloadKey];
      }
    }

    finalState = await app.invoke(initialState, executionConfig);
  }

  // ==========================================
  // 3. CHECK FOR INTERRUPT
  // ==========================================
  const threadState = await app.getState(executionConfig);
  const isInterrupted = threadState.next && threadState.next.length > 0;

  if (isInterrupted) {
    return {
      status: "interrupted",
      node: threadState.next[0],
      state: threadState.values,
    };
  }

  // 4. HANDLE SYSTEM ERROR
  if (finalState.__error__) {
    return {
      status: "completed",
      result: { error: finalState.__error__ },
    };
  }

  return {
    status: "completed",
    result: finalState.__final_payload__,
  };
}
