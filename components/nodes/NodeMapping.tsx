import React from "react";
import { Globe, LogIn, LogOut, ArrowRight, ArrowLeft } from "lucide-react";

interface NodeMappingProps {
  globalKey: string;
  localKey: string;
  flowDirection: "global-to-local" | "local-to-global";
  localType: "input" | "output";
}

export function NodeMapping({
  globalKey,
  localKey,
  flowDirection,
  localType,
}: NodeMappingProps) {
  const LocalIcon = localType === "input" ? LogIn : LogOut;
  const ArrowIcon =
    flowDirection === "global-to-local" ? ArrowRight : ArrowLeft;

  // Indigo when extracting from state, Emerald when saving to state
  const globalColor =
    flowDirection === "global-to-local"
      ? "text-indigo-500"
      : "text-emerald-500";

  return (
    <div className="text-[10px] flex items-center justify-between gap-2 text-slate-500 font-mono bg-slate-50 rounded px-1.5 py-1 border border-slate-100">
      {/* Left Side: Global State */}
      <div
        className={`flex items-center gap-1 w-[45%] overflow-hidden ${globalColor}`}
      >
        <Globe className="w-3 h-3 shrink-0" />
        <span className="font-semibold truncate" title={`State: ${globalKey}`}>
          {globalKey}
        </span>
      </div>

      {/* Center: Directional Arrow */}
      <div className="flex-1 flex justify-center">
        <ArrowIcon className="w-3 h-3 text-slate-400 shrink-0" />
      </div>

      {/* Right Side: Local Field */}
      <div className="flex items-center gap-1 w-[45%] justify-end overflow-hidden text-slate-600">
        <span className="truncate" title={`Local: ${localKey}`}>
          {localKey}
        </span>
        <LocalIcon className="w-3 h-3 shrink-0" />
      </div>
    </div>
  );
}
