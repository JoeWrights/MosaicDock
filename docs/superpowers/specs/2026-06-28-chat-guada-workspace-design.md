# Chat Guada Workspace Design

## Goal

Update the existing chat workspace to follow the Guada interaction style selected by the user: a focused central chat area with a floating composer, plus a right-side workspace file panel.

## Scope

- Keep the current left workspace navigation from `WorkspaceLayout`.
- Polish `ChatWorkspace` so the header, message list, avatars, bubbles, spacing, and bottom composer resemble the Guada reference.
- Add a right-side "工作目录" panel in the chat page.
- Connect the panel to existing backend workspace endpoints through `ApiClient`.
- Keep the panel responsive: visible on wide screens, collapsible on narrower screens.

## Components

### Chat Workspace

`apps/web/src/pages/chat/index.tsx` remains the main page. It will own chat state and workspace tree state for this pass to keep the change local.

The main layout becomes a two-column content area:

- Chat column: flexible width, centered message content, floating composer.
- Workspace column: fixed width right panel with file tree and refresh/collapse actions.

### Workspace Tree Panel

The panel shows:

- Header: `工作目录`, refresh action, collapse action.
- Loading state while the tree loads.
- Empty state when no files are returned.
- Error state with a retry action.
- Directory and file rows, with directories expandable.

Initial load uses the root tree. Expanding a directory loads that directory's children on demand.

## Data Flow

Add API client helpers for existing backend routes:

- `fetchWorkspaceTree(sessionId)` -> `GET /sessions/:id/workspace/tree`
- `fetchWorkspaceChildren(sessionId, path)` -> `GET /sessions/:id/workspace/children?path=...`
- Export the workspace file node response types from the API client package so the web page can consume them without duplicating shapes.

`ChatWorkspace` fetches the root workspace tree after `activeSessionId` changes. Directory expansion calls the children endpoint and merges the returned children into the current tree.

## Interaction Details

- The input placeholder changes to `按 / 使用技能，Shift+Enter 换行`.
- The composer gets a second toolbar row with simple action affordances and the current model name when available.
- Sending behavior remains unchanged: Enter sends, Shift+Enter inserts a newline.
- User messages align right with Guada-like soft blue styling.
- Assistant messages align left with avatar and bordered white card styling.
- Workspace panel collapse is local UI state only.

## Error Handling

- Existing chat load and send errors remain visible.
- Workspace tree errors appear inside the right panel and do not block chatting.
- If the session has no active workspace or the backend returns an empty tree, show a clear empty state.

## Testing

- Update `ChatWorkspace.test.tsx` to cover workspace tree loading.
- Preserve existing tests for session loading and streaming send.
- Add API client tests for the new workspace tree and children endpoints.
- Run web package tests or targeted tests after implementation.

## Out Of Scope

- File preview, editing, rename, delete, and upload actions.
- Real-time workspace SSE updates.
- Persisting panel expanded/collapsed state across sessions.
