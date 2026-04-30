"use client";

import { useRouter } from "next/navigation";
import {
  Bot,
  Wrench,
  Server,
  ChevronRight,
  Network,
  Layers,
} from "lucide-react";

export default function GlobalDashboard() {
  const router = useRouter();

  const sections = [
    {
      title: "Orchestrators",
      description:
        "Top-level executive systems that manage and delegate tasks to specialized Agents to achieve open-ended goals.",
      icon: <Layers className="w-6 h-6 text-sky-600" />,
      path: "/orchestrators",
      count: "0 Active",
      accent: {
        hoverBorder: "hover:border-sky-400",
        iconBg: "bg-sky-50",
        actionHoverBg: "group-hover:bg-sky-600",
      },
      action: () => router.push("/orchestrators"),
    },
    {
      title: "Agents",
      description:
        "Autonomous executive systems that reason, plan, and delegate tasks to specific Skills to achieve open-ended goals.",
      icon: <Bot className="w-6 h-6 text-emerald-600" />,
      path: "/agents",
      count: "0 Active",
      accent: {
        hoverBorder: "hover:border-emerald-400",
        iconBg: "bg-emerald-50",
        actionHoverBg: "group-hover:bg-emerald-600",
      },
      action: () => router.push("/agents"),
    },
    {
      title: "Skills",
      description:
        "Structured, repeatable workflows that orchestrate Tools, logic routing, and state management into multi-step processes.",
      icon: <Network className="w-6 h-6 text-violet-600" />,
      path: "/skills",
      count: "3 Active",
      accent: {
        hoverBorder: "hover:border-violet-400",
        iconBg: "bg-violet-50",
        actionHoverBg: "group-hover:bg-violet-600",
      },
      action: () => router.push("/skills"),
    },
    {
      title: "Tool Library",
      description:
        "Fundamental, single-purpose building blocks like API integrations, specialized functions, and prompt templates.",
      icon: <Wrench className="w-6 h-6 text-amber-700" />,
      path: "/tools",
      count: "12 Tools",
      accent: {
        hoverBorder: "hover:border-amber-400",
        iconBg: "bg-amber-50",
        actionHoverBg: "group-hover:bg-amber-600",
      },
      action: () => router.push("/tools"),
    },
    {
      title: "MCP Servers",
      description: "External connectors for databases, search, and APIs.",
      icon: <Server className="w-6 h-6 text-cyan-700" />,
      path: "/mcp-servers",
      count: "2 Online",
      accent: {
        hoverBorder: "hover:border-cyan-400",
        iconBg: "bg-cyan-50",
        actionHoverBg: "group-hover:bg-cyan-600",
      },
      action: () => router.push("/mcp-servers"),
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Command Center</h1>
          <p className="text-slate-500 mt-2">
            Visual authoring and management for AI agents.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {sections.map((s) => (
            <button
              key={s.title}
              onClick={s.action}
              className={`group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${s.accent.hoverBorder} hover:shadow-md transition-all flex items-center justify-between text-left`}
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-14 h-14 rounded-2xl ${s.accent.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}
                >
                  {s.icon}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {s.title}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">{s.description}</p>
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 ${s.accent.actionHoverBg} group-hover:text-white transition-all`}
              >
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
