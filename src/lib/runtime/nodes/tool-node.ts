import { PromptTemplate } from "@langchain/core/prompts";
import { mapSchemaToZod } from "../../utils/schema-mapper";
import { ManifestNode, NodeContext, GraphState } from "../types";

/**
 * Creates a Tool Node for the LangGraph workflow.
 * This node is responsible for executing a specific LLM-backed tool/skill.
 * It maps the global graph state into the tool's expected input schema,
 * invokes the LLM with the tool's specific prompt template, and then maps
 * the structured output back into the global state.
 *
 * @param node - The manifest definition for this tool node.
 * @param context - Shared execution context (LLM, reporter, manifest, etc.).
 * @returns An asynchronous LangGraph node execution function.
 */
export function createToolNode(node: ManifestNode, context: NodeContext) {
  const { manifest, llm, reporter, edges, getLabel, globalPersona } = context;
  const toolId = node.data.toolId as string;
  const tool = manifest.resolved_skills[toolId];

  if (!tool) {
    console.warn(
      `[DEBUG] Tool configuration for ID '${toolId}' not found in manifest.`,
    );
  }

  // 1. Hoist static configurations outside the execution cycle for performance.
  const nodeLabel = getLabel(node.id);
  const inMap = (node.data.input_mapping || {}) as Record<
    string,
    string | string[]
  >;
  const outMap = (node.data.output_mapping || {}) as Record<string, string>;
  const inputSchemaKeys = Object.keys(tool?.input_schema || {});

  const stepInstructions = node.data.custom_instructions
    ? `\n--- STEP-SPECIFIC INSTRUCTIONS ---\n${node.data.custom_instructions}\n`
    : "";
  const schemaString = JSON.stringify(tool?.output_schema || {});

  const prompt = tool
    ? PromptTemplate.fromTemplate(
        tool.prompt_template + manifest.engine_prompts.skill_system_wrapper,
      )
    : null;

  let structuredToolLlm: ReturnType<typeof llm.withStructuredOutput> | null =
    null;

  if (tool) {
    const toolZodSchema = mapSchemaToZod(tool.output_schema);
    const safeToolName =
      tool.name?.replace(/[^a-zA-Z0-9_-]/g, "_") || "tool_execution";

    structuredToolLlm = llm
      .withStructuredOutput(toolZodSchema, { name: safeToolName })
      .withRetry({ stopAfterAttempt: 3 });
  }

  return async (state: GraphState): Promise<GraphState> => {
    if (state.__error__) return {};
    if (!tool || !prompt || !structuredToolLlm) return {};

    reporter?.onNodeStart?.(nodeLabel);

    const localInputs: GraphState = {};

    // 2. Input Mapping
    for (const localKey of inputSchemaKeys) {
      const mapping = inMap[localKey];
      if (Array.isArray(mapping)) {
        const aggregated = mapping
          .map((globalKey) => state[globalKey])
          .filter((val) => val !== undefined && val !== null);

        localInputs[localKey] = aggregated.reduce(
          (acc: unknown[], val) => acc.concat(Array.isArray(val) ? val : [val]),
          [],
        );
      } else {
        const globalKey = mapping || localKey;
        localInputs[localKey] =
          state[globalKey] !== undefined ? state[globalKey] : "";
      }
    }

    const stateUpdates: GraphState = {};

    // 3. Prompt Formatting
    const formatted = await prompt.format({
      ...localInputs,
      __persona__: globalPersona,
      __node_instructions__: stepInstructions,
      __schema__: schemaString,
      __inputsString__: JSON.stringify(localInputs, null, 2),
    });

    // 4. Execution with Inline Catch
    // If it fails, we handle the error, apply it to stateUpdates, and return null.
    const outputData = await structuredToolLlm
      .invoke(formatted)
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(
          `[DEBUG] Tool execution failed for node ${node.id}:`,
          err,
        );
        stateUpdates["__error__"] =
          `Tool ${tool.name} failed execution: ${errorMessage}`;
        return null;
      });

    // 5. Output Mapping (Only runs if the LLM invocation was successful)
    if (outputData) {
      for (const localKey of Object.keys(outputData)) {
        const globalKey = outMap[localKey] || localKey;
        stateUpdates[globalKey] = outputData[localKey];
      }
    }

    // 6. Finalize
    reporter?.onNodeEnd?.(nodeLabel, stateUpdates, undefined, {
      ...state,
      ...stateUpdates,
    });

    const outgoingEdges = edges.filter((e) => e.source === node.id);
    if (outgoingEdges.length === 1 && !outgoingEdges[0].data?.label?.trim()) {
      reporter?.onEdgeTraversal?.(nodeLabel, getLabel(outgoingEdges[0].target));
    }

    return stateUpdates;
  };
}
