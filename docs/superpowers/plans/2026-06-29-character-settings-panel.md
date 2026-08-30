# Character Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MosaicDock's simplified assistant create/edit dialog with a Guada-aligned 7-tab character settings panel, including avatar crop/upload, model, memory, local tools, MCP, and Skills configuration.

**Architecture:** Keep the existing `/characters/assistants` page as the route/list container, but move modal state and payload construction into focused React components and helper functions. Preserve backend endpoints and store advanced settings inside `Character.settings`, matching Guada's payload shape.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind v4, lucide-react, Vitest, Testing Library, existing MosaicDock API client/shared packages, browser Canvas API for 1:1 avatar crop.

---

### File Structure

- Modify `packages/shared/src/character.ts` to strongly type `CharacterSettings`, tools, MCP, skills, and character tool responses.
- Add `packages/shared/src/mcp.ts` for `McpServer` list typing.
- Add `packages/api-client/src/services/mcp-server-service.ts` and expose `fetchMcpServers()` from `ApiClient`.
- Modify `packages/api-client/src/http-client.test.ts` to cover MCP and avatar upload request behavior.
- Rewrite `apps/web/src/pages/characters/index.tsx` into a list container using a full `CharacterModal`.
- Create `apps/web/src/pages/characters/character-settings.ts` for defaults, normalize, validate, and payload conversion.
- Create `apps/web/src/pages/characters/CharacterModal.tsx` for the Guada-style modal shell and two-step save.
- Create `apps/web/src/pages/characters/CharacterSettingPanel.tsx` for the 7-tab form and avatar crop UI.
- Extend `apps/web/src/pages/characters/CharactersPage.test.tsx` to cover complete create/edit flows and payload shape.

### Task 1: Types and API Client

- [ ] Write failing API client tests for `fetchMcpServers()` and avatar upload FormData handling.
- [ ] Extend shared character settings and MCP types.
- [ ] Implement MCP API client service and `ApiClient.fetchMcpServers`.
- [ ] Run `http-client.test.ts` and api-client typecheck.

### Task 2: Payload Helpers

- [ ] Write unit tests or page-flow expectations proving `systemPrompt` is saved inside `settings.systemPrompt`, not top-level.
- [ ] Implement form defaults, character-to-form normalization, form-to-payload conversion, title validation, token parsing, and tools config helpers.

### Task 3: Guada-Style Modal UI

- [ ] Replace the simplified dialog with a 900px modal and top tab navigation: 基础、提示词、模型、记忆、本地工具、MCP 工具、Skills.
- [ ] Implement Basic, Prompt, Model, Memory, Local Tools, MCP, and Skills sections using existing Tailwind UI patterns.
- [ ] Load full character details with `fetchCharacter(id)` before editing.
- [ ] Bootstrap groups, models, skills, MCP servers, and character tools for create/edit.

### Task 4: Avatar Crop and Upload

- [ ] Implement image select, preview, 1:1 crop modal, zoom slider, and cropped `File` generation.
- [ ] Save via Guada order: create/update first, then `uploadCharacterAvatar(id, file)`.
- [ ] Update tests to assert upload happens after create/update when avatar is selected.

### Task 5: Group Management

- [ ] Make `+ 新建分组` functional and add rename/delete actions for character groups.
- [ ] Refresh groups and list after group changes.

### Task 6: Verification

- [ ] Run API client tests and typecheck.
- [ ] Run CharactersPage and WorkspaceLayout tests.
- [ ] Run web typecheck.
- [ ] Run lints on changed files.

