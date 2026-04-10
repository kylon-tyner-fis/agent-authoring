"use client";

import { useState } from "react";
import { Server, Plus, Trash2, Key, Link2, Activity } from "lucide-react";
import { MOCK_MCP_SERVERS } from "@/lib/constants";
import { useRouter } from "next/navigation";

export default function MCPServersDashboard() {
  const router = useRouter();
  const [servers, setServers] = useState(MOCK_MCP_SERVERS);

  const handleDelete = (id: string) => {
    if (!confirm("Remove this MCP Server? Skills depending on it may fail."))
      return;
    setServers(servers.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-6 h-6 text-teal-600" /> MCP Servers
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Connect external tools, databases, and APIs to your agents.
            </p>
          </div>
          <button
            onClick={() => router.push("/mcp-servers/new")} // <-- Add this onClick
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Add Server
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {servers.map((server) => (
            <div
              key={server.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group"
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border ${server.status === "active" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
                >
                  <Activity
                    className={`w-5 h-5 ${server.status === "active" ? "text-emerald-500" : "text-red-500"}`}
                  />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {server.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <Link2 className="w-3 h-3" /> {server.url}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <Key className="w-3 h-3" /> Auth: {server.auth_type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push(`/mcp-servers/${server.id}`)} // <-- Add this onClick
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Edit Config
                </button>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
