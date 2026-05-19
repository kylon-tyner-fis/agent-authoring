// src/components/features/workspace/WorkspaceEditorPanel.tsx
"use client";

import React from "react";
import { useWorkspace, EntityType } from "@/src/lib/contexts/WorkspaceContext";
import {
  Layers,
  Bot,
  Network,
  Wrench,
  Server,
  AlertCircle,
} from "lucide-react";
import { OrchestratorEditor } from "./editors/OrchestratorEditor";
import { AgentEditor } from "./editors/AgentEditor";
import { SkillEditor } from "./editors/SkillEditor";

// --- PLACEHOLDER EDITOR SHELLS ---
// We will replace these with the actual components in the next steps

function ToolEditorShell({ id }: { id: string }) {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 m-4 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-amber-50/50">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            Tool Configuration
          </h1>
          <p className="text-xs text-slate-500 font-mono">ID: {id}</p>
        </div>
      </div>
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="border-2 border-dashed border-amber-100 rounded-xl h-full flex items-center justify-center bg-amber-50/20 text-amber-800/50 font-medium">
          Tool API & Schema Form will mount here
        </div>
      </div>
    </div>
  );
}

function MCPServerEditorShell({ id }: { id: string }) {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 m-4 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-emerald-50/50">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            MCP Server Connection
          </h1>
          <p className="text-xs text-slate-500 font-mono">ID: {id}</p>
        </div>
      </div>
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="border-2 border-dashed border-emerald-100 rounded-xl h-full flex items-center justify-center bg-emerald-50/20 text-emerald-800/50 font-medium">
          MCP Connection Settings will mount here
        </div>
      </div>
    </div>
  );
}

// --- MAIN ROUTER PANEL ---

export function WorkspaceEditorPanel() {
  const { selectedNode } = useWorkspace();

  // Empty State
  if (!selectedNode || selectedNode.type === "group") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50">
        <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm mb-4">
          <Layers className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">
          Select an entity from the hierarchy to view or edit
        </p>
      </div>
    );
  }

  // Dynamic Router
  switch (selectedNode.type) {
    case "orchestrator":
      return <OrchestratorEditor id={selectedNode.id} />;
    case "agent":
      return <AgentEditor id={selectedNode.id} />;
    case "skill":
      return <SkillEditor id={selectedNode.id} />;
    case "tool":
      return <ToolEditorShell id={selectedNode.id} />;
    case "mcp_server":
      return <MCPServerEditorShell id={selectedNode.id} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-amber-600 bg-amber-50">
          <AlertCircle className="w-5 h-5 mr-2" />
          No editor available for type: {selectedNode.type}
        </div>
      );
  }
}
