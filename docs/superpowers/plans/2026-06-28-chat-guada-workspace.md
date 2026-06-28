# Chat Guada Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the chat workspace to match the selected Guada-style interaction and show a real right-side workspace directory tree.

**Architecture:** Keep the change local to the existing web chat page and API client. `ApiClient` exposes typed workspace tree helpers; `ChatWorkspace` owns the tree state, renders a fixed right panel on desktop, and keeps chat send/load behavior unchanged.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, TypeScript, Tailwind CSS utilities, existing Nest workspace endpoints.

---

### Task 1: API Client Workspace Endpoints

**Files:**
- Modify: `packages/api-client/src/http-client.test.ts`
- Modify: `packages/api-client/src/http-client.ts`

- [ ] **Step 1: Write the failing endpoint tests**

Add a test to `packages/api-client/src/http-client.test.ts`:

```ts
  it("fetches workspace tree and children with legacy endpoints", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ tree: [] }),
    })) as unknown as typeof fetch & { mock: { calls: Parameters<typeof fetch>[] } };
    const client = new ApiClient({
      fetcher,
      tokenProvider: () => null,
      clientIdProvider: () => "client-123",
    });

    await client.fetchWorkspaceTree("session-1");
    await client.fetchWorkspaceChildren("session-1", "src/components");

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/sessions/session-1/workspace/tree",
      "/api/v1/sessions/session-1/workspace/children?path=src%2Fcomponents",
    ]);
  });
```

- [ ] **Step 2: Run the API client test and verify RED**

Run: `pnpm --filter @mosaic-dock/api-client test -- src/http-client.test.ts`

Expected: FAIL because `fetchWorkspaceTree` and `fetchWorkspaceChildren` are not defined.

- [ ] **Step 3: Add typed API helpers**

Add exports to `packages/api-client/src/http-client.ts`:

```ts
export interface WorkspaceTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  hasChildren?: boolean;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceTreeResponse {
  tree: WorkspaceTreeNode[];
}

export interface WorkspaceChildrenResponse {
  children: WorkspaceTreeNode[];
}
```

Add methods to `ApiClient`:

```ts
  async fetchWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    return this.request<WorkspaceTreeResponse>(`/sessions/${sessionId}/workspace/tree`);
  }

  async fetchWorkspaceChildren(
    sessionId: string,
    path: string,
  ): Promise<WorkspaceChildrenResponse> {
    const search = new URLSearchParams({ path });
    return this.request<WorkspaceChildrenResponse>(
      `/sessions/${sessionId}/workspace/children?${search.toString()}`,
    );
  }
```

- [ ] **Step 4: Run the API client test and verify GREEN**

Run: `pnpm --filter @mosaic-dock/api-client test -- src/http-client.test.ts`

Expected: PASS.

### Task 2: Chat Workspace File Tree Behavior

**Files:**
- Modify: `apps/web/src/pages/chat/ChatWorkspace.test.tsx`
- Modify: `apps/web/src/pages/chat/index.tsx`

- [ ] **Step 1: Write the failing chat workspace tests**

Update `baseApi().client` in `ChatWorkspace.test.tsx` with `fetchWorkspaceTree` and `fetchWorkspaceChildren` mocks. Add tests:

```ts
  it("loads and renders the workspace tree in the right panel", async () => {
    const api = baseApi();
    renderChat(api);

    expect(await screen.findByRole("heading", { name: "工作目录" })).toBeInTheDocument();
    expect(await screen.findByText(".guada")).toBeInTheDocument();
    expect(await screen.findByText("README.md")).toBeInTheDocument();
    expect(api.client.fetchWorkspaceTree).toHaveBeenCalledWith("session-1");
  });

  it("loads workspace children when expanding a directory", async () => {
    const api = baseApi();
    const user = userEvent.setup();
    renderChat(api);

    await user.click(await screen.findByRole("button", { name: "展开 src" }));

    await waitFor(() => {
      expect(api.client.fetchWorkspaceChildren).toHaveBeenCalledWith("session-1", "src");
    });
    expect(await screen.findByText("index.tsx")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the chat workspace test and verify RED**

Run: `pnpm --filter @mosaic-dock/web test -- src/pages/chat/ChatWorkspace.test.tsx`

Expected: FAIL because the page has no workspace panel.

- [ ] **Step 3: Implement workspace tree state and rendering**

In `ChatWorkspace`, extend `ChatWorkspaceApi.client` to include `fetchWorkspaceTree` and `fetchWorkspaceChildren`, add tree state, load root nodes on `activeSessionId`, and render a `WorkspaceTreePanel` local component with expand/collapse support.

- [ ] **Step 4: Run the chat workspace test and verify GREEN**

Run: `pnpm --filter @mosaic-dock/web test -- src/pages/chat/ChatWorkspace.test.tsx`

Expected: PASS.

### Task 3: Guada-Style Chat Layout Polish

**Files:**
- Modify: `apps/web/src/pages/chat/ChatWorkspace.test.tsx`
- Modify: `apps/web/src/pages/chat/index.tsx`

- [ ] **Step 1: Update behavior assertions for the composer**

Change the send test placeholder lookup from `输入消息，按 Enter 发送` to `按 / 使用技能，Shift+Enter 换行`.

- [ ] **Step 2: Run the chat workspace test and verify RED**

Run: `pnpm --filter @mosaic-dock/web test -- src/pages/chat/ChatWorkspace.test.tsx`

Expected: FAIL until the composer placeholder is updated.

- [ ] **Step 3: Polish the layout**

Update `ChatWorkspace` classes and markup:

- Use a white main surface with a right workspace column.
- Keep the top title bar compact and Guada-like.
- Render messages in a centered max-width column.
- Update user bubbles to soft blue styling.
- Update assistant bubbles to bordered white cards with avatar.
- Render a floating composer with toolbar affordances and send button.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
pnpm --filter @mosaic-dock/web test -- src/pages/chat/ChatWorkspace.test.tsx
pnpm --filter @mosaic-dock/web typecheck
```

Expected: PASS.

### Task 4: Final Verification

**Files:**
- Verify: `packages/api-client/src/http-client.test.ts`
- Verify: `apps/web/src/pages/chat/ChatWorkspace.test.tsx`

- [ ] **Step 1: Run package tests**

Run:

```bash
pnpm --filter @mosaic-dock/api-client test -- src/http-client.test.ts
pnpm --filter @mosaic-dock/web test -- src/pages/chat/ChatWorkspace.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Check lints for edited files**

Use IDE diagnostics for:

- `packages/api-client/src/http-client.ts`
- `packages/api-client/src/http-client.test.ts`
- `apps/web/src/pages/chat/index.tsx`
- `apps/web/src/pages/chat/ChatWorkspace.test.tsx`

Expected: no new diagnostics.
