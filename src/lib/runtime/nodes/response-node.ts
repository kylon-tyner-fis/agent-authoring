import { PromptTemplate } from "@langchain/core/prompts";
import { mapSchemaToZod } from "../../utils/schema-mapper";
import { ManifestNode, NodeContext, GraphState } from "../types";

/**
 * Creates a Response Node for the LangGraph workflow.
 * This node acts as the final terminal in the graph. It is responsible for
 * extracting data from the internal state and assembling the final API payload.
 * Optionally, if custom instructions are provided, it leverages an LLM to
 * format, summarize, or synthesize the raw data into the target schema.
 *
 * @param node - The manifest definition for the response node.
 * @param context - Shared execution context (LLM, reporter, manifest, etc.).
 * @returns An asynchronous LangGraph node execution function.
 */
export function createResponseNode(node: ManifestNode, context: NodeContext) {
  const { manifest, llm, reporter, getLabel, globalPersona } = context;

  // 1. Hoist static configurations outside the execution cycle for performance.
  const nodeLabel = getLabel(node.id);
  const customInstructions = node.data.custom_instructions as
    | string
    | undefined;

  const expectedPayloadSchema = (node.data.response_payload || {}) as Record<
    string,
    string
  >;
  const expectedOutputKeys = Object.keys(expectedPayloadSchema);
  const extMap = (node.data.extraction_mapping || {}) as Record<string, string>;

  // Pre-compile LLM formatter and prompt template if instructions are present
  let formatterPrompt: PromptTemplate | null = null;
  let responseFormatter: ReturnType<typeof llm.withStructuredOutput> | null =
    null;

  if (customInstructions) {
    formatterPrompt = PromptTemplate.fromTemplate(
      manifest.engine_prompts.response_formatter,
    );

    const responseZodSchema = mapSchemaToZod(expectedPayloadSchema);
    responseFormatter = llm.withStructuredOutput(responseZodSchema, {
      name: "response_formatter",
    });
  }

  return async (state: GraphState): Promise<GraphState> => {
    const usedModel = manifest.engine.model.model_name;
    reporter?.onNodeStart?.(nodeLabel, usedModel);

    const responsePayload: GraphState = {};

    // 2. Extraction: Pull target values from the global graph state
    for (const payloadKey of expectedOutputKeys) {
      const stateKey = extMap[payloadKey] || payloadKey;
      responsePayload[payloadKey] =
        state[stateKey] !== undefined ? state[stateKey] : null;
    }

    // If no explicit schema is defined, dump all non-system state variables into the output
    if (expectedOutputKeys.length === 0) {
      const rest = { ...state };

      delete rest.__final_payload__;
      delete rest.__error__;
      delete rest.__human_feedback__;

      Object.assign(responsePayload, rest);
    }

    // 3. Formatting: If custom instructions exist, use the LLM to synthesize the final payload
    if (customInstructions && formatterPrompt && responseFormatter) {
      try {
        const formatted = await formatterPrompt.format({
          __persona__: globalPersona,
          __response_instructions__: customInstructions,
          __raw_data__: JSON.stringify(responsePayload),
          __schema__: JSON.stringify(
            expectedOutputKeys.length > 0
              ? expectedPayloadSchema
              : { final_output: "any" },
          ), // Maintained for backward compatibility
        });

        const finalParsed = (await responseFormatter.invoke(
          formatted,
        )) as GraphState;

        reporter?.onNodeEnd?.(
          nodeLabel,
          { __final_payload__: finalParsed },
          "Formatted final response via LLM",
          { ...state, __final_payload__: finalParsed },
          usedModel,
        );

        return { __final_payload__: finalParsed };
      } catch (err) {
        console.error(
          `[DEBUG] Response formatter LLM failed for node ${node.id}:`,
          err,
        );
        // Fall through to returning the raw payload if the LLM format fails
      }
    }

    // 4. Default/Fallback: Return the raw mapped payload
    reporter?.onNodeEnd?.(
      nodeLabel,
      { __final_payload__: responsePayload },
      "Returned raw final response",
      { ...state, __final_payload__: responsePayload },
      usedModel,
    );

    return { __final_payload__: responsePayload };
  };
}
