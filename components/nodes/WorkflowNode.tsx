import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Bot, Hand, ChevronRight, Wrench } from "lucide-react";

export type WorkflowNodeData = {
  label: string;
  skillId?: string;
  description?: string;
};

export type WorkflowNodeType = Node<WorkflowNodeData, "skill" | "interrupt">;

export function WorkflowNode({
  data,
  type,
  selected,
}: NodeProps<WorkflowNodeType>) {
  let theme = {
    bg: "bg-blue-50/50",
    border: "border-blue-100",
    iconBg: "bg-blue-100",
    text: "text-blue-600",
    ring: "border-blue-500 shadow-md ring-4 ring-blue-50",
    label: "Skill Node",
    Icon: Bot,
  };

  if (type === "interrupt") {
    theme = {
      bg: "bg-orange-50/50",
      border: "border-orange-100",
      iconBg: "bg-orange-100",
      text: "text-orange-600",
      ring: "border-orange-500 shadow-md ring-4 ring-orange-50",
      label: "Interrupt",
      Icon: Hand,
    };
  }

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
      {/* Target Handle (Left) - Always visible for Skills/Interrupts now */}
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
            {data.label}
          </h3>
          <p
            className={`text-[10px] font-semibold uppercase tracking-wider ${theme.text}`}
          >
            {theme.label}
          </p>
        </div>
      </div>

      <div className="p-3 bg-white rounded-b-xl min-h-[60px]">
        {type === "skill" ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 line-clamp-2">
              {data.description || "No description provided."}
            </p>
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-1 rounded border border-slate-100">
              <Wrench className="w-3 h-3" /> {data.skillId}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Human approval required.
          </p>
        )}
      </div>

      {/* Source Handle (Right) */}
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
