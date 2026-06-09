import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as readline from "node:readline"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import { log } from "../logger.ts"

const UNISON_TOOL_NAMES = [
	"unison_store",
	"unison_search",
	"unison_forget",
	"unison_status",
	"unison_profile",
]

function appendUniqueStrings(value: unknown, entries: string[]): string[] {
	const current = Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: []
	return Array.from(new Set([...current, ...entries]))
}

function ensureUnisonToolsAllowed(config: Record<string, unknown>): void {
	if (
		!config.tools ||
		typeof config.tools !== "object" ||
		Array.isArray(config.tools)
	) {
		config.tools = {}
	}

	const tools = config.tools as Record<string, unknown>
	tools.alsoAllow = appendUniqueStrings(tools.alsoAllow, UNISON_TOOL_NAMES)

	if (Array.isArray(tools.allow)) {
		tools.allow = appendUniqueStrings(tools.allow, UNISON_TOOL_NAMES)
	}
}

export function registerCli(
	api: OpenClawPluginApi,
	client?: UnisonBrainClient,
): void {
	api.registerCli(
		// biome-ignore lint/suspicious/noExplicitAny: openclaw SDK does not ship types
		({ program }: { program: any }) => {
			const cmd = program
				.command("unison")
				.description("Unison brain long-term memory commands")

			cmd
				.command("setup")
				.description("Configure Unison API key")
				.action(async () => {
					const configDir = path.join(os.homedir(), ".openclaw")
					const configPath = path.join(configDir, "openclaw.json")

					console.log("\nUnison Brain Setup\n")
					console.log("Get your API key from: https://app.unisonlabs.ai\n")

					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout,
					})

					const apiKey = await new Promise<string>((resolve) => {
						rl.question("Enter your Unison API key (usk_live_...): ", resolve)
					})
					rl.close()

					if (!apiKey.trim()) {
						console.log("\nNo API key provided. Setup cancelled.")
						return
					}

					if (!apiKey.startsWith("usk_")) {
						console.log("\nWarning: Unison API keys start with 'usk_'")
					}

					let config: Record<string, unknown> = {}
					if (fs.existsSync(configPath)) {
						try {
							config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
						} catch {
							config = {}
						}
					}

					if (!config.plugins) config.plugins = {}
					const plugins = config.plugins as Record<string, unknown>
					if (!plugins.entries) plugins.entries = {}
					if (!plugins.slots) plugins.slots = {}
					ensureUnisonToolsAllowed(config)
					const entries = plugins.entries as Record<string, unknown>
					const slots = plugins.slots as Record<string, unknown>
					slots.memory = "openclaw-unison"

					entries["openclaw-unison"] = {
						enabled: true,
						hooks: {
							allowPromptInjection: true,
							allowConversationAccess: true,
						},
						config: {
							apiKey: apiKey.trim(),
						},
					}

					if (!fs.existsSync(configDir)) {
						fs.mkdirSync(configDir, { recursive: true })
					}

					fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

					console.log("\n✓ API key saved to ~/.openclaw/openclaw.json")
					console.log(
						"  Restart OpenClaw to apply changes: openclaw gateway restart\n",
					)
				})

			cmd
				.command("setup-advanced")
				.description("Configure Unison with all options")
				.action(async () => {
					const configDir = path.join(os.homedir(), ".openclaw")
					const configPath = path.join(configDir, "openclaw.json")
					const defaultHostname = os.hostname().replace(/[^a-zA-Z0-9_-]/g, "_")

					console.log("\nUnison Brain Advanced Setup\n")
					console.log("Press Enter to use default values shown in [brackets]\n")
					console.log("Get your API key from: https://app.unisonlabs.ai\n")

					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout,
					})

					const ask = (question: string): Promise<string> =>
						new Promise((resolve) => rl.question(question, resolve))

					const apiKey = await ask("API key (required, usk_live_...): ")
					if (!apiKey.trim()) {
						console.log("\nNo API key provided. Setup cancelled.")
						rl.close()
						return
					}

					if (!apiKey.startsWith("usk_")) {
						console.log("Warning: Unison API keys start with 'usk_'\n")
					}

					const brainPath = await ask(
						`Brain path prefix [/private/openclaw_${defaultHostname}]: `,
					)

					console.log("\nAuto-recall:")
					console.log(
						"  true  - Inject relevant brain documents before each AI response (recommended)",
					)
					console.log("  false - Disable automatic brain recall")
					const autoRecallInput = await ask("Auto-recall (true/false) [true]: ")
					let autoRecall = true
					if (autoRecallInput.trim().toLowerCase() === "false") {
						autoRecall = false
					} else if (
						autoRecallInput.trim() &&
						autoRecallInput.trim().toLowerCase() !== "true"
					) {
						console.log("  Invalid value, using default: true")
					}

					console.log("\nAuto-capture:")
					console.log(
						"  true  - Save conversations to brain after each AI response (recommended)",
					)
					console.log("  false - Disable automatic conversation capture")
					const autoCaptureInput = await ask(
						"Auto-capture (true/false) [true]: ",
					)
					let autoCapture = true
					if (autoCaptureInput.trim().toLowerCase() === "false") {
						autoCapture = false
					} else if (
						autoCaptureInput.trim() &&
						autoCaptureInput.trim().toLowerCase() !== "true"
					) {
						console.log("  Invalid value, using default: true")
					}

					const maxResultsInput = await ask(
						"Max brain documents to recall per turn (1-50) [10]: ",
					)
					let maxRecallResults = 10
					const parsedMax = Number.parseInt(maxResultsInput.trim(), 10)
					if (maxResultsInput.trim()) {
						if (parsedMax >= 1 && parsedMax <= 50) {
							maxRecallResults = parsedMax
						} else {
							console.log("  Invalid value, using default: 10")
						}
					}

					const profileFreqInput = await ask(
						"Inject full profile every N turns (1-500) [50]: ",
					)
					let profileFrequency = 50
					const parsedFreq = Number.parseInt(profileFreqInput.trim(), 10)
					if (profileFreqInput.trim()) {
						if (parsedFreq >= 1 && parsedFreq <= 500) {
							profileFrequency = parsedFreq
						} else {
							console.log("  Invalid value, using default: 50")
						}
					}

					console.log("\nCapture mode:")
					console.log(
						"  all        - Filter short texts and context blocks (recommended)",
					)
					console.log("  everything - Capture all messages without filtering")
					const captureModeInput = await ask(
						"Capture mode (all/everything) [all]: ",
					)
					let captureMode: "all" | "everything" = "all"
					if (captureModeInput.trim().toLowerCase() === "everything") {
						captureMode = "everything"
					} else if (
						captureModeInput.trim() &&
						captureModeInput.trim().toLowerCase() !== "all"
					) {
						console.log("  Invalid value, using default: all")
					}

					console.log("\nMemory usage display:")
					console.log(
						"  true  - Show how many brain documents were used in each response (recommended)",
					)
					console.log("  false - Hide memory usage counts from responses")
					const showMemoryUsageInput = await ask(
						"Show memory usage (true/false) [true]: ",
					)
					let showMemoryUsage = true
					if (showMemoryUsageInput.trim().toLowerCase() === "false") {
						showMemoryUsage = false
					} else if (
						showMemoryUsageInput.trim() &&
						showMemoryUsageInput.trim().toLowerCase() !== "true"
					) {
						console.log("  Invalid value, using default: true")
					}

					console.log("\nEntity context:")
					console.log(
						"  Instructions that guide what memories are extracted from conversations.",
					)
					console.log(
						"  Leave blank to use the built-in default (recommended for most users).",
					)
					const entityContextInput = await ask(
						"Entity context (optional, press Enter for default): ",
					)

					rl.close()

					let config: Record<string, unknown> = {}
					if (fs.existsSync(configPath)) {
						try {
							config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
						} catch {
							config = {}
						}
					}

					if (!config.plugins) config.plugins = {}
					const plugins = config.plugins as Record<string, unknown>
					if (!plugins.entries) plugins.entries = {}
					if (!plugins.slots) plugins.slots = {}
					ensureUnisonToolsAllowed(config)
					const entries = plugins.entries as Record<string, unknown>
					const slots = plugins.slots as Record<string, unknown>
					slots.memory = "openclaw-unison"

					const pluginConfig: Record<string, unknown> = {
						apiKey: apiKey.trim(),
					}

					if (brainPath.trim()) {
						pluginConfig.brainPath = brainPath.trim().replace(/\/$/, "")
					}
					if (!autoRecall) pluginConfig.autoRecall = false
					if (!autoCapture) pluginConfig.autoCapture = false
					if (maxRecallResults !== 10)
						pluginConfig.maxRecallResults = maxRecallResults
					if (profileFrequency !== 50)
						pluginConfig.profileFrequency = profileFrequency
					if (captureMode !== "all") pluginConfig.captureMode = captureMode
					if (!showMemoryUsage) pluginConfig.showMemoryUsage = false
					if (entityContextInput.trim())
						pluginConfig.entityContext = entityContextInput.trim()

					entries["openclaw-unison"] = {
						enabled: true,
						hooks: {
							allowPromptInjection: true,
							allowConversationAccess: true,
						},
						config: pluginConfig,
					}

					if (!fs.existsSync(configDir)) {
						fs.mkdirSync(configDir, { recursive: true })
					}

					fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

					console.log("\n✓ Configuration saved to ~/.openclaw/openclaw.json")
					console.log("\nSettings:")
					console.log(
						`  API key:          ${apiKey.slice(0, 12)}...${apiKey.slice(-4)}`,
					)
					console.log(
						`  Brain path:       ${brainPath.trim() || `/private/openclaw_${defaultHostname}`}`,
					)
					console.log(`  Auto-recall:      ${autoRecall}`)
					console.log(`  Auto-capture:     ${autoCapture}`)
					console.log(`  Max results:      ${maxRecallResults}`)
					console.log(`  Profile freq:     ${profileFrequency}`)
					console.log(`  Capture mode:     ${captureMode}`)
					console.log(`  Memory usage:     ${showMemoryUsage}`)
					const entityPreview = entityContextInput.trim()
					if (entityPreview) {
						const truncated =
							entityPreview.length > 50
								? `${entityPreview.slice(0, 50)}...`
								: entityPreview
						console.log(`  Entity context:   "${truncated}"`)
					} else {
						console.log("  Entity context:   (default)")
					}
					console.log("\nRestart OpenClaw to apply: openclaw gateway restart\n")
				})

			cmd
				.command("status")
				.description("Check Unison brain configuration and status")
				.action(async () => {
					const configPath = path.join(
						os.homedir(),
						".openclaw",
						"openclaw.json",
					)
					const envKey = process.env.UNISON_TOKEN
					const defaultHostname = os.hostname().replace(/[^a-zA-Z0-9_-]/g, "_")

					console.log("\nUnison Brain Status\n")

					let apiKeySource = ""
					let apiKeyDisplay = ""
					let pluginConfig: Record<string, unknown> = {}
					let enabled = true

					if (envKey) {
						apiKeySource = "environment"
						apiKeyDisplay = `${envKey.slice(0, 12)}...${envKey.slice(-4)}`
					}

					if (fs.existsSync(configPath)) {
						try {
							const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
							const entry = config?.plugins?.entries?.["openclaw-unison"]
							if (entry) {
								enabled = entry.enabled ?? true
								pluginConfig = entry.config ?? {}
								if (pluginConfig.apiKey && !envKey) {
									const key = pluginConfig.apiKey as string
									apiKeySource = "config"
									apiKeyDisplay = `${key.slice(0, 12)}...${key.slice(-4)}`
								}
							}
						} catch {
							console.log("✗ Could not read config file\n")
							return
						}
					}

					if (!apiKeyDisplay) {
						console.log("✗ No API key configured")
						console.log("  Run: openclaw unison setup\n")
						return
					}

					console.log(
						`✓ API key:         ${apiKeyDisplay} (from ${apiKeySource})`,
					)
					console.log(`  Enabled:          ${enabled}`)
					console.log(
						`  Brain path:       ${pluginConfig.brainPath ?? `/private/openclaw_${defaultHostname}`}`,
					)
					console.log(`  Auto-recall:      ${pluginConfig.autoRecall ?? true}`)
					console.log(`  Auto-capture:     ${pluginConfig.autoCapture ?? true}`)
					console.log(
						`  Max results:      ${pluginConfig.maxRecallResults ?? 10}`,
					)
					console.log(
						`  Profile freq:     ${pluginConfig.profileFrequency ?? 50}`,
					)
					console.log(
						`  Capture mode:     ${pluginConfig.captureMode ?? "all"}`,
					)
					console.log(
						`  Memory usage:     ${pluginConfig.showMemoryUsage ?? true}`,
					)
					const entityCtx = pluginConfig.entityContext as string | undefined
					if (entityCtx) {
						const truncated =
							entityCtx.length > 50 ? `${entityCtx.slice(0, 50)}...` : entityCtx
						console.log(`  Entity context:   "${truncated}"`)
					} else {
						console.log("  Entity context:   (default)")
					}
					console.log("")

					if (client) {
						try {
							const s = await client.status()
							console.log("Brain health:")
							console.log(
								`  Documents:        ${s.docCount} (${s.docWithEmbedding} embedded)`,
							)
							console.log(`  Entities:         ${s.entityCount}`)
							console.log(`  Facts:            ${s.factCount}`)
							console.log(`  Pending jobs:     ${s.pendingJobs}`)
							console.log("")
						} catch (err) {
							log.warn(
								`status check failed: ${err instanceof Error ? err.message : String(err)}`,
							)
						}
					}
				})

			if (!client) return

			cmd
				.command("search")
				.argument("<query>", "Search query")
				.option("--limit <n>", "Max results", "10")
				.action(async (query: string, opts: { limit: string }) => {
					const limit = Number.parseInt(opts.limit, 10) || 10
					log.debug(`cli search: query="${query}" limit=${limit}`)

					const results = await client.search(query, limit)

					if (results.length === 0) {
						console.log("No brain documents found.")
						return
					}

					for (const r of results) {
						const label = r.title ?? r.path.split("/").pop() ?? r.path
						const score = ` (${(r.score * 100).toFixed(0)}%)`
						const excerpt = r.highlight ?? r.tldr ?? ""
						const excerptPart = excerpt ? ` — ${excerpt}` : ""
						console.log(`- ${label}${excerptPart}${score}`)
					}
				})

			cmd
				.command("profile")
				.description(
					"Show a summary of what is known about the user from the brain",
				)
				.option("--query <q>", "Optional query to focus the profile")
				.action(async (opts: { query?: string }) => {
					log.debug(`cli profile: query="${opts.query ?? "(none)"}"`)

					const profile = await client.getProfile(opts.query)

					if (
						profile.static.length === 0 &&
						profile.dynamic.length === 0 &&
						profile.searchResults.length === 0
					) {
						console.log("No profile information available yet.")
						return
					}

					if (profile.static.length > 0) {
						console.log("Stable Facts:")
						for (const f of profile.static) console.log(`  - ${f}`)
					}

					if (profile.dynamic.length > 0) {
						console.log("Known Entities:")
						for (const f of profile.dynamic) console.log(`  - ${f}`)
					}

					if (profile.searchResults.length > 0) {
						console.log("Relevant Brain Documents:")
						for (const r of profile.searchResults) {
							const pct =
								r.similarity != null
									? ` (${Math.round(r.similarity * 100)}%)`
									: ""
							console.log(`  - ${r.memory ?? ""}${pct}`)
						}
					}
				})

			cmd
				.command("wipe")
				.description(
					"Delete ALL brain documents under the configured brain path",
				)
				.action(async () => {
					const brainPath = client.getBrainPath()
					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout,
					})

					const answer = await new Promise<string>((resolve) => {
						rl.question(
							`This will permanently delete all brain documents under "${brainPath}". Type "yes" to confirm: `,
							resolve,
						)
					})
					rl.close()

					if (answer.trim().toLowerCase() !== "yes") {
						console.log("Aborted.")
						return
					}

					log.debug(`cli wipe: brainPath="${brainPath}"`)
					const result = await client.wipeAllNotes()
					console.log(
						`Wiped ${result.deletedCount} brain documents from "${brainPath}".`,
					)
				})
		},
		{
			descriptors: [
				{
					name: "unison",
					description: "Unison brain long-term memory commands",
					hasSubcommands: true,
				},
			],
		},
	)
}
