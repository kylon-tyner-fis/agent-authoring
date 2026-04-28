import { PromptTemplate } from "@langchain/core/prompts";
import { mapSchemaToZod } from "../../utils/schema-mapper";
import { ManifestNode, NodeContext, GraphState } from "../types";

export function createResponseNode(node: ManifestNode, context: NodeContext) {
  const { manifest, llm, reporter, getLabel, globalPersona } = context;

  return async (state: GraphState): Promise<GraphState> => {
    reporter?.onNodeStart?.(getLabel(node.id));

    const responsePayload: GraphState = {};
    const extMap = (node.data.extraction_mapping || {}) as Record<
      string,
      string
    >;
    const expectedOutputKeys = Object.keys(
      (node.data.response_payload || {}) as Record<string, string>,
    );

    for (const payloadKey of expectedOutputKeys) {
      const stateKey = extMap[payloadKey] || payloadKey;
      responsePayload[payloadKey] =
        state[stateKey] !== undefined ? state[stateKey] : null;
    }

    if (expectedOutputKeys.length === 0) {
      const { __final_payload__, __error__, __human_feedback__, ...rest } =
        state;
      Object.assign(responsePayload, rest);
    }

    if (node.data.custom_instructions) {
      try {
        const prompt = PromptTemplate.fromTemplate(
          manifest.engine_prompts.response_formatter,
        );
        const formatted = await prompt.format({
          __persona__: globalPersona,
          __response_instructions__: node.data.custom_instructions,
          __raw_data__: JSON.stringify(responsePayload),
          __schema__: JSON.stringify(
            expectedOutputKeys.length > 0
              ? node.data.response_payload
              : { final_output: "any" },
          ), // RESTORED FOR BACKWARD COMPATIBILITY
        });

        const responseZodSchema = mapSchemaToZod(
          (node.data.response_payload || {}) as Record<string, string>,
        );
        const responseFormatter = llm.withStructuredOutput(responseZodSchema);
        const finalParsed = await responseFormatter.invoke(formatted);

        reporter?.onNodeEnd?.(
          getLabel(node.id),
          { __final_payload__: finalParsed },
          "Formatted final response",
          { ...state, __final_payload__: finalParsed },
        );
        return { __final_payload__: finalParsed };
      } catch (err) {
        console.error("[DEBUG] Response formatter LLM failed:", err);
      }
    }

    reporter?.onNodeEnd?.(
      getLabel(node.id),
      { __final_payload__: responsePayload },
      "Returned raw final response",
      { ...state, __final_payload__: responsePayload },
    );
    return { __final_payload__: responsePayload };
  };
}
