# Mosaic Dock Migration Notes

## Scope

This repository is a pnpm + Turbo monorepo rebuilt from `guada`.

Current workspace packages:

- `apps/web`: React + Ant Design + Rsbuild frontend.
- `apps/api`: migrated NestJS + Prisma backend from `guada/backend-ts`.
- `packages/shared`: framework-agnostic business types and utilities.
- `packages/api-client`: framework-agnostic HTTP, SSE, and chat stream client.
- `packages/config`: shared config package placeholder.

Electron packaging is intentionally out of scope for this phase. Add it later as `apps/desktop` after Web/API behavior is stable.

## Local Development

Install dependencies:

```bash
pnpm install
pnpm --filter @mosaic-dock/api exec prisma generate
```

Start both apps:

```bash
pnpm dev
```

Start individually:

```bash
pnpm dev:api
pnpm dev:web
```

The Web app proxies `/api/v1`, `/static`, and `/uploads` to `http://localhost:3000` by default. Override with:

```bash
MOSAIC_DOCK_API_TARGET=http://localhost:3000 pnpm dev:web
```

## Verification

Run all default checks:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Backend notes:

- `pnpm --filter @mosaic-dock/api build` verifies NestJS compilation.
- `pnpm --filter @mosaic-dock/api exec prisma generate` verifies Prisma client generation.
- `pnpm --filter @mosaic-dock/api test` runs the migration smoke test.
- `pnpm --filter @mosaic-dock/api test:legacy` runs copied `guada` legacy tests. These are currently not the monorepo gate because several tests are stale against the current backend implementation signatures.

## Deployment

Minimum deployable artifacts:

- Web: `apps/web/dist`
- API: `apps/api/dist`, `apps/api/prisma`, `apps/api/static`, and runtime data directories.

Recommended container approach:

1. Use Corepack to activate pnpm.
2. Run `pnpm fetch` or `pnpm install --frozen-lockfile` in the builder image.
3. Run `pnpm --filter @mosaic-dock/api exec prisma generate`.
4. Run `pnpm build`.
5. Serve `apps/web/dist` with Nginx or another static server.
6. Run API with `pnpm --filter @mosaic-dock/api start:prod` or `node apps/api/dist/main`.

Native backend dependencies that need attention in Docker and CI:

- `better-sqlite3`
- `sharp`
- `sqlite-vec`
- `@node-rs/jieba`
- Prisma engines

## Electron Follow-Up

Do not reuse the old `guada` Electron scripts blindly. A later phase should:

- Add `apps/desktop`.
- Reintroduce native module rebuilds for Electron separately from server builds.
- Decide whether the desktop app embeds `apps/api` or connects to an external API.
- Rework `electron-builder` resources around the new `apps/*` layout.
