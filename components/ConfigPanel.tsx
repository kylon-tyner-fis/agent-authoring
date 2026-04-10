"use client";

import { useState, useEffect, useRef } from "react";
import {
  Settings2,
  SlidersHorizontal,
  Share2,
  Braces,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  User,
  Fingerprint,
  Network,
  AlignLeft,
  Cpu,
  CornerDownRight,
  ListTree,
  Play,
} from "lucide-react";
import { AgentConfig, MOCK_PROVIDERS, MOCK_MODELS } from "@/lib/constants";
import {
  OrchestrationCanvas,
  OrchestrationCanvasRef,
} from "./OrchestrationCanvas";

interface ConfigPanelProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
  onOpenPlayground: () => void;
}

type Tab = "identity" | "engine" | "schema" | "orchestration";

interface SchemaNode {
  id: string;
  key: string;
  typeHint: string;
  isNullable: boolean;
  children?: SchemaNode[];
}

// ============================================================================
// SAFE SUB-COMPONENT: RECURSIVE NODE LIST
// ============================================================================
interface RecursiveNodeListProps {
  nodes: SchemaNode[];
  setNodes: (nodes: SchemaNode[]) => void;
  depth?: number;
}

const RecursiveNodeList = ({
  nodes,
  setNodes,
  depth = 0,
}: RecursiveNodeListProps) => {
  const updateNode = (id: string, updates: Partial<SchemaNode>) => {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const removeNode = (id: string) => setNodes(nodes.filter((n) => n.id !== id));
  const addNode = () =>
    setNodes([
      ...nodes,
      {
        id: Math.random().toString(),
        key: "",
        typeHint: "string",
        isNullable: false,
      },
    ]);

  return (
    <div className={`space-y-2 ${depth > 0 ? "mt-3" : ""}`}>
      {nodes.map((node) => {
        const typeLower = (node.typeHint || "").toLowerCase().trim();
        const isObject = typeLower === "object" || typeLower === "dict";
        const isArrayOfObject =
          typeLower === "array<object>" || typeLower === "object[]";
        const hasChildren = isObject || isArrayOfObject;

        return (
          <div
            key={node.id}
            className={`flex flex-col gap-2 ${depth > 0 ? "pl-2" : ""}`}
          >
            <div className="flex gap-2 items-center group relative">
              {depth > 0 && (
                <div className="absolute -left-6 top-1/2 w-4 border-b-2 border-l-2 border-emerald-200 rounded-bl h-10 -translate-y-10" />
              )}

              <input
                type="text"
                value={node.key}
                placeholder="Key (e.g. user)"
                onChange={(e) => updateNode(node.id, { key: e.target.value })}
                className="flex-1 p-2.5 text-sm border border-gray-300 rounded-lg outline-none font-mono focus:border-emerald-500 bg-white shadow-sm transition-all"
              />
              <span className="text-gray-400 font-mono">:</span>

              <input
                type="text"
                list="type-hints"
                value={node.typeHint}
                placeholder="Type (e.g. string)"
                onChange={(e) => {
                  const val = e.target.value;
                  const vLower = val.toLowerCase().trim();
                  const isComplex =
                    vLower === "object" ||
                    vLower === "dict" ||
                    vLower === "array<object>" ||
                    vLower === "object[]";
                  updateNode(node.id, {
                    typeHint: val,
                    ...(isComplex && !node.children ? { children: [] } : {}),
                  });
                }}
                className={`flex-[1.5] p-2.5 text-sm border border-gray-300 rounded-lg outline-none font-mono focus:border-emerald-500 shadow-sm transition-all ${hasChildren ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold" : "bg-white text-blue-700"}`}
              />

              {!hasChildren && (
                <button
                  onClick={() =>
                    updateNode(node.id, { isNullable: !node.isNullable })
                  }
                  className={`px-3 py-2.5 text-xs font-bold rounded-lg border transition-colors ${node.isNullable ? "bg-amber-100 text-amber-700 border-amber-300 shadow-inner" : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"}`}
                  title="Toggle Nullable (?)"
                >
                  Optional (?)
                </button>
              )}
              <button
                onClick={() => removeNode(node.id)}
                className="p-2.5 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {hasChildren && (
              <div className="ml-6 pl-4 border-l-2 border-emerald-100 py-1">
                <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ListTree className="w-3 h-3" />
                  {isArrayOfObject
                    ? "Array Item Properties"
                    : "Object Properties"}
                </div>
                <RecursiveNodeList
                  nodes={node.children || []}
                  setNodes={(newChildren) =>
                    updateNode(node.id, { children: newChildren })
                  }
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addNode}
        className={`flex items-center gap-1.5 font-semibold text-xs py-1.5 transition-colors ${depth === 0 ? "w-full mt-4 py-2.5 border-2 border-dashed border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-50 justify-center" : "text-emerald-500 hover:text-emerald-700"}`}
      >
        {depth === 0 ? (
          <Plus className="w-4 h-4" />
        ) : (
          <CornerDownRight className="w-3.5 h-3.5" />
        )}
        {depth === 0 ? "Add State Variable" : "Add Property"}
      </button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const ConfigPanel = ({
  config,
  setConfig,
  onOpenPlayground,
}: ConfigPanelProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Ref for the Orchestration Canvas
  const canvasRef = useRef<OrchestrationCanvasRef>(null);

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

  // 1. The Real-Time Callback
  const handleSkillsChange = (skills: string[]) => {
    // Only update state if the array actually changed to prevent infinite loops
    if (JSON.stringify(skills) !== JSON.stringify(config.skills)) {
      setConfig((prev) => ({ ...prev, skills }));
    }
  };

  // 2. The Cleaned-up Save Handler
  // 2. The Cleaned-up Save Handler
  const handleSaveAgent = async () => {
    if (!config.agent_id.trim()) {
      alert("Please provide an Agent ID before saving.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let latestCanvasData = null;
      if (canvasRef.current) {
        latestCanvasData = canvasRef.current.getCanvasData();
      }

      const finalConfig = {
        ...config,
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

      // ---> NEW: Update the local state with the latest saved data <---
      setConfig(finalConfig);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      alert("Failed to save");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${saveSuccess ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}
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
          { id: "orchestration", label: "Orchestration", icon: Network },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          >
            <tab.icon
              className={`w-4 h-4 ${activeTab === tab.id ? "text-blue-600" : "text-gray-400"}`}
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                            MOCK_MODELS[
                              e.target.value as keyof typeof MOCK_MODELS
                            ][0],
                        },
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none bg-gray-50"
                  >
                    {MOCK_PROVIDERS.map((p) => (
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none bg-gray-50"
                  >
                    {MOCK_MODELS[
                      config.model.provider as keyof typeof MOCK_MODELS
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
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-inner">
              <RecursiveNodeList
                nodes={schemaNodes}
                setNodes={setSchemaNodes}
              />
            </div>
          </div>
        )}

        {/* TAB 4: ORCHESTRATION */}
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

            {/* 3. Pass the callback to the Canvas */}
            <OrchestrationCanvas
              ref={canvasRef}
              onSkillsChange={handleSkillsChange}
              initialData={config.orchestration}
            />
          </div>
        )}
      </div>
    </div>
  );
};
