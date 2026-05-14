// src/components/features/workspace/editors/SkillSettings.tsx
"use client";

import React from "react";
import { Cpu, MessageSquare, Info } from "lucide-react";

interface SkillSettingsProps {
  data: any;
  onChange: (field: string, value: any) => void;
  readOnly?: boolean;
}

const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google"];
const SUPPORTED_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash"],
};

export function SkillSettings({ data, onChange, readOnly }: SkillSettingsProps) {
  return (
    <div className="p-6 flex flex-col md:flex-row gap-8 overflow-y-auto">
      {/* Description Section */}
      <section className="flex-1 space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" /> General Info
        </label>
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-600">
            Skill Description
          </span>
          <textarea
            value={data.description || ""}
            disabled={readOnly}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="What does this skill accomplish?"
            className={`w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none min-h-[100px] resize-none ${readOnly ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-50/30 text-slate-700"}`}
          />
        </div>
      </section>

      {/* System Prompt Section */}
      <section className="flex-[1.5] space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Info className="w-3.5 h-3.5" /> Logic & Reasoning
        </label>
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-600">
            Instructions (System Prompt)
          </span>
          <textarea
            value={data.system_prompt || ""}
            disabled={readOnly}
            onChange={(e) => onChange("system_prompt", e.target.value)}
            placeholder="Define the internal logic for this skill..."
            className={`w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none min-h-[100px] font-mono ${readOnly ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-50/30 text-slate-700"}`}
          />
        </div>
      </section>

      {/* Model Configuration */}
      <section className="flex-1 space-y-4">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5" /> AI Model
        </label>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-600">
              Provider
            </span>
            <select
              value={data.model?.provider || "openai"}
              disabled={readOnly}
              onChange={(e) =>
                onChange("model", {
                  ...data.model,
                  provider: e.target.value,
                  model_name: SUPPORTED_MODELS[e.target.value][0],
                })
              }
              className={`w-full p-2 text-sm border border-slate-200 rounded-lg outline-none ${readOnly ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700"}`}
            >
              {SUPPORTED_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-600">
              Model Name
            </span>
            <select
              value={data.model?.model_name || ""}
              disabled={readOnly}
              onChange={(e) =>
                onChange("model", { ...data.model, model_name: e.target.value })
              }
              className={`w-full p-2 text-sm border border-slate-200 rounded-lg outline-none ${readOnly ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700"}`}
            >
              {SUPPORTED_MODELS[data.model?.provider || "openai"]?.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
