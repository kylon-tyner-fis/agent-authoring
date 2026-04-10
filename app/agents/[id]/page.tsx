"use client";

import { useEffect, useState, use } from "react"; // 1. Import 'use'
import { useRouter } from "next/navigation";
import { ConfigPanel } from "@/components/ConfigPanel";
import { AgentConfig, DEFAULT_AGENT_CONFIG } from "@/lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";

// 2. Change the type definition to expect a Promise
export default function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  // 3. Unwrap the params promise using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const isNew = id === "new";

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      if (isNew) {
        setConfig({ ...DEFAULT_AGENT_CONFIG, agent_id: "" });
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/agents/${id}`); // Use the unwrapped id
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
        console.error("Failed to load agent");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [id, isNew]); // Use 'id' in the dependency array

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
          onOpenPlayground={() => alert("Playground opening...")}
        />
      </div>
    </div>
  );
}
