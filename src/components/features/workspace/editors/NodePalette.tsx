// src/components/features/workspace/editors/NodePalette.tsx
import React from "react";
import { Flag, ArrowRight, Zap, Hand, Code2, Database } from "lucide-react";
import { ToolConfig, MCPServerConfig } from "@/src/lib/types/constants";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, itemId: string) => void;
  availableTools: ToolConfig[];
  availableServers: MCPServerConfig[];
}

export function NodePalette({ onDragStart, availableTools, availableServers }: NodePaletteProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flow Control</span>
        <div className="grid grid-cols-2 gap-3">
          {[
            { type: "trigger", icon: Flag, color: "bg-rose-500", label: "Trigger" },
            { type: "response", icon: ArrowRight, color: "bg-emerald-500", label: "Response" },
            { type: "agent", icon: Zap, color: "bg-blue-500", label: "Agent Node" },
            { type: "interrupt", icon: Hand, color: "bg-amber-500", label: "Interrupt" }
          ].map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type, "")}
              className="group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-violet-500 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
            >
              <div className={`w-8 h-8 ${item.color} text-white rounded-lg flex items-center justify-center shadow-sm`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-600 group-hover:text-violet-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Tools</span>
        <div className="flex flex-wrap gap-2">
          {availableTools.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => onDragStart(e, "tool", t.id)}
              className="px-3 py-2 border border-amber-200 bg-white text-amber-700 rounded-xl cursor-grab hover:bg-amber-50 flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <Code2 className="w-3.5 h-3.5" /> {t.name}
            </div>
          ))}
          {availableTools.length === 0 && (
            <div className="w-full py-4 border border-dashed border-slate-200 rounded-xl flex items-center justify-center">
              <span className="text-[10px] text-slate-400 font-medium italic">No tools available</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MCP Servers</span>
        <div className="flex flex-wrap gap-2">
          {availableServers.map((s) => (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => onDragStart(e, "mcp_node", s.id)}
              className="px-3 py-2 border border-emerald-200 bg-white text-emerald-700 rounded-xl cursor-grab hover:bg-emerald-50 flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <Database className="w-3.5 h-3.5" /> {s.name}
            </div>
          ))}
          {availableServers.length === 0 && (
            <div className="w-full py-4 border border-dashed border-slate-200 rounded-xl flex items-center justify-center">
              <span className="text-[10px] text-slate-400 font-medium italic">No MCP servers available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
