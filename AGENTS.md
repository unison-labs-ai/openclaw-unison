# AGENTS.md

Guidance for AI agents. This file has two sections — jump to yours:

- **Use this plugin** — you're an agent setting up Unison brain memory in OpenClaw →
  [Using the plugin](#using-the-plugin)
- **Contribute to this repo** — you're modifying the plugin code →
  [Working in this repo](#working-in-this-repo)

Follows the [AGENTS.md](https://agents.md/) convention. Human contributors: see
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Using the plugin

This plugin wires OpenClaw to the **Unison brain** — a hosted, path-addressable
knowledge graph that stores decisions, notes, and conversation history, and
retrieves them with hybrid BM25+vector search. Once installed, every AI turn is
preceded by a brain search and followed by a capture write.

### 1. Install

```bash
openclaw plugins install @unisonlabs/openclaw-unison
```

### 2. Authenticate

You need a Unison API key (`usk_...`). Two ways to get one:

**Interactive (human runs this):**
```bash
openclaw unison setup
# prompts for the key from app.unisonlabs.ai
openclaw gateway restart
```

**Headless / CI (agent can run this):**
```bash
# Provision an account (returns a usk_ key immediately)
curl -X POST https://api.unisonlabs.ai/v1/auth/provision \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
# → {"apiKey":"usk_live_...","tenantId":"..."}

export UNISON_TOKEN="usk_live_..."
```

For a custom brain server (self-hosted or local dev):
```bash
export UNISON_TOKEN="usk_..."
export UNISON_API_URL="http://localhost:4001"
```

### 3. Verify

```bash
openclaw unison status
# Shows brain health: document count, entity count, last ingest time
```

### 4. The loop

- **Auto-recall** fires before every AI turn: searches the brain with the current
  query and injects matching documents as a `<unison-context>` block.
- **Auto-capture** fires after every AI turn: appends the conversation to a session
  note under `<brainPath>/sessions/`.
- **Slash commands**: `/remember <text>`, `/recall <query>`, `/memory-usage`.
- **AI tools** (the model calls these directly): `unison_search`, `unison_store`,
  `unison_forget`, `unison_status`.

### Brain API (for agents calling the HTTP API directly)

| Endpoint | Purpose |
|---|---|
| `PUT /v1/brain/doc` | Write a document; body: `{ path, bodyMd, kind, title?, tags[], source? }` |
| `GET /v1/brain/search?q=<q>&k=<n>` | Hybrid search; returns `{ results: [{ doc, score, highlight }] }` |
| `GET /v1/brain/status` | Health: docCount, entityCount, lastIngestAt |
| `GET /v1/brain/doc?path=<p>` | Fetch one document by path |
| `DELETE /v1/brain/doc?path=<p>` | Delete one document |

Auth header on every request: `Authorization: Bearer <usk_key>`.

Brain path namespaces:
- `/private/...` — visible only to the key owner (default)
- `/tenant/...` — visible to the whole Unison workspace
- `/teams/<slug>/...` — visible to a specific team

---

## Working in this repo

This is the OpenClaw plugin source — a single-package TypeScript project bundled
with esbuild, linted with Biome.

### Structure

```
index.ts          — plugin entry point, registers hooks + tools + commands
client.ts         — UnisonBrainClient wrapping @unisonlabs/sdk
config.ts         — config schema and parseConfig()
memory.ts         — path builders, category detection, inbound metadata strip
logger.ts         — debug/info/warn logging behind the debug flag
hooks/
  recall.ts       — beforeTurn hook: brain search → context injection
  capture.ts      — afterTurn hook: conversation → brain write
  trigger.ts      — registers both hooks
tools/
  search.ts       — unison_search AI tool
  store.ts        — unison_store AI tool
  forget.ts       — unison_forget AI tool
  status.ts       — unison_status AI tool
commands/
  cli.ts          — openclaw unison setup / setup-advanced / status / search / wipe
  slash.ts        — /remember / /recall / /memory-usage slash commands
types/
  openclaw.d.ts   — ambient type declarations for the openclaw peer dep
lib/
  validate.js     — usk_ key validation (CommonJS, no TS dep)
  validate.d.ts   — types for validate.js
dist/             — esbuild output (gitignored during dev, published via files[])
```

### Build, lint, test

```bash
bun install
bun run build    # esbuild bundle → dist/index.js
bun run lint     # Biome CI (lint + format check)
bun run lint:fix # auto-fix formatting
bun run check-types  # TypeScript type check (no emit)
```

CI runs `bun install && bun run build` on every PR. All must pass before merging.

### Conventions

- TypeScript + ESM. Biome formatting: tabs, double quotes, 100 cols (see `biome.json`).
- No new runtime dependencies without discussion — the bundle is esbuild-inlined
  except for `openclaw` and `@unisonlabs/sdk` (both are externals).
- The client never enforces auth or path rules — the server is the boundary. Send
  the request; surface the response.
- Secrets (`usk_...`) must never appear in source, tests, or git history. Use
  `UNISON_TOKEN` env var.

### PRs

One logical change per PR. Update `CHANGELOG.md` under "Unreleased" if one exists.
Never push to `main` directly. Security issues: see [`SECURITY.md`](./SECURITY.md).
