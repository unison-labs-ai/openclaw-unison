import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"
import {
	buildMemoryPath,
	detectCategory,
	MEMORY_CATEGORIES,
} from "../memory.ts"

export function registerStoreTool(
	api: OpenClawPluginApi,
	client: UnisonBrainClient,
	cfg: UnisonConfig,
	toolName = "unison_store",
): void {
	api.registerTool(
		{
			name: toolName,
			label: "Brain Store",
			description:
				"Save important information to the Unison brain (long-term memory).",
			parameters: Type.Object({
				text: Type.String({ description: "Information to remember" }),
				title: Type.Optional(
					Type.String({ description: "Optional title for the brain note" }),
				),
				category: Type.Optional(
					Type.Unsafe<string>({ type: "string", enum: [...MEMORY_CATEGORIES] }),
				),
			}),
			async execute(
				_toolCallId: string,
				params: { text: string; title?: string; category?: string },
			) {
				const category = params.category ?? detectCategory(params.text)
				const title =
					params.title ??
					`${category.charAt(0).toUpperCase()}${category.slice(1)} note`
				const notePath = buildMemoryPath(cfg.brainPath, title)

				log.debug(`store tool: category="${category}" path="${notePath}"`)

				const timestamp = new Date().toISOString()
				const bodyMd = `# ${title}\n\n_Saved: ${timestamp}_\n\n${params.text}`

				await client.writeNote(notePath, bodyMd, title)

				const preview =
					params.text.length > 80 ? `${params.text.slice(0, 80)}…` : params.text

				return {
					content: [
						{ type: "text" as const, text: `Stored in brain: "${preview}"` },
					],
				}
			},
		},
		{ name: toolName },
	)
}
