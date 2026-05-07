import { Handle, Position, NodeProps, type Node } from "@xyflow/react";
import { FileText, ArrowRightLeft } from "lucide-react";

export type DocumentNodeData = {
  label: string;
  input_mapping?: Record<string, string>;
  output_mapping?: Record<string, string>;
  custom_instructions?: string;
  active?: boolean;
  file_type?: string; // NEW
};

export type DocumentNodeType = Node<DocumentNodeData, "document">;

export function DocumentNode({ data, selected }: NodeProps<DocumentNodeType>) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all w-[260px] ${
        selected
          ? "border-rose-500 shadow-md ring-4 ring-rose-50"
          : data.active
            ? "border-rose-400 ring-4 ring-rose-100 animate-pulse"
            : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-rose-500 border-2 border-white -ml-1.5"
      />

      <div className="bg-rose-50/50 border-b border-rose-100 p-3 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 text-rose-600 shadow-sm border border-rose-200">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">
              {data.label || "Generate File"}
            </h3>
            <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
              {data.file_type
                ? `${data.file_type} Generator`
                : "File Generator"}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white rounded-b-xl flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs font-mono bg-slate-50 p-1.5 rounded border border-slate-100">
          <span className="text-slate-500 truncate w-20">
            {data.input_mapping?.source_data || "No input"}
          </span>
          <ArrowRightLeft className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-rose-600 truncate w-20 text-right">
            {data.output_mapping?.file_url || "No output"}
          </span>
        </div>
      </div>

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-slate-400 border-2 border-white -mr-1.5"
      />
    </div>
  );
}
