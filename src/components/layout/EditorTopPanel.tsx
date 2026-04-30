import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Play,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface EditorTopPanelProps {
  backUrl: string;
  backLabel: string;
  onCopy?: () => void;
  isCopied?: boolean;
  onTest?: () => void;
  testLabel?: string;
  onSave: () => void;
  saveLabel: string;
  isSaving: boolean;
  saveSuccess?: boolean;
  themeColor?: "emerald" | "sky" | "cyan" | "amber" | "violet" | "slate";
}

export const EditorTopPanel = ({
  backUrl,
  backLabel,
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
    <div className="px-4 sm:px-6 lg:px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
      <button
        onClick={() => router.push(backUrl)}
        // We added negative margin and padding to increase the clickable area without altering layout alignment
        className="flex items-center gap-2 px-3 py-2 -ml-3 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </button>
      <div className="flex items-center gap-3">
        {onCopy && (
          <button
            onClick={onCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm ${
            saveSuccess
              ? "bg-green-100 text-green-700 border border-green-200 !text-green-700"
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
