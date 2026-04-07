"use client";

import { useState } from "react";
import { ConfigPanel } from "@/components/ConfigPanel";
import { Playground } from "@/components/Playground";
import { AgentConfig, Message, DEFAULT_AGENT_CONFIG } from "@/lib/constants";

export default function AgentStudio() {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! Test your LangGraph configuration here. Click 'Save Config' when you are ready to publish it to your downstream apps.",
    },
  ]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <ConfigPanel config={config} setConfig={setConfig} />
      <Playground
        config={config}
        messages={messages}
        setMessages={setMessages}
      />
    </div>
  );
}
