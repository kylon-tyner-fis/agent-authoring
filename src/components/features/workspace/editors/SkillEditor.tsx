// src/components/features/workspace/editors/SkillEditor.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Network,
  Settings as SettingsIcon,
  Blocks,
  Play,
  ArrowRight,
  Database,
  Search,
  Code2,
  Trash2,
  History,
  Lock,
  ChevronDown,
  Loader2,
  X,
  Zap,
  Hand,
  Flag,
  Check,
  Brain,
} from "lucide-react";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useWorkspace } from "@/src/lib/contexts/WorkspaceContext";
import { OrchestrationCanvas, OrchestrationCanvasRef } from "../../canvas/OrchestrationCanvas";
import { SkillSettings } from "./SkillSettings";
import { Playground } from "../../skill-editor/Playground";
import { SlidingPlaygroundPanel } from "@/src/components/layout/SlidingPlaygroundPanel";
import { SkillConfig, ToolConfig, MCPServerConfig, Message, DEFAULT_SKILL_CONFIG } from "@/src/lib/types/constants";
import { NodePalette } from "./NodePalette";
import { useToast } from "@/src/components/layout/Toast";
import {
  WORKSPACE_ENTITY_DROPDOWN_ACTIVE_CLASS,
  WORKSPACE_ENTITY_DROPDOWN_IDLE_CLASS,
  WORKSPACE_ENTITY_ICON_SHELL_CLASS,
  WORKSPACE_ENTITY_PRIMARY_BUTTON_CLASS,
  WORKSPACE_ENTITY_SECTION_ICON_CLASS,
  WORKSPACE_ENTITY_THEME,
  WORKSPACE_ENTITY_TOGGLE_ACTIVE_CLASS,
  WORKSPACE_ENTITY_TOGGLE_IDLE_CLASS,
} from "../workspaceEntityTheme";

const SIDE_PANEL_WIDTH = 380;
const SIDE_PANEL_GAP = 16;

