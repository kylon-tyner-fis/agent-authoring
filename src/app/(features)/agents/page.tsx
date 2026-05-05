"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Trash2, Loader2 } from "lucide-react";
import { AgentConfig } from "@/src/lib/types/constants";
import { useProject } from "@/src/lib/contexts/ProjectContext";

export default function AgentsDashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { currentProject } = useProject();

  useEffect(() => {
    if (!currentProject) return;

    const fetchAgents = async () => {
      try {
        const res = await fetch(`/api/agents?projectId=${currentProject.id}`);
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
      } catch (error) {
        console.error("Failed to fetch agents", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgents();
  }, [currentProject]);

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete agent?`)) return;
    try {
      await fetch(`/api/agents/${id}`, { method: "DELETE" });
      setAgents(agents.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Failed to delete agent", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-6 h-6 text-fuchsia-600" /> Agents
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Autonomous executive systems that reason, plan, and dynamically
              delegate tasks to your Skills.
            </p>
          </div>
          <button
            onClick={() => router.push("/agents/new")}
            className="flex items-center gap-2 bg-fuchsia-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-fuchsia-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Create Agent
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-slate-900 font-bold">No agents found</p>
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border bg-fuchsia-50 border-fuchsia-200">
                    <Bot className="w-5 h-5 text-fuchsia-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 min-w-0">
                      <span className="truncate">{agent.name}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${agent.status === "active" ? "bg-green-50 text-green-600 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                      >
                        {agent.status}
                      </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                      {agent.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => router.push(`/agents/${agent.id}`)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Edit Agent
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
