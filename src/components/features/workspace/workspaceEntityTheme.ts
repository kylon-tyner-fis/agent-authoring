import type { CSSProperties } from "react";
import type { EntityType } from "@/src/lib/contexts/WorkspaceContext";

export type WorkspaceEntityThemeKey = Extract<
  EntityType,
  "orchestrator" | "agent" | "skill"
>;

export type WorkspacePanelThemeKey = "composer" | "inspector";

type ColorFamily = "sky" | "blue" | "fuchsia" | "purple" | "violet" | "indigo";

type ThemeConfig = {
  family: ColorFamily;
  gradientFamily: ColorFamily;
  selectedTo?: number;
};

const ENTITY_GRADIENT_STOPS = {
  defaultFrom: 100,
  defaultTo: 100,
  hoverFrom: 100,
  hoverTo: 300,
  selectedFrom: 500,
  selectedTo: 600,
  shadow: 200,
};

const createColorToken = (family: ColorFamily, stop: number) =>
  `var(--color-${family}-${stop})`;

const createEntityStyle = (
  family: ThemeConfig["family"],
  gradientFamily: ThemeConfig["gradientFamily"],
  selectedTo = ENTITY_GRADIENT_STOPS.selectedTo,
) =>
  ({
    "--entity-50": createColorToken(family, 50),
    "--entity-100": createColorToken(family, 100),
    "--entity-200": createColorToken(family, 200),
    "--entity-300": createColorToken(family, 300),
    "--entity-400": createColorToken(family, 400),
    "--entity-500": createColorToken(family, 500),
    "--entity-600": createColorToken(family, 600),
    "--entity-700": createColorToken(family, 700),
    "--entity-default-from": createColorToken(
      family,
      ENTITY_GRADIENT_STOPS.defaultFrom,
    ),
    "--entity-default-to": createColorToken(
      family,
      ENTITY_GRADIENT_STOPS.defaultTo,
    ),
    "--entity-hover-from": createColorToken(
      family,
      ENTITY_GRADIENT_STOPS.hoverFrom,
    ),
    "--entity-hover-to": createColorToken(family, ENTITY_GRADIENT_STOPS.hoverTo),
    "--entity-selected-from": createColorToken(
      family,
      ENTITY_GRADIENT_STOPS.selectedFrom,
    ),
    "--entity-selected-to": createColorToken(family, selectedTo),
    "--entity-gradient-from": createColorToken(family, 500),
    "--entity-gradient-to": createColorToken(gradientFamily, 600),
    "--entity-gradient-hover-from": createColorToken(family, 600),
    "--entity-gradient-hover-to": createColorToken(gradientFamily, 700),
    "--entity-border-subtle": createColorToken(family, 100),
    "--entity-border": createColorToken(family, 200),
    "--entity-border-strong": createColorToken(family, 300),
    "--entity-shadow-color": `color-mix(in srgb, ${createColorToken(family, ENTITY_GRADIENT_STOPS.shadow)} 80%, transparent)`,
    "--entity-focus-soft": `color-mix(in srgb, ${createColorToken(family, 500)} 16%, white)`,
  }) as CSSProperties;

const ENTITY_CONFIG: Record<WorkspaceEntityThemeKey, ThemeConfig> = {
  orchestrator: {
    family: "sky",
    gradientFamily: "blue",
  },
  agent: {
    family: "fuchsia",
    gradientFamily: "purple",
  },
  skill: {
    family: "violet",
    gradientFamily: "indigo",
    selectedTo: 700,
  },
};

const PANEL_CONFIG: Record<WorkspacePanelThemeKey, ThemeConfig> = {
  composer: {
    family: "violet",
    gradientFamily: "indigo",
  },
  inspector: {
    family: "indigo",
    gradientFamily: "blue",
  },
};

const createThemeRecord = <TKey extends string>(
  config: Record<TKey, ThemeConfig>,
): Record<TKey, ThemeConfig & { style: CSSProperties }> => {
  const result = {} as Record<TKey, ThemeConfig & { style: CSSProperties }>;

  for (const themeKey of Object.keys(config) as TKey[]) {
    const themeConfig = config[themeKey];

    result[themeKey] = {
      ...themeConfig,
      style: createEntityStyle(
        themeConfig.family,
        themeConfig.gradientFamily,
        themeConfig.selectedTo,
      ),
    };
  }

  return result;
};

export const WORKSPACE_ENTITY_THEME = createThemeRecord(
  ENTITY_CONFIG,
) as Record<WorkspaceEntityThemeKey, ThemeConfig & { style: CSSProperties }>;

export const WORKSPACE_PANEL_THEME = createThemeRecord(
  PANEL_CONFIG,
) as Record<WorkspacePanelThemeKey, ThemeConfig & { style: CSSProperties }>;

export const WORKSPACE_ENTITY_TREE_SURFACE_CLASS =
  "border border-transparent text-slate-700 bg-white/70 hover:bg-[color-mix(in_srgb,var(--entity-50)_72%,white)] hover:border-[var(--entity-border-subtle)]";

export const WORKSPACE_ENTITY_TREE_SELECTED_CLASS =
  "border border-[var(--entity-border-strong)] text-slate-900 bg-linear-to-r from-[var(--entity-200)] to-[color-mix(in_srgb,var(--entity-100)_72%,white)]";

export const WORKSPACE_ENTITY_TREE_EDITING_CLASS =
  "border bg-white border-[var(--entity-border-strong)] shadow-sm ring-2 ring-[var(--entity-focus-soft)]";

export const WORKSPACE_ENTITY_HEADER_CLASS =
  "border-b border-[var(--entity-border-subtle)] bg-linear-to-r from-[var(--entity-50)] to-white";

