import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { UnisonBrainClient } from "./client.ts"
import { registerCli } from "./commands/cli.ts"
import { registerCommands, registerStubCommands } from "./commands/slash.ts"
import { parseConfig, unisonConfigSchema } from "./config.ts"
import { buildCaptureHandler } from "./hooks/capture.ts"
import { buildRecallHandler } from "./hooks/recall.ts"
import { initLogger } from "./logger.ts"
import { buildMemoryRuntime, buildPromptSection } from "./runtime.ts"
import { registerForgetTool } from "./tools/forget.ts"
import { registerProfileTool } from "./tools/profile.ts"
import { registerSearchTool } from "./tools/search.ts"
import { registerStatusTool } from "./tools/status.ts"
import { registerStoreTool } from "./tools/store.ts"

try {
	const stateDir =
		process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw")
	const storePath = path.join(stateDir, "memory", "main.sqlite")
	if (!fs.existsSync(storePath)) {
		fs.mkdirSync(path.dirname(storePath), { recursive: true })
		fs.writeFileSync(storePath, "")
	}
} catch {}

export default {
	id: "openclaw-unison",
	name: "Unison Brain",
	description: "OpenClaw powered by the Unison brain plugin",
	kind: "memory" as const,
	configSchema: unisonConfigSchema,

	register(api: OpenClawPluginApi) {
		const cfg = parseConfig(api.pluginConfig)

		initLogger(api.logger, cfg.debug)

		if (!cfg.apiKey) {
			registerCli(api)
			api.logger.info("unison: not configured - run 'openclaw unison setup'")
			registerStubCommands(api)
			return
		}

		const client = new UnisonBrainClient(cfg.apiKey, cfg.baseUrl, cfg.brainPath)
		registerCli(api, client)

		const memoryRuntime = buildMemoryRuntime(client)
		const noopFlushPlan = () => null
		if (typeof api.registerMemoryCapability === "function") {
			api.registerMemoryCapability({
				runtime: memoryRuntime,
				promptBuilder: buildPromptSection,
				flushPlanResolver: noopFlushPlan,
			})
		} else {
			api.registerMemoryRuntime?.(memoryRuntime)
			api.registerMemoryPromptSection?.(buildPromptSection)
			api.registerMemoryFlushPlan?.(noopFlushPlan)
		}

		let sessionKey: string | undefined
		const getSessionKey = () => sessionKey

		api.on("session_start", (...args: unknown[]) => {
			const ctx = args[1] as Record<string, unknown> | undefined
			if (ctx?.sessionKey) sessionKey = ctx.sessionKey as string
		})

		registerSearchTool(api, client, cfg)
		registerStoreTool(api, client, cfg)
		registerForgetTool(api, client, cfg)
		registerStatusTool(api, client, cfg)
		registerProfileTool(api, client, cfg)

		// Register aliased tool names for compatibility with older openclaw slot routing
		registerSearchTool(api, client, cfg, "unison-search")
		registerStoreTool(api, client, cfg, "unison-save")
		registerForgetTool(api, client, cfg, "unison-forget")
		registerProfileTool(api, client, cfg, "unison-profile")

		const recallHandler = buildRecallHandler(client, cfg)
		const captureHandler = buildCaptureHandler(client, cfg, getSessionKey)

		if (cfg.autoRecall) {
			api.on("before_prompt_build", (...args: unknown[]) =>
				recallHandler(
					args[0] as Record<string, unknown>,
					args[1] as Record<string, unknown> | undefined,
				),
			)
		}

		if (cfg.autoCapture) {
			api.on("agent_end", (...args: unknown[]) =>
				captureHandler(
					args[0] as Record<string, unknown>,
					args[1] as Record<string, unknown>,
				),
			)
		}

		registerCommands(api, client, cfg)

		api.registerService({
			id: "openclaw-unison",
			start: () => {
				api.logger.info("unison: connected")
			},
			stop: () => {
				api.logger.info("unison: stopped")
			},
		})
	},
}
