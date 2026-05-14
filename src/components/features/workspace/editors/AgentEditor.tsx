// src/components/features/workspace/editors/AgentEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Bot, Save, Loader2, Play } from "lucide-react";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useWorkspace } from "@/src/lib/contexts/WorkspaceContext";
import { SlidingPlaygroundPanel } from "@/src/components/layout/SlidingPlaygroundPanel";
import { AgentPlayground } from "@/src/components/features/agent-editor/AgentPlayground";
import { AgentConfig } from "@/src/lib/types/constants";

interface AgentEditorProps {
  id: string;
}

export function AgentEditor({ id }: AgentEditorProps) {
  const { currentProject } = useProject();
  const { refreshTree } = useWorkspace();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);

  // Form State aligned with your DB schema
  const [formData, setFormData] = useState<AgentConfig>({
    id,
    project_id: currentProject?.id || "",
    name: "",
    description: "",
    system_prompt: "",
    skills: [],
  });

  // REAL FETCH
  useEffect(() => {
    async function fetchAgent() {
      if (!currentProject?.id) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/agents/${id}?projectId=${currentProject.id}`,
        );
        if (!res.ok) throw new Error("Failed to fetch agent");
        const data = await res.json();

        if (data.agent) {
          setFormData({
            id: data.agent.id || id,
            project_id: data.agent.project_id || currentProject.id,
            name: data.agent.name || "",
            description: data.agent.description || "",
            system_prompt: data.agent.system_prompt || "",
            skills: data.agent.skills || [],
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgent();
  }, [id, currentProject?.id]);

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
        `/api/agents/${id}?projectId=${currentProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            system_prompt: formData.system_prompt,
            skills: formData.skills,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to save agent");

      // Refresh the left panel tree so the new name reflects immediately!
      await refreshTree();

      // Optional: Add a toast notification here for success
    } catch (error) {
      console.error(error);
      // Optional: Add a toast notification here for error
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl shadow-sm border border-slate-200 m-4">
        <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">
          Loading agent settings...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex overflow-hidden bg-slate-50">
      <div className="flex flex-col h-full min-w-0 flex-1 bg-white rounded-xl shadow-sm border border-slate-200 m-4 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-fuchsia-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fuchsia-100 text-fuchsia-600 rounded-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                Agent Configuration
              </h1>
              <p className="text-xs text-slate-500 font-mono">ID: {id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* We'll hook this up to open the AgentPlayground next */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors shadow-sm"
              onClick={() => setIsPlaygroundOpen(true)}
            >
              <Play className="w-4 h-4 text-fuchsia-500 fill-fuchsia-500" />
              Playground
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white text-sm font-medium rounded-md hover:bg-fuchsia-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Identity Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                Agent Identity
              </h2>

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Agent Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Research Assistant"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 text-sm"
                />
              </div>

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
                  placeholder="Briefly describe this agent's purpose..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 text-sm resize-none"
                />
              </div>
            </div>

            {/* Core Logic Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                <Bot className="w-4 h-4 text-fuchsia-500" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Core Logic
                </h2>
              </div>

              <div className="pt-2">
                <label
                  htmlFor="system_prompt"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  System Prompt / Instructions
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Define exactly how this agent should behave. What is its
                  persona? What are its goals? (Global system instructions will
                  be prepended to this automatically).
                </p>
                <textarea
                  id="system_prompt"
                  name="system_prompt"
                  rows={12}
                  value={formData.system_prompt}
                  onChange={handleChange}
                  placeholder="e.g., You are an expert data researcher. Your goal is to gather facts using the Web Research skill and format them into comprehensive reports."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 text-sm font-mono text-slate-700 leading-relaxed"
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
          apiEndpoint="/api/agents/simulate"
          accent="agent"
          onClose={() => setIsPlaygroundOpen(false)}
        />
      </SlidingPlaygroundPanel>
    </div>
  );
}
