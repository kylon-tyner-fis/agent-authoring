export type PrimarySectionKey =
  | "dashboard"
  | "skills"
  | "agents"
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
  { key: "skills", label: "Skills", href: "/skills" },
  { key: "agents", label: "Agents", href: "/agents" },
  { key: "mcpServers", label: "MCP Servers", href: "/mcp-servers" },
];

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const resolvePrimarySection = (pathname: string): PrimarySectionKey => {
  if (pathname === "/") return "dashboard";
  if (startsWithSegment(pathname, "/skills")) return "skills";
  if (startsWithSegment(pathname, "/agents")) return "agents";
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
