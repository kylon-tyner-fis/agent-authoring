"use client";

import { useEffect, useState, use } from "react";
import {
  SkillConfig,
  ToolConfig,
  MCPServerConfig,
  DEFAULT_SKILL_CONFIG,
  Message,
} from "@/src/lib/types/constants";
import { Loader2 } from "lucide-react";
import { ConfigPanel } from "@/src/components/features/skill-editor/ConfigPanel";
import { Playground } from "@/src/components/features/skill-editor/Playground";

export default function SkillEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const isNew = id === "new";

  const [config, setConfig] = useState<SkillConfig | null>(null);
  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([]);
  const [availableServers, setAvailableServers] = useState<MCPServerConfig[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toolsRes, serversRes] = await Promise.all([
          fetch("/api/tools").then((r) => r.json()),
          fetch("/api/mcp-servers").then((r) => r.json()),
        ]);

        if (toolsRes.tools) setAvailableTools(toolsRes.tools);
        if (serversRes.servers) setAvailableServers(serversRes.servers);

        if (isNew) {
          setConfig({ ...DEFAULT_SKILL_CONFIG, id: "" });
          setIsLoading(false);
          return;
        }

        const res = await fetch(`/api/skills/${id}`);
        const data = await res.json();

        if (data.skill) {
          setConfig({
            ...DEFAULT_SKILL_CONFIG,
            ...data.skill,
            model: {
              provider: data.skill.provider,
              model_name: data.skill.model_name,
              temperature: data.skill.temperature,
              max_tokens: data.skill.max_tokens,
            },
          });
        }
      } catch (err) {
        console.error("Failed to load skill, tools, or server data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isNew]);

  if (isLoading || !config) {
    return (
      <div className="fixed top-[57px] bottom-0 left-0 right-0 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="fixed top-[57px] bottom-0 left-0 right-0 flex overflow-hidden bg-slate-50">
      <div
        className={`h-full transition-all duration-300 ease-in-out ${
          isPlaygroundOpen ? "w-[60%]" : "w-full"
        }`}
      >
        <ConfigPanel
          config={config}
          setConfig={
            setConfig as React.Dispatch<React.SetStateAction<SkillConfig>>
          }
          availableTools={availableTools}
          availableServers={availableServers}
          activeNodeId={activeNodeId}
          onOpenPlayground={() => setIsPlaygroundOpen(true)}
        />
      </div>

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
