import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/src/components/layout/Toast";
import { AppChrome } from "@/src/components/layout/AppChrome";
import { ProjectProvider } from "../lib/contexts/ProjectContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
