"use client";

import { useEffect, useState, use } from "react";
import {
  AgentConfig,
  SkillConfig,
  DEFAULT_AGENT_CONFIG,
  Message,
} from "@/src/lib/types/constants";
import { Loader2 } from "lucide-react";
import { ConfigPanel } from "@/src/components/features/agent-editor/ConfigPanel";
import { Playground } from "@/src/components/features/agent-editor/Playground";

export default function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const isNew = id === "new";

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const skillsRes = await fetch("/api/skills");
        const skillsData = await skillsRes.json();

        if (skillsData.skills) setAvailableSkills(skillsData.skills);

        if (isNew) {
          setConfig({ ...DEFAULT_AGENT_CONFIG, agent_id: "" });
          setIsLoading(false);
          return;
        }

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
        console.error("Failed to load agent, skills, or server data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isNew]);

  if (isLoading || !config) {
    return (
      <div className="fixed top-[57px] bottom-0 left-0 right-0 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="fixed top-[57px] bottom-0 left-0 right-0 flex overflow-hidden bg-slate-50">
      {/* Config Panel Container - Shrinks when playground opens */}
      <div
        className={`h-full transition-all duration-300 ease-in-out ${
          isPlaygroundOpen ? "w-[60%]" : "w-full"
        }`}
      >
        <ConfigPanel
          config={config}
          setConfig={
            setConfig as React.Dispatch<React.SetStateAction<AgentConfig>>
          }
          availableSkills={availableSkills}
          activeNodeId={activeNodeId}
          onOpenPlayground={() => setIsPlaygroundOpen(true)}
        />
      </div>

      {/* Playground Drawer - Sits side-by-side with the config panel */}
      {isPlaygroundOpen && (
        <div className="w-[40%] min-w-[450px] h-full shadow-2xl z-20 bg-white animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">
          <Playground
            config={config}
            messages={messages}
            setMessages={setMessages}
            onClose={() => setIsPlaygroundOpen(false)}
            onActiveNodeChange={setActiveNodeId}
          />
        </div>
      )}
    </div>
  );
}
