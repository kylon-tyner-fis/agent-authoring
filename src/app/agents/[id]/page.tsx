"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Bot, Network, Loader2, Play } from "lucide-react";
import { AgentConfig, SkillConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { AgentPlayground } from "@/src/components/features/agent-editor/AgentPlayground";

export default function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === "new";

  const [agent, setAgent] = useState<AgentConfig>({
    id: "",
    name: "",
    description: "",
    skills: [],
    status: "active",
    system_prompt: "",
  });

  const [availableSkills, setAvailableSkills] = useState<SkillConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<AgentConfig[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [skillsData, agentsData] = await Promise.all([
          fetch("/api/skills").then((res) => res.json()),
          fetch("/api/agents").then((res) => res.json()), // Fetch all agents
        ]);

        if (skillsData.skills) setAvailableSkills(skillsData.skills);
        if (agentsData.agents) setAvailableAgents(agentsData.agents);

        if (!isNew) {
          const agentData = await fetch(`/api/agents/${id}`).then((res) =>
            res.json(),
          );
          if (agentData.agent) setAgent(agentData.agent);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, isNew]);

  const toggleSubAgent = (agentId: string) => {
    setAgent((prev) => ({
      ...prev,
      sub_agents: (prev.sub_agents || []).includes(agentId)
        ? prev.sub_agents!.filter((id) => id !== agentId)
        : [...(prev.sub_agents || []), agentId],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const finalAgent = { ...agent, id: agent.id || uuidv4() };

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalAgent),
      });

      if (res.ok) router.push("/agents");
    } catch (error) {
      console.error("Error saving agent:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setAgent((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter((id) => id !== skillId)
        : [...prev.skills, skillId],
    }));
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
        <button
          onClick={() => router.push("/agents")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Agents
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaygroundOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
          >
            <Play className="w-4 h-4" /> Test Agent
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Agent
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Config Panel */}
        <div
          className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isPlaygroundOpen ? "w-[60%]" : "w-full"}`}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-500" /> General Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agent.name}
                    onChange={(e) =>
                      setAgent({ ...agent, name: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
                    placeholder="e.g. Sales Assistant"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">
                    Description
                  </label>
                  <input
                    type="text"
                    value={agent.description}
                    onChange={(e) =>
                      setAgent({ ...agent, description: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600 flex justify-between">
                    <span>Agent Prompt / Role</span>
                    <span className="text-gray-400 font-normal">
                      Base Persona & Instructions
                    </span>
                  </label>
                  <textarea
                    rows={8}
                    value={agent.system_prompt || ""}
                    onChange={(e) =>
                      setAgent({ ...agent, system_prompt: e.target.value })
                    }
                    className="w-full p-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 min-h-[150px] bg-slate-50 text-slate-900"
                    placeholder="e.g. You are a Goals, Outcomes, and Objectives agent for technical education..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Status
                  </label>
                  <select
                    value={agent.status}
                    onChange={(e) =>
                      setAgent({
                        ...agent,
                        status: e.target.value as "active" | "inactive",
                      })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="active">🟢 Active</option>
                    <option value="inactive">⚪ Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-blue-500" /> Assigned Skills
                (Workflows)
              </h2>
              <p className="text-xs text-slate-500">
                Select the orchestration workflows this agent is allowed to
                execute.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-2">
                {availableSkills.map((skill) => (
                  <div
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${agent.skills.includes(skill.id) ? "border-blue-500 bg-blue-50/30 ring-1 ring-blue-500" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm text-slate-800 truncate">
                        {skill.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={agent.skills.includes(skill.id)}
                        readOnly
                        className="mt-1"
                      />
                    </div>
                    <span className="text-xs text-slate-500 line-clamp-2">
                      {skill.description}
                    </span>
                  </div>
                ))}
                {availableSkills.length === 0 && (
                  <div className="col-span-2 p-6 text-sm text-slate-400 italic text-center border border-dashed border-slate-300 rounded-xl">
                    No skills available. Create one in the Skills tab first.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" /> Assigned Sub-Agents
              </h2>
              <p className="text-xs text-slate-500">
                Allow this agent to delegate complex reasoning to specialized
                sub-agents.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-2">
                {availableAgents
                  .filter((a) => a.id !== agent.id) // Prevent self-assignment
                  .map((subAgent) => (
                    <div
                      key={subAgent.id}
                      onClick={() => toggleSubAgent(subAgent.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${(agent.sub_agents || []).includes(subAgent.id) ? "border-purple-500 bg-purple-50/30 ring-1 ring-purple-500" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {subAgent.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={(agent.sub_agents || []).includes(
                            subAgent.id,
                          )}
                          readOnly
                          className="mt-1"
                        />
                      </div>
                      <span className="text-xs text-slate-500 line-clamp-2">
                        {subAgent.description}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Playground Drawer */}
        {isPlaygroundOpen && (
          <div className="w-[40%] min-w-[450px] h-full shadow-2xl z-20 bg-white animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">
            <AgentPlayground
              agent={agent}
              onClose={() => setIsPlaygroundOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
