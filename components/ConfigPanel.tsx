"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { AgentConfig, MOCK_PROVIDERS, MOCK_MODELS } from "@/lib/constants";

interface ConfigPanelProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}

export const ConfigPanel = ({ config, setConfig }: ConfigPanelProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state for the State Schema Visual Builder
  const [stateFields, setStateFields] = useState<
    { id: string; key: string; typeHint: string }[]
  >(
    Object.entries(config.state_schema).map(([key, typeHint]) => ({
      id: Math.random().toString(),
      key,
      typeHint,
    })),
  );

  // Group the advanced orchestration fields into one JSON block for the raw editor
  const [orchestrationJson, setOrchestrationJson] = useState(
    JSON.stringify(
      {
        graph: config.graph,
        subgraphs: config.subgraphs,
        persistence: config.persistence,
        interrupts: config.interrupts,
      },
      null,
      2,
    ),
  );

  // Sync State Schema to Config
  useEffect(() => {
    const newSchema: Record<string, string> = {};
    stateFields.forEach((f) => {
      if (f.key.trim()) newSchema[f.key.trim()] = f.typeHint;
    });
    setConfig((prev) => ({ ...prev, state_schema: newSchema }));
  }, [stateFields, setConfig]);

  // --- MOCK SAVE FUNCTION ---
  const handleSaveAgent = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // await fetch("/api/agents", { method: "POST", body: JSON.stringify(config) });
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      alert("Failed to save agent to database.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- HANDLERS ---
  const handleOrchestrationChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setOrchestrationJson(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      setConfig((prev) => ({
        ...prev,
        graph: parsed.graph || prev.graph,
        subgraphs: parsed.subgraphs,
        persistence: parsed.persistence,
        interrupts: parsed.interrupts,
      }));
    } catch (err) {
      // Allow invalid JSON while typing
    }
  };

  return (
    <div className="w-1/2 border-r border-gray-200 bg-white flex flex-col h-full">
      {/* HEADER */}
      <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold">LangGraph Studio</h1>
        </div>
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

      <div className="p-6 flex-1 overflow-y-auto space-y-8 pb-12">
        {/* 1. IDENTITY & TOOLS */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" /> Identity & Integration
          </h2>
          <div className="grid grid-cols-12 gap-4">
            <div className="space-y-2 col-span-9">
              <label className="text-xs font-semibold text-gray-500">
                Agent ID (Slug)
              </label>
              <input
                type="text"
                value={config.agent_id}
                onChange={(e) =>
                  setConfig({ ...config, agent_id: e.target.value })
                }
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div className="space-y-2 col-span-3">
              <label className="text-xs font-semibold text-gray-500">
                Version
              </label>
              <input
                type="text"
                value={config.version}
                onChange={(e) =>
                  setConfig({ ...config, version: e.target.value })
                }
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div className="space-y-2 col-span-12">
              <label className="text-xs font-semibold text-gray-500">
                Description
              </label>
              <input
                type="text"
                value={config.description}
                onChange={(e) =>
                  setConfig({ ...config, description: e.target.value })
                }
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Brief description of agent capabilities..."
              />
            </div>
            <div className="space-y-2 col-span-12">
              <label className="text-xs font-semibold text-gray-500">
                Tools (Comma Separated)
              </label>
              <input
                type="text"
                value={config.tools.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tools: e.target.value.split(",").map((t) => t.trim()),
                  })
                }
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-emerald-600"
                placeholder="search_db, check_inventory"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500">
              System Prompt
            </label>
            <textarea
              rows={3}
              value={config.system_prompt}
              onChange={(e) =>
                setConfig({ ...config, system_prompt: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
            />
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* 2. MODEL HYPERPARAMETERS */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-purple-500" /> Engine
            Configuration
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">
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
                className="w-full p-2 text-sm border border-gray-300 rounded-md outline-none bg-white"
              >
                {MOCK_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">
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
                className="w-full p-2 text-sm border border-gray-300 rounded-md outline-none bg-white"
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

            <div className="space-y-2 col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">
                  Temperature
                </label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
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

              <div className="flex items-center justify-between mb-1 mt-4">
                <label className="text-xs font-semibold text-gray-700">
                  Max Tokens
                </label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
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

        <hr className="border-gray-200" />

        {/* 3. STATE SCHEMA BUILDER (LANGUAGE AGNOSTIC) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Braces className="w-4 h-4 text-emerald-500" /> State Schema
            (Agnostic Types)
          </h2>
          <div className="space-y-2 p-4 border border-emerald-100 bg-emerald-50/30 rounded-lg">
            <p className="text-xs text-emerald-700 mb-3">
              Define state keys using agnostic type hints (e.g.,{" "}
              <code>string</code>, <code>number</code>, <code>object</code>,{" "}
              <code>array&lt;BaseMessage&gt;</code>).
            </p>
            {stateFields.map((field) => (
              <div key={field.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={field.key}
                  placeholder="Key (e.g., messages)"
                  onChange={(e) =>
                    setStateFields(
                      stateFields.map((f) =>
                        f.id === field.id ? { ...f, key: e.target.value } : f,
                      ),
                    )
                  }
                  className="flex-1 p-2 text-sm border border-gray-300 rounded outline-none font-mono focus:border-emerald-500 bg-white"
                />
                <span className="text-gray-400">:</span>
                <input
                  type="text"
                  value={field.typeHint}
                  placeholder="Type Hint (e.g., array<BaseMessage>)"
                  onChange={(e) =>
                    setStateFields(
                      stateFields.map((f) =>
                        f.id === field.id
                          ? { ...f, typeHint: e.target.value }
                          : f,
                      ),
                    )
                  }
                  className="flex-[1.5] p-2 text-sm border border-gray-300 rounded outline-none font-mono focus:border-emerald-500 bg-white"
                />
                <button
                  onClick={() =>
                    setStateFields(stateFields.filter((f) => f.id !== field.id))
                  }
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setStateFields([
                  ...stateFields,
                  { id: Math.random().toString(), key: "", typeHint: "" },
                ])
              }
              className="w-full mt-2 py-2 border-2 border-dashed border-emerald-200 rounded-md text-sm font-medium text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add State Key
            </button>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* 4. ADVANCED ORCHESTRATION */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Share2 className="w-4 h-4 text-orange-500" /> Advanced
            Orchestration
          </h2>
          <p className="text-xs text-gray-500">
            Define your LangGraph Nodes, Edges, Subgraphs, Persistence, and
            Interrupts.
          </p>
          <textarea
            value={orchestrationJson}
            onChange={handleOrchestrationChange}
            className="w-full h-96 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none resize-none font-mono text-xs bg-slate-900 text-orange-300"
            spellCheck="false"
          />
        </div>
      </div>
    </div>
  );
};
