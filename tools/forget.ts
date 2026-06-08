import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerForgetTool(
	api: OpenClawPluginApi,
	client: UnisonBrainClient,
	_cfg: UnisonConfig,
	toolName = "unison_forget",
): void {
	api.registerTool(
		{
			name: toolName,
			label: "Brain Forget",
			description:
				"Forget/delete a specific brain document. Searches for the closest match and removes it.",
			parameters: Type.Object({
				query: Type.Optional(
					Type.String({ description: "Describe the memory to forget" }),
				),
				path: Type.Optional(
					Type.String({ description: "Direct brain document path to delete" }),
				),
			}),
			async execute(
				_toolCallId: string,
				params: { query?: string; path?: string },
			) {
				if (params.path) {
					log.debug(`forget tool: direct delete path="${params.path}"`)
					await client.deleteDoc(params.path)
					return {
						content: [
							{ type: "text" as const, text: "Brain document forgotten." },
						],
					}
				}

				if (params.query) {
					log.debug(`forget tool: search-then-delete query="${params.query}"`)
					const result = await client.forgetByQuery(params.query)
					return {
						content: [{ type: "text" as const, text: result.message }],
					}
				}

				return {
					content: [
						{
							type: "text" as const,
							text: "Provide a query or path to forget.",
						},
					],
				}
			},
		},
		{ name: toolName },
	)
}
