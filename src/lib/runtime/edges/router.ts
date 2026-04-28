import { END } from "@langchain/langgraph";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { ManifestEdge, NodeContext, GraphState } from "../types";

/**
 * Creates an edge routing function for the LangGraph workflow.
 * Evaluates conditional edges dynamically using an LLM, routing the
 * execution flow based on natural language conditions.
 * @param sourceId - The ID of the node originating the edges.
 * @param outgoingEdges - Array of possible edges to traverse from the source.
 * @param expectedInputStateKeys - Keys expected in the input state, provided to the LLM for context.
 * @param context - Shared execution context (LLM, reporter, manifest, etc.).
 */
export function createEdgeRouter(
  sourceId: string,
  outgoingEdges: ManifestEdge[],
  expectedInputStateKeys: string[],
  context: NodeContext,
) {
  const { manifest, llm, reporter, getLabel, globalPersona } = context;

  // 1. Hoist static configurations outside the execution cycle for performance.
  // This prevents recompiling the prompt template, parsing JSON, and building
  // the Zod schema on every single edge evaluation attempt.
  const promptTemplate = PromptTemplate.fromTemplate(
    manifest.engine_prompts.edge_router,
  );

  const expectedInputsString = JSON.stringify(expectedInputStateKeys);

  const routerSchema = z.object({
    reasoning: z
      .string()
      .describe("Explanation for why the condition is met or not"),
    is_true: z
      .boolean()
      .describe("True if the current state satisfies the condition"),
  });

  // 2. Pre-configure the LLM with structured output and resilience (retries).
  const routerLlm = llm
    .withStructuredOutput(routerSchema, { name: "edge_router" })
    .withRetry({ stopAfterAttempt: 3 });

  // 3. Return the state evaluation function used by LangGraph.
  return async (state: GraphState) => {
    // Halt execution immediately if a system error was flagged in the state
    if (state.__error__) return END;

    for (const edge of outgoingEdges) {
      const condition = edge.data?.label?.trim();

      // Unconditional edge (Default Fallback)
      if (!condition) {
        reporter?.onEdgeTraversal?.(
          getLabel(sourceId),
          getLabel(edge.target),
          "Default Fallback",
        );
        return edge.target;
      }

      try {
        // Format the prompt with the current runtime state
        const formattedPrompt = await promptTemplate.format({
          __persona__: globalPersona,
          __state__: JSON.stringify(state),
          __condition__: condition,
          __expected_inputs__: expectedInputsString,
        });

        // Evaluate the natural language condition using the LLM
        const result = (await routerLlm.invoke(formattedPrompt)) as {
          reasoning: string;
          is_true: boolean;
        };

        // If the LLM determines this edge's condition is met, take this route
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
        console.error(`[DEBUG] Router failed, reverting to fail-open:`, err);

        // Fail-safe logic: If LLM fails evaluating conditions after retries,
        // safely proceed down this route to prevent a dead-end loop or graph crash.
        reporter?.onEdgeTraversal?.(
          getLabel(sourceId),
          getLabel(edge.target),
          "Error Fallback",
          "LLM evaluation failed, routing to default target.",
        );
        return edge.target;
      }
    }

    // If no conditions match and there is no default fallback, end the graph execution.
    return END;
  };
}
