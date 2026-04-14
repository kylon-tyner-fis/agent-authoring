import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { AgentConfig, SkillConfig } from "./constants";

export async function compileAndRunAgent(
  config: AgentConfig,
  skills: SkillConfig[],
  userInput: string,
) {
  console.log("\n--- [DEBUG] STARTING AGENT EXECUTION ---");
  const nodes = config.orchestration?.nodes || [];
  const edges = config.orchestration?.edges || [];

  const triggerNode = nodes.find((n: any) => n.type === "trigger");
  const responseNode = nodes.find((n: any) => n.type === "response");

  if (!triggerNode || !responseNode) {
    throw new Error(
      "Graph must have at least one Trigger node and one Response node.",
    );
  }

  // 1. Initialize state: SMART INPUT EXTRACTION
  let parsedInput: any = {};
  try {
    // If the user pastes raw JSON into the playground, use it directly
    parsedInput = JSON.parse(userInput);
    console.log("[DEBUG] Parsed input as raw JSON.");
  } catch (e) {
    // If it's natural language, use the LLM to extract the Trigger Schema!
    console.log(
      "[DEBUG] Natural language detected. Running Smart Extraction...",
    );

    if (process.env.OPENAI_API_KEY) {
      try {
        const extractionLlm = new ChatOpenAI({
          modelName: "gpt-4o-mini",
          temperature: 0, // 0 for deterministic, accurate extraction
          modelKwargs: { response_format: { type: "json_object" } },
        });

        const schemaString = JSON.stringify(
          triggerNode.data.expected_payload || {},
        );
        const extractionPrompt = PromptTemplate.fromTemplate(
          `You are an API payload extractor. Extract the user's intent into the following JSON schema: {__schema__}\n\nUser Input: {__input__}\n\nReturn ONLY valid JSON. If a field is not explicitly mentioned but can be logically inferred, do so. Otherwise, leave it null.`,
        );

        const formatted = await extractionPrompt.format({
          __schema__: schemaString,
          __input__: userInput,
        });

        const response = await extractionLlm.invoke(formatted);
        let cleanStr = response.content.toString().trim();
        if (cleanStr.startsWith("```json")) {
          cleanStr = cleanStr
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim();
        }

        parsedInput = JSON.parse(cleanStr);
        console.log("[DEBUG] Smart Extraction Result:", parsedInput);
      } catch (extError) {
        console.error("[DEBUG] Smart Extraction failed:", extError);
        // Fallback if extraction fails
        const expectedKeys = Object.keys(
          triggerNode.data.expected_payload || {},
        );
        if (expectedKeys.length > 0)
          parsedInput = { [expectedKeys[0]]: userInput };
      }
    } else {
      // Fallback for mock execution
      const expectedKeys = Object.keys(triggerNode.data.expected_payload || {});
      if (expectedKeys.length > 0)
        parsedInput = { [expectedKeys[0]]: userInput };
    }
  }

  const initialState: Record<string, any> = {};
  const initMap = triggerNode.data.initialization_mapping || {};

  // AUTO-MAP Trigger Inputs to Global State
  const expectedPayloadKeys = Object.keys(
    triggerNode.data.expected_payload || {},
  );
  for (const payloadKey of expectedPayloadKeys) {
    const stateKey = initMap[payloadKey] || payloadKey;
    if (parsedInput[payloadKey] !== undefined) {
      initialState[stateKey] = parsedInput[payloadKey];
    }
  }
  console.log("[DEBUG] Initial State populated:", initialState);

  // 2. Define StateGraph channels
  const channels: Record<string, any> = {};
  Object.keys(config.state_schema || {}).forEach((key) => {
    channels[key] = {
      value: (prev: any, next: any) => (next !== undefined ? next : prev),
      default: () => null,
    };
  });

  Object.keys(initialState).forEach((key) => {
    if (!channels[key]) {
      channels[key] = {
        value: (prev: any, next: any) => (next !== undefined ? next : prev),
        default: () => null,
      };
    }
  });

  const workflow = new StateGraph<any>({ channels });

  // 3. Add Nodes (Skills)
  const skillNodes = nodes.filter((n: any) => n.type === "skill");
  for (const node of skillNodes) {
    const skill = skills.find((s) => s.id === node.data.skillId);
    if (!skill) continue;

    workflow.addNode(node.id, async (state: any) => {
      console.log(`\n[DEBUG] Executing Node: ${node.data.label} (${node.id})`);

      const localInputs: Record<string, any> = {};
      const inMap = node.data.input_mapping || {};

      for (const localKey of Object.keys(skill.input_schema || {})) {
        const globalKey = inMap[localKey] || localKey;
        localInputs[localKey] =
          state[globalKey] !== undefined ? state[globalKey] : "";
      }

      let outputData: Record<string, any> = {};

      if (process.env.OPENAI_API_KEY) {
        try {
          const llm = new ChatOpenAI({
            modelName: config.model.model_name || "gpt-4o-mini",
            temperature: config.model.temperature || 0.7,
            modelKwargs: { response_format: { type: "json_object" } },
          });

          const schemaString = JSON.stringify(skill.output_schema || {});
          const inputsString = JSON.stringify(localInputs, null, 2);

          const systemInstruction = `\n\n--- SYSTEM INSTRUCTIONS ---\n1. Task Inputs (Use these to guide your response):\n{__inputsString__}\n\n2. Return your response as a valid JSON object matching this exact schema: {__schemaString__}. Return ONLY raw JSON.`;

          const prompt = PromptTemplate.fromTemplate(
            skill.prompt_template + systemInstruction,
          );

          const formatted = await prompt.format({
            ...localInputs,
            __schemaString__: schemaString,
            __inputsString__: inputsString,
          });

          console.log(`[DEBUG] Sending prompt to LLM...`);
          const response = await llm.invoke(formatted);

          try {
            let cleanStr = response.content.toString().trim();
            if (cleanStr.startsWith("```json")) {
              cleanStr = cleanStr
                .replace(/^```json/, "")
                .replace(/```$/, "")
                .trim();
            }
            const parsedResponse = JSON.parse(cleanStr);
            console.log(
              `[DEBUG] Parsed LLM JSON successfully:`,
              parsedResponse,
            );

            for (const key of Object.keys(skill.output_schema || {})) {
              outputData[key] = parsedResponse[key];
            }
          } catch (parseErr) {
            console.error("[DEBUG] Failed to parse JSON. Error:", parseErr);
            const outKeys = Object.keys(skill.output_schema || {});
            if (outKeys.length > 0) {
              outputData[outKeys[0]] = response.content;
            }
          }
        } catch (e: any) {
          console.error("[DEBUG] LLM Invocation Error:", e);
          const outKeys = Object.keys(skill.output_schema || {});
          if (outKeys.length > 0) {
            outputData[outKeys[0]] = `Error: ${e.message}`;
          }
        }
      } else {
        console.log(`[DEBUG] Mock Execution running`);
        for (const key of Object.keys(skill.output_schema || {})) {
          outputData[key] = `[Mocked output for ${key}]`;
        }
      }

      const stateUpdates: Record<string, any> = {};
      const outMap = node.data.output_mapping || {};

      for (const localKey of Object.keys(outputData)) {
        const globalKey = outMap[localKey] || localKey;
        stateUpdates[globalKey] = outputData[localKey];
      }

      return stateUpdates;
    });
  }

  // 4. Add Edges
  for (const edge of edges) {
    const sourceNode = nodes.find((n: any) => n.id === edge.source);
    const targetNode = nodes.find((n: any) => n.id === edge.target);

    if (!sourceNode || !targetNode) continue;

    if (sourceNode.type === "trigger" && targetNode.type === "response") {
      workflow.addEdge(START, END);
    } else if (sourceNode.type === "trigger") {
      workflow.addEdge(START, edge.target);
    } else if (targetNode.type === "response") {
      workflow.addEdge(edge.source, END);
    } else if (sourceNode.type === "skill" && targetNode.type === "skill") {
      workflow.addEdge(edge.source, edge.target);
    }
  }

  const hasStartEdge = edges.some((e: any) => {
    const src = nodes.find((n: any) => n.id === e.source);
    return src?.type === "trigger";
  });

  if (!hasStartEdge && skillNodes.length > 0) {
    workflow.addEdge(START, skillNodes[0].id);
    workflow.addEdge(skillNodes[skillNodes.length - 1].id, END);
  }

  // 5. Compile and Run
  const app = workflow.compile();
  console.log(`\n[DEBUG] Invoking Graph...`);
  const finalState = await app.invoke(initialState);

  // 6. Extract Final Response
  const responsePayload: Record<string, any> = {};
  const extMap = responseNode.data.extraction_mapping || {};
  const expectedOutputKeys = Object.keys(
    responseNode.data.response_payload || {},
  );

  for (const payloadKey of expectedOutputKeys) {
    const stateKey = extMap[payloadKey] || payloadKey;
    responsePayload[payloadKey] =
      finalState[stateKey] !== undefined ? finalState[stateKey] : null;
  }

  if (expectedOutputKeys.length === 0) {
    Object.assign(responsePayload, finalState);
  }

  console.log("--- [DEBUG] AGENT EXECUTION COMPLETE ---\n");

  return {
    extracted_data: responsePayload,
    ...finalState,
  };
}
