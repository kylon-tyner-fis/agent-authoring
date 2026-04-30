"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, resolvePrimarySection } from "@/src/lib/navigation";
import {
  Layers,
  Bot,
  Network,
  Wrench,
  Server,
  HelpCircle,
  Bell,
  User,
} from "lucide-react";
import Image from "next/image";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const activeSection = resolvePrimarySection(pathname);

  // 1. Identify if we are on a workspace/edit page
  const isDetailPage = pathname.match(
    /^\/(skills|agents|mcp-servers|tools|orchestrators)\/.+$/,
  );

  // 2. Dynamically assign the layout wrapper class
  const headerLayoutClass = isDetailPage
    ? "max-w-full" // Fluid edge-to-edge
    : "max-w-7xl"; // Constrained

  // Helper to return the correct icon for each nav item
  const getNavIcon = (key: string, isActive: boolean) => {
    const className = `w-4 h-4 shrink-0 transition-colors ${
      isActive ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
    }`;
    switch (key) {
      case "orchestrators":
        return <Layers className={className} />;
      case "agents":
        return <Bot className={className} />;
      case "skills":
        return <Network className={className} />;
      case "tools":
        return <Wrench className={className} />;
      case "mcpServers":
        return <Server className={className} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      <header className="h-16 shrink-0 sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur flex items-center">
        {/* Changed to justify-between to push utilities to the right */}
        <div
          className={`mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-5 transition-all duration-300 ease-in-out ${headerLayoutClass}`}
        >
          {/* Left Side: Navigation Links */}
          <nav
            aria-label="Primary"
            className="flex items-center gap-1.5 overflow-x-auto"
          >
            {PRIMARY_NAV.map((item) => {
              const isActive = item.key === activeSection;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  // 4. Enhance Active/Inactive State Transitions: Softer styles & group hovers
                  className={`group rounded-lg px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                    isActive
                      ? "bg-slate-100 text-slate-900 shadow-sm border border-slate-200/50"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  {item.key === "dashboard" ? (
                    <Image
                      src="/logo.svg"
                      width={20}
                      height={20}
                      alt="App Logo"
                      className={`shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                    />
                  ) : (
                    getNavIcon(item.key, isActive)
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* 2. Add Right-Side Utility Actions (Profile/Help) */}
          <div className="flex items-center gap-1 shrink-0 pl-4 border-l border-slate-200">
            <button
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Help and Documentation"
              title="Help & Docs"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors relative"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button
              className="ml-2 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
              aria-label="User Profile"
              title="User Settings"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)] flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