export const WORKSPACE_ENTITY_ICON_SHELL_CLASS =
  "bg-linear-to-br from-[var(--entity-gradient-from)] to-[var(--entity-gradient-to)] text-white shadow-[0_8px_20px_var(--entity-shadow-color)]";

export const WORKSPACE_ENTITY_PRIMARY_BUTTON_CLASS =
  "bg-linear-to-br from-[var(--entity-gradient-from)] to-[var(--entity-gradient-to)] text-white hover:from-[var(--entity-gradient-hover-from)] hover:to-[var(--entity-gradient-hover-to)] shadow-[0_8px_20px_var(--entity-shadow-color)]";

export const WORKSPACE_ENTITY_SECONDARY_BUTTON_CLASS =
  "bg-white text-slate-700 border border-[var(--entity-border)] hover:bg-[var(--entity-50)] hover:border-[var(--entity-border-strong)] transition-all shadow-sm";

export const WORKSPACE_ENTITY_SECONDARY_ICON_CLASS =
  "text-[var(--entity-500)] fill-[var(--entity-500)]";

export const WORKSPACE_ENTITY_FIELD_FOCUS_CLASS =
  "focus:outline-none focus:ring-2 focus:ring-[var(--entity-500)] focus:border-[var(--entity-500)]";

export const WORKSPACE_ENTITY_FIELD_SOFT_FOCUS_CLASS =
  "focus:outline-none focus:ring-2 focus:ring-[var(--entity-focus-soft)]";

export const WORKSPACE_ENTITY_TREE_ICON_CLASS =
  "text-[var(--entity-500)]";

export const WORKSPACE_ENTITY_SECTION_ICON_CLASS =
  "text-[var(--entity-500)]";

export const WORKSPACE_ENTITY_SECTION_ICON_SHELL_CLASS =
  "bg-[var(--entity-100)] text-[var(--entity-600)]";

export const WORKSPACE_ENTITY_DOT_CLASS = "bg-[var(--entity-600)]";

export const WORKSPACE_ENTITY_INLINE_ACTION_CLASS =
  "bg-white text-slate-400 border border-slate-200 hover:text-[var(--entity-600)] hover:bg-[var(--entity-50)] hover:border-[var(--entity-border)]";

export const WORKSPACE_ENTITY_INLINE_ACTION_SELECTED_CLASS =
  "bg-white/85 text-slate-500 border border-white/80 hover:text-[var(--entity-600)] hover:bg-white";

export const WORKSPACE_ENTITY_DASHED_ADD_BUTTON_CLASS =
  "text-[var(--entity-700)] border-[var(--entity-border)] bg-white hover:bg-[var(--entity-50)] hover:border-[var(--entity-border-strong)]";

export const WORKSPACE_ENTITY_DROPDOWN_IDLE_CLASS =
  "bg-linear-to-r from-[var(--entity-50)] to-white border-slate-200 hover:border-[var(--entity-border)] hover:bg-[var(--entity-50)]/50";

export const WORKSPACE_ENTITY_DROPDOWN_ACTIVE_CLASS =
  "bg-linear-to-br from-[var(--entity-gradient-from)] to-[var(--entity-gradient-to)] border-[var(--entity-500)] shadow-[0_8px_20px_var(--entity-shadow-color)]";

export const WORKSPACE_ENTITY_TOGGLE_ACTIVE_CLASS =
  "bg-[var(--entity-600)] text-white border-transparent shadow-[0_8px_20px_var(--entity-shadow-color)]";

export const WORKSPACE_ENTITY_TOGGLE_IDLE_CLASS =
  "bg-white border-slate-200 text-slate-500 hover:border-[var(--entity-500)] hover:text-[var(--entity-600)]";

export const WORKSPACE_ENTITY_STAT_CARD_CLASS =
  "bg-linear-to-br from-[var(--entity-50)] to-white border border-[var(--entity-border-subtle)]";

export const WORKSPACE_PANEL_CONTROL_CLASS =
  "border border-slate-200 bg-white text-slate-500 hover:-translate-y-0.5 hover:border-[var(--entity-border)] hover:bg-[var(--entity-50)] hover:text-[var(--entity-600)]";

export const WORKSPACE_PANEL_CONTROL_SHELL_CLASS =
  "bg-linear-to-b from-white to-slate-50 shadow-sm shadow-slate-200/50";

export const WORKSPACE_PANEL_TITLE_ICON_CLASS =
  "text-[var(--entity-500)]";

export const WORKSPACE_PANEL_SECONDARY_BUTTON_CLASS =
  "bg-white text-[var(--entity-700)] border border-[var(--entity-border)] hover:bg-[var(--entity-50)] hover:border-[var(--entity-border-strong)] transition-all shadow-sm";

export const WORKSPACE_PANEL_SECONDARY_ICON_CLASS =
  "fill-[var(--entity-700)] text-[var(--entity-700)]";

export const WORKSPACE_PANEL_PRIMARY_BUTTON_CLASS =
  "bg-linear-to-br from-[var(--entity-gradient-from)] to-[var(--entity-gradient-to)] text-white hover:from-[var(--entity-gradient-hover-from)] hover:to-[var(--entity-gradient-hover-to)] shadow-[0_8px_20px_var(--entity-shadow-color)]";

export const WORKSPACE_PANEL_BADGE_INFO_CLASS =
  "bg-[var(--entity-100)] text-[var(--entity-700)] border-[var(--entity-border)]";

export const WORKSPACE_PANEL_NODE_CARD_HOVER_CLASS =
  "hover:border-[var(--entity-500)] hover:shadow-md";

export const WORKSPACE_PANEL_NODE_CARD_LABEL_HOVER_CLASS =
  "group-hover:text-[var(--entity-700)]";
