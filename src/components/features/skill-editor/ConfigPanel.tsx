"use client";

import { useState, useEffect, useRef } from "react";
import {
  Settings2,
  SlidersHorizontal,
  Share2,
  Braces,
  Save,
  CheckCircle2,
  User,
  Fingerprint,
  Network,
  AlignLeft,
  Cpu,
  Play,
  Database,
  Info,
} from "lucide-react";
import {
  SkillConfig,
  ToolConfig,
  MCPServerConfig,
} from "@/src/lib/types/constants";
import {
  OrchestrationCanvas,
  OrchestrationCanvasRef,
} from "./OrchestrationCanvas";
import { useToast } from "../../layout/Toast";
import { SchemaNode } from "../../shared/json-tools/SchemaEditor";
import { SchemaViewer } from "../../shared/json-tools/SchemaViewer";
import { v4 as uuidv4 } from "uuid";

interface ConfigPanelProps {
  config: SkillConfig;
  setConfig: React.Dispatch<React.SetStateAction<SkillConfig>>;
  availableTools: ToolConfig[];
  availableServers: MCPServerConfig[]; // NEW
  activeNodeId?: string | null;
  onOpenPlayground: () => void;
}

type Tab = "identity" | "engine" | "schema" | "orchestration";

const SUPPORTED_PROVIDERS = ["openai", "anthropic"];
const SUPPORTED_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

