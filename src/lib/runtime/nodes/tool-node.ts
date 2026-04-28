import { PromptTemplate } from "@langchain/core/prompts";
import { mapSchemaToZod } from "../../utils/schema-mapper";
import { ManifestNode, NodeContext, GraphState } from "../types";

export function createToolNode(node: ManifestNode, context: NodeContext) {
  const { manifest, llm, reporter, edges, getLabel, globalPersona } = context;
  const toolId = node.data.toolId as string;
  const tool = manifest.resolved_skills[toolId];

  return async (state: GraphState): Promise<GraphState> => {
    if (state.__error__) return {};
    if (!tool) return {};

    reporter?.onNodeStart?.(getLabel(node.id));

    const localInputs: GraphState = {};
    const inMap = (node.data.input_mapping || {}) as Record<
      string,
      string | string[]
    >;

    for (const localKey of Object.keys(tool.input_schema || {})) {
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

    const prompt = PromptTemplate.fromTemplate(
      tool.prompt_template + manifest.engine_prompts.skill_system_wrapper,
    );
    const formatted = await prompt.format({
      ...localInputs,
      __persona__: globalPersona,
      __node_instructions__: node.data.custom_instructions
        ? `\n--- STEP-SPECIFIC INSTRUCTIONS ---\n${node.data.custom_instructions}\n`
        : "",
      __schema__: JSON.stringify(tool.output_schema || {}), // RESTORED FOR BACKWARD COMPATIBILITY
      __inputsString__: JSON.stringify(localInputs, null, 2),
    });

    let outputData: GraphState = {};
    const stateUpdates: GraphState = {};

    try {
      const toolZodSchema = mapSchemaToZod(tool.output_schema);
      const structuredToolLlm = llm.withStructuredOutput(toolZodSchema);
      outputData = (await structuredToolLlm.invoke(formatted)) as GraphState;
    } catch (e: any) {
      stateUpdates["__error__"] =
        `Tool ${tool.name} failed execution: ${e.message}`;
    }

    const outMap = (node.data.output_mapping || {}) as Record<string, string>;
    for (const localKey of Object.keys(outputData)) {
      const globalKey = outMap[localKey] || localKey;
      stateUpdates[globalKey] = outputData[localKey];
    }

    reporter?.onNodeEnd?.(getLabel(node.id), stateUpdates, undefined, {
      ...state,
      ...stateUpdates,
    });

    const outgoingEdges = edges.filter((e) => e.source === node.id);
    if (outgoingEdges.length === 1 && !outgoingEdges[0].data?.label?.trim()) {
      reporter?.onEdgeTraversal?.(
        getLabel(node.id),
        getLabel(outgoingEdges[0].target),
      );
    }

    return stateUpdates;
  };
}
