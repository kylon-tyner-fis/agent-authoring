import { END } from "@langchain/langgraph";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { ManifestEdge, NodeContext, GraphState } from "../types";

export function createEdgeRouter(
  sourceId: string,
  outgoingEdges: ManifestEdge[],
  expectedInputStateKeys: string[],
  context: NodeContext,
) {
  const { manifest, llm, reporter, getLabel, globalPersona } = context;

  return async (state: GraphState) => {
    if (state.__error__) return END;

    for (const edge of outgoingEdges) {
      const condition = edge.data?.label?.trim();
      if (!condition) {
        reporter?.onEdgeTraversal?.(
          getLabel(sourceId),
          getLabel(edge.target),
          "Default Fallback",
        );
        return edge.target;
      }

      try {
        const prompt = PromptTemplate.fromTemplate(
          manifest.engine_prompts.edge_router,
        );
        const formatted = await prompt.format({
          __persona__: globalPersona,
          __state__: JSON.stringify(state),
          __condition__: condition,
          __expected_inputs__: JSON.stringify(expectedInputStateKeys),
        });

        const routerSchema = z.object({
          reasoning: z.string(),
          is_true: z.boolean(),
        });
        const routerLlm = llm.withStructuredOutput(routerSchema);
        const result = (await routerLlm.invoke(formatted)) as {
          reasoning: string;
          is_true: boolean;
        };

        if (result.is_true) {
          reporter?.onEdgeTraversal?.(
            getLabel(sourceId),
            getLabel(edge.target),
            condition,
            result.reasoning,
          );
          return edge.target;
        }
      } catch (err) {
        console.error(`[DEBUG] Router failed:`, err);
      }
    }
    return END;
  };
}
