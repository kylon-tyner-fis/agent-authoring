"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Server, Link2, Key, Activity, Loader2 } from "lucide-react";
import { MCPServerConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { EditorTopPanel } from "@/src/components/layout/EditorTopPanel";
import { useProject } from "@/src/lib/contexts/ProjectContext";

export default function MCPServerEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { currentProject } = useProject();
  const { id } = use(params);
  const isNew = id === "new";

  const [server, setServer] = useState<MCPServerConfig>({
    id: "",
    project_id: "",
    name: "",
    url: "",
    health_url: "",
    auth_type: "none",
    status: "Active",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyConfig = async () => {
    const snapshot = {
      name: server.name,
      url: server.url,
      health_url: server.health_url,
      auth_type: server.auth_type,
      status: server.status,
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
      if (!currentProject?.id) {
        setIsLoading(false);
        return;
      }

      if (isNew) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/mcp-servers/${id}?projectId=${currentProject.id}`,
        );
        const data = await res.json();
        if (data.server) setServer(data.server);
      } catch (error) {
        console.error("Failed to load server:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServer();
  }, [id, isNew, currentProject?.id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const finalId = server.id || uuidv4();
    const finalServer = {
      ...server,
      id: finalId,
      project_id: server.project_id || currentProject?.id || "",
    };

    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalServer),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
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
        title={
          isNew ? "Create MCP Server" : server.name || "Untitled MCP Server"
        }
        subtitle="Configure server connection, health, and authentication"
        icon={Server}
        onCopy={handleCopyConfig}
        isCopied={isCopied}
        onSave={handleSave}
        saveLabel="Save Server Config"
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        themeColor="cyan"
      />
      {isLoading ? (
        <div className="h-full w-full flex items-center justify-center bg-slate-50 overflow-hidden">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* General Info */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" /> General
                Information
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 transition-colors text-slate-900"
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
                  <input
                    value={server.status}
                    disabled
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg outline-none bg-slate-50 cursor-not-allowed text-slate-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Status is updated dynamically via health checks.
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Details */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-600" /> Connection
                Details
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
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 font-mono text-slate-900"
                    placeholder="https://mcp.yourdomain.com/v1"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Health Check URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={server.health_url || ""}
                    onChange={(e) =>
                      setServer({ ...server, health_url: e.target.value })
                    }
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 font-mono text-slate-900"
                    placeholder="https://mcp.yourdomain.com/health"
                  />
                  <p className="text-[11px] text-slate-500">
                    If provided, this URL will be actively pinged to determine
                    the real-time status of the server.
                  </p>
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
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500"
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
                        type="password"
                        value={server.auth_token || ""}
                        onChange={(e) =>
                          setServer({ ...server, auth_token: e.target.value })
                        }
                        className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 font-mono text-slate-900"
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
