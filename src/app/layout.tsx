import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/src/components/layout/Toast";
import { AppChrome } from "@/src/components/layout/AppChrome";
import { ProjectProvider } from "../lib/contexts/ProjectContext";

export const metadata: Metadata = {
  title: "LangGraph Agent Studio",
  description: "Visual authoring tool for LangGraph agents",
  icons: {
    icon:
      process.env.NODE_ENV === "development" ? "/icon-dev.svg" : "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <ProjectProvider>
            <AppChrome>{children}</AppChrome>
          </ProjectProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
