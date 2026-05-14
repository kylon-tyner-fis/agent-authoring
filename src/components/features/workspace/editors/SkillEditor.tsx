// src/components/features/workspace/editors/SkillEditor.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Save,
  Play,
  Settings as SettingsIcon,
  Blocks,
  Zap,
  Flag,
  Hand,
  Code2,
  Database,
  ChevronDown,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Loader2,
  Network,
  Check,
  Lock,
} from "lucide-react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useWorkspace } from "@/src/lib/contexts/WorkspaceContext";
import { SkillConfig, MCPServerConfig, DEFAULT_SKILL_CONFIG, Message } from "@/src/lib/types/constants";
import { SkillSettings } from "./SkillSettings";
import {
  OrchestrationCanvasRef,
  OrchestrationCanvas,
} from "../../canvas/OrchestrationCanvas";
import { SlidingPlaygroundPanel } from "@/src/components/layout/SlidingPlaygroundPanel";
import { useToast } from "@/src/components/layout/Toast";
import { Playground } from "../../skill-editor/Playground";

interface SkillEditorProps {
  id: string;
}

type ActivePanel = "palette" | "settings" | null;


export function SkillEditor({ id }: SkillEditorProps) {
  const { currentProject } = useProject();
  const { refreshTree, setSelectedNode, selectedNode } = useWorkspace();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const [activePanel, setActivePanel] = useState<ActivePanel>("palette");
  const [skillConfig, setSkillConfig] = useState<SkillConfig>({
    ...DEFAULT_SKILL_CONFIG,
    id,
    name: "New Skill",
  });

  const canvasRef = useRef<OrchestrationCanvasRef>(null);

  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>([]);

  const isReadOnly = skillConfig.status === "published";
  const headId = skillConfig.parent_id || skillConfig.id;

  const getCurrentCanvasData = () =>
    canvasRef.current?.getCanvasData() || skillConfig.orchestration;

  const getMcpServerIds = (canvasData: any) => {
    const serverIds = new Set<string>();
    const nodes = canvasData?.nodes || [];
    nodes.forEach((n: any) => {
      if (n.data?.serverId) serverIds.add(n.data.serverId);
    });
    return Array.from(serverIds);
  };

  useEffect(() => {
    async function loadSkill() {
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

        const vData = await versionsRes.json();
        const toolsData = await toolsRes.json();
        const serversData = await serversRes.json();

        if (data.skill) {
          const sortedVersions = (vData.skills || []).sort((a: any, b: any) => {
            if (a.status === "draft") return -1;
            if (b.status === "draft") return 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });

          setSkillConfig({
            ...DEFAULT_SKILL_CONFIG,
            ...data.skill,
            versions: sortedVersions,
            id: data.skill.id || id,
            project_id: data.skill.project_id || currentProject.id,
            status: data.skill.status || "draft",
            parent_id: data.skill.parent_id || undefined,
            version: data.skill.version || "1",
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
        setAvailableTools(toolsData.tools || []);
        setAvailableServers(serversData.servers || []);
      } catch (error) {
        console.error("Failed to load skill", error);
        addToast("Failed to load skill", "error");
      } finally {
        setIsLoading(false);
      }
    }
    loadSkill();
  }, [id, currentProject?.id]);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, dataId?: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (dataId) {
      event.dataTransfer.setData("application/nodeId", dataId);
    }
    event.dataTransfer.effectAllowed = "move";
  };

  const syncCanvasToSkillConfig = () => {
    const currentCanvasData = getCurrentCanvasData();
    const mcpServers = getMcpServerIds(currentCanvasData);
    const inferredStateSchema =
      canvasRef.current?.getInferredStateSchema() || skillConfig.state_schema;
    setSkillConfig((prev) => ({
      ...prev,
      mcp_servers: mcpServers,
      state_schema: inferredStateSchema,
      orchestration: currentCanvasData,
    }));
  };

  const handleSave = async () => {
    if (!currentProject?.id || isReadOnly) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const currentCanvasData = getCurrentCanvasData();
      const mcpServers = getMcpServerIds(currentCanvasData);
      const inferredStateSchema =
        canvasRef.current?.getInferredStateSchema() || skillConfig.state_schema;
      const res = await fetch(
        `/api/skills/${id}?projectId=${currentProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...skillConfig,
            mcp_servers: mcpServers,
            state_schema: inferredStateSchema,
            orchestration: currentCanvasData,
            status: "draft",
          }),
        },
      );
      if (res.ok) {
        setSkillConfig((prev) => ({
          ...prev,
          mcp_servers: mcpServers,
          state_schema: inferredStateSchema,
          orchestration: currentCanvasData,
          status: "draft",
        }));
        setSaveSuccess(true);
        addToast("Draft saved successfully", "success");
        setTimeout(() => setSaveSuccess(false), 3000);
        await refreshTree();
      }
    } catch (error) {
      console.error(error);
      addToast("Failed to save draft", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!currentProject?.id || isReadOnly) return;
    setIsPublishing(true);
    setPublishSuccess(false);

    try {
      const currentCanvasData = getCurrentCanvasData();
      const mcpServers = getMcpServerIds(currentCanvasData);
      const inferredStateSchema = canvasRef.current?.getInferredStateSchema() || skillConfig.state_schema;

      const res = await fetch(`/api/skills/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...skillConfig,
          mcp_servers: mcpServers,
          state_schema: inferredStateSchema,
          orchestration: currentCanvasData,
        }),
      });

      if (!res.ok) throw new Error("Publish failed");
      const data = await res.json();

      setSkillConfig(data.skill);
      setPublishSuccess(true);
      addToast(`Version ${data.skill.version} published!`, "success");
      setTimeout(() => setPublishSuccess(false), 3000);
      await refreshTree();
    } catch (error) {
      console.error(error);
      addToast("Failed to publish version", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGoToDraft = () => {
    setSelectedNode({ id: headId, type: "skill", parentId: selectedNode?.parentId });
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
            globalStateSchema={skillConfig.state_schema}
            activeNodeId={activeNodeId}
            readOnly={isReadOnly}
            onSelectionChange={() => {
              setActivePanel(null);
            }}
          />
        </div>

        {/* 2. Unified Command Center (Header + Trays) */}
        {/* 2. Unified Command Center (Header + Trays) */}
        <div className="absolute top-6 left-6 right-6 z-20 flex flex-col bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden transition-all">
          {/* Header Row */}
          <div className="flex items-center justify-between px-6 h-16 bg-white/40 z-20 relative shrink-0">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                <Network className="w-5 h-5" />
              </div>

              <div className="flex flex-col min-w-0">
                <input
                  type="text"
                  value={skillConfig.name}
                  onChange={(e) => {
                    if (isReadOnly) return;
                    setSkillConfig((prev) => ({
                      ...prev,
                      name: e.target.value,
                      status: "draft",
                    }));
                  }}
                  disabled={isReadOnly}
                  className={`bg-transparent font-bold text-base tracking-tight focus:outline-none focus:ring-0 placeholder:text-slate-300 truncate -ml-0.5 ${isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-900"}`}
                  placeholder="Untitled Skill"
                />

                <div className="flex items-center gap-2 mt-0.5">
                  <Dropdown
                    trigger={(selected, isOpen) => (
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer
                        ${isOpen
                          ? "bg-violet-50 border-violet-200 ring-4 ring-violet-500/5"
                          : "bg-white/50 border-slate-200 hover:border-slate-300"
                        }`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v{selected?.label || '1'}</span>
                        <div className={`w-1 h-1 rounded-full ${selected?.badge === 'DRAFT' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></div>
                        <span className={`text-[9px] font-bold uppercase tracking-tight
                          ${selected?.badge === 'DRAFT' ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {selected?.badge}
                        </span>
                        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    )}
                    options={(skillConfig.versions || []).map((v: any) => ({
                      id: v.id,
                      label: v.version,
                      description: `${new Date(v.updated_at).toLocaleDateString()}`,
                      badge: v.status === 'draft' ? 'DRAFT' : 'PUBLISHED',
                      icon: v.id === id ? <Check className="w-3 h-3" /> : undefined
                    }))}
                    value={id}
                    onChange={async (newId) => {
                      if (newId === id || !currentProject?.id || !selectedNode?.parentId) return;
                      try {
                        const agentId = selectedNode.parentId;
                        const agentRes = await fetch(`/api/agents/${agentId}?projectId=${currentProject.id}`);
                        const agentData = await agentRes.json();
                        const agent = agentData.agent;

                        const nextSkills = (agent.skills || []).map((sid: string) =>
                          sid === id ? newId : sid
                        );

                        await fetch(`/api/agents/${agentId}?projectId=${currentProject.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ...agent, skills: nextSkills })
                        });

                        addToast(`Switched version`, "success");
                        await refreshTree();

                        setSelectedNode({
                          ...selectedNode,
                          id: newId,
                        });
                      } catch (err) {
                        addToast("Failed to switch version", "error");
                      }
                    }}
                  />
                  {isReadOnly && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/50 border border-slate-200 rounded-full">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Read Only</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Node Palette Toggle */}
              {!isReadOnly && (
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
              )}

              {!isReadOnly && <div className="w-px h-6 bg-violet-200 mx-1"></div>}

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

              {isReadOnly ? (
                <button
                  onClick={handleGoToDraft}
                  className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors shadow-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  Switch to Draft to Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isPublishing}
                    className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border ${saveSuccess
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-white text-slate-700 border-violet-200 hover:bg-violet-50"
                      }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? "Saving..." : saveSuccess ? "Saved" : "Save Draft"}
                  </button>

                  <button
                    onClick={handlePublish}
                    disabled={isSaving || isPublishing}
                    className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${publishSuccess
                      ? "bg-emerald-500 text-white"
                      : "bg-violet-600 text-white hover:bg-violet-700"
                      }`}
                  >
                    {isPublishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : publishSuccess ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    {publishSuccess ? "Published" : "Publish Version"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Animated Tray Container */}
          <div
            className={`bg-white transition-all duration-300 ease-in-out shadow-inner overflow-hidden ${activePanel
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
                  readOnly={isReadOnly}
                  onChange={(field, val) => {
                    if (isReadOnly) return;
                    setSkillConfig((prev) => ({ ...prev, [field]: val, status: "draft" }))
                  }}
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
