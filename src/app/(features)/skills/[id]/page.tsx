"use client";

import { useEffect, useState, use } from "react";
import {
  SkillConfig,
  ToolConfig,
  MCPServerConfig,
  DEFAULT_SKILL_CONFIG,
  Message,
} from "@/src/lib/types/constants";
import { ConfigPanel } from "@/src/components/features/skill-editor/ConfigPanel";
import { Playground } from "@/src/components/features/skill-editor/Playground";
import { SlidingPlaygroundPanel } from "@/src/components/layout/SlidingPlaygroundPanel";
import { useProject } from "@/src/lib/contexts/ProjectContext";

export default function SkillEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const isNew = id === "new";
  const { currentProject } = useProject();

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
      if (!currentProject?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const [toolsRes, serversRes] = await Promise.all([
          fetch(`/api/tools?projectId=${currentProject.id}`).then((r) =>
            r.json(),
          ),
          fetch(`/api/mcp-servers?projectId=${currentProject.id}`).then((r) =>
            r.json(),
          ),
        ]);

        if (toolsRes.tools) setAvailableTools(toolsRes.tools);
        if (serversRes.servers) setAvailableServers(serversRes.servers);

        if (isNew) {
          setConfig({
            ...DEFAULT_SKILL_CONFIG,
            id: "",
            project_id: currentProject.id,
          });
          setIsLoading(false);
          return;
        }

        const res = await fetch(
          `/api/skills/${id}?projectId=${currentProject.id}`,
        );
        const data = await res.json();

        if (data.skill) {
          setConfig({
            ...DEFAULT_SKILL_CONFIG,
            ...data.skill,
            project_id: data.skill.project_id || currentProject?.id || "",
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
  }, [id, isNew, currentProject?.id]);

  // REMOVED the "if (isLoading || !config)" block completely so the layout renders instantly

  return (
    <div className="h-full w-full flex overflow-hidden bg-slate-50">
      <div className="h-full min-w-0 flex-1">
        <ConfigPanel
          // Pass the default config while loading to prevent null errors
          config={config || DEFAULT_SKILL_CONFIG}
          setConfig={
            setConfig as React.Dispatch<React.SetStateAction<SkillConfig>>
          }
          availableTools={availableTools}
          availableServers={availableServers}
          activeNodeId={activeNodeId}
          onOpenPlayground={() => setIsPlaygroundOpen(true)}
          isLoading={isLoading} // ADDED: pass the loading state down
        />
      </div>

      <SlidingPlaygroundPanel isOpen={isPlaygroundOpen}>
        <Playground
          config={config!}
          messages={messages}
          setMessages={setMessages}
          onClose={() => setIsPlaygroundOpen(false)}
          onActiveNodeChange={setActiveNodeId}
        />
      </SlidingPlaygroundPanel>
    </div>
  );
}
