"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, Trash2, Loader2 } from "lucide-react";
import { OrchestratorConfig } from "@/src/lib/types/constants";

export default function OrchestratorsDashboard() {
  const router = useRouter();
  const [orchestrators, setOrchestrators] = useState<OrchestratorConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrchestrators = async () => {
      try {
        const res = await fetch("/api/orchestrators");
        const data = await res.json();
        if (data.orchestrators) setOrchestrators(data.orchestrators);
      } catch (error) {
        console.error("Failed to fetch orchestrators", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrchestrators();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete orchestrator?`)) return;
    try {
      await fetch(`/api/orchestrators/${id}`, { method: "DELETE" });
      setOrchestrators(orchestrators.filter((o) => o.id !== id));
    } catch (error) {
      console.error("Failed to delete orchestrator", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-sky-600" /> Orchestrators
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Top-level executive systems that manage and delegate tasks to
              specialized Agents.
            </p>
          </div>
          <button
            onClick={() => router.push("/orchestrators/new")}
            className="flex items-center gap-2 bg-sky-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-sky-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Create Orchestrator
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : orchestrators.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-slate-900 font-bold">No orchestrators found</p>
            </div>
          ) : (
            orchestrators.map((orchestrator) => (
              <div
                key={orchestrator.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border bg-sky-50 border-sky-200">
                    <Layers className="w-5 h-5 text-sky-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 min-w-0">
                      <span className="truncate">{orchestrator.name}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${orchestrator.status === "active" ? "bg-green-50 text-green-600 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                      >
                        {orchestrator.status}
                      </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                      {orchestrator.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() =>
                      router.push(`/orchestrators/${orchestrator.id}`)
                    }
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Edit Orchestrator
                  </button>
                  <button
                    onClick={() => handleDelete(orchestrator.id)}
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
