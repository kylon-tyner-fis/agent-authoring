"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ConfigPanel } from "@/components/ConfigPanel";
import {
  AgentConfig,
  SkillConfig,
  DEFAULT_AGENT_CONFIG,
} from "@/lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const isNew = id === "new";

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch available skills from the database
        const skillsRes = await fetch("/api/skills");
        const skillsData = await skillsRes.json();
        if (skillsData.skills) {
          setAvailableSkills(skillsData.skills);
        }

        // 2. Handle New Agent vs Existing Agent
        if (isNew) {
          setConfig({ ...DEFAULT_AGENT_CONFIG, agent_id: "" });
          setIsLoading(false);
          return;
        }

        // 3. Fetch existing agent config
        const res = await fetch(`/api/agents/${id}`);
        const data = await res.json();

        if (data.agent) {
          setConfig({
            ...DEFAULT_AGENT_CONFIG,
            ...data.agent,
            model: {
              provider: data.agent.provider,
              model_name: data.agent.model_name,
              temperature: data.agent.temperature,
              max_tokens: data.agent.max_tokens,
            },
          });
        }
      } catch (err) {
        console.error("Failed to load agent or skills data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isNew]);

  if (isLoading || !config) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center shrink-0">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ConfigPanel
          config={config}
          setConfig={setConfig}
          availableSkills={availableSkills}
          onOpenPlayground={() => alert("Playground opening...")}
        />
      </div>
    </div>
  );
}
