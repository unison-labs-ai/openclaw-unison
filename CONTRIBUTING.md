# Contributing to openclaw-unison

Thanks for improving the OpenClaw Unison brain memory plugin.

## Repo layout

Single-package TypeScript plugin. Key files:

- `index.ts` — plugin entry, registers hooks + tools + slash commands
- `client.ts` — `UnisonBrainClient` wrapping `@unisonlabs/sdk`
- `config.ts` — config schema and `parseConfig()`
- `hooks/` — `beforeTurn` (recall) and `afterTurn` (capture)
- `tools/` — four AI tools: `unison_search`, `unison_store`, `unison_forget`, `unison_status`
- `commands/` — CLI (`openclaw unison ...`) and slash commands (`/remember`, `/recall`)

## Development

```bash
bun install
bun run build       # esbuild bundle → dist/index.js
bun run lint        # Biome (lint + format check)
bun run lint:fix    # auto-fix
bun run check-types # TypeScript (no emit)
```

## Before opening a PR

1. `bun run lint` and `bun run build` must pass (CI runs both).
2. Keep changes scoped — one logical change per PR.
3. No new runtime dependencies without discussion.
4. Secrets (`usk_...`) must never appear in source or git history.

## Conventions

- TypeScript + ESM. Biome formatting: tabs, double quotes, 100 cols (see `biome.json`).
- The client enforces nothing — the Unison server is the security boundary.
  Don't add client-side scope checks or path allow-lists.
- `UNISON_TOKEN` env var is the canonical secret delivery mechanism.

## Reporting bugs / proposing features

Use the issue templates. For security issues, see [`SECURITY.md`](./SECURITY.md) —
do **not** open a public issue.
