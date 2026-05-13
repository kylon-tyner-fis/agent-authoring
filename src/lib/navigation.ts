export type PrimarySectionKey =
  | "dashboard"
  | "workspace"
  | "tools"
  | "mcpServers";

export interface PrimaryNavItem {
  key: PrimarySectionKey;
  label: string;
  href: string;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrent: boolean;
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "workspace", label: "Workspace", href: "/workspace" },
  { key: "tools", label: "Tools", href: "/tools" },
  { key: "mcpServers", label: "MCP Servers", href: "/mcp-servers" },
];

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const resolvePrimarySection = (pathname: string): PrimarySectionKey => {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/workspace")) return "workspace";
  if (startsWithSegment(pathname, "/tools")) return "tools";
  if (startsWithSegment(pathname, "/mcp-servers")) return "mcpServers";
  return "dashboard";
};

export const getSectionByKey = (key: PrimarySectionKey): PrimaryNavItem =>
  PRIMARY_NAV.find((item) => item.key === key) || PRIMARY_NAV[0];

export const buildSectionBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const section = resolvePrimarySection(pathname);

  if (section === "dashboard") {
    const root = getSectionByKey("dashboard");
    return [{ label: root.label, href: root.href, isCurrent: true }];
  }

  const dashboard = getSectionByKey("dashboard");
  const current = getSectionByKey(section);

  return [
    { label: dashboard.label, href: dashboard.href, isCurrent: false },
    { label: current.label, href: current.href, isCurrent: true },
  ];
};
