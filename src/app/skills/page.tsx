"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Trash2, Loader2, Cpu, Clock } from "lucide-react";

interface SkillListItem {
  id: string;
  version: string;
  description: string;
  model_name: string;
  updated_at: string;
}

export default function AgentsDashboard() {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const skillsRes = await fetch("/api/skills");
        const skillsData = await skillsRes.json();
        if (skillsData.skills) setSkills(skillsData.skills);
      } catch (error) {
        console.error("Failed to fetch skills", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, []);

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await fetch(`/api/skills/${deletingId}`, { method: "DELETE" });
      setSkills(skills.filter((s) => s.id !== deletingId));
    } catch (error) {
      console.error("Failed to delete agent", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-600" /> Skills
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your orchestration configurations.
            </p>
          </div>
          <button
            onClick={() => router.push("/skills/new")}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Create Skill
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-slate-900 font-bold">No skills found</p>
              <p className="text-slate-500 text-sm mt-1">
                Create your first skill to get started.
              </p>
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border bg-blue-50 border-blue-200">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 min-w-0">
                      <span className="truncate">{skill.id}</span>
                      <span className="text-sm bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono border border-slate-200">
                        v{skill.version}
                      </span>
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                      {skill.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" /> {skill.model_name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(skill.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => router.push(`/agents/${skill.id}`)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Edit Agent
                  </button>
                  <button
                    onClick={() => setDeletingId(skill.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Agent?
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to permanently delete this agent? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
