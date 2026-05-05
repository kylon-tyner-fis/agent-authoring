"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Trash2,
  Key,
  Link2,
  Activity,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MCPServerConfig } from "@/src/lib/types/constants";
import { useProject } from "@/src/lib/contexts/ProjectContext";

export default function MCPServersDashboard() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentProject) return;

    const fetchServers = async () => {
      try {
        const mcpServersRes = await fetch(
          `/api/mcp-servers?projectId=${currentProject.id}`,
        );
        const data = await mcpServersRes.json();
        if (data.servers) setServers(data.servers);
      } catch (error) {
        console.error("Failed to fetch servers", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServers();
  }, [currentProject]);

  const handleDelete = async (deletingId: string) => {
    if (
      !currentProject ||
      !confirm("Remove this MCP Server? Skills depending on it may fail.")
    )
      return;

    try {
      await fetch(
        `/api/mcp-servers/${deletingId}?projectId=${currentProject.id}`,
        { method: "DELETE" },
      );
      setServers(servers.filter((s) => s.id !== deletingId));
    } catch (error) {
      console.error("Failed to delete server", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-6 h-6 text-emerald-700" /> MCP Servers
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Connect external tools, databases, and APIs to your agents.
            </p>
          </div>
          <button
            onClick={() => router.push("/mcp-servers/new")}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Add Server
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-slate-900 font-bold">No MCP Servers found</p>
              <p className="text-slate-500 text-sm mt-1">
                Add your first server to connect external tools.
              </p>
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div
                    className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border ${server.status === "Active" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
                  >
                    <Activity
                      className={`w-5 h-5 ${server.status === "Active" ? "text-emerald-500" : "text-red-500"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg truncate">
                      {server.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100 min-w-0 max-w-full">
                        <Link2 className="w-3 h-3" /> {server.url}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        <Key className="w-3 h-3" /> Auth: {server.auth_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => router.push(`/mcp-servers/${server.id}`)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Edit Server
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
