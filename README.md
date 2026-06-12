# OpenClaw Unison Plugin

Long-term memory for OpenClaw, powered by the [Unison brain](https://unisonlabs.ai). Automatically searches your brain before every AI turn, captures conversations for long-term recall, and exposes tools for the AI to read and write to your knowledge graph — no local infrastructure required.

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
- `/tenant/...` — visible to your entire team
- `/teams/<slug>/...` — visible to a specific team

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
# Returns: {"verified":true,"apiKey":"usk_live_...","tenantId":"..."}
```

## License

MIT — see [LICENSE](LICENSE).
