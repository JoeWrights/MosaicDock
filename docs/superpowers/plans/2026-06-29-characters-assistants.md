# Characters Assistants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Guada-aligned `/characters/assistants` page to MosaicDock with assistant browsing, grouping, basic CRUD, and "use this role" session creation.

**Architecture:** Keep the backend unchanged and add missing frontend client methods for the existing character endpoints. Implement the page as focused React components under `apps/web/src/pages/characters`, injected with a small API surface for tests, and wire it into `WorkspaceLayout` navigation.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind v4, lucide-react, Vitest, Testing Library, existing `@mosaic-dock/api-client` and `@mosaic-dock/shared` packages.

---

### File Structure

- Modify `packages/shared/src/character.ts` to add typed request payloads for character and group mutations.
- Create `packages/api-client/src/services/character-service.ts` for `/characters` and `/character-groups` endpoints.
- Modify `packages/api-client/src/http-client.ts` to expose character/group CRUD methods.
- Modify `packages/api-client/src/http-client.test.ts` with failing tests for endpoint URLs, methods, params, and bodies.
- Create `apps/web/src/pages/characters/index.tsx` for the page container, list, modal, and helper normalization functions.
- Create `apps/web/src/pages/characters/CharactersPage.test.tsx` with user-flow tests for load, filtering, create/update/delete, and session creation navigation.
- Modify `apps/web/src/constants/routes.ts` and `apps/web/src/routes/routes.tsx` to register `/characters` redirect and `/characters/:tab`.
- Modify `apps/web/src/layouts/WorkspaceLayout.tsx` and `apps/web/src/layouts/WorkspaceLayout.test.tsx` to enable the sidebar "助手" entry and active state.

### Task 1: API Client Character Endpoints

- [ ] Write failing tests in `packages/api-client/src/http-client.test.ts` proving `fetchCharacters({ groupId })`, character CRUD, character group CRUD, avatar upload, and tool fetch call the expected backend endpoints.
- [ ] Add request types to `packages/shared/src/character.ts`.
- [ ] Implement `packages/api-client/src/services/character-service.ts`.
- [ ] Wire methods through `ApiClient` in `packages/api-client/src/http-client.ts`.
- [ ] Run `pnpm --filter @mosaic-dock/api-client test` and confirm the new tests pass.

### Task 2: Characters Page Behavior

- [ ] Write failing tests in `apps/web/src/pages/characters/CharactersPage.test.tsx` for rendering assistants, group filtering, opening create/edit dialog, saving basic fields, deleting a character, and creating a chat session from a character.
- [ ] Implement `apps/web/src/pages/characters/index.tsx` with page header, tabs, group pills, cards, dialogs, loading/error/empty states, and API injection.
- [ ] Run `pnpm --filter @mosaic-dock/web test -- CharactersPage.test.tsx` and confirm the new tests pass.

### Task 3: Routing And Sidebar

- [ ] Write/update failing tests in `WorkspaceLayout.test.tsx` proving the "助手" sidebar entry navigates to `/characters/assistants` and is active on `/characters/*`.
- [ ] Add route constants and route objects for `/characters`, `/characters/assistants`, and `/characters/teams`.
- [ ] Enable the sidebar navigation path and active key.
- [ ] Run the web tests covering layout and characters routes.

### Task 4: Verification

- [ ] Run `pnpm --filter @mosaic-dock/api-client test`.
- [ ] Run `pnpm --filter @mosaic-dock/web test`.
- [ ] Run `pnpm --filter @mosaic-dock/web typecheck`.
- [ ] Use `ReadLints` on changed files and fix introduced diagnostics.

