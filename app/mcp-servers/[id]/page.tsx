"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Server, Link2, Key, Activity } from "lucide-react";
import { MCPServerConfig, MOCK_MCP_SERVERS } from "@/lib/constants";

export default function MCPServerEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  // Initialize state using a lazy initializer to prevent hydration errors (just like skills)
  const [server, setServer] = useState<MCPServerConfig>(() => {
    if (id !== "new") {
      const existing = MOCK_MCP_SERVERS.find((s) => s.id === id);
      if (existing) return existing;
    }
    return {
      id: id === "new" ? "" : id,
      name: "",
      url: "",
      auth_type: "none",
      status: "active",
    };
  });

  const handleSave = async () => {
    // Generate an ID if it's a new server
    const finalId = server.id || `mcp_${Date.now()}`;

    const finalServer = {
      ...server,
      id: finalId,
    };

    console.log("Saving MCP Server:", finalServer);
    // TODO: POST to /api/mcp-servers
    router.push("/mcp-servers");
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* HEADER */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
        <button
          onClick={() => router.push("/mcp-servers")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Servers
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" /> Save Server Config
        </button>
      </div>

      {/* EDITOR BODY */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* General Info */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-teal-500" /> General Information
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-semibold text-gray-600">
                  Server Name
                </label>
                <input
                  type="text"
                  value={server.name}
                  onChange={(e) =>
                    setServer({ ...server, name: e.target.value })
                  }
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-teal-500 transition-colors"
                  placeholder="e.g. Internal Knowledge Graph"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Internal ID
                </label>
                <input
                  type="text"
                  value={server.id || "Generated on save"}
                  disabled
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-50 text-slate-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Status
                </label>
                <select
                  value={server.status}
                  onChange={(e) =>
                    setServer({
                      ...server,
                      status: e.target.value as MCPServerConfig["status"],
                    })
                  }
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-teal-500 bg-white cursor-pointer"
                >
                  <option value="active">🟢 Active</option>
                  <option value="inactive">⚪ Inactive</option>
                  <option value="error">🔴 Error / Offline</option>
                </select>
              </div>
            </div>
          </div>

          {/* Connection Details */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Link2 className="w-4 h-4 text-teal-500" /> Connection Details
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Server URL (Endpoint)
                </label>
                <input
                  type="url"
                  value={server.url}
                  onChange={(e) =>
                    setServer({ ...server, url: e.target.value })
                  }
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-teal-500 font-mono text-slate-800"
                  placeholder="https://mcp.yourdomain.com/v1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Authentication Type
                </label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {(["none", "api_key", "bearer"] as const).map((type) => (
                    <div
                      key={type}
                      onClick={() => setServer({ ...server, auth_type: type })}
                      className={`p-3 border rounded-lg cursor-pointer text-center text-sm font-medium transition-all ${
                        server.auth_type === type
                          ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {type === "none" && "No Auth"}
                      {type === "api_key" && "API Key (Header)"}
                      {type === "bearer" && "Bearer Token"}
                    </div>
                  ))}
                </div>
                {server.auth_type !== "none" && (
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    Note: Actual credentials/keys should be managed securely in
                    your environment variables, not hardcoded here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
