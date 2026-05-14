import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Database, Type, ChevronRight } from "lucide-react";

export type ValueNodeData = {
  label: string;
  source_type: "state" | "static";
  state_key?: string;
  static_value?: string;
  active?: boolean;
};

export type ValueNodeType = Node<ValueNodeData, "value">;

export function ValueNode({ data, selected }: NodeProps<ValueNodeType>) {
  const isStatic = data.source_type === "static";
  
  const theme = {
    bg: isStatic ? "bg-amber-50/50" : "bg-indigo-50/50",
    border: isStatic ? "border-amber-100" : "border-indigo-100",
    iconBg: isStatic ? "bg-amber-100" : "bg-indigo-100",
    text: isStatic ? "text-amber-700" : "text-indigo-700",
    ring: isStatic ? "border-amber-500 shadow-md ring-4 ring-amber-50" : "border-indigo-500 shadow-md ring-4 ring-indigo-50",
    label: isStatic ? "Static Value" : "State Reference",
    Icon: isStatic ? Type : Database,
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
            {data.label || (isStatic ? "Literal" : "Memory")}
          </h3>
          <p
            className={`text-[10px] font-bold uppercase tracking-wider ${theme.text}`}
          >
            {theme.label}
          </p>
        </div>
      </div>
      
      <div className="p-3 bg-white rounded-b-xl min-h-[60px] flex flex-col justify-center">
        {isStatic ? (
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 overflow-hidden">
            <p className="text-xs font-mono text-slate-600 truncate">
              {data.static_value || "(empty value)"}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-indigo-50/50 rounded-lg px-2.5 py-1.5 border border-indigo-100/50 overflow-hidden">
            <Database className="w-3 h-3 text-indigo-400 shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 truncate">
              {data.state_key || "select_state..."}
            </p>
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
