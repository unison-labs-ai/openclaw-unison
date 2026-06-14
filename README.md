<div align="center">

<img src="https://raw.githubusercontent.com/unison-labs-ai/unison-brain/main/assets/brain.svg" width="140" />

# openclaw-unison

**Long-term memory for OpenClaw — so it stops asking what you already told it.**

Powered by the [Unison brain](https://unisonlabs.ai). Auto-recalls relevant context before every AI turn, captures conversations for long-term recall, and gives the AI tools to read and write your knowledge graph — no local infrastructure required.

[![CI](https://github.com/unison-labs-ai/openclaw-unison/actions/workflows/ci.yml/badge.svg)](https://github.com/unison-labs-ai/openclaw-unison/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/unison-labs-ai/openclaw-unison?style=social)](https://github.com/unison-labs-ai/openclaw-unison)

[**Why**](#with-unison-vs-without) • [**Install**](#install) • [**Setup**](#setup) • [**Commands**](#cli-commands) • [**Config**](#configuration)

</div>

---

### With Unison vs. without

| Without Unison | With Unison |
|---|---|
| OpenClaw forgets your stack, preferences, and prior decisions the moment the session ends | Every conversation is written to the brain; the next session picks up exactly where you left off |
| You re-explain the same architecture, conventions, and context over and over | Auto-recall injects semantically matched notes before every AI turn — the AI already knows |
| "What did we decide about X?" → the AI guesses or asks you | `openclaw unison search "what did we decide about X"` → the actual decision, in one second |
| Memory is trapped in one machine and one tool | Cloud brain: same context on any machine, shareable with your team via `/tenant/...` paths |

**Powered by the [Unison brain](https://github.com/unison-labs-ai/unison-brain#the-hard-part--what-every-memory-system-gets-wrong) — not a flat vector store.** Temporal facts that know *what changed when*, entity resolution that knows *who's who*, and one source of truth shared across every agent and teammate — Claude Code, Cursor, Codex, voice, your backend.

### Why Unison, not OpenClaw's built-in memory (or mem0)?

| Other memory | Unison |
|---|---|
| Stores *what you said* as a flat log / vector dump | Resolves *who and what you meant* and *when it changed* — a temporal knowledge graph |
| A silo — scoped to OpenClaw, this repo, this machine, you | One brain every agent **and teammate** reads from and writes back to |
| Keeps returning a now-stale fact with confidence after things change | Bitemporal supersession stops surfacing the version that's no longer true |
| "Trust our benchmark" | An [open, reproducible benchmark](https://github.com/unison-labs-ai/Unison-evals) scoring every system — including ours |

## Install

```bash
openclaw plugins install @unisonlabs/openclaw-unison
```

## Setup

```bash
openclaw unison setup
openclaw gateway restart
```

Enter your API key from [app.unisonlabs.ai](https://app.unisonlabs.ai). That's it.

### Advanced Setup

```bash
openclaw unison setup-advanced
openclaw gateway restart
```

Configure all options interactively: brain path prefix, auto-recall, auto-capture, capture mode, and more.

## Environment Variables

| Variable | Description |
| -------- | ----------- |
| `UNISON_TOKEN` | Your Unison API key (`usk_live_...`). Takes precedence over config file. |
| `UNISON_API_URL` | Override the API base URL. Defaults to `https://brain.unisonlabs.ai`. |

## How It Works

Once installed, the plugin works automatically:

- **Auto-Recall** — Before every AI turn, searches the Unison brain for relevant documents and injects them as context. The AI sees semantically matched past conversations and stored notes.
- **Auto-Capture** — After every AI turn, the conversation is written to the brain as a structured markdown note under your configured `brainPath`. Existing session notes are appended to.
- **Real Hybrid Search** — Uses the brain's hybrid BM25 + vector search (`/v1/brain/search`) for precise recall across all stored notes.

Everything runs in the cloud via the Unison brain API. No local embeddings or databases required.

## Slash Commands

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `/remember <text>` | Manually save something to the Unison brain.        |
| `/recall <query>`  | Search the brain with similarity scores.            |
| `/memory-usage`    | Toggle the memory usage indicator on/off.           |

## AI Tools

The AI uses these tools autonomously:

| Tool              | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `unison_search`   | Search the brain by query (hybrid semantic + keyword). |
| `unison_store`    | Save information to the brain as a markdown note.      |
| `unison_forget`   | Delete a brain document by path or search query.       |
| `unison_status`   | View brain health: document count, entities, facts.    |

## CLI Commands

```bash
openclaw unison setup              # Configure API key
openclaw unison setup-advanced     # Configure all options
openclaw unison status             # View current configuration + brain health
openclaw unison search <query>     # Search the brain
openclaw unison wipe               # Delete all notes under the brain path (requires confirmation)
```

## Configuration

Set the API key via environment variable:

```bash
export UNISON_TOKEN="usk_live_..."
```

Or configure in `~/.openclaw/openclaw.json`:

### Options

| Key                | Type      | Default                            | Description                                                        |
| ------------------ | --------- | ---------------------------------- | ------------------------------------------------------------------ |
| `apiKey`           | `string`  | —                                  | Unison API key (`usk_live_...`). Use `${UNISON_TOKEN}` to env-ref. |
| `baseUrl`          | `string`  | `https://brain.unisonlabs.ai`        | Override the API base URL.                                         |
| `brainPath`        | `string`  | `/private/openclaw_<hostname>`     | Root brain path prefix for all stored notes.                       |
| `autoRecall`       | `boolean` | `true`                             | Inject relevant brain docs before every AI turn.                   |
| `autoCapture`      | `boolean` | `true`                             | Store conversations after every turn.                              |
| `maxRecallResults` | `number`  | `10`                               | Max brain docs injected per turn (1–50).                           |
| `captureMode`      | `string`  | `"all"`                            | `"all"` filters short texts; `"everything"` captures all.          |
| `debug`            | `boolean` | `false`                            | Verbose debug logs for API calls.                                  |
| `showMemoryUsage`  | `boolean` | `true`                             | Show how many brain docs were loaded in each response.             |

### Full Example

```json
{
  "plugins": {
    "slots": {
      "memory": "openclaw-unison"
    },
    "entries": {
      "openclaw-unison": {
        "enabled": true,
        "hooks": {
          "allowPromptInjection": true,
          "allowConversationAccess": true
        },
        "config": {
          "apiKey": "${UNISON_TOKEN}",
          "brainPath": "/private/openclaw_myhost",
          "autoRecall": true,
          "autoCapture": true,
          "maxRecallResults": 10,
          "captureMode": "all",
          "debug": false,
          "showMemoryUsage": true
        }
      }
    }
  }
}
```

## Brain Path Routing

All notes are stored under the configured `brainPath`. The Unison brain enforces writeable root namespaces:

- `/private/...` — visible only to you (default)
- `/workspace/...` — visible to your entire workspace
- `/workspace/teams/<slug>/...` — visible to a specific team

Notes stored by this plugin are tagged `openclaw` and follow this structure:

```
<brainPath>/
  sessions/   — auto-captured conversation notes (one per session)
  notes/      — manually saved notes via /remember or unison_store
```

## MCP Server

To use the Unison brain directly in Claude Desktop or other MCP hosts:

```json
{
  "mcpServers": {
    "unison-brain": {
      "command": "npx",
      "args": ["-y", "@unisonlabs/mcp"],
      "env": {
        "UNISON_TOKEN": "usk_live_...",
        "UNISON_API_URL": "https://brain.unisonlabs.ai"
      }
    }
  }
}
```

## Headless Account Creation

If you don't have a Unison account yet, you can provision one programmatically:

```bash
# 1. Provision (sends OTP to your email)
curl -X POST https://brain.unisonlabs.ai/v1/auth/provision \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'

# 2. Verify with the OTP from your email
curl -X POST https://brain.unisonlabs.ai/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","code":"<OTP>"}'
# Returns: {"verified":true,"apiKey":"usk_live_...","workspaceId":"..."}
```

## Star history

If this saves you from re-explaining your stack one more time, a star helps others find it.

<div align="center">

<a href="https://star-history.com/#unison-labs-ai/openclaw-unison&Date">
  <img src="https://api.star-history.com/svg?repos=unison-labs-ai/openclaw-unison&type=Date" width="600" />
</a>

</div>

## License

MIT — see [LICENSE](LICENSE).

---

## Part of the Unison Labs constellation

**One brain, every agent.** Every repo below reads from _and writes to_ the same [Unison brain](https://unisonlabs.ai) — no per-tool memory silos.

| Repo | What it does |
|---|---|
| [unison-brain](https://github.com/unison-labs-ai/unison-brain) | CLI · SDK · MCP server — the core |
| [claude-unison](https://github.com/unison-labs-ai/claude-unison) | Memory for Claude Code |
| [cursor-unison](https://github.com/unison-labs-ai/cursor-unison) | Memory for Cursor |
| [codex-unison](https://github.com/unison-labs-ai/codex-unison) | Memory for OpenAI Codex CLI |
| [opencode-unison](https://github.com/unison-labs-ai/opencode-unison) | Memory for OpenCode |
| **[openclaw-unison](https://github.com/unison-labs-ai/openclaw-unison)** | **Memory for OpenClaw ← you are here** |
| [pipecat-unison](https://github.com/unison-labs-ai/pipecat-unison) | Memory for Pipecat voice agents |
| [python-sdk](https://github.com/unison-labs-ai/python-sdk) | Python SDK for the brain |
| [install-mcp](https://github.com/unison-labs-ai/install-mcp) | One-command MCP installer |
| [code-chunk](https://github.com/unison-labs-ai/code-chunk) | AST-aware code chunking |
| [unison-fs](https://github.com/unison-labs-ai/unison-fs) | Mount the brain as a filesystem |
| [backchannel](https://github.com/unison-labs-ai/backchannel) | Async messaging between agents |
| [Unison-evals](https://github.com/unison-labs-ai/Unison-evals) | Open memory benchmark suite |