export function SkillEditor({ id }: SkillEditorProps) {
  const { currentProject } = useProject();
  const { refreshTree, lastUpdated, selectedNode, setSelectedNode } = useWorkspace();
  const { addToast } = useToast();
  const theme = WORKSPACE_ENTITY_THEME.skill;

  const [skillConfig, setSkillConfig] = useState<SkillConfig>(DEFAULT_SKILL_CONFIG);
  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [activePanel, setActivePanel] = useState<"palette" | "settings" | "playground" | null>(null);
  const [isCanvasSidePanelOpen, setIsCanvasSidePanelOpen] = useState(false);
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const canvasRef = useRef<OrchestrationCanvasRef>(null);

  const isReadOnly = skillConfig.status === "published";
  const isMemoryActive = activePanel === null && isMemoryPanelOpen;
  const floatingActionOffset = activePanel || isCanvasSidePanelOpen || isMemoryPanelOpen
    ? (SIDE_PANEL_WIDTH + SIDE_PANEL_GAP) / 2
    : 0;

  useEffect(() => {
    const loadSkill = async () => {
      if (!currentProject?.id) return;
      setIsLoading(true);
      try {
        const skillRes = await fetch(`/api/skills/${id}?projectId=${currentProject.id}`);
        const data = await skillRes.json();

        const rootId = data.skill.parent_id || data.skill.id;
        const [versionsRes, toolsRes, serversRes] = await Promise.all([
          fetch(`/api/skills?projectId=${currentProject.id}&rootId=${rootId}`),
          fetch(`/api/tools?projectId=${currentProject.id}`),
          fetch(`/api/mcp-servers?projectId=${currentProject.id}`),
        ]);

        const versionsData = await versionsRes.json();
        const toolsData = await toolsRes.json();
        const serversData = await serversRes.json();

        const versions = (versionsData.skills || []).sort((a: any, b: any) => {
          if (a.status === 'draft') return -1;
          if (b.status === 'draft') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const versionCount = versions.length;
        setSkillConfig({
          ...data.skill,
          versions: versions.map((v: any, index: number) => {
            const vNum = v.version_number || (versionCount - index);
            return {
              id: v.id,
              label: `v${vNum}${v.status === 'draft' ? ' (Draft)' : ''}`,
              description: (v.created_at || v.updated_at) ? new Date(v.created_at || v.updated_at).toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'No date',
              status: v.status,
              created_at: v.created_at
            };
          })
        });

        setAvailableTools(toolsData.tools || []);
        setAvailableServers(serversData.servers || []);
      } catch (err) {
        addToast("Failed to load skill", "error");
      } finally {
        setIsLoading(false);
      }
    };

    loadSkill();
  }, [id, currentProject?.id, lastUpdated]);

  const syncCanvasToSkillConfig = () => {
    if (!canvasRef.current) return;
    const { nodes, edges, viewport } = canvasRef.current.getCanvasData();
    const inferredState = canvasRef.current.getInferredStateSchema();

    setSkillConfig((prev) => ({
      ...prev,
      state_schema: inferredState,
      orchestration: {
        nodes: nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
        })),
        viewport,
      },
    }));
  };

  const handleSave = async () => {
    if (isReadOnly || !currentProject?.id) return;
    setIsSaving(true);
    try {
      const { nodes, edges, viewport } = canvasRef.current?.getCanvasData() || {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      const inferredState = canvasRef.current?.getInferredStateSchema() || {};

      const payload = {
        ...skillConfig,
        state_schema: inferredState,
        orchestration: {
          nodes: nodes.map((n: any) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          edges: edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: e.label,
          })),
          viewport,
        },
      };

      await fetch(`/api/skills/${id}?projectId=${currentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSkillConfig(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      addToast("Changes saved successfully", "success");
      refreshTree();
    } catch (err) {
      addToast("Failed to save changes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isReadOnly || !currentProject?.id) return;
    setIsPublishing(true);
    try {
      const inferredState = canvasRef.current?.getInferredStateSchema() || {};
      const canvasData = canvasRef.current?.getCanvasData() || {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      const nodes = canvasData.nodes as any[];
      const edges = canvasData.edges as any[];
      const viewport = canvasData.viewport;

      const orchestration = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
        })),
        viewport,
      };

      const res = await fetch(
        `/api/skills/${id}/publish?projectId=${currentProject.id}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...skillConfig,
          id,
          project_id: currentProject.id,
          orchestration,
          state_schema: inferredState,
        }),
      },
      );

      if (!res.ok) throw new Error("Failed to publish");

      const data = await res.json();

      setSkillConfig((prev) => ({
        ...prev,
        ...data.skill,
        versions: prev.versions,
      }));
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 2000);
      addToast("Version published", "success");
      refreshTree();
    } catch (err) {
      addToast("Publish failed", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, itemId: string) => {
    if (isReadOnly) return;
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (itemId) event.dataTransfer.setData("application/itemId", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const togglePanel = (panel: "palette" | "settings" | "playground") => {
    if (activePanel !== panel) {
      canvasRef.current?.clearSelection();
    }
    setActivePanel(activePanel === panel ? null : panel);
  };

  const toggleMemoryPanel = () => {
    if (isMemoryActive) {
      canvasRef.current?.clearSelection();
      return;
    }

    setActivePanel(null);
    canvasRef.current?.openStateSchema();
  };

  if (isLoading) {
    return (
      <div
        style={theme.style}
        className="flex h-full items-center justify-center bg-slate-50"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--entity-500)]" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Initialising Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={theme.style}
      className="flex flex-col h-full bg-white relative overflow-hidden"
    >
      <div className="flex-1 min-w-0 relative h-full">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>

        {/* 1. IDENTITY CLUSTER (Top-Left) */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          <div className="flex items-center gap-4 p-2.5 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)] hover:border-slate-300/80 group/identity">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-0.5 transition-transform duration-500 group-hover/identity:scale-110 group-hover/identity:rotate-3 ${WORKSPACE_ENTITY_ICON_SHELL_CLASS}`}>
              <Network className="w-6 h-6" />
            </div>

            <div className="flex flex-col pr-6 min-w-0 max-w-[320px]">
              <input
                type="text"
                value={skillConfig.name || ""}
                disabled={isReadOnly}
                onChange={(e) => setSkillConfig({ ...skillConfig, name: e.target.value })}
                className={`bg-transparent font-bold text-lg tracking-tight focus:outline-none focus:ring-0 placeholder:text-slate-200 truncate transition-all duration-300 ${isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-900 hover:text-[var(--entity-600)]"}`}
                placeholder="Untitled Skill"
              />

              <div className="flex items-center gap-2 mt-0.5">
                <Dropdown
                  trigger={(selected, isOpen) => (
                    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all duration-300 cursor-pointer group
                      ${isOpen 
                        ? WORKSPACE_ENTITY_DROPDOWN_ACTIVE_CLASS
                        : WORKSPACE_ENTITY_DROPDOWN_IDLE_CLASS
                      }`}>
                      <History className={`w-3.5 h-3.5 transition-colors ${isOpen ? "text-white/80" : "text-slate-400 group-hover:text-[var(--entity-500)]"}`} />
                      <div className="flex flex-col leading-none">
                        <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 transition-colors ${isOpen ? "text-white/70" : "text-slate-400"}`}>
                          Version
                        </span>
                        <span className={`text-[11px] font-bold tracking-tight transition-colors ${isOpen ? "text-white" : "text-slate-700"}`}>
                          {selected?.label || 'v1.0'}
                        </span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 transition-all duration-300 ${isOpen ? 'rotate-180 text-white/80' : 'text-slate-400 group-hover:text-[var(--entity-500)] group-hover:translate-y-0.5'}`} />
                    </div>
                  )}
                  value={id}
                  options={skillConfig.versions || []}
                  onChange={async (newId) => {
                    const selected = (skillConfig.versions || []).find(v => v.id === newId);
                    if (!selected || !selectedNode) return;

                    try {
                      if (selectedNode.parentId && currentProject?.id) {
                        const agentRes = await fetch(
                          `/api/agents/${selectedNode.parentId}?projectId=${currentProject.id}`
                        );
                        const agentData = await agentRes.json();

                        if (!agentRes.ok) {
                          throw new Error(agentData.error || "Failed to load agent");
                        }

                        const agent = agentData.agent;
                        const nextSkills = (agent.skills || []).map((skillId: string) =>
                          skillId === id ? newId : skillId
                        );

                        const updateRes = await fetch(
                          `/api/agents/${selectedNode.parentId}?projectId=${currentProject.id}`,
                          {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ...agent, skills: nextSkills }),
                          }
                        );

                        if (!updateRes.ok) {
                          throw new Error("Failed to update agent skill version");
                        }

                        await refreshTree();
                      }

                      setSelectedNode({
                        ...selectedNode,
                        id: newId,
                      });
                      addToast(`Switched to ${selected.label}`, "success");
                    } catch (err) {
                      addToast(
                        err instanceof Error ? err.message : "Failed to switch skill version",
                        "error"
                      );
                    }
                  }}
                />


                {isReadOnly && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
                    <Lock className="w-2.5 h-2.5 text-amber-500" />
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tight">Read Only</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. MAIN CANVAS AREA */}
        <div className="absolute inset-0 z-0 bg-slate-50/50">
          <OrchestrationCanvas
            ref={canvasRef}
            initialData={skillConfig.orchestration}
            availableTools={availableTools}
            availableServers={availableServers}
            globalStateSchema={skillConfig.state_schema}
            activeNodeId={activeNodeId}
            readOnly={isReadOnly}
            onSelectionChange={(hasSelection) => {
              setIsCanvasSidePanelOpen(hasSelection);
              if (hasSelection) {
                setActivePanel(null);
              }
            }}
            onStateSchemaOpenChange={setIsMemoryPanelOpen}
          />
        </div>

        {/* 3. UTILITY CLUSTER (Top-Right) */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end">
          <div className="flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/40 rounded-2xl">
            {!isReadOnly && (
              <button
                onClick={() => togglePanel("palette")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border ${activePanel === "palette"
                  ? WORKSPACE_ENTITY_TOGGLE_ACTIVE_CLASS
                  : WORKSPACE_ENTITY_TOGGLE_IDLE_CLASS
                  }`}
              >
                <Blocks className="w-4 h-4" />
                Nodes
              </button>
            )}

            <button
              onClick={() => togglePanel("settings")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border ${activePanel === "settings"
                ? WORKSPACE_ENTITY_TOGGLE_ACTIVE_CLASS
                : WORKSPACE_ENTITY_TOGGLE_IDLE_CLASS
                }`}
            >
              <SettingsIcon className="w-4 h-4" />
              Config
            </button>

            <button
              onClick={toggleMemoryPanel}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border ${isMemoryActive
                ? WORKSPACE_ENTITY_TOGGLE_ACTIVE_CLASS
                : WORKSPACE_ENTITY_TOGGLE_IDLE_CLASS
                }`}
            >
              <Brain className="w-4 h-4" />
              Memory
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isMemoryActive ? "bg-[var(--entity-500)] text-white" : "bg-slate-100 text-slate-500"}`}>
                {Object.keys(skillConfig.state_schema || {}).length}
              </span>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            <button
              onClick={() => togglePanel("playground")}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border ${activePanel === "playground"
                ? "bg-linear-to-br from-emerald-500 to-teal-600 text-white border-transparent shadow-lg shadow-emerald-500/20"
                : "bg-white border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600"
                }`}
            >
              <Play className="w-4 h-4" />
              Test
            </button>
          </div>
        </div>

        {/* 4. STANDARDIZED FLOATING PANELS (Right Side) */}
        {/* Node Palette Panel */}
        <div
          className={`absolute right-4 top-[78px] bottom-4 w-[380px] z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 ease-out origin-right ${activePanel === "palette"
            ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-x-8 scale-95 pointer-events-none"
            }`}
          style={{ right: SIDE_PANEL_GAP, width: SIDE_PANEL_WIDTH }}
        >
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Blocks className={`w-4 h-4 ${WORKSPACE_ENTITY_SECTION_ICON_CLASS}`} />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Node Palette</h2>
            </div>
            <button onClick={() => setActivePanel(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <NodePalette
              onDragStart={onDragStart}
              availableTools={availableTools}
              availableServers={availableServers}
            />
          </div>
        </div>

        {/* Skill Configuration Panel */}
        <div
          className={`absolute right-4 top-[78px] bottom-4 w-[380px] z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 ease-out origin-right ${activePanel === "settings"
            ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-x-8 scale-95 pointer-events-none"
            }`}
          style={{ right: SIDE_PANEL_GAP, width: SIDE_PANEL_WIDTH }}
        >
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <SettingsIcon className={`w-4 h-4 ${WORKSPACE_ENTITY_SECTION_ICON_CLASS}`} />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Skill Configuration</h2>
            </div>
            <button onClick={() => setActivePanel(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <SkillSettings
              data={skillConfig}
              readOnly={isReadOnly}
              onChange={(field, val) => setSkillConfig(prev => ({ ...prev, [field]: val, status: 'draft' }))}
            />
          </div>
        </div>

        <SlidingPlaygroundPanel isOpen={activePanel === "playground"}>
          <Playground
            config={skillConfig}
            messages={messages}
            setMessages={setMessages}
            onClose={() => setActivePanel(null)}
            onActiveNodeChange={setActiveNodeId}
          />
        </SlidingPlaygroundPanel>

        {/* 5. ACTION CLUSTER (Bottom-Center) */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-2xl transition-all duration-300 ease-out hover:scale-[1.02]"
          style={{ left: `calc(50% - ${floatingActionOffset}px)` }}
        >
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={isSaving || isPublishing}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-[0.1em] rounded-xl transition-all disabled:opacity-50 border
                ${saveSuccess
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-[var(--entity-50)] hover:border-[var(--entity-border)] hover:text-[var(--entity-600)] shadow-sm"
                }`}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <History className="w-3.5 h-3.5" />
              )}
              {isSaving ? "Saving..." : saveSuccess ? "Saved" : "Save Changes"}
            </button>
          )}

          {!isReadOnly && (
            <button
              onClick={handlePublish}
              disabled={isSaving || isPublishing}
              className={`flex items-center gap-2 px-6 py-2 text-xs font-black uppercase tracking-[0.1em] rounded-xl transition-all disabled:opacity-50 ${WORKSPACE_ENTITY_PRIMARY_BUTTON_CLASS}`}
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : publishSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {isPublishing ? "Publishing..." : publishSuccess ? "Published" : "Publish Version"}
            </button>
          )}

          {isReadOnly && (
            <div className="px-6 py-2 text-xs font-bold text-slate-400 bg-slate-50 rounded-xl border border-slate-100 italic">
              Viewing Published Snapshot
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SkillEditorProps {
  id: string;
}
