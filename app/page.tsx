"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Wrench,
  Server,
  ChevronRight,
  PlusCircle,
  Activity,
} from "lucide-react";

export default function GlobalDashboard() {
  const router = useRouter();

  const sections = [
    {
      title: "Agents",
      description: "Manage orchestration workflows and LLM configurations.",
      icon: <Bot className="w-6 h-6 text-blue-600" />,
      path: "/agents", // Note: You might want to move your current dashboard to /agents
      count: "3 Active",
      color: "blue",
      action: () => router.push("/agents"), // Current dashboard is at root
    },
    {
      title: "Skill Library",
      description: "Reusable functions, prompt templates, and tool logic.",
      icon: <Wrench className="w-6 h-6 text-indigo-600" />,
      path: "/skills",
      count: "12 Skills",
      color: "indigo",
      action: () => router.push("/skills"),
    },
    {
      title: "MCP Servers",
      description: "External connectors for databases, search, and APIs.",
      icon: <Server className="w-6 h-6 text-teal-600" />,
      path: "/mcp-servers",
      count: "2 Online",
      color: "teal",
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

        {/* QUICK STATS */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                System Status
              </p>
              <p className="text-sm font-bold text-slate-900">
                All Systems Operational
              </p>
            </div>
          </div>
        </div>

        {/* NAVIGATION CARDS */}
        <div className="grid grid-cols-1 gap-4">
          {sections.map((s) => (
            <button
              key={s.title}
              onClick={s.action}
              className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-14 h-14 rounded-2xl bg-${s.color}-50 flex items-center justify-center transition-transform group-hover:scale-110`}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      {s.title}
                    </h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                      {s.count}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm mt-1">{s.description}</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          ))}
        </div>

        {/* QUICK ACTION */}
        <div className="pt-4">
          <button
            onClick={() => router.push("/agents/new")}
            className="flex items-center gap-2 text-blue-600 font-bold hover:underline transition-all"
          >
            <PlusCircle className="w-5 h-5" /> Create new agent workflow
          </button>
        </div>
      </div>
    </main>
  );
}
