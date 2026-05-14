// src/components/features/workspace/editors/SkillEditor.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Network,
  Save,
  Loader2,
  Play,
  Settings as SettingsIcon,
  Blocks,
  Zap,
  Flag,
  Hand,
  Code2,
  Database,
  ChevronDown,
} from "lucide-react";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useWorkspace } from "@/src/lib/contexts/WorkspaceContext";
import { SkillSettings } from "./SkillSettings";
import { Playground } from "@/src/components/features/skill-editor/Playground";
import { SlidingPlaygroundPanel } from "@/src/components/layout/SlidingPlaygroundPanel";
import {
  DEFAULT_SKILL_CONFIG,
  MCPServerConfig,
  Message,
  SkillConfig,
  ToolConfig,
} from "@/src/lib/types/constants";
import {
  OrchestrationCanvasRef,
  OrchestrationCanvas,
} from "../../canvas/OrchestrationCanvas";

interface SkillEditorProps {
  id: string;
}

type ActivePanel = "palette" | "settings" | null;

export function SkillEditor({ id }: SkillEditorProps) {
  const { currentProject } = useProject();
  const { refreshTree } = useWorkspace();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Single state for mutual exclusivity
  const [activePanel, setActivePanel] = useState<ActivePanel>("palette");

  const canvasRef = useRef<OrchestrationCanvasRef>(null);
  const [skillConfig, setSkillConfig] = useState<SkillConfig>({
    ...DEFAULT_SKILL_CONFIG,
    id,
    project_id: currentProject?.id || "",
    model: {
      ...DEFAULT_SKILL_CONFIG.model,
      model_name: "gpt-4o",
    },
  });

  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>(
    [],
  );

  const getCurrentCanvasData = () =>
    canvasRef.current?.getCanvasData() || skillConfig.orchestration;

  const getMcpServerIds = (canvasData: unknown) => {
    if (!canvasData || typeof canvasData !== "object")
      return skillConfig.mcp_servers;

    const nodes = (canvasData as { nodes?: unknown }).nodes;
    if (!Array.isArray(nodes)) return skillConfig.mcp_servers;

    return Array.from(
      new Set(
        nodes.flatMap((node) => {
          if (!node || typeof node !== "object") return [];

          const { type, data } = node as { type?: unknown; data?: unknown };
          if (type !== "mcp_node" || !data || typeof data !== "object") {
            return [];
          }

          const serverId = (data as { serverId?: unknown }).serverId;
          return typeof serverId === "string" && serverId ? [serverId] : [];
        }),
      ),
    );
  };

  const syncCanvasToSkillConfig = () => {
    const currentCanvasData = getCurrentCanvasData();
    if (!currentCanvasData) return skillConfig;

    const nextConfig = {
      ...skillConfig,
      mcp_servers: getMcpServerIds(currentCanvasData),
      orchestration: currentCanvasData,
    };

    setSkillConfig(nextConfig);
    return nextConfig;
  };

  useEffect(() => {
    async function fetchSkillData() {
      if (!currentProject?.id) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/skills/${id}?projectId=${currentProject.id}`,
        );
        const data = await res.json();

        const [toolsRes, serversRes] = await Promise.all([
          fetch(`/api/tools?projectId=${currentProject.id}`),
          fetch(`/api/mcp-servers?projectId=${currentProject.id}`),
        ]);

        // Restored the robust fallbacks here!
        if (toolsRes.ok) {
          const tData = await toolsRes.json();
          setAvailableTools((tData.tools || tData.data || []) as ToolConfig[]);
        }

        if (serversRes.ok) {
          const sData = await serversRes.json();
          setAvailableServers(
            (sData.mcp_servers ||
              sData.servers ||
              sData.data ||
              []) as MCPServerConfig[],
          );
        }

        if (data.skill) {
          setSkillConfig({
            ...DEFAULT_SKILL_CONFIG,
            ...data.skill,
            id: data.skill.id || id,
            project_id: data.skill.project_id || currentProject.id,
            model: {
              ...DEFAULT_SKILL_CONFIG.model,
              ...(data.skill.model || {
                provider: data.skill.provider || "openai",
                model_name: data.skill.model_name || "gpt-4o",
                temperature: data.skill.temperature ?? 0.7,
                max_tokens: data.skill.max_tokens ?? 4096,
              }),
            },
            mcp_servers: data.skill.mcp_servers || [],
            orchestration: data.skill.orchestration || undefined,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSkillData();
  }, [id, currentProject?.id]);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((current) => {
      const nextPanel = current === panel ? null : panel;

      // If we are opening a drawer, clear the canvas selection to close the Inspector
      if (nextPanel !== null) {
        canvasRef.current?.clearSelection();
      }

      return nextPanel;
    });
  };

  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    itemId?: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (itemId) event.dataTransfer.setData("application/itemId", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSave = async () => {
    if (!currentProject?.id) return;
    setIsSaving(true);
    try {
      const currentCanvasData = getCurrentCanvasData();
      const mcpServers = getMcpServerIds(currentCanvasData);
      const res = await fetch(
        `/api/skills/${id}?projectId=${currentProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...skillConfig,
            mcp_servers: mcpServers,
            orchestration: currentCanvasData,
          }),
        },
      );
      if (res.ok) {
        setSkillConfig((prev) => ({
          ...prev,
          mcp_servers: mcpServers,
          orchestration: currentCanvasData,
        }));
        await refreshTree();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading canvas...</p>
      </div>
    );

  return (
    <div className="h-full w-full flex overflow-hidden bg-slate-50">
      <div className="relative h-full min-w-0 flex-1 bg-slate-50 overflow-hidden">
        {/* 1. Canvas Area */}
        <div className="absolute inset-0 z-0">
          <OrchestrationCanvas
            ref={canvasRef}
            initialData={skillConfig.orchestration}
            availableTools={availableTools}
            availableServers={availableServers}
            activeNodeId={activeNodeId}
            readOnly={false}
            onSelectionChange={() => {
              setActivePanel(null);
            }}
          />
        </div>

        {/* 2. Unified Command Center (Header + Trays) */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col bg-violet-50 border border-violet-200 shadow-sm rounded-xl overflow-hidden transition-all">
          {/* Header Row */}
          <div className="flex items-center justify-between px-4 h-[60px] bg-violet-50 z-20 relative shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-violet-100 text-violet-600 rounded-lg shrink-0">
                <Network className="w-5 h-5" />
              </div>
              <div className="flex-1 max-w-sm">
                <input
                  type="text"
                  value={skillConfig.name}
                  onChange={(e) =>
                    setSkillConfig((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/50 rounded px-1 -ml-1 text-lg placeholder:text-slate-400 truncate"
                />
                <p className="text-[10px] text-slate-500 font-mono leading-none mt-1 ml-0.5">
                  ID: {id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Node Palette Toggle */}
              <button
                onClick={() => togglePanel("palette")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activePanel === "palette" ? "bg-violet-200 text-violet-800" : "bg-white border border-violet-200 text-violet-700 hover:bg-violet-100"}`}
              >
                <Blocks className="w-4 h-4" />
                Node Palette
                <div
                  className={`transition-transform duration-300 ${activePanel === "palette" ? "rotate-180" : "rotate-0"}`}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </button>

              <div className="w-px h-6 bg-violet-200 mx-1"></div>

              {/* Settings Toggle */}
              <button
                onClick={() => togglePanel("settings")}
                className={`p-2 rounded-md transition-colors ${activePanel === "settings" ? "bg-violet-200 text-violet-800" : "text-slate-500 hover:text-violet-700 hover:bg-violet-100"}`}
                title="Skill Settings"
              >
                <SettingsIcon
                  className={`w-5 h-5 ${activePanel === "settings" ? "animate-spin-slow" : ""}`}
                />
              </button>

              <button
                onClick={() => {
                  syncCanvasToSkillConfig();
                  setIsPlaygroundOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-1.5 bg-white text-slate-700 border border-violet-200 text-sm font-medium rounded-md hover:bg-violet-50 transition-colors shadow-sm ml-1"
              >
                <Play className="w-4 h-4 text-violet-500 fill-violet-500" />
                Playground
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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

          {/* Animated Tray Container */}
          <div
            className={`bg-white transition-all duration-300 ease-in-out shadow-inner overflow-hidden ${
              activePanel
                ? "max-h-[45vh] opacity-100 border-t border-violet-200"
                : "max-h-0 opacity-0 border-t-0 pointer-events-none"
            }`}
          >
            {/* Tray 1: Node Palette */}
            {activePanel === "palette" && (
              <div className="p-4 flex flex-wrap gap-x-10 gap-y-6 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    API Contract
                  </span>
                  <div className="flex gap-2">
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, "trigger")}
                      className="px-3 py-2 border border-sky-200 bg-sky-50 text-sky-700 rounded cursor-grab hover:bg-sky-100 flex items-center gap-2 text-xs font-semibold"
                    >
                      <Zap className="w-3.5 h-3.5" /> Trigger
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, "response")}
                      className="px-3 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded cursor-grab hover:bg-purple-100 flex items-center gap-2 text-xs font-semibold"
                    >
                      <Flag className="w-3.5 h-3.5" /> Response
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Flow Control
                  </span>
                  <div className="flex gap-2">
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, "interrupt")}
                      className="px-3 py-2 border border-orange-200 bg-orange-50 text-orange-700 rounded cursor-grab hover:bg-orange-100 flex items-center gap-2 text-xs font-semibold"
                    >
                      <Hand className="w-3.5 h-3.5" /> Interrupt
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Internal Tools
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableTools.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, "tool", t.id)}
                        className="px-3 py-2 border border-amber-200 bg-white text-amber-700 rounded cursor-grab hover:bg-amber-50 flex items-center gap-2 text-xs font-semibold"
                      >
                        <Code2 className="w-3.5 h-3.5" /> {t.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    MCP Servers
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableServers.map((s) => (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, "mcp_node", s.id)}
                        className="px-3 py-2 border border-emerald-200 bg-white text-emerald-700 rounded cursor-grab hover:bg-emerald-50 flex items-center gap-2 text-xs font-semibold"
                      >
                        <Database className="w-3.5 h-3.5" /> {s.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tray 2: Skill Configuration */}
            {activePanel === "settings" && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <SkillSettings
                  data={skillConfig}
                  onChange={(field, val) =>
                    setSkillConfig((prev) => ({ ...prev, [field]: val }))
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <SlidingPlaygroundPanel isOpen={isPlaygroundOpen}>
        <Playground
          config={skillConfig}
          messages={messages}
          setMessages={setMessages}
          onClose={() => setIsPlaygroundOpen(false)}
          onActiveNodeChange={setActiveNodeId}
        />
      </SlidingPlaygroundPanel>
    </div>
  );
}
