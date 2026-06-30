# Guada Model Provider Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate Guada's provider card actions for full model management and provider settings on the existing model management page.

**Architecture:** Keep the workflow in `apps/web/src/pages/models/index.tsx` using two Guada-style dialogs launched from each added provider card: one for model management, one for provider settings. Extend `packages/api-client/src/services/model-service.ts` and `packages/api-client/src/http-client.ts` to expose the Nest model/provider endpoints that already exist. Use `/models/all` as the source of truth and refresh it after every mutation.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, `@mosaic-dock/api-client`, existing NestJS `/models` and `/providers` endpoints.

---

### Task 1: API Client Surface

**Files:**
- Modify: `packages/api-client/src/services/model-service.ts`
- Modify: `packages/api-client/src/http-client.ts`

- [ ] Add typed request helpers for `updateProvider`, `deleteProvider`, `fetchRemoteModels`, `createModel`, `updateModel`, `deleteModel`, `toggleModelActive`, and `toggleModelFavorite`.
- [ ] Expose matching methods on `ApiClient` so `ModelsPageApi` can inject them in tests.

### Task 2: Model Management Tests

**Files:**
- Modify: `apps/web/src/pages/models/ModelsPage.test.tsx`

- [ ] Extend the fake API with two added models and mocks for all model management methods.
- [ ] Add a test that opens “模型管理”, verifies the existing model list, toggles favorite, toggles active, deletes a model, manually adds a model, syncs remote models, imports one remote model, and verifies `/models/all` refreshes.

### Task 3: Provider Settings Tests

**Files:**
- Modify: `apps/web/src/pages/models/ModelsPage.test.tsx`

- [ ] Add a test that opens “供应商设置”, edits API key and custom headers, tests the connection, saves provider settings, deletes the provider, and verifies the payloads and refresh behavior.

### Task 4: Page Implementation

**Files:**
- Modify: `apps/web/src/pages/models/index.tsx`

- [ ] Expand `ModelsPageApi` with the new methods.
- [ ] Change `ProviderCard` from a whole-card button to a card container with real action buttons to avoid nested interactive controls.
- [ ] Add `selectedModelProvider` and `selectedSettingsProvider` state.
- [ ] Implement `ModelManagementDialog` with model list, favorite, enable/disable, delete, manual add, remote sync, and import actions.
- [ ] Implement `ProviderSettingsDialog` with editable settings, connection test, save, and delete.
- [ ] Reuse existing helpers where possible and keep all mutations followed by `loadProviders()`.

### Task 5: Verification

**Files:**
- Test: `apps/web/src/pages/models/ModelsPage.test.tsx`
- Typecheck: `apps/web`
- Typecheck: `packages/api-client`

- [ ] Run `pnpm --filter @mosaic-dock/web exec vitest run src/pages/models/ModelsPage.test.tsx`.
- [ ] Run `pnpm --filter @mosaic-dock/web typecheck`.
- [ ] Run `pnpm --filter @mosaic-dock/api-client typecheck`.
- [ ] Run `pnpm --filter @mosaic-dock/web test` if focused verification passes.
