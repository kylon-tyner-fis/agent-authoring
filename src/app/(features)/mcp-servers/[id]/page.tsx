"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Server, Link2, Key, Activity, Loader2 } from "lucide-react";
import { MCPServerConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { EditorTopPanel } from "@/src/components/layout/EditorTopPanel";

export default function MCPServerEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === "new";

  const [server, setServer] = useState<MCPServerConfig>({
    id: "",
    name: "",
    url: "",
    auth_type: "none",
    status: "active",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyConfig = async () => {
    const snapshot = {
      name: server.name,
      url: server.url,
      auth_type: server.auth_type,
      status: server.status,
      // Intentionally omitting auth_token for safety
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  useEffect(() => {
    const fetchServer = async () => {
      if (isNew) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/mcp-servers/${id}`);
        const data = await res.json();
        if (data.server) setServer(data.server);
      } catch (error) {
        console.error("Failed to load server:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServer();
  }, [id, isNew]);

  const handleSave = async () => {
    setIsSaving(true);
    const finalId = server.id || uuidv4();
    const finalServer = { ...server, id: finalId };

    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalServer),
      });

      if (res.ok) {
        router.push("/mcp-servers");
      }
    } catch (error) {
      console.error("Error saving server:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <EditorTopPanel
        backUrl="/mcp-servers"
        backLabel="Back to Servers"
        onCopy={handleCopyConfig}
        isCopied={isCopied}
        onSave={handleSave}
        saveLabel="Save Server Config"
        isSaving={isSaving}
        themeColor="cyan"
      />
      {isLoading ? (
        <div className="h-full w-full flex items-center justify-center bg-slate-50 overflow-hidden">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* General Info */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-600" /> General Information
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-cyan-500 transition-colors text-slate-900"
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
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-50 text-slate-900 font-mono"
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-cyan-500 bg-white cursor-pointer text-slate-900"
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
                <Link2 className="w-4 h-4 text-cyan-600" /> Connection Details
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-cyan-500 font-mono text-slate-900"
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
                        onClick={() =>
                          setServer({ ...server, auth_type: type })
                        }
                        className={`p-3 border rounded-lg cursor-pointer text-center text-sm font-medium transition-all ${
                          server.auth_type === type
                            ? "border-cyan-500 bg-cyan-50 text-cyan-700 ring-1 ring-cyan-500"
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
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        {server.auth_type === "bearer"
                          ? "Bearer Token"
                          : "API Key"}
                      </label>
                      <input
                        type="password" // Use password type to hide the token in the UI
                        value={server.auth_token || ""}
                        onChange={(e) =>
                          setServer({ ...server, auth_token: e.target.value })
                        }
                        className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-cyan-500 font-mono text-slate-900"
                        placeholder={
                          server.auth_type === "bearer"
                            ? "access_..."
                            : "your-api-key"
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
