"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Network, Loader2 } from "lucide-react";
import { AgentConfig, SkillConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { AgentPlayground } from "@/src/components/features/agent-editor/AgentPlayground";
import { EditorTopPanel } from "@/src/components/layout/EditorTopPanel";

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
    project_id: "",
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
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyConfig = async () => {
    try {
      const snapshot = {
        ...agent,
        skills: agent.skills.map(
          (skillId) => availableSkills.find((s) => s.id === skillId) || skillId,
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
        const skillsData = await fetch("/api/skills").then((res) => res.json());

        if (skillsData.skills) setAvailableSkills(skillsData.skills);

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

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <EditorTopPanel
        backUrl="/agents"
        backLabel="Back to Agents"
        onCopy={handleCopyConfig}
        isCopied={isCopied}
        onTest={() => setIsPlaygroundOpen(true)}
        testLabel="Test Agent"
        onSave={handleSave}
        saveLabel="Save Agent"
        isSaving={isSaving}
        themeColor="emerald"
      />
      {isLoading ? (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div
            className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isPlaygroundOpen ? "w-[60%]" : "w-full"}`}
          >
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" /> General
                  Information
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
                  <Network className="w-4 h-4 text-violet-500" /> Assigned
                  Skills (Workflows)
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
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${agent.skills.includes(skill.id) ? "border-violet-500 bg-violet-50/30 ring-1 ring-violet-500" : "border-slate-200 hover:border-slate-300"}`}
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
            </div>
          </div>

          {isPlaygroundOpen && (
            <div className="w-[40%] min-w-[450px] h-full shadow-2xl z-20 bg-white animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">
              <AgentPlayground
                config={agent}
                apiEndpoint="/api/agents/simulate"
                onClose={() => setIsPlaygroundOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
