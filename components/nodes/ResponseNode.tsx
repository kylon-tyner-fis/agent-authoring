import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Flag, ChevronRight } from "lucide-react";
import { NodeMapping } from "./NodeMapping";

export type ResponseNodeData = {
  label: string;
  response_payload?: any;
  extraction_mapping?: Record<string, string>;
  active?: boolean; // NEW: For real-time execution highlighting
};

export type ResponseNodeType = Node<ResponseNodeData, "response">;

export function ResponseNode({ data, selected }: NodeProps<ResponseNodeType>) {
  const theme = {
    bg: "bg-purple-50/50",
    border: "border-purple-100",
    iconBg: "bg-purple-100",
    text: "text-purple-600",
    ring: "border-purple-500 shadow-md ring-4 ring-purple-50",
    label: "Response (API Output)",
    Icon: Flag,
  };

  const handleStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const hasMapping =
    data.extraction_mapping &&
    Object.values(data.extraction_mapping).some(Boolean);

  // NEW: Dynamic active styling
  const activeRing = data.active
    ? "ring-4 ring-indigo-400 border-indigo-500 scale-105 z-10 relative"
    : "border-slate-200";

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-300 w-[240px] ${selected ? theme.ring : activeRing}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
        className="group !p-0"
      >
        <div
          className={`w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform group-hover:scale-110 bg-white ${theme.text}`}
        >
          <ChevronRight className="w-4 h-4" />
        </div>
      </Handle>

      <div
        className={`${theme.bg} border-b ${theme.border} p-3 flex items-center gap-3 rounded-t-xl`}
      >
        <div
          className={`w-8 h-8 rounded-lg ${theme.iconBg} flex items-center justify-center shrink-0 ${theme.text}`}
        >
          <theme.Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 truncate">
            {data.label || "API Response"}
          </h3>
          <p
            className={`text-[10px] font-semibold uppercase tracking-wider ${theme.text}`}
          >
            {theme.label}
          </p>
        </div>
      </div>
      <div className="p-3 bg-white rounded-b-xl min-h-[60px] flex flex-col justify-center">
        <p className="text-xs text-slate-500 italic">
          Defines the final data returned to the caller.
        </p>

        {/* Extraction Mapping Visualizer */}
        {hasMapping && (
          <div className="space-y-1.5 border-t border-slate-100 pt-2 mt-2">
            {Object.entries(data.extraction_mapping || {}).map(
              ([k, v]) =>
                v && (
                  <NodeMapping
                    key={`ext-${k}`}
                    globalKey={v}
                    localKey={k}
                    flowDirection="global-to-local"
                    localType="output"
                  />
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
