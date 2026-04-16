# DESIGN: Global Navigation + Breadcrumbs (Phase 3)

Date: 2026-04-16
Status: Draft for Human Approval

## 1) Problem Statement

Navigation in the current app is fragmented.
Each page manages its own local navigation controls.
Only `/` has a sidebar for major section jumps.
Section switching from deep editor pages is inconsistent.
There is no persistent breadcrumb showing current location.

The requested behavior is:
- URL-based navigation.
- Global top-header tabs available at all times.
- Primary sections limited to Dashboard, Skills, Agents, MCP Servers.
- Section-level breadcrumbs first.
- Breadcrumb segments must be clickable.
- No mobile-specific work in this pass.
- No requirement to preserve local section state when switching.

## 2) Current State (Observed)

`app/layout.tsx` is global but contains only font/body shell + `ToastProvider`.
No shared app shell component currently wraps pages.
`app/page.tsx` implements a standalone sidebar nav pattern.
`app/skills/page.tsx`, `app/agents/page.tsx`, `app/mcp-servers/page.tsx` are independent list pages.
`app/skills/[id]/page.tsx`, `app/agents/[id]/page.tsx`, and `app/mcp-servers/[id]/page.tsx` have local back bars.
Navigation patterns are mostly imperative `router.push(...)` calls.
No shared `usePathname`-driven route metadata layer exists.
No breadcrumb component exists.
No section-level taxonomy is centralized in one file.

## 3) Desired End State

All app pages render inside a shared shell with:
- A top header tab bar for primary section jumps.
- A breadcrumb row below the tabs that reflects current route.
- Clickable breadcrumb ancestors.

Behavior characteristics:
- The browser URL is the source of truth for location.
- Tabs highlight the active primary section.
- Deep routes (`/skills/[id]`, etc.) map to their section tab and breadcrumb path.
- Global navigation does not depend on page-local components.
- Existing page content keeps working with minimal feature changes.

## 4) Design Principles

1. Centralize route metadata.
2. Keep global nav declarative and deterministic.
3. Use route-prefix matching for section activation.
4. Keep breadcrumb generation pure from pathname.
5. Minimize churn in feature pages.
6. Avoid introducing client-state coupling for nav.
7. Prefer composable shell wrappers over one-off UI duplication.
8. Preserve App Router conventions.

## 5) Architectural Strategy

### 5.1 Introduce a Shared App Shell Component

Create a client component (e.g., `components/AppChrome.tsx`) responsible for:
- Rendering top tabs.
- Rendering breadcrumb row.
- Rendering `children` content area.

Why client component:
- It needs `usePathname` for active tab + breadcrumbs.
- It may use `Link` and route-aware styles.

Placement:
- Use this shell from `app/layout.tsx` so all app routes receive global nav by default.

### 5.2 Central Route Registry

Create a route metadata module (e.g., `lib/navigation.ts`) containing:
- Primary section definitions:
  - Dashboard -> `/`
  - Skills -> `/skills`
  - Agents -> `/agents`
  - MCP Servers -> `/mcp-servers`
- Label text for tabs and breadcrumbs.
- Path matching helpers.

This becomes single source of truth for:
- Tab rendering.
- Active section logic.
- Section-level breadcrumb generation.

### 5.3 Pathname-to-Section Resolution

Resolution logic rules:
- `/` => Dashboard.
- `/skills` and `/skills/*` => Skills.
- `/agents` and `/agents/*` => Agents.
- `/mcp-servers` and `/mcp-servers/*` => MCP Servers.

This keeps active tab behavior stable for list and detail pages.

### 5.4 Breadcrumb Model (Section-Level for This Phase)

Breadcrumb model will be intentionally shallow now.
For any non-root route:
- Crumb 1: Dashboard (`/`)
- Crumb 2: Active Section root path (`/skills`, `/agents`, `/mcp-servers`)

For root route:
- Single crumb: Dashboard.

Clickable behavior:
- Ancestor crumbs render as links.
- Current crumb may render as text or disabled link style.

No entity-level crumb in this phase:
- `/skills/abc` still shows `Dashboard > Skills`.
- `/agents/new` still shows `Dashboard > Agents`.

### 5.5 Interaction with Existing Local Back Bars

Local back bars in editor pages can remain initially.
Global breadcrumb does not require immediate back-bar removal.
Potential overlap is visual, not logical.

Design choice for this phase:
- Keep local back bars for low-risk transition.
- De-duplicate later if desired after acceptance.

### 5.6 Dashboard Sidebar Coexistence

`app/page.tsx` has a page-local sidebar with similar links.
With global tabs added, this becomes redundant but not functionally broken.

Design choice for this phase:
- Keep existing sidebar initially to avoid redesign churn.
- Normalize later in a follow-up cleanup.

## 6) UI/UX Structure (Desktop)