export const ConfigPanel = ({
  config,
  setConfig,
  activeNodeId,
  availableTools,
  availableServers,
  onOpenPlayground,
}: ConfigPanelProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canvasRef = useRef<OrchestrationCanvasRef>(null);
  const { addToast } = useToast();

  const parseConfigToNodes = (schema: any): SchemaNode[] => {
    if (!schema) return [];
    return Object.entries(schema).map(([key, val]) => {
      if (Array.isArray(val) && typeof val[0] === "object") {
        return {
          id: Math.random().toString(),
          key,
          typeHint: "array<object>",
          isNullable: false,
          children: parseConfigToNodes(val[0]),
        };
      }
      if (typeof val === "object" && val !== null) {
        return {
          id: Math.random().toString(),
          key,
          typeHint: "object",
          isNullable: false,
          children: parseConfigToNodes(val),
        };
      }
      const strVal = String(val);
      const isNullable = strVal.endsWith("?");
      return {
        id: Math.random().toString(),
        key,
        typeHint: isNullable ? strVal.slice(0, -1) : strVal,
        isNullable,
      };
    });
  };

  const [schemaNodes, setSchemaNodes] = useState<SchemaNode[]>(
    parseConfigToNodes(config.state_schema),
  );

  useEffect(() => {
    const compileNodes = (nodes: SchemaNode[]): any => {
      const result: any = {};
      nodes.forEach((n) => {
        if (!n.key.trim()) return;
        const typeLower = n.typeHint.toLowerCase().trim();
        const isObject = typeLower === "object" || typeLower === "dict";
        const isArrayOfObject =
          typeLower === "array<object>" || typeLower === "object[]";

        if (isObject && n.children && n.children.length > 0) {
          result[n.key.trim()] = compileNodes(n.children);
        } else if (isArrayOfObject && n.children && n.children.length > 0) {
          result[n.key.trim()] = [compileNodes(n.children)];
        } else {
          result[n.key.trim()] = n.typeHint + (n.isNullable ? "?" : "");
        }
      });
      return result;
    };

    setConfig((prev) => ({ ...prev, state_schema: compileNodes(schemaNodes) }));
  }, [schemaNodes, setConfig]);

  const syncCanvasToConfig = () => {
    if (activeTab === "orchestration" && canvasRef.current) {
      const latestCanvasData = canvasRef.current.getCanvasData();

      // NEW: Automatically extract required mcp_servers from the orchestration nodes
      const requiredServers = Array.from(
        new Set(
          (latestCanvasData.nodes || [])
            .filter((n: any) => n.type === "mcp_node" && n.data?.serverId)
            .map((n: any) => n.data.serverId),
        ),
      ) as string[];

      setConfig((prev) => ({
        ...prev,
        mcp_servers: requiredServers, // Keeps config in sync with canvas
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
        const hasTrigger = canvasNodes.some((n: any) => n.type === "trigger");
        const hasResponse = canvasNodes.some((n: any) => n.type === "response");

        if (!hasTrigger) {
          addToast(
            "Your graph is missing a Trigger (API Input) node.",
            "error",
          );
          setIsSaving(false);
          return;
        }
        if (!hasResponse) {
          addToast(
            "Your graph is missing a Response (API Output) node.",
            "error",
          );
          setIsSaving(false);
          return;
        }
      }

      const finalId = config.id || uuidv4();

      const finalConfig = {
        ...config,
        id: finalId,
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
    setConfig((prev) => ({
      ...prev,
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

      <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              LangGraph Studio
            </h1>
            <p className="text-xs text-gray-500">Skill Authoring</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenPlayground}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
          >
            <Play className="w-4 h-4" /> Test Skill
          </button>

          <button
            onClick={handleSaveSkill}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              saveSuccess
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Published
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Config
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex px-4 pt-2 bg-slate-50 border-b border-gray-200 shrink-0 overflow-x-auto">
        {[
          { id: "identity", label: "Identity", icon: Fingerprint },
          { id: "engine", label: "AI Engine", icon: Cpu },
          { id: "schema", label: "State Schema", icon: Braces },
          { id: "orchestration", label: "Orchestration", icon: Network },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <tab.icon
              className={`w-4 h-4 ${
                activeTab === tab.id ? "text-blue-600" : "text-gray-400"
              }`}
            />{" "}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-white">
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
                    Skill ID
                  </label>
                  <input
                    type="text"
                    value={config.id || "Generated on save"}
                    disabled
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-50 text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5 col-span-3">
                  <label className="text-xs font-semibold text-gray-600">
                    Version
                  </label>
                  <input
                    type="text"
                    value={config.version || ""}
                    onChange={(e) =>
                      setConfig({ ...config, version: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none font-mono bg-gray-50 text-center text-slate-900"
                  />
                </div>
                <div className="space-y-1.5 col-span-12">
                  <label className="text-xs font-semibold text-gray-600">
                    Description
                  </label>
                  <input
                    type="text"
                    value={config.description || ""}
                    onChange={(e) =>
                      setConfig({ ...config, description: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none bg-gray-50 text-slate-900"
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" /> Persona
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 flex justify-between">
                  <span>System Prompt</span>
                  <span className="text-gray-400 font-normal">
                    Base Persona Instructions
                  </span>
                </label>
                <textarea
                  rows={6}
                  value={config.system_prompt || ""}
                  onChange={(e) =>
                    setConfig({ ...config, system_prompt: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none min-h-[150px] text-sm bg-gray-50 text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "engine" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-500" /> Model
                Configuration
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Provider
                  </label>
                  <select
                    value={config.model.provider}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        model: {
                          ...config.model,
                          provider: e.target.value,
                          model_name:
                            SUPPORTED_MODELS[
                              e.target.value as keyof typeof SUPPORTED_MODELS
                            ][0],
                        },
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-slate-900"
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
                    value={config.model.model_name}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        model: { ...config.model, model_name: e.target.value },
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-slate-900"
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
                        Controls randomness (0 = deterministic, 2 = creative)
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.model.temperature}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          model: {
                            ...config.model,
                            temperature: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-300 w-20"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.model.temperature}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        model: {
                          ...config.model,
                          temperature: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-purple-600"
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
                      min="256"
                      max="8192"
                      step="1"
                      value={config.model.max_tokens}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          model: {
                            ...config.model,
                            max_tokens: parseInt(e.target.value) || 256,
                          },
                        })
                      }
                      className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-300 w-24"
                    />
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="8192"
                    step="256"
                    value={config.model.max_tokens}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        model: {
                          ...config.model,
                          max_tokens: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-purple-600"
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div className="space-y-4">
              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" /> Memory &
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
                    value="postgresSaver"
                    readOnly
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-50 text-slate-900 font-mono cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Thread TTL (Seconds)
                  </label>
                  <input
                    type="number"
                    value={config.persistence?.ttl_seconds || ""}
                    onChange={(e) =>
                      updatePersistence({
                        ttl_seconds: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono text-slate-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Store TTL (Seconds)
                  </label>
                  <input
                    type="number"
                    value={config.persistence?.store_ttl || ""}
                    onChange={(e) =>
                      updatePersistence({
                        store_ttl: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "schema" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
            <div className="flex flex-col gap-1 mb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Graph State Schema
              </h2>
              <p className="text-sm text-gray-500">
                Define the memory structure for your StateGraph.
              </p>
            </div>
            <SchemaViewer
              title="Graph State Schema"
              nodes={schemaNodes}
              setNodes={setSchemaNodes}
              addButtonText="Add State Variable"
            />
          </div>
        )}

        {activeTab === "orchestration" && (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col gap-1 shrink-0">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Share2 className="w-4 h-4 text-orange-500" /> Workflow
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
            />
          </div>
        )}
      </div>
    </div>
  );
};
