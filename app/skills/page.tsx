"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Plus, Edit2, Trash2, Code2 } from "lucide-react";
import { MOCK_SKILLS } from "@/lib/constants";

export default function SkillsDashboard() {
  const router = useRouter();

  const [skills, setSkills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (data.skills) setSkills(data.skills);
      setIsLoading(false);
    };
    fetchSkills();
  }, []);

  // Update handleDelete to use actual API
  const handleDelete = async (id: string) => {
    if (!confirm(`Delete skill ${id}?`)) return;
    await fetch(`/api/skills/${id}`, { method: "DELETE" });
    setSkills(skills.filter((s) => s.id !== id));
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
              Reusable functions and prompts that your Agents can execute.
            </p>
          </div>
          <button
            onClick={() => router.push("/skills/new")}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Create Skill
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100 shrink-0">
                  <Code2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{skill.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                    {skill.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {skill.mcp_dependencies.map((dep) => (
                      <span
                        key={dep}
                        className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono border border-slate-200"
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => router.push(`/skills/${skill.id}`)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(skill.id)}
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
