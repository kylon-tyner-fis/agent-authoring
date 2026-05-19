"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  Braces,
  Fingerprint,
  Network,
  AlignLeft,
  Cpu,
  Database,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  SkillConfig,
  ToolConfig,
  MCPServerConfig,
} from "@/src/lib/types/constants";
import {
  OrchestrationCanvas,
  OrchestrationCanvasRef,
} from "../canvas/OrchestrationCanvas";
import { useToast } from "../../layout/Toast";
import { SchemaNode } from "../../shared/json-tools/SchemaEditor";
import { SchemaViewer } from "../../shared/json-tools/SchemaViewer";
import { v4 as uuidv4 } from "uuid";
import { EditorTopPanel } from "../../layout/EditorTopPanel";

interface ConfigPanelProps {
  config: SkillConfig;
  setConfig: React.Dispatch<React.SetStateAction<SkillConfig>>;
  availableTools: ToolConfig[];
  availableServers: MCPServerConfig[];
  activeNodeId?: string | null;
  onOpenPlayground: () => void;
  isLoading?: boolean;
}

type Tab = "identity" | "engine" | "schema" | "orchestration";

const SUPPORTED_PROVIDERS = ["openai", "anthropic"];
const SUPPORTED_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-5.4-nano"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

export const ConfigPanel = ({
  config,
  setConfig,
  activeNodeId,
  availableTools,
  availableServers,
  onOpenPlayground,
  isLoading,
}: ConfigPanelProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Read-Only Guard
  const isReadOnly = config.status === "published";

  const canvasRef = useRef<OrchestrationCanvasRef>(null);
  const { addToast } = useToast();

  const handleFieldChange = (updates: Partial<SkillConfig>) => {
    if (isReadOnly) return; // Safety check
    setConfig((prev) => ({
      ...prev,
      ...updates,
      status: "draft", // Any change turns a 'published' config back into a 'draft'
    }));
  };

  // Removed legacy manual schema parsing logic

  const syncCanvasToConfig = () => {
    if (activeTab === "orchestration" && canvasRef.current) {
      const latestCanvasData = canvasRef.current.getCanvasData();

      const requiredServers = Array.from(
        new Set(
          (latestCanvasData.nodes || [])
            .filter((n: any) => n.type === "mcp_node" && n.data?.serverId)
            .map((n: any) => n.data.serverId),
        ),
      ) as string[];

      setConfig((prev) => ({
        ...prev,
        status: "draft",
        mcp_servers: requiredServers,
        orchestration: {
          nodes: latestCanvasData.nodes,
          edges: latestCanvasData.edges,
          viewport: latestCanvasData.viewport,
        },
      }));
    }
  };

  const handleTabChange = (newTab: Tab) => {
    syncCanvasToConfig();
    setActiveTab(newTab);
  };

  const handleOpenPlayground = () => {
    syncCanvasToConfig();
    onOpenPlayground();
  };

  const handleCopyConfig = async () => {
    let latestCanvasData = null;
    if (activeTab === "orchestration" && canvasRef.current) {
      latestCanvasData = canvasRef.current.getCanvasData();
    } else {
      latestCanvasData = config.orchestration;
    }

    const rawNodes = latestCanvasData?.nodes || [];
    const rawEdges = latestCanvasData?.edges || [];

    const semanticNodes = rawNodes.map((n: any) => {
      const { active, ...cleanData } = n.data || {};
      let actionName;
      if (n.type === "tool" && cleanData.toolId) {
        actionName = availableTools.find(
          (t) => t.id === cleanData.toolId,
        )?.name;
      } else if (n.type === "mcp_node" && cleanData.serverId) {
        actionName = availableServers.find(
          (s) => s.id === cleanData.serverId,
        )?.name;
      }
      return { id: n.id, type: n.type, actionName, ...cleanData };
    });

    const semanticEdges = rawEdges.map((e: any) => ({
      source: e.source,
      target: e.target,
      condition: e.data?.label || undefined,
    }));

    const snapshot = {
      ...config,
      graph: { nodes: semanticNodes, edges: semanticEdges },
    };

    delete snapshot.orchestration;
    delete snapshot.compiled_manifest;

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  const handlePublishSkill = async () => {
    setIsPublishing(true);
    setPublishSuccess(false);

    try {
      let latestCanvasData = null;
      let mcpServers = config.mcp_servers || [];

      if (activeTab === "orchestration" && canvasRef.current) {
        latestCanvasData = canvasRef.current.getCanvasData();
        mcpServers = Array.from(
          new Set(
            (latestCanvasData.nodes || [])
              .filter((n: any) => n.type === "mcp_node" && n.data?.serverId)
              .map((n: any) => n.data.serverId),
          ),
        ) as string[];
      } else {
        latestCanvasData = config.orchestration;
      }

      if (latestCanvasData) {
        const canvasNodes = latestCanvasData.nodes || [];
        if (
          !canvasNodes.some((n: any) => n.type === "trigger") ||
          !canvasNodes.some((n: any) => n.type === "response")
        ) {
          addToast(
            "Your graph must have at least one Trigger and one Response node to publish.",
            "error",
          );
          setIsPublishing(false);
          return;
        }
      }

      const finalConfig = {
        ...config,
        mcp_servers: mcpServers,
        status: "published",
        ...(latestCanvasData && {
          orchestration: {
            nodes: latestCanvasData.nodes,
            edges: latestCanvasData.edges,
            viewport: latestCanvasData.viewport,
          },
        }),
      };

      const response = await fetch(
        `/api/skills/${config.id || "new"}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalConfig),
        },
      );

      if (!response.ok) throw new Error(`Publish failed: ${response.status}`);
      const data = await response.json();

      setConfig(data.skill);
      setPublishSuccess(true);
      addToast(
        `Version ${data.skill.version} published successfully!`,
        "success",
      );
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch (error) {
      addToast("Failed to publish skill.", "error");
      console.error(error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveSkill = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let latestCanvasData = null;
      let mcpServers = config.mcp_servers || [];

      if (activeTab === "orchestration" && canvasRef.current) {
        latestCanvasData = canvasRef.current.getCanvasData();
        mcpServers = Array.from(
          new Set(
            (latestCanvasData.nodes || [])
              .filter((n: any) => n.type === "mcp_node" && n.data?.serverId)
              .map((n: any) => n.data.serverId),
          ),
        ) as string[];
      } else {
        latestCanvasData = config.orchestration;
      }

      if (latestCanvasData) {
        const canvasNodes = latestCanvasData.nodes || [];
        if (!canvasNodes.some((n: any) => n.type === "trigger")) {
          addToast(
            "Your graph is missing a Trigger (API Input) node.",
            "error",
          );
          setIsSaving(false);
          return;
        }
        if (!canvasNodes.some((n: any) => n.type === "response")) {
          addToast(
            "Your graph is missing a Response (API Output) node.",
            "error",
          );
          setIsSaving(false);
          return;
        }
      }

      const finalId = config.id || uuidv4();

      const finalConfig: SkillConfig = {
        ...config,
        id: finalId,
        status: "draft",
        mcp_servers: mcpServers,
        persistence: {
          ...config.persistence,
          checkpointer: "postgresSaver",
          ttl_seconds: config.persistence?.ttl_seconds || 3600,
          store_ttl: config.persistence?.store_ttl || 3600,
        },
        ...(latestCanvasData && {
          orchestration: {
            nodes: latestCanvasData.nodes,
            edges: latestCanvasData.edges,
            viewport: latestCanvasData.viewport,
          },
        }),
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalConfig),
      });

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);

      setConfig(finalConfig);
      setSaveSuccess(true);
      addToast("Skill configuration saved successfully!", "success");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      addToast("Failed to save skill configuration.", "error");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePersistence = (
    updates: Partial<NonNullable<SkillConfig["persistence"]>>,
  ) => {
    if (isReadOnly) return;
    setConfig((prev) => ({
      ...prev,
      status: "draft",
      persistence: {
        checkpointer: "postgresSaver",
        ttl_seconds: prev.persistence?.ttl_seconds || 3600,
        store_ttl: prev.persistence?.store_ttl || 3600,
        ...updates,
      },
    }));
  };

  return (
    <div className="w-full border-r border-gray-200 bg-white flex flex-col h-full">
      <datalist id="type-hints">
        <option value="string" />
        <option value="number" />
        <option value="boolean" />
        <option value="object" />
        <option value="array<object>" />
        <option value="array<string>" />
        <option value="any" />
      </datalist>

      <EditorTopPanel
        backUrl="/skills"
        title={config.name || "Untitled Skill"}
        icon={Network}
        onCopy={handleCopyConfig}
        isCopied={isCopied}
        onTest={handleOpenPlayground}
        testLabel="Test Skill"
        onSave={isReadOnly ? () => {} : handleSaveSkill}
        saveSuccess={saveSuccess}
        isPublishing={isPublishing}
        publishSuccess={publishSuccess}
        themeColor="violet"
        onPublish={isReadOnly ? undefined : handlePublishSkill}
        isSaving={isSaving || !!isLoading}
        subtitle={`Version ${config.version} | ${isReadOnly ? "LIVE (Read-Only)" : "DRAFT"}`}
        version={config.version}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : (
        <>
          <div className="flex px-4 sm:px-6 lg:px-8 pt-2 bg-slate-50 border-b border-gray-200 shrink-0 overflow-x-auto">
            {[
              { id: "identity", label: "Identity", icon: Fingerprint },
              { id: "engine", label: "AI Engine", icon: Cpu },
              { id: "orchestration", label: "Orchestration", icon: Network },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-violet-600 text-violet-700 bg-violet-50/50 rounded-t-lg"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${
                    activeTab === tab.id ? "text-violet-600" : "text-gray-400"
                  }`}
                />{" "}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 flex-1 overflow-y-auto bg-white">
            {activeTab === "identity" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-slate-400" /> Meta
                    Information
                  </h2>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="space-y-1.5 col-span-9">
                      <label className="text-xs font-semibold text-gray-600">
                        Skill Name
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={config.name || ""}
                        onChange={(e) =>
                          handleFieldChange({ name: e.target.value })
                        }
                        placeholder="e.g. Generate Content"
                        className={`w-full p-2.5 text-sm border border-gray-200 rounded-lg font-mono ${
                          isReadOnly
                            ? "bg-slate-100 cursor-not-allowed text-slate-400"
                            : "bg-slate-50 text-slate-500"
                        }`}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-3">
                      <label className="text-xs font-semibold text-gray-600">
                        Current Version
                      </label>
                      <div className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-center">
                        v{config.version}
                      </div>
                    </div>
                    <div className="space-y-1.5 col-span-12">
                      <label className="text-xs font-semibold text-gray-600">
                        Description
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={config.description || ""}
                        onChange={(e) =>
                          handleFieldChange({ description: e.target.value })
                        }
                        className={`w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none ${
                          isReadOnly
                            ? "bg-slate-100 cursor-not-allowed text-slate-400"
                            : "bg-gray-50 text-slate-900"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-violet-500" /> Global
                    Workflow Rules
                  </h2>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 flex justify-between">
                      <span>System Instructions</span>
                      <span className="text-gray-400 font-normal">
                        Rules applied to ALL nodes in this graph.
                      </span>
                    </label>
                    <textarea
                      rows={6}
                      disabled={isReadOnly}
                      value={config.system_prompt || ""}
                      onChange={(e) =>
                        handleFieldChange({ system_prompt: e.target.value })
                      }
                      className={`w-full p-3 border border-gray-300 rounded-lg outline-none min-h-[150px] text-sm ${
                        isReadOnly
                          ? "bg-slate-100 cursor-not-allowed text-slate-400"
                          : "bg-gray-50 text-slate-900"
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "engine" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-purple-500" />{" "}
                    Model Configuration
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Provider
                      </label>
                      <select
                        disabled={isReadOnly}
                        value={config.model.provider}
                        onChange={(e) =>
                          handleFieldChange({
                            model: {
                              ...config.model,
                              provider: e.target.value,
                              model_name:
                                SUPPORTED_MODELS[
                                  e.target
                                    .value as keyof typeof SUPPORTED_MODELS
                                ][0],
                            },
                          })
                        }
                        className={`w-full p-2.5 text-sm border border-gray-300 rounded-lg ${
                          isReadOnly
                            ? "bg-slate-100 cursor-not-allowed text-slate-400"
                            : "bg-gray-50 text-slate-900"
                        }`}
                      >
                        {SUPPORTED_PROVIDERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Model Name
                      </label>
                      <select
                        disabled={isReadOnly}
                        value={config.model.model_name}
                        onChange={(e) =>
                          handleFieldChange({
                            model: {
                              ...config.model,
                              model_name: e.target.value,
                            },
                          })
                        }
                        className={`w-full p-2.5 text-sm border border-gray-300 rounded-lg ${
                          isReadOnly
                            ? "bg-slate-100 cursor-not-allowed text-slate-400"
                            : "bg-gray-50 text-slate-900"
                        }`}
                      >
                        {SUPPORTED_MODELS[
                          config.model.provider as keyof typeof SUPPORTED_MODELS
                        ]?.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 col-span-2 bg-slate-50 p-6 rounded-xl border border-gray-200 mt-2">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className="text-sm font-semibold text-gray-900 block">
                            Temperature
                          </label>
                          <span className="text-xs text-gray-500">
                            Controls randomness (0 = deterministic, 2 =
                            creative)
                          </span>
                        </div>
                        <input
                          type="number"
                          disabled={isReadOnly}
                          min="0"
                          max="2"
                          step="0.1"
                          value={config.model.temperature}
                          onChange={(e) =>
                            handleFieldChange({
                              model: {
                                ...config.model,
                                temperature: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className={`text-sm font-mono px-2 py-1 rounded border border-gray-300 w-20 ${
                            isReadOnly
                              ? "bg-slate-100 cursor-not-allowed text-slate-400"
                              : "bg-white"
                          }`}
                        />
                      </div>
                      <input
                        type="range"
                        disabled={isReadOnly}
                        min="0"
                        max="2"
                        step="0.1"
                        value={config.model.temperature}
                        onChange={(e) =>
                          handleFieldChange({
                            model: {
                              ...config.model,
                              temperature: parseFloat(e.target.value),
                            },
                          })
                        }
                        className={`w-full ${isReadOnly ? "opacity-50 cursor-not-allowed" : "accent-purple-600"}`}
                      />

                      <div className="flex items-center justify-between mb-3 mt-8">
                        <div>
                          <label className="text-sm font-semibold text-gray-900 block">
                            Max Tokens
                          </label>
                          <span className="text-xs text-gray-500">
                            Maximum length of the generated response
                          </span>
                        </div>
                        <input
                          type="number"
                          disabled={isReadOnly}
                          min="256"
                          max="8192"
                          step="1"
                          value={config.model.max_tokens}
                          onChange={(e) =>
                            handleFieldChange({
                              model: {
                                ...config.model,
                                max_tokens: parseInt(e.target.value) || 256,
                              },
                            })
                          }
                          className={`text-sm font-mono px-2 py-1 rounded border border-gray-300 w-24 ${
                            isReadOnly
                              ? "bg-slate-100 cursor-not-allowed text-slate-400"
                              : "bg-white"
                          }`}
                        />
                      </div>
                      <input
                        type="range"
                        disabled={isReadOnly}
                        min="256"
                        max="8192"
                        step="256"
                        value={config.model.max_tokens}
                        onChange={(e) =>
                          handleFieldChange({
                            model: {
                              ...config.model,
                              max_tokens: parseInt(e.target.value),
                            },
                          })
                        }
                        className={`w-full ${isReadOnly ? "opacity-50 cursor-not-allowed" : "accent-purple-600"}`}
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="space-y-4">
                  <div className="flex flex-col gap-1 mb-2">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Database className="w-4 h-4 text-fuchsia-500" /> Memory &
                      Persistence
                    </h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Checkpointer Provider
                      </label>
                      <input
                        type="text"
                        disabled
                        value="postgresSaver"
                        readOnly
                        className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-100 text-slate-400 font-mono cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Thread TTL (Seconds)
                      </label>
                      <input
                        type="number"
                        disabled={isReadOnly}
                        value={config.persistence?.ttl_seconds || ""}
                        onChange={(e) =>
                          updatePersistence({
                            ttl_seconds: parseInt(e.target.value) || 0,
                          })
                        }
                        className={`w-full p-2.5 text-sm border border-gray-300 rounded-lg font-mono ${
                          isReadOnly
                            ? "bg-slate-100 cursor-not-allowed text-slate-400"
                            : "bg-gray-50 text-slate-900"
                        }`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">
                        Store TTL (Seconds)
                      </label>
                      <input
                        type="number"
                        disabled={isReadOnly}
                        value={config.persistence?.store_ttl || ""}
                        onChange={(e) =>
                          updatePersistence({
                            store_ttl: parseInt(e.target.value) || 0,
                          })
                        }
                        className={`w-full p-2.5 text-sm border border-gray-300 rounded-lg font-mono ${
                          isReadOnly
                            ? "bg-slate-100 cursor-not-allowed text-slate-400"
                            : "bg-gray-50 text-slate-900"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}


            {activeTab === "orchestration" && (
              <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col gap-1 shrink-0">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Network className="w-4 h-4 text-violet-500" /> Workflow
                    Configuration
                  </h2>
                </div>
                <OrchestrationCanvas
                  ref={canvasRef}
                  initialData={config.orchestration}
                  globalStateSchema={config.state_schema}
                  availableTools={availableTools}
                  availableServers={availableServers}
                  activeNodeId={activeNodeId}
                  readOnly={isReadOnly} // <-- Passed down
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
