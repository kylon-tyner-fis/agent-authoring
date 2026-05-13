// src/app/(features)/workspace/page.tsx
"use client";

import React, { useEffect } from "react";
import {
  WorkspaceProvider,
  useWorkspace,
} from "@/src/lib/contexts/WorkspaceContext";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { SystemComposerPanel } from "@/src/components/features/workspace/SystemComposerPanel";
import { WorkspaceEditorPanel } from "@/src/components/features/workspace/WorkspaceEditorPanel";

function SystemReadinessPanel() {
  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Readiness
        </h2>
        <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
          Incomplete
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Validation Checklist will go here */}
        <div className="border border-slate-200 rounded p-3 mb-2 opacity-50">
          <p className="text-sm font-medium">Orchestrator Settings</p>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded p-3 mb-2">
          <p className="text-sm font-medium text-amber-900">
            Agents (0/1 Required)
          </p>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200 flex flex-col gap-2">
        <button className="w-full py-2 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200">
          Preview System
        </button>
        <button className="w-full py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 opacity-50 cursor-not-allowed">
          Publish Orchestrator
        </button>
      </div>
    </div>
  );
}

// --- MAIN PAGE WRAPPER ---

function WorkspaceContent() {
  const { currentProject } = useProject();
  const { activeOrchestratorId, setActiveOrchestratorId } = useWorkspace();

  // Replaced the hardcoded 'orch-test-123' with an actual fetch to get the first valid orchestrator
  useEffect(() => {
    async function loadInitialOrchestrator() {
      if (currentProject && !activeOrchestratorId) {
        try {
          // Fetch the list of orchestrators for the current project
          const response = await fetch(
            `/api/orchestrators?projectId=${currentProject.id}`,
          );
          const data = await response.json();

          if (data.orchestrators && data.orchestrators.length > 0) {
            // Set the active ID to the very first real orchestrator in the database
            setActiveOrchestratorId(data.orchestrators[0].id);
          }
        } catch (error) {
          console.error("Failed to load initial orchestrator:", error);
        }
      }
    }

    loadInitialOrchestrator();
  }, [currentProject, activeOrchestratorId, setActiveOrchestratorId]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-slate-50 overflow-hidden">
      {/* LEFT PANEL: Hierarchy Explorer */}
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col z-10 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)]">
        <SystemComposerPanel />
      </aside>

      {/* MIDDLE PANEL: Dynamic Editor */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-slate-50">
        <WorkspaceEditorPanel />
      </main>

      {/* RIGHT PANEL: Inspector / Readiness */}
      <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col z-10 shadow-[-2px_0_8px_-4px_rgba(0,0,0,0.1)]">
        <SystemReadinessPanel />
      </aside>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
    </WorkspaceProvider>
  );
}
