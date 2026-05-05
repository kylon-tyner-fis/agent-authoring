import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { Database, ChevronRight, Server } from "lucide-react";
import { NodeMapping } from "./NodeMapping";

export type MCPNodeData = {
  label: string;
  serverId?: string;
  toolName?: string;
  input_mapping?: Record<string, string>;
  output_mapping?: Record<string, string>;
  active?: boolean;
};

export type MCPNodeType = Node<MCPNodeData, "mcp_node">;

export function MCPNode({ data, selected }: NodeProps<MCPNodeType>) {
  const theme = {
    bg: "bg-emerald-50/50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "border-emerald-500 shadow-md ring-4 ring-emerald-50",
    label: "MCP Action",
    Icon: Database,
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

  const hasInputs =
    data.input_mapping && Object.values(data.input_mapping).some(Boolean);
  const hasOutputs =
    data.output_mapping && Object.values(data.output_mapping).some(Boolean);

  const activeRing = data.active
    ? "ring-4 ring-indigo-400 border-indigo-500 scale-105 z-10 relative"
    : "border-slate-200";

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all w-[240px] ${selected ? theme.ring : activeRing}`}
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
            {data.label}
          </h3>
          <p
            className={`text-sm font-semibold uppercase tracking-wider ${theme.text}`}
          >
            {theme.label}
          </p>
        </div>
      </div>

      <div className="p-3 bg-white rounded-b-xl min-h-[60px] flex flex-col gap-3">
        <div className="flex items-center gap-1 text-xs font-mono text-slate-500 bg-slate-50 px-1.5 py-1 rounded border border-slate-100 self-start truncate max-w-full">
          <Server className="w-3 h-3 shrink-0" />{" "}
          {data.toolName || "No Action Selected"}
        </div>

        {(hasInputs || hasOutputs) && (
          <div className="space-y-1.5 border-t border-slate-100 pt-2 mt-1">
            {Object.entries(data.input_mapping || {}).flatMap(([k, v]) => {
              if (Array.isArray(v)) {
                return v
                  .filter(Boolean)
                  .map((item, idx) => (
                    <NodeMapping
                      key={`in-${k}-${idx}`}
                      globalKey={item}
                      localKey={`${k}[${idx}]`}
                      flowDirection="global-to-local"
                      localType="input"
                    />
                  ));
              }
              return v
                ? [
                    <NodeMapping
                      key={`in-${k}`}
                      globalKey={v as string}
                      localKey={k}
                      flowDirection="global-to-local"
                      localType="input"
                    />,
                  ]
                : [];
            })}
            {Object.entries(data.output_mapping || {}).map(
              ([k, v]) =>
                v && (
                  <NodeMapping
                    key={`out-${k}`}
                    globalKey={v}
                    localKey={k}
                    flowDirection="local-to-global"
                    localType="output"
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
