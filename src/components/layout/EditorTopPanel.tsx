"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Play,
  Save,
  CheckCircle2,
  LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface EditorTopPanelProps {
  backUrl: string;
  backLabel?: string; // Optional if using title/subtitle
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  onCopy?: () => void;
  isCopied?: boolean;
  onTest?: () => void;
  testLabel?: string;
  onSave: () => void;
  saveLabel?: string;
  isSaving: boolean;
  saveSuccess?: boolean;
  themeColor?:
    | "emerald"
    | "sky"
    | "cyan"
    | "amber"
    | "violet"
    | "slate"
    | "fuchsia"
    | "indigo";
}

export const EditorTopPanel = ({
  backUrl,
  backLabel,
  title,
  subtitle,
  icon: Icon,
  onCopy,
  isCopied,
  onTest,
  testLabel = "Test",
  onSave,
  saveLabel = "Save",
  isSaving,
  saveSuccess,
  themeColor = "emerald",
}: EditorTopPanelProps) => {
  const router = useRouter();

  const themeMap = {
    fuchsia: {
      text: "text-fuchsia-600",
      bg: "bg-fuchsia-600",
      hoverBg: "hover:bg-fuchsia-700",
      lightBg: "bg-fuchsia-100",
      lightHoverBg: "hover:bg-fuchsia-200",
      border: "border-fuchsia-200",
    },
    indigo: {
      text: "text-indigo-600",
      bg: "bg-indigo-600",
      hoverBg: "hover:bg-indigo-700",
      lightBg: "bg-indigo-100",
      lightHoverBg: "hover:bg-indigo-200",
      border: "border-indigo-200",
    },
    emerald: {
      text: "text-emerald-600",
      bg: "bg-emerald-600",
      hoverBg: "hover:bg-emerald-700",
      lightBg: "bg-emerald-50",
      lightHoverBg: "hover:bg-emerald-100",
      border: "border-emerald-200",
    },
    sky: {
      text: "text-sky-700",
      bg: "bg-sky-600",
      hoverBg: "hover:bg-sky-700",
      lightBg: "bg-sky-50",
      lightHoverBg: "hover:bg-sky-100",
      border: "border-sky-200",
    },
    cyan: {
      text: "text-cyan-700",
      bg: "bg-cyan-600",
      hoverBg: "hover:bg-cyan-700",
      lightBg: "bg-cyan-50",
      lightHoverBg: "hover:bg-cyan-100",
      border: "border-cyan-200",
    },
    amber: {
      text: "text-amber-700",
      bg: "bg-amber-600",
      hoverBg: "hover:bg-amber-700",
      lightBg: "bg-amber-50",
      lightHoverBg: "hover:bg-amber-100",
      border: "border-amber-200",
    },
    violet: {
      text: "text-violet-700",
      bg: "bg-violet-600",
      hoverBg: "hover:bg-violet-700",
      lightBg: "bg-violet-50",
      lightHoverBg: "hover:bg-violet-100",
      border: "border-violet-200",
    },
    slate: {
      text: "text-slate-700",
      bg: "bg-slate-600",
      hoverBg: "hover:bg-slate-700",
      lightBg: "bg-slate-50",
      lightHoverBg: "hover:bg-slate-100",
      border: "border-slate-200",
    },
  };

  const theme = themeMap[themeColor];

  return (
    <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(backUrl)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {title ? (
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className={`w-10 h-10 rounded-xl ${theme.lightBg} flex items-center justify-center ${theme.text}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
        ) : (
          <span className="text-sm font-semibold text-slate-700">
            {backLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onCopy && (
          <button
            onClick={onCopy}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          >
            {isCopied ? (
              <Check className={`w-4 h-4 ${theme.text}`} />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {isCopied ? "Copied!" : "Copy Config"}
          </button>
        )}

        {onTest && (
          <button
            onClick={onTest}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${theme.lightBg} ${theme.text} ${theme.lightHoverBg} border ${theme.border}`}
          >
            <Play className="w-4 h-4" /> {testLabel}
          </button>
        )}

        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm ${
            saveSuccess
              ? "bg-green-100 text-green-700 border border-green-200"
              : `text-white ${theme.bg} ${theme.hoverBg}`
          }`}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? "Published" : saveLabel}
        </button>
      </div>
    </div>
  );
};
