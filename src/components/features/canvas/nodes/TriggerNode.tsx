import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Zap, ChevronRight } from "lucide-react";
import { NodeMapping } from "./NodeMapping";

export type TriggerNodeData = {
  label: string;
  expected_payload?: any;
  initialization_mapping?: Record<string, string>;
  active?: boolean; // NEW: For real-time execution highlighting
};

export type TriggerNodeType = Node<TriggerNodeData, "trigger">;

export function TriggerNode({ data, selected }: NodeProps<TriggerNodeType>) {
  const theme = {
    bg: "bg-sky-50/50",
    border: "border-sky-100",
    iconBg: "bg-sky-100",
    text: "text-sky-700",
    ring: "border-sky-500 shadow-md ring-4 ring-sky-50",
    label: "Trigger (API Input)",
    Icon: Zap,
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
    data.initialization_mapping &&
    Object.values(data.initialization_mapping).some(Boolean);

  // NEW: Dynamic active styling
  const activeRing = data.active
    ? "ring-4 ring-indigo-400 border-indigo-500 scale-105 z-10 relative"
    : "border-slate-200";

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-300 w-[240px] ${selected ? theme.ring : activeRing}`}
    >
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
            {data.label || "API Request"}
          </h3>
          <p
            className={`text-sm font-semibold uppercase tracking-wider ${theme.text}`}
          >
            {theme.label}
          </p>
        </div>
      </div>
      <div className="p-3 bg-white rounded-b-xl min-h-[60px] flex flex-col justify-center">
        <p className="text-xs text-slate-500 italic">
          Defines the input payload required to start this agent.
        </p>

        {/* Initialization Mapping Visualizer */}
        {hasMapping && (
          <div className="space-y-1.5 border-t border-slate-100 pt-2 mt-2">
            {Object.entries(data.initialization_mapping || {}).map(
              ([k, v]) =>
                v && (
                  <NodeMapping
                    key={`init-${k}`}
                    globalKey={v}
                    localKey={k}
                    flowDirection="local-to-global"
                    localType="input"
                  />
                ),
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
        className="group !p-0"
      >
        <div
          className={`w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform group-hover:scale-110 bg-white ${theme.text}`}
        >
          <ChevronRight className="w-4 h-4" />
        </div>
      </Handle>
    </div>
  );
}
