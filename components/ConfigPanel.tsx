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
  Link2,
  Key,
  Info,
} from "lucide-react";
import { AgentConfig, MCPServerConfig } from "@/lib/constants";
import {
  OrchestrationCanvas,
  OrchestrationCanvasRef,
} from "./OrchestrationCanvas";
import { SchemaNode } from "./SchemaEditor";
import { SchemaViewer } from "./SchemaViewer";
import { useToast } from "./Toast";
import { SkillConfig } from "@/lib/constants";

interface ConfigPanelProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
  availableSkills: SkillConfig[];
  availableServers: MCPServerConfig[];
  activeNodeId?: string | null;
  onOpenPlayground: () => void;
}

type Tab = "identity" | "engine" | "schema" | "integrations" | "orchestration";

const SUPPORTED_PROVIDERS = ["openai", "anthropic"];

const SUPPORTED_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

export const ConfigPanel = ({
  config,
  setConfig,
  activeNodeId,
  availableSkills,
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

  const handleSaveAgent = async () => {
    if (!config.agent_id.trim()) {
      addToast("Please provide an Agent ID before saving.", "error");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let latestCanvasData = null;
      if (canvasRef.current) {
        latestCanvasData = canvasRef.current.getCanvasData();

        // Run Pre-Flight Validations
        const canvasNodes = latestCanvasData.nodes || [];
        const hasTrigger = canvasNodes.some((n: any) => n.type === "trigger");
        const hasResponse = canvasNodes.some((n: any) => n.type === "response");

        if (!hasTrigger) {
          addToast(
            "Your graph is missing a Trigger (API Input) node. The agent needs an entry point.",
            "error",
          );
          setIsSaving(false);
          return;
        }
        if (!hasResponse) {
          addToast(
            "Your graph is missing a Response (API Output) node. The agent needs to return data.",
            "error",
          );
          setIsSaving(false);
          return;
        }
      }

      // Ensure postgresSaver is always sent as the checkpointer backend
      const finalConfig = {
        ...config,
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

      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalConfig),
      });

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);

      setConfig(finalConfig);
      setSaveSuccess(true);
      addToast("Agent configuration saved successfully!", "success");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      addToast("Failed to save agent configuration.", "error");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for merging persistence state safely
  const updatePersistence = (
    updates: Partial<NonNullable<AgentConfig["persistence"]>>,
  ) => {
    setConfig((prev) => ({
      ...prev,
      persistence: {
        checkpointer: "postgresSaver", // Enforce default
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

      {/* APP HEADER */}
      <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              LangGraph Studio
            </h1>
            <p className="text-xs text-gray-500">MVP v2 Authoring Tool</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPlayground}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
          >
            <Play className="w-4 h-4" /> Test Agent
          </button>

          <button
            onClick={handleSaveAgent}
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

      {/* TABS */}
      <div className="flex px-4 pt-2 bg-slate-50 border-b border-gray-200 shrink-0 overflow-x-auto">
        {[
          { id: "identity", label: "Identity", icon: Fingerprint },
          { id: "engine", label: "Engine", icon: Cpu },
          { id: "schema", label: "State Schema", icon: Braces },
          { id: "integrations", label: "Integrations", icon: Database },
          { id: "orchestration", label: "Orchestration", icon: Network },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
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

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        {/* TAB 1: IDENTITY */}
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
                    Agent ID (Slug)
                  </label>
                  <input
                    type="text"
                    value={config.agent_id || ""}
                    onChange={(e) =>
                      setConfig({ ...config, agent_id: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-gray-50 text-slate-900"
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-gray-50 text-center text-slate-900"
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-slate-900"
                    placeholder="Brief description of capabilities..."
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
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm bg-gray-50 leading-relaxed text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ENGINE */}
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none bg-gray-50 text-slate-900"
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none bg-gray-50 text-slate-900"
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
                    <span className="text-sm font-mono bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
                      {config.model.temperature}
                    </span>
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
                    <span className="text-sm font-mono bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
                      {config.model.max_tokens}
                    </span>
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

            {/* SECTION: MEMORY & PERSISTENCE */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" /> Memory &
                  Persistence
                </h2>
                <p className="text-xs text-gray-500">
                  Configure how the agent remembers state between interactions
                  (Checkpointers).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {/* Checkpointer Tooltip & Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      Checkpointer Provider
                    </label>
                    <div className="relative group flex items-center">
                      <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-normal leading-relaxed">
                        Defines the storage backend for agent memory. Currently
                        locked to postgresSaver default.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value="postgresSaver"
                    readOnly
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg outline-none bg-slate-50 text-slate-900 font-mono cursor-not-allowed"
                  />
                </div>

                {/* Thread TTL Tooltip & Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      Thread TTL (Seconds)
                    </label>
                    <div className="relative group flex items-center">
                      <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-normal leading-relaxed">
                        Time-to-live for a specific conversation thread.
                        Determines how long the agent remembers a continuous
                        chat.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={config.persistence?.ttl_seconds || ""}
                    onChange={(e) =>
                      updatePersistence({
                        ttl_seconds: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="3600"
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 bg-gray-50 font-mono text-slate-900"
                  />
                </div>

                {/* Store TTL Tooltip & Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      Store TTL (Seconds)
                    </label>
                    <div className="relative group flex items-center">
                      <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-normal leading-relaxed">
                        Time-to-live for cross-thread memory. Determines how
                        long global state is retained across different sessions.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={config.persistence?.store_ttl || ""}
                    onChange={(e) =>
                      updatePersistence({
                        store_ttl: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="3600"
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 bg-gray-50 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEMA */}
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

        {/* TAB 4: INTEGRATIONS */}
        {activeTab === "integrations" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
            <div className="flex flex-col gap-1 mb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-500" />
                MCP Server Integrations
              </h2>
              <p className="text-sm text-gray-500">
                Enable external tools and APIs for this agent by attaching MCP
                servers. Skills used in the orchestration graph will inherit
                these connections.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableServers.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No MCP servers available. Add some in the dashboard.
                </p>
              ) : (
                availableServers.map((server) => {
                  const isSelected =
                    config.mcp_servers?.includes(server.id) || false;
                  return (
                    <div
                      key={server.id}
                      onClick={() => {
                        const newServers = isSelected
                          ? config.mcp_servers.filter((id) => id !== server.id)
                          : [...(config.mcp_servers || []), server.id];
                        setConfig({ ...config, mcp_servers: newServers });
                      }}
                      className={`p-5 border rounded-xl cursor-pointer transition-all flex flex-col gap-3 ${
                        isSelected
                          ? "border-teal-500 bg-teal-50/30 ring-1 ring-teal-500 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900">
                          {server.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="mt-1 accent-teal-600 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 mt-auto pt-2 border-t border-slate-100/50">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                          <Link2 className="w-3 h-3" /> {server.url}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                          <Key className="w-3 h-3" /> Auth: {server.auth_type}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ORCHESTRATION */}
        {activeTab === "orchestration" && (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col gap-1 shrink-0">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Share2 className="w-4 h-4 text-orange-500" /> Workflow
                Configuration
              </h2>
              <p className="text-sm text-gray-500">
                Define your LangGraph Nodes, Edges, Subgraphs, and Interrupts.
              </p>
            </div>

            <OrchestrationCanvas
              ref={canvasRef}
              initialData={config.orchestration}
              globalStateSchema={config.state_schema}
              availableSkills={availableSkills}
              activeNodeId={activeNodeId} // PASS TO CANVAS
            />
          </div>
        )}
      </div>
    </div>
  );
};
