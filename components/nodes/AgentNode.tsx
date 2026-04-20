import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Bot } from "lucide-react";

// 1. Define just the payload
export type AgentNodeData = {
  label: string;
  prompt: string;
  tools: string[];
};

// 2. NEW: Wrap it in the official Node generic, mapping it to the "agent" type string
export type AgentNodeType = Node<AgentNodeData, "agent">;

// 3. Pass the full Node type to NodeProps
export function AgentNode({ data, selected }: NodeProps<AgentNodeType>) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all w-[250px] ${
        selected
          ? "border-blue-500 shadow-md ring-4 ring-blue-50"
          : "border-slate-200"
      }`}
    >
      {/* Input Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500"
      />

      {/* Node Header */}
      <div className="bg-blue-50/50 border-b border-blue-100 p-3 flex items-center gap-3 rounded-t-xl">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 truncate">
            {data.label}
          </h3>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
            Agent Node
          </p>
        </div>
      </div>

      {/* Node Body (Tool Previews) */}
      <div className="p-3 bg-white rounded-b-xl">
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">
          {data.prompt || "No prompt defined..."}
        </p>

        {data.tools && data.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.tools.map((t) => (
              <span
                key={t}
                className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Output Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-slate-400"
      />
    </div>
  );
}
