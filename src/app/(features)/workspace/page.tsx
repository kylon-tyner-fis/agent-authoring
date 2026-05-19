// src/app/(features)/workspace/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WorkspaceProvider, useWorkspace } from "@/src/lib/contexts/WorkspaceContext";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { SystemComposerPanel } from "@/src/components/features/workspace/SystemComposerPanel";
import { WorkspaceEditorPanel } from "@/src/components/features/workspace/WorkspaceEditorPanel";
import { SystemInspectorPanel } from "@/src/components/features/workspace/SystemInspectorPanel";

// --- MAIN PAGE WRAPPER ---

const LEFT_PANEL_WIDTH = 288;
const RIGHT_PANEL_WIDTH = 320;
const MINIMIZED_PANEL_WIDTH = 64;

function WorkspaceShell() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-slate-50 overflow-hidden">
      <aside
        className="shrink-0 border-r border-slate-200 bg-white"
        style={{ width: LEFT_PANEL_WIDTH }}
      />
      <main className="flex-1 min-w-0 bg-slate-50" />
      <aside
        className="shrink-0 border-l border-slate-200 bg-white"
        style={{ width: RIGHT_PANEL_WIDTH }}
      />
    </div>
  );
}

function WorkspaceContentInner() {
  const { currentProject } = useProject();
  const { activeOrchestratorId, setActiveOrchestratorId } = useWorkspace();
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false);
  const [isRightPanelMinimized, setIsRightPanelMinimized] = useState(false);

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
      <aside
        className="shrink-0 border-r border-slate-200 bg-white flex flex-col z-10 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)] transition-[width] duration-300 ease-out will-change-[width]"
        style={{
          width: isLeftPanelMinimized
            ? MINIMIZED_PANEL_WIDTH
            : LEFT_PANEL_WIDTH,
        }}
      >
        <SystemComposerPanel
          isMinimized={isLeftPanelMinimized}
          onToggleMinimized={() =>
            setIsLeftPanelMinimized((current) => !current)
          }
        />
      </aside>

      {/* MIDDLE PANEL: Dynamic Editor */}
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-slate-50">
        <WorkspaceEditorPanel />
      </main>

      {/* RIGHT PANEL: Inspector / Readiness */}
      <aside
        className="shrink-0 border-l border-slate-200 bg-white flex flex-col z-10 shadow-[-2px_0_8px_-4px_rgba(0,0,0,0.1)] transition-[width] duration-300 ease-out will-change-[width]"
        style={{
          width: isRightPanelMinimized
            ? MINIMIZED_PANEL_WIDTH
            : RIGHT_PANEL_WIDTH,
        }}
      >
        <SystemInspectorPanel
          isMinimized={isRightPanelMinimized}
          onToggleMinimized={() =>
            setIsRightPanelMinimized((current) => !current)
          }
        />
      </aside>
    </div>
  );
}

const WorkspaceContent = dynamic(
  async () => ({ default: WorkspaceContentInner }),
  {
    ssr: false,
    loading: () => <WorkspaceShell />,
  },
);

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
    </WorkspaceProvider>
  );
}
