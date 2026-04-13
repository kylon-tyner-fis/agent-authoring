"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Trash2, Edit2, Cpu, Clock, Loader2 } from "lucide-react";

export default function AgentsDashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = async () => {
    setIsLoading(true);
    const res = await fetch("/api/agents");
    const data = await res.json();
    if (data.agents) setAgents(data.agents);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete ${id}?`)) return;

    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    setAgents(agents.filter((a) => a.agent_id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              LangGraph Agents
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your orchestration configurations.
            </p>
          </div>
          <button
            onClick={() => router.push("/agents/new")}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create Agent
          </button>
        </div>

        {/* LIST */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <Bot className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-900 font-bold">No agents found</p>
                <p className="text-slate-500 text-sm">
                  Create your first agent to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agents.map((agent) => (
                <div
                  key={agent.agent_id}
                  className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100 shrink-0">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        {agent.agent_id}
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono border border-slate-200">
                          v{agent.version}
                        </span>
                      </h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                        {agent.description}
                      </p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" /> {agent.model_name}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />{" "}
                          {new Date(agent.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => router.push(`/agents/${agent.agent_id}`)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Agent"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(agent.agent_id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
