"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Layers,
  Bot,
  Loader2,
  Play,
  Check,
  Copy,
} from "lucide-react";
import { OrchestratorConfig, AgentConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { AgentPlayground } from "@/src/components/features/agent-editor/AgentPlayground";

export default function OrchestratorEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === "new";

  const [orchestrator, setOrchestrator] = useState<OrchestratorConfig>({
    id: "",
    name: "",
    description: "",
    agents: [],
    status: "active",
    system_prompt: "",
  });

  const [availableAgents, setAvailableAgents] = useState<AgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyConfig = async () => {
    try {
      const snapshot = {
        ...orchestrator,
        agents: orchestrator.agents.map(
          (agentId) => availableAgents.find((a) => a.id === agentId) || agentId,
        ),
      };

      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const agentsData = await fetch("/api/agents").then((res) => res.json());

        if (agentsData.agents) setAvailableAgents(agentsData.agents);

        if (!isNew) {
          const orchData = await fetch(`/api/orchestrators/${id}`).then((res) =>
            res.json(),
          );
          if (orchData.orchestrator) setOrchestrator(orchData.orchestrator);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, isNew]);

  const handleSave = async () => {
    setIsSaving(true);
    const finalOrchestrator = {
      ...orchestrator,
      id: orchestrator.id || uuidv4(),
    };

    try {
      const res = await fetch("/api/orchestrators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalOrchestrator),
      });

      if (res.ok) router.push("/orchestrators");
    } catch (error) {
      console.error("Error saving orchestrator:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setOrchestrator((prev) => ({
      ...prev,
      agents: prev.agents.includes(agentId)
        ? prev.agents.filter((id) => id !== agentId)
        : [...prev.agents, agentId],
    }));
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
        <button
          onClick={() => router.push("/orchestrators")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orchestrators
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyConfig}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-sky-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {isCopied ? "Copied!" : "Copy Config"}
          </button>

          <button
            onClick={() => setIsPlaygroundOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
          >
            <Play className="w-4 h-4" /> Test Orchestrator
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Orchestrator
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isPlaygroundOpen ? "w-[60%]" : "w-full"}`}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" /> General
                Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">
                    Orchestrator Name
                  </label>
                  <input
                    type="text"
                    value={orchestrator.name}
                    onChange={(e) =>
                      setOrchestrator({ ...orchestrator, name: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-sky-500"
                    placeholder="e.g. Master Content Coordinator"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">
                    Description
                  </label>
                  <input
                    type="text"
                    value={orchestrator.description}
                    onChange={(e) =>
                      setOrchestrator({
                        ...orchestrator,
                        description: e.target.value,
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600 flex justify-between">
                    <span>System Prompt</span>
                    <span className="text-gray-400 font-normal">
                      Base Persona & Instructions
                    </span>
                  </label>
                  <textarea
                    rows={8}
                    value={orchestrator.system_prompt || ""}
                    onChange={(e) =>
                      setOrchestrator({
                        ...orchestrator,
                        system_prompt: e.target.value,
                      })
                    }
                    className="w-full p-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-sky-500 min-h-[150px] bg-slate-50 text-slate-900"
                    placeholder="e.g. You are the lead Orchestrator responsible for..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Status
                  </label>
                  <select
                    value={orchestrator.status}
                    onChange={(e) =>
                      setOrchestrator({
                        ...orchestrator,
                        status: e.target.value as "active" | "inactive",
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-sky-500 bg-white"
                  >
                    <option value="active">🟢 Active</option>
                    <option value="inactive">⚪ Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-500" /> Assigned Agents
              </h2>
              <p className="text-xs text-slate-500">
                Select the agents this orchestrator can delegate tasks to.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-2">
                {availableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${orchestrator.agents.includes(agent.id) ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm text-slate-800 truncate">
                        {agent.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={orchestrator.agents.includes(agent.id)}
                        readOnly
                        className="mt-1"
                      />
                    </div>
                    <span className="text-xs text-slate-500 line-clamp-2">
                      {agent.description}
                    </span>
                  </div>
                ))}
                {availableAgents.length === 0 && (
                  <div className="col-span-2 p-6 text-sm text-slate-400 italic text-center border border-dashed border-slate-300 rounded-xl">
                    No agents available. Create one in the Agents tab first.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {isPlaygroundOpen && (
          <div className="w-[40%] min-w-[450px] h-full shadow-2xl z-20 bg-white animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">
            <AgentPlayground
              config={orchestrator}
              apiEndpoint="/api/orchestrators/simulate"
              accent="orchestrator"
              onClose={() => setIsPlaygroundOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
