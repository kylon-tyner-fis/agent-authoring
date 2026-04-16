# RESEARCH: Navigation and Routing (Current State)

Date: 2026-04-16

## 1) Codebase Routing Topology

The app uses Next.js App Router with route files under `app/`.

Primary pages currently present:
- `/` -> `app/page.tsx`
- `/skills` -> `app/skills/page.tsx`
- `/skills/[id]` -> `app/skills/[id]/page.tsx`
- `/agents` -> `app/agents/page.tsx`
- `/agents/[id]` -> `app/agents/[id]/page.tsx`
- `/mcp-servers` -> `app/mcp-servers/page.tsx`
- `/mcp-servers/[id]` -> `app/mcp-servers/[id]/page.tsx`

API routes currently present:
- `/api/skills` and `/api/skills/[id]`
- `/api/agents` and `/api/agents/[id]`
- `/api/mcp-servers` and `/api/mcp-servers/[id]`
- `/api/agent`

## 2) Global Layout and Shared UI Baseline

`app/layout.tsx` currently:
- Applies fonts and body shell.
- Wraps children with `ToastProvider`.
- Does not render a shared header, tabs, breadcrumbs, or shared nav component.

`app/globals.css` currently:
- Defines root color variables and dark-mode media override.
- Sets `body` font to `Arial, Helvetica, sans-serif`.
- Does not define breadcrumb/nav utility classes.

## 3) Existing Navigation Behavior by Page

### `/` (`app/page.tsx`)
- Contains its own left sidebar with section buttons:
  - Overview (visual active button)
  - Agents (`router.push('/agents')`)
  - Skills (`router.push('/skills')`)
  - MCP Servers (`router.push('/mcp-servers')`)
- Also has section cards that navigate with `router.push(...)`.
- This sidebar exists only on `/`.

### `/skills` (`app/skills/page.tsx`)
- No global/top section tabs.
- Uses `router.push('/skills/new')` for create.
- Uses `router.push('/skills/{id}')` for edit.

### `/skills/[id]` (`app/skills/[id]/page.tsx`)
- Has local top bar with a back button (`router.push('/skills')`).
- Save action returns to `/skills`.
- No breadcrumb UI.

### `/agents` (`app/agents/page.tsx`)
- No global/top section tabs.
- Uses `router.push('/agents/new')` for create.
- Uses `router.push('/agents/{agent_id}')` for edit.

### `/agents/[id]` (`app/agents/[id]/page.tsx`)
- Has local top bar with a back button (`router.push('/agents')`).
- Page body composes `ConfigPanel` and optional `Playground` drawer.
- No breadcrumb UI.

### `/mcp-servers` (`app/mcp-servers/page.tsx`)
- No global/top section tabs.
- Uses `router.push('/mcp-servers/new')` for create.
- Uses `router.push('/mcp-servers/{id}')` for edit.

### `/mcp-servers/[id]` (`app/mcp-servers/[id]/page.tsx`)
- Has local top bar with a back button (`router.push('/mcp-servers')`).
- Save action returns to `/mcp-servers`.
- No breadcrumb UI.

## 4) Breadcrumb and Route-State Observations

- No breadcrumb component exists in `components/`.
- No file currently imports breadcrumb primitives.
- No route-aware shared component currently uses `usePathname`.
- Navigation is primarily imperative (`useRouter().push`) at page level.
- There is no single source of truth for section labels (`Dashboard`, `Skills`, `Agents`, `MCP Servers`) across pages.

## 5) ID/Entity Contract Facts Relevant to Route Labels

- Skills identify records with `id` (`/api/skills/[id]`).
- MCP servers identify records with `id` (`/api/mcp-servers/[id]`).
- Agents identify records with `agent_id` in storage and API filters (`/api/agents/[id]` resolves `.eq('agent_id', id)`).

## 6) Current Component/Screen Composition Facts

- Many pages define full-screen containers (`min-h-screen` or `h-screen`) and page-local top bars.
- `app/agents/[id]/page.tsx` includes an internal editor shell and uses large fixed-width panes for panel/playground.
- `components/ConfigPanel.tsx` also renders its own header area for the editor context.

## 7) Potential Side-Effect / Breakage Vectors (Current-State Risks)

These are observed coupling points in the existing code:

- Multiple pages have independent top bars and back controls; adding shared navigation affects vertical spacing on pages already using `h-screen`/`min-h-screen` wrappers.
- `/` has a unique left sidebar nav that is not shared elsewhere; a second global nav surface would overlap in responsibility with that page-local sidebar.
- Section navigation labels are currently duplicated in multiple files (`app/page.tsx`, list headers, button text), so label consistency is currently manual.
- Imperative navigation via page-local `router.push` means global route context is not centralized in one component.

## 8) Files Directly Related to Navigation Surface

- `app/layout.tsx`
- `app/page.tsx`
- `app/skills/page.tsx`
- `app/skills/[id]/page.tsx`
- `app/agents/page.tsx`
- `app/agents/[id]/page.tsx`
- `app/mcp-servers/page.tsx`
- `app/mcp-servers/[id]/page.tsx`
- `app/globals.css`
