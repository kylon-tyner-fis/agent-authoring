"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Wrench,
  Server,
  ChevronRight,
  Network,
  Layers,
  Activity,
  AlertCircle,
} from "lucide-react";
import { useProject } from "../lib/contexts/ProjectContext";

export default function GlobalDashboard() {
  const router = useRouter();
  const { currentProject } = useProject();

  // 1. Dynamic Data Integration: State to hold our fetched counts
  const [counts, setCounts] = useState({
    orchestrators: 0,
    agents: 0,
    skills: 0,
    tools: 0,
    mcpServers: 0,
  });

  // State to hold the health of our external integrations
  const [mcpHealth, setMcpHealth] = useState({ total: 0, offline: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    if (!hasMounted || !currentProject?.id) return;

    const fetchDashboardData = async () => {
      try {
        const [orchRes, agentsRes, skillsRes, toolsRes, mcpRes] =
          await Promise.all([
            fetch(`/api/orchestrators?projectId=${currentProject.id}`).then(
              (res) => res.json(),
            ),
            fetch(`/api/agents?projectId=${currentProject.id}`).then((res) =>
              res.json(),
            ),
            fetch("/api/skills").then((res) => res.json()),
            fetch("/api/tools").then((res) => res.json()),
            fetch("/api/mcp-servers").then((res) => res.json()),
          ]);

        setCounts({
          orchestrators: orchRes.orchestrators?.length || 0,
          agents: agentsRes.agents?.length || 0,
          skills: skillsRes.skills?.length || 0,
          tools: toolsRes.tools?.length || 0,
          mcpServers: mcpRes.servers?.length || 0,
        });

        // 3. System Status Overview: Calculate how many servers are not active
        const servers = mcpRes.servers || [];
        const offlineServers = servers.filter(
          (s: any) => s.status !== "active",
        ).length;

        setMcpHealth({ total: servers.length, offline: offlineServers });
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentProject, hasMounted]);

  const sections = [
    {
      title: "Orchestrators",
      description:
        "Top-level executive systems that manage and delegate tasks to specialized Agents to achieve open-ended goals.",
      icon: <Layers className="w-6 h-6 text-sky-600" />,
      path: "/orchestrators",
      count: isLoading ? "Loading..." : `${counts.orchestrators} Configured`,
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
      count: isLoading ? "Loading..." : `${counts.agents} Configured`,
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
      count: isLoading ? "Loading..." : `${counts.skills} Configured`,
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
      count: isLoading ? "Loading..." : `${counts.tools} Tools`,
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
      count: isLoading ? "Loading..." : `${counts.mcpServers} Connected`,
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
      {/* Increased max-w to accommodate the new 3-column grid */}
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Command Center</h1>
          <p className="text-slate-500 mt-2">
            Visual authoring and management for AI agents.
          </p>
        </header>

        {/* 3. System Status Overview Banner */}
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!isLoading && mcpHealth.offline > 0 ? (
            <>
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">System Warning</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {mcpHealth.offline} of {mcpHealth.total} MCP Servers are
                  offline or reporting errors. Some skills may fail to execute.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">
                  {isLoading
                    ? "Checking systems..."
                    : "All Systems Operational"}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  MCP Servers and API configurations are healthy.
                </p>
              </div>
            </>
          )}
        </div>

        {/* 2. Responsive Grid Layout: Changed from grid-cols-1 to md:grid-cols-2 lg:grid-cols-3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((s) => (
            <button
              key={s.title}
              onClick={s.action}
              className={`group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${s.accent.hoverBorder} hover:shadow-md transition-all flex flex-col justify-between text-left h-full min-h-[200px]`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-14 h-14 rounded-2xl ${s.accent.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}
                  >
                    {s.icon}
                  </div>
                  <div
                    className={`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 ${s.accent.actionHoverBg} group-hover:text-white transition-all`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {s.title}
                </h2>
                <p className="text-slate-500 text-sm mt-2 line-clamp-3">
                  {s.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span
                  key={hasMounted ? s.count : "initial"}
                  className={`text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full ${
                    hasMounted &&
                    !isLoading &&
                    (s.title === "Agents" || s.title === "Orchestrators")
                      ? "animate-in fade-in zoom-in-95 duration-500"
                      : ""
                  }`}
                >
                  {!hasMounted ? "Loading..." : s.count}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
