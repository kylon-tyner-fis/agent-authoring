"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Plus, Trash2, Code2, Loader2 } from "lucide-react";
import { SkillConfig } from "@/src/lib/types/constants";

export default function SkillsDashboard() {
  const router = useRouter();

  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await fetch("/api/skills");
        const data = await res.json();
        if (data.skills) setSkills(data.skills);
      } catch (error) {
        console.error("Failed to fetch skills", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete skill ${id}?`)) return;

    try {
      await fetch(`/api/skills/${id}`, { method: "DELETE" });
      setSkills(skills.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to delete skill", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-indigo-600" /> Skill Library
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Reusable functions and prompts that your agents can execute.
            </p>
          </div>
          <button
            onClick={() => router.push("/skills/new")}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
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
                Create your first skill to build reusable workflow logic.
              </p>
            </div>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border bg-indigo-50 border-indigo-200">
                    <Code2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg truncate">
                      {skill.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                      {skill.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {skill.mcp_dependencies.length > 0 ? (
                        skill.mcp_dependencies.map((dep) => (
                          <span
                            key={dep}
                            className="text-sm bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono border border-slate-200"
                          >
                            {dep}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          No MCP dependencies
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => router.push(`/skills/${skill.id}`)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Edit Skill
                  </button>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Skill"
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
