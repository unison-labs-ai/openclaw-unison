import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"
import { buildMemoryPath, detectCategory } from "../memory.ts"

export function registerStubCommands(api: OpenClawPluginApi): void {
	api.registerCommand({
		name: "remember",
		description: "Save something to the Unison brain",
		acceptsArgs: true,
		requireAuth: true,
		handler: async () => {
			return {
				text: "Unison brain not configured. Run 'openclaw unison setup' first.",
			}
		},
	})

	api.registerCommand({
		name: "recall",
		description: "Search the Unison brain",
		acceptsArgs: true,
		requireAuth: true,
		handler: async () => {
			return {
				text: "Unison brain not configured. Run 'openclaw unison setup' first.",
			}
		},
	})
}

export function registerCommands(
	api: OpenClawPluginApi,
	client: UnisonBrainClient,
	cfg: UnisonConfig,
): void {
	api.registerCommand({
		name: "memory-usage",
		description: "Toggle memory usage display on/off",
		acceptsArgs: true,
		requireAuth: false,
		handler: async (ctx: { args?: string }) => {
			const arg = ctx.args?.trim().toLowerCase()

			if (arg === "on" || arg === "true" || arg === "enable") {
				cfg.showMemoryUsage = true
				return {
					text: "Memory usage display enabled. The model will now show how many brain documents were used.",
				}
			}

			if (arg === "off" || arg === "false" || arg === "disable") {
				cfg.showMemoryUsage = false
				return {
					text: "Memory usage display disabled.",
				}
			}

			if (!arg) {
				cfg.showMemoryUsage = !cfg.showMemoryUsage
				const state = cfg.showMemoryUsage ? "enabled" : "disabled"
				return {
					text: `Memory usage display ${state}. Use /memory-usage on|off to set explicitly.`,
				}
			}

			return { text: "Usage: /memory-usage [on|off]" }
		},
	})

	api.registerCommand({
		name: "remember",
		description: "Save something to the Unison brain",
		acceptsArgs: true,
		requireAuth: true,
		handler: async (ctx: { args?: string }) => {
			const text = ctx.args?.trim()
			if (!text) {
				return { text: "Usage: /remember <text to remember>" }
			}

			log.debug(`/remember command: "${text.slice(0, 50)}"`)

			try {
				const category = detectCategory(text)
				const title = `${category.charAt(0).toUpperCase()}${category.slice(1)} note`
				const notePath = buildMemoryPath(cfg.brainPath, title)
				const timestamp = new Date().toISOString()
				const bodyMd = `# ${title}\n\n_Saved: ${timestamp}_\n\n${text}`

				await client.writeNote(notePath, bodyMd, title)

				const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text
				return { text: `Remembered: "${preview}"` }
			} catch (err) {
				log.error("/remember failed", err)
				return { text: "Failed to save to brain. Check logs for details." }
			}
		},
	})

	api.registerCommand({
		name: "recall",
		description: "Search the Unison brain",
		acceptsArgs: true,
		requireAuth: true,
		handler: async (ctx: { args?: string }) => {
			const query = ctx.args?.trim()
			if (!query) {
				return { text: "Usage: /recall <search query>" }
			}

			log.debug(`/recall command: "${query}"`)

			try {
				const results = await client.search(query, cfg.maxRecallResults)

				if (results.length === 0) {
					return { text: `No brain documents found for: "${query}"` }
				}

				const lines = results.map((r, i) => {
					const label = r.title ?? r.path.split("/").pop() ?? r.path
					const score = ` (${(r.score * 100).toFixed(0)}%)`
					const excerpt = r.highlight ?? r.tldr ?? ""
					const excerptPart = excerpt ? ` — ${excerpt}` : ""
					return `${i + 1}. ${label}${excerptPart}${score}`
				})

				return {
					text: `Found ${results.length} brain documents:\n\n${lines.join("\n")}`,
				}
			} catch (err) {
				log.error("/recall failed", err)
				return { text: "Failed to search brain. Check logs for details." }
			}
		},
	})
}
