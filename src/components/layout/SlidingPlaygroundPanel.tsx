// src/components/layout/SlidingPlaygroundPanel.tsx
"use client";

import { ReactNode } from "react";

interface SlidingPlaygroundPanelProps {
  isOpen: boolean;
  children: ReactNode;
  basis?: string;
  minWidth?: number;
}

export function SlidingPlaygroundPanel({
  isOpen,
  children,
  basis = "40%",
  minWidth = 450,
}: SlidingPlaygroundPanelProps) {
  return (
    <div
      className="h-full shrink-0 overflow-hidden bg-white duration-300 ease-out"
      style={{
        flexBasis: isOpen ? basis : "0px",
        minWidth: isOpen ? `${minWidth}px` : "0px",
        transitionProperty: "flex-basis, min-width",
      }}
      aria-hidden={!isOpen}
    >
      <div
        className={`h-full w-full border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ minWidth }}
      >
        {children}
      </div>
    </div>
  );
}
