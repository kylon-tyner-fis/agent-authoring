# PLAN: Implement Global Tabs + Section Breadcrumbs

Date: 2026-04-16

## Work Tree

### Branch A: Navigation Contracts (Pure Logic)
- [x] Action A1: Create `lib/navigation.ts` with primary section metadata and exported types.
- [x] Verify A1: Run TypeScript/lint checks for new module exports and imports.
- [x] Action A2: Implement pathname resolver (`resolvePrimarySection`) with explicit prefix matching.
- [x] Verify A2: Validate expected mapping in code review for representative paths.
- [x] Action A3: Implement section breadcrumb builder (`buildSectionBreadcrumbs`) using section-level model.
- [x] Verify A3: Validate breadcrumb outputs in code review for root and deep routes.

### Branch B: Shared Chrome Component
- [x] Action B1: Create `components/AppChrome.tsx` as a client component.
- [x] Verify B1: Ensure no server-only APIs are used; hooks compile.
- [x] Action B2: Render global top tabs from `PRIMARY_NAV` and highlight active section by pathname.
- [x] Verify B2: Confirm active tab semantics and styles are route-driven.
- [x] Action B3: Render breadcrumb row from `buildSectionBreadcrumbs` with clickable ancestors.
- [x] Verify B3: Confirm breadcrumb appears and ancestors are links.

### Branch C: App Integration
- [x] Action C1: Modify `app/layout.tsx` to wrap page content with `AppChrome` inside `ToastProvider`.
- [x] Verify C1: Ensure layout still renders children and global providers.

### Branch D: End-to-End Verification
- [x] Action D1: Run lint/type checks.
- [ ] Verify D1: Repo-wide lint currently fails due to pre-existing issues unrelated to this change; targeted lint on changed files passes.
- [x] Action D2: Review affected routes for expected nav/breadcrumb behavior.
- [x] Verify D2: Confirm requirements match:
  - URL-based global navigation
  - top-header tabs for Dashboard/Skills/Agents/MCP Servers
  - section-level clickable breadcrumbs on all screens

## Execution Order
1. Branch A
2. Branch B
3. Branch C
4. Branch D

## Rollback Strategy
- If Branch B fails, keep Branch A and fix component integration.
- If Branch C fails, isolate layout wrapper change and re-run checks.
- If verification fails, patch only failing layer (resolver, chrome, or layout) and re-verify.
