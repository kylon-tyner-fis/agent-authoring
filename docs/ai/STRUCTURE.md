# STRUCTURE: Global Nav + Section Breadcrumbs

Date: 2026-04-16
Based on: `docs/ai/DESIGN.md`

## 1) Scope Contract

In scope:
- Global top header tabs for primary sections.
- Global section-level breadcrumbs on every screen.
- URL/pathname-driven active state.
- Clickable ancestor breadcrumbs.

Out of scope:
- Entity-level breadcrumbs.
- Mobile-specific adaptation.
- Cross-section state persistence.
- API/database changes.

## 2) Route Taxonomy Contract

Primary sections:
- Dashboard: `/`
- Skills: `/skills` and descendants
- Agents: `/agents` and descendants
- MCP Servers: `/mcp-servers` and descendants

## 3) Module Contracts

### 3.1 `lib/navigation.ts` (New)

Purpose:
- Central source of truth for section metadata and pathname resolution.

Types:
- `type PrimarySectionKey = 'dashboard' | 'skills' | 'agents' | 'mcpServers'`
- `type PrimaryNavItem = { key: PrimarySectionKey; label: string; href: string }`
- `type BreadcrumbItem = { label: string; href: string; isCurrent: boolean }`

Exports:
- `PRIMARY_NAV: PrimaryNavItem[]`
- `resolvePrimarySection(pathname: string): PrimarySectionKey`
- `getSectionByKey(key: PrimarySectionKey): PrimaryNavItem`
- `buildSectionBreadcrumbs(pathname: string): BreadcrumbItem[]`

Resolution behavior:
- Exact `/` => `dashboard`
- Prefix `/skills` => `skills`
- Prefix `/agents` => `agents`
- Prefix `/mcp-servers` => `mcpServers`
- Fallback => `dashboard`

### 3.2 `components/AppChrome.tsx` (New)

Purpose:
- Shared page chrome rendering tabs + breadcrumbs + page content.

Inputs:
- `children: React.ReactNode`

Dependencies:
- `next/link`
- `next/navigation` (`usePathname`)
- `lib/navigation` helpers

Render phases:
1. Read pathname.
2. Resolve active section.
3. Build breadcrumb list.
4. Render top tabs nav (`aria-label='Primary'`).
5. Render breadcrumbs nav (`aria-label='Breadcrumb'`).
6. Render children area.

### 3.3 `app/layout.tsx` (Modify)

Purpose change:
- Wrap all app content in `AppChrome` while preserving `ToastProvider`.

Contract:
- Keep metadata and font setup unchanged.
- Keep server layout; nest client chrome inside body.

## 4) UI Structure Contract

Top chrome stack:
1. Tabs row (global primary sections)
2. Breadcrumb row (section-level)
3. Existing page body

Active tab semantics:
- Active tab uses visual selected style.
- Active tab includes `aria-current='page'`.

Breadcrumb semantics:
- Ancestors rendered as links.
- Current crumb rendered as non-link text or current style.

## 5) Vertical Slices

Slice A: Navigation data layer
- Add `lib/navigation.ts` contracts and pure helpers.

Slice B: Shared chrome shell
- Add `components/AppChrome.tsx` using Slice A.

Slice C: App integration
- Connect shell in `app/layout.tsx`.

Slice D: Verification
- Type/lint check.
- Confirm all target routes display tabs + breadcrumbs.

## 6) Verification Checkpoints

Checkpoint A (after Slice A):
- `lib/navigation.ts` exports compile.
- Pathname mapping returns expected keys for:
  - `/`, `/skills`, `/skills/new`, `/agents/foo`, `/mcp-servers/abc`.

Checkpoint B (after Slice B):
- AppChrome renders tabs and breadcrumb structures without runtime errors.

Checkpoint C (after Slice C):
- Global chrome visible on:
  - `/`
  - `/skills`
  - `/skills/new`
  - `/agents`
  - `/agents/new`
  - `/mcp-servers`
  - `/mcp-servers/new`

Checkpoint D (final):
- Lint/type checks pass.
- Existing page-level navigation actions still route correctly.

## 7) Failure Handling Contract

If runtime/layout regressions appear:
- Roll back only the latest slice.
- Preserve previous slices if valid.
- Update `PLAN.md` with discovered issue before continuing.
