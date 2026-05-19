// src/components/layout/SlidingPlaygroundPanel.tsx
"use client";

import { ReactNode } from "react";

interface SlidingPlaygroundPanelProps {
  isOpen: boolean;
  children: ReactNode;
}

export function SlidingPlaygroundPanel({
  isOpen,
  children,
}: SlidingPlaygroundPanelProps) {
  return (
    <div
      className={`absolute right-4 top-[78px] bottom-4 w-[380px] z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white/95 backdrop-blur-xl transition-all duration-300 ease-out origin-right ${
        isOpen 
          ? "opacity-100 translate-x-0 scale-100 pointer-events-auto" 
          : "opacity-0 translate-x-8 scale-95 pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}
