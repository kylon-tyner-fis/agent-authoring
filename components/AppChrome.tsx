"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, resolvePrimarySection } from "@/lib/navigation";
import { ArrowLeft } from "lucide-react";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const activeSection = resolvePrimarySection(pathname);

  // Detail page detection
  const isDetailPage = pathname.match(/^\/(skills|agents|mcp-servers)\/.+$/);
  const backHref = isDetailPage ? `/${isDetailPage[1]}` : null;

  let backLabel = "Back";
  if (isDetailPage) {
    if (isDetailPage[1] === "skills") backLabel = "Library";
    if (isDetailPage[1] === "agents") backLabel = "Agents";
    if (isDetailPage[1] === "mcp-servers") backLabel = "Servers";
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="shrink-0 sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Primary"
            className="flex items-center gap-2 py-3 overflow-x-auto"
          >
            {isDetailPage && backHref && (
              <>
                <Link
                  href={backHref}
                  className="flex items-center gap-1.5 pr-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> {backLabel}
                </Link>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
              </>
            )}

            {PRIMARY_NAV.map((item) => {
              const isActive = item.key === activeSection;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
