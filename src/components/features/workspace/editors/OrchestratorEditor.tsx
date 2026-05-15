// src/components/features/workspace/editors/OrchestratorEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Layers, Save, Loader2, Play } from "lucide-react";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useWorkspace } from "@/src/lib/contexts/WorkspaceContext";
import { SlidingPlaygroundPanel } from "@/src/components/layout/SlidingPlaygroundPanel";
import { AgentPlayground } from "@/src/components/features/agent-editor/AgentPlayground";
import { OrchestratorConfig } from "@/src/lib/types/constants";

interface OrchestratorEditorProps {
  id: string;
}

export function OrchestratorEditor({ id }: OrchestratorEditorProps) {
  const { currentProject } = useProject();
  const { refreshTree, lastUpdated } = useWorkspace();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<OrchestratorConfig>({
    id,
    project_id: currentProject?.id || "",
    name: "",
    description: "",
    system_prompt: "",
    agents: [],
  });

  // REAL FETCH
  useEffect(() => {
    async function fetchOrchestrator() {
      if (!currentProject?.id) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/orchestrators/${id}?projectId=${currentProject.id}`,
        );
        if (!res.ok) throw new Error("Failed to fetch orchestrator");
        const data = await res.json();

        if (data.orchestrator) {
          setFormData({
            id: data.orchestrator.id || id,
            project_id: data.orchestrator.project_id || currentProject.id,
            name: data.orchestrator.name || "",
            description: data.orchestrator.description || "",
            system_prompt: data.orchestrator.system_prompt || "",
            agents: data.orchestrator.agents || [],
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrchestrator();
  }, [id, currentProject?.id, lastUpdated]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // REAL SAVE
  const handleSave = async () => {
    if (!currentProject?.id) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/orchestrators/${id}?projectId=${currentProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            system_prompt: formData.system_prompt,
            agents: formData.agents,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to save orchestrator");

      // Refresh the left panel tree so the new name reflects immediately
      await refreshTree();
    } catch (error) {
      console.error(error);
      alert("Failed to save orchestrator");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl shadow-sm border border-slate-200 m-4">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">
          Loading orchestrator settings...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex overflow-hidden bg-slate-50">
      <div className="flex flex-col h-full min-w-0 flex-1 bg-white rounded-xl shadow-sm border border-slate-200 m-4 overflow-hidden relative">
        {/* Header (Standardized to h-[60px] and solid bg-sky-50) */}
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-sky-100 bg-sky-50 shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-sky-100 text-sky-600 rounded-lg shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1 max-w-sm">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Untitled Orchestrator"
                className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded px-1 -ml-1 text-lg placeholder:text-slate-400 truncate"
              />
              <p className="text-[10px] text-slate-500 font-mono leading-none mt-1 ml-0.5">
                ID: {id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-slate-700 border border-sky-200 text-sm font-medium rounded-md hover:bg-sky-50 transition-colors shadow-sm ml-1"
              onClick={() => setIsPlaygroundOpen(true)}
            >
              <Play className="w-4 h-4 text-sky-500 fill-sky-500" />
              Playground
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-1.5 bg-sky-600 text-white text-sm font-medium rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Identity Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                Orchestrator Identity
              </h2>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Briefly describe what this orchestrator manages..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm resize-none"
                />
              </div>
            </div>

            {/* Core Logic Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                <Layers className="w-4 h-4 text-sky-500" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Routing & Logic
                </h2>
              </div>

              <div className="pt-2">
                <label
                  htmlFor="system_prompt"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  System Instructions / Routing Prompt
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Define how this orchestrator evaluates inputs and routes tasks
                  to its underlying agents and skills.
                </p>
                <textarea
                  id="system_prompt"
                  name="system_prompt"
                  rows={12}
                  value={formData.system_prompt}
                  onChange={handleChange}
                  placeholder="e.g., You are the top-level orchestrator. Evaluate user intent and route to the correct agent..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm font-mono text-slate-700 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SlidingPlaygroundPanel isOpen={isPlaygroundOpen}>
        <AgentPlayground
          config={{
            ...formData,
            id,
            project_id: formData.project_id || currentProject?.id || "",
          }}
          apiEndpoint="/api/orchestrators/simulate"
          accent="orchestrator"
          onClose={() => setIsPlaygroundOpen(false)}
        />
      </SlidingPlaygroundPanel>
    </div>
  );
}