Global vertical stack:
1. Tabs row (primary nav)
2. Breadcrumb row
3. Page content

Tab row requirements:
- Always visible at top.
- Clear active state for current section.
- Uses `Link` to primary section URLs.

Breadcrumb row requirements:
- Always visible on every screen.
- Uses separators (`/` or chevrons).
- Ancestors clickable.
- Current crumb visually distinct.

Content area requirement:
- Existing pages render unchanged below chrome.

## 7) Data and Logic Contracts

### 7.1 Section Type Contract

Define a finite section type:
- `dashboard`
- `skills`
- `agents`
- `mcpServers`

### 7.2 Navigation Entry Contract

Each entry includes:
- `key` (section id)
- `label` (display)
- `href` (section root URL)
- `matchPrefix` (path prefix for activation)

### 7.3 Breadcrumb Contract

A breadcrumb item includes:
- `label`
- `href`
- `isCurrent`

Generated from pathname and section resolution helper.

## 8) Styling Direction

Use existing Tailwind tokens and neutral slate palette already used across pages.
Do not introduce a new visual language in this phase.
Focus on consistency and clarity.

Tabs styling:
- Inactive: subtle text + hover background.
- Active: stronger text + bottom indicator or filled background.

Breadcrumb styling:
- Ancestors: link color with hover underline or tint.
- Current: muted but stronger than metadata text.

## 9) Accessibility Considerations

- Use semantic `<nav aria-label="Primary">` for tabs.
- Use semantic `<nav aria-label="Breadcrumb">` for breadcrumb trail.
- Ensure active tab has `aria-current="page"` semantics where appropriate.
- Keep hit targets large enough for desktop interaction.

## 10) Risk Analysis

### 10.1 Layout Height Coupling

Many pages use `h-screen`/`min-h-screen` wrappers.
Adding persistent top chrome may produce nested full-height overflow behavior.

Mitigation:
- Use shell content container strategy that allows child pages to continue scrolling.
- Avoid hard-forcing additional `h-screen` constraints in shell wrapper.

### 10.2 Duplicate Navigation Surfaces

Root page sidebar duplicates global tabs.

Mitigation:
- Accept temporary redundancy in this iteration.
- Track cleanup option as follow-up.

### 10.3 Route Matching Edge Cases

Potential false positives with prefix matching if future routes overlap.

Mitigation:
- Use explicit prefix boundaries (`/skills` or `/skills/...`) rather than loose substring checks.

### 10.4 Client/Server Boundaries

`layout.tsx` is server by default; route-aware hooks require client scope.

Mitigation:
- Keep layout server component and insert a client `AppChrome` wrapper inside body.

## 11) What We Intentionally Avoid in This Phase

- Entity-level breadcrumbs (`Dashboard > Skills > Skill Name`).
- Persisting filters/scroll/selection state across section jumps.
- Mobile-specific nav adaptation.
- Refactoring every local back button.
- Redesigning dashboard content model.

## 12) Verification Intent for Later Phases

Expected verifications once implementation begins:
- Navigating between all 4 primary tabs updates URL correctly.
- Active tab is correct on list and detail routes.
- Breadcrumb appears on all main routes and detail routes.
- Breadcrumb ancestors navigate correctly.
- Existing page actions (create/edit/save/back) still function.

## 13) Proposed Files to Introduce/Modify (Design-Level)

Likely new files:
- `components/AppChrome.tsx`
- `components/Breadcrumbs.tsx` (optional split)
- `lib/navigation.ts`

Likely modified files:
- `app/layout.tsx` (wrap `children` with global chrome)
- `app/page.tsx` (possible future cleanup only; not required for first pass)

No API contract changes are required.
No database schema changes are required.

## 14) Architectural Patterns to Follow

- Single source of truth for navigation metadata.
- Route-derived UI state (`pathname -> active section -> breadcrumbs`).
- Composition over duplication for global page furniture.
- Minimal invasive edits to feature modules.

## 15) Architectural Patterns to Avoid

- Hardcoding tab labels/paths in multiple page files.
- Creating separate breadcrumb logic per route.
- Storing active section in local React state disconnected from URL.
- Coupling global nav with agent editor internals.

## 16) Decision Summary

Decision A:
Global top tabs will be implemented as shared app chrome.

Decision B:
Section-level breadcrumbs will be global and clickable for ancestors.

Decision C:
URL/pathname is the only source for current navigation context.

Decision D:
Existing per-page back controls remain for now unless they conflict.

Decision E:
No mobile optimization or state persistence in this iteration.

## 17) Human Approval Gate

This document is Phase 3 output and serves as architectural alignment.
Implementation must not start until explicit approval.

Approval prompt:
- Reply with `LGTM` or `Proceed` to start Phase 4 (Structure).
- If changes are needed, specify them and this design will be revised.
