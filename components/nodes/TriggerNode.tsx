import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Zap, ChevronRight } from "lucide-react";

export type TriggerNodeData = {
  label: string;
};

export type TriggerNodeType = Node<TriggerNodeData, "trigger">;

export function TriggerNode({ data, selected }: NodeProps<TriggerNodeType>) {
  const theme = {
    bg: "bg-emerald-50/50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100",
    text: "text-emerald-600",
    ring: "border-emerald-500 shadow-md ring-4 ring-emerald-50",
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

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all w-[240px] ${selected ? theme.ring : "border-slate-200"}`}
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
            className={`text-[10px] font-semibold uppercase tracking-wider ${theme.text}`}
          >
            {theme.label}
          </p>
        </div>
      </div>
      <div className="p-3 bg-white rounded-b-xl min-h-[60px]">
        <p className="text-xs text-slate-500 italic">
          Defines the input payload required to start this agent.
        </p>
      </div>
      {/* Source Handle ONLY (Right) */}
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
