# Guada Custom Model Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate Guada's model management "Add custom" flow with a real provider connection test and save path.

**Architecture:** Extend the existing API client model service with provider creation and connection testing endpoints already exposed by the Nest backend. Keep the UI in `apps/web/src/pages/models/index.tsx`, matching the current Guada-style single-page pattern and adding a focused custom provider dialog. Refresh the provider list after save so chat/model selectors can consume persisted providers through existing `/models/all` data.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, `@mosaic-dock/api-client`, existing NestJS `/providers` endpoints.

---

### Task 1: API Client Provider Endpoints

**Files:**
- Modify: `packages/api-client/src/services/model-service.ts`
- Modify: `packages/api-client/src/http-client.ts`

- [ ] **Step 1: Add request and response types in `model-service.ts`**

```ts
export interface ProviderHeadersAttributes {
  headers?: Record<string, string>;
}

export interface CreateProviderRequest {
  name: string;
  provider?: string;
  protocol: string;
  apiKey: string;
  apiUrl: string;
  attributes?: ProviderHeadersAttributes;
}

export interface TestProviderConnectionRequest {
  provider?: string;
  protocol: string;
  apiKey: string;
  apiUrl: string;
  attributes?: ProviderHeadersAttributes;
}

export interface ProviderConnectionTestResult {
  success: boolean;
  message?: string;
}
```

- [ ] **Step 2: Add provider functions in `model-service.ts`**

```ts
export function createProvider(
  request: RestRequestClient,
  data: CreateProviderRequest,
): Promise<ModelProvider> {
  return request.request<ModelProvider>("/providers", {
    method: "POST",
    body: data,
  });
}

export function testProviderConnection(
  request: RestRequestClient,
  data: TestProviderConnectionRequest,
): Promise<ProviderConnectionTestResult> {
  return request.request<ProviderConnectionTestResult>("/providers/test-connection", {
    method: "POST",
    body: data,
  });
}
```

- [ ] **Step 3: Expose methods on `ApiClient`**

```ts
async createProvider(data: modelService.CreateProviderRequest): Promise<ModelProvider> {
  return modelService.createProvider(this.requestClient, data);
}

async testProviderConnection(
  data: modelService.TestProviderConnectionRequest,
): Promise<modelService.ProviderConnectionTestResult> {
  return modelService.testProviderConnection(this.requestClient, data);
}
```

### Task 2: Models Page Dialog Tests

**Files:**
- Modify: `apps/web/src/pages/models/ModelsPage.test.tsx`

- [ ] **Step 1: Extend fake API**

```ts
createProvider: vi.fn(async (data) => ({
  id: "provider-custom",
  name: data.name,
  provider: data.provider,
  protocol: data.protocol,
  apiUrl: data.apiUrl,
  apiKeySet: true,
  isActive: true,
  attributes: data.attributes,
  models: [],
})),
testProviderConnection: vi.fn(async () => ({
  success: true,
  message: "连接成功",
})),
```

- [ ] **Step 2: Add test for opening, testing, and saving custom provider**

```ts
it("creates a custom provider with Guada-style dialog and connection test", async () => {
  const api = createApi();
  const user = userEvent.setup();

  render(<ModelsPage api={api} />);

  await user.click(screen.getByRole("button", { name: "添加自定义" }));
  const dialog = screen.getByRole("dialog", { name: "新建分组" });

  await user.type(within(dialog).getByLabelText("名字"), "我的网关");
  await user.selectOptions(within(dialog).getByLabelText("协议类型"), "openai");
  await user.type(within(dialog).getByLabelText("API地址"), "https://gateway.example.com/v1");
  await user.type(within(dialog).getByLabelText("API KEY"), "sk-test");
  await user.type(within(dialog).getByLabelText("自定义请求头"), "Authorization: Bearer token\nX-Trace: abc");

  await user.click(within(dialog).getByRole("button", { name: "测试" }));
  expect(await within(dialog).findByText("连接成功")).toBeInTheDocument();

  await user.click(within(dialog).getByRole("button", { name: "确定" }));

  await waitFor(() =>
    expect(api.client.createProvider).toHaveBeenCalledWith({
      name: "我的网关",
      provider: "custom",
      protocol: "openai",
      apiUrl: "https://gateway.example.com/v1",
      apiKey: "sk-test",
      attributes: {
        headers: {
          Authorization: "Bearer token",
          "X-Trace": "abc",
        },
      },
    }),
  );
  expect(api.client.fetchAllModels).toHaveBeenCalledTimes(2);
});
```

### Task 3: Models Page Implementation

**Files:**
- Modify: `apps/web/src/pages/models/index.tsx`

- [ ] **Step 1: Expand `ModelsPageApi`**

```ts
export interface ModelsPageApi {
  client: Pick<ApiClient, "fetchAllModels" | "createProvider" | "testProviderConnection">;
}
```

- [ ] **Step 2: Add dialog state and provider reload helper**

```ts
const [customDialogOpen, setCustomDialogOpen] = useState(false);

const loadProviders = useCallback(async () => {
  setLoading(true);
  setError(null);
  const response = await api.client.fetchAllModels();
  setProviders(Array.isArray(response.items) ? response.items : []);
  setLoading(false);
}, [api]);
```

- [ ] **Step 3: Wire the header button**

```tsx
<button type="button" onClick={() => setCustomDialogOpen(true)} ...>
  <Plus className="h-4 w-4" aria-hidden="true" />
  添加自定义
</button>
```

- [ ] **Step 4: Add `CustomProviderDialog`**

```tsx
<CustomProviderDialog
  open={customDialogOpen}
  api={api}
  onClose={() => setCustomDialogOpen(false)}
  onSaved={() => {
    setCustomDialogOpen(false);
    void loadProviders();
  }}
/>
```

- [ ] **Step 5: Implement form parsing and submission**

```ts
function parseHeaderLines(value: string): Record<string, string> | undefined {
  const headers = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex <= 0) {
        throw new Error("请求头格式应为 Key: Value");
      }
      acc[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
      return acc;
    }, {});

  return Object.keys(headers).length > 0 ? headers : undefined;
}
```

- [ ] **Step 6: Style the dialog to match the screenshot**

Use a fixed overlay, centered `max-w-[560px]` panel, title `新建分组`, labels `名字` / `协议类型` / `API地址` / `API KEY` / `自定义请求头`, pink `测试` and `确定` buttons, white/gray inputs, close `×`, and helper text under the headers textarea.

### Task 4: Verification

**Files:**
- Test: `apps/web/src/pages/models/ModelsPage.test.tsx`
- Test: `packages/api-client/src/http-client.test.ts`

- [ ] **Step 1: Run focused web test**

Run: `pnpm --filter @mosaic-dock/web test -- ModelsPage.test.tsx`

Expected: PASS for existing render test and new dialog test.

- [ ] **Step 2: Run web typecheck**

Run: `pnpm --filter @mosaic-dock/web typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run API client typecheck**

Run: `pnpm --filter @mosaic-dock/api-client typecheck`

Expected: PASS with no TypeScript errors.
