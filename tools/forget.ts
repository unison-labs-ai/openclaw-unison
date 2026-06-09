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
				"Forget/delete a specific brain document. Provide a memoryId, a path, or a search query to find and remove the closest match.",
			parameters: Type.Object({
				query: Type.Optional(
					Type.String({ description: "Describe the memory to forget" }),
				),
				path: Type.Optional(
					Type.String({ description: "Direct brain document path to delete" }),
				),
				memoryId: Type.Optional(
					Type.String({ description: "Direct memory ID to delete" }),
				),
			}),
			async execute(
				_toolCallId: string,
				params: { query?: string; path?: string; memoryId?: string },
			) {
				if (params.memoryId) {
					log.debug(`forget tool: direct delete id="${params.memoryId}"`)
					const result = await client.deleteMemory(params.memoryId)
					return {
						content: [
							{
								type: "text" as const,
								text: result.deleted
									? "Brain document forgotten."
									: `No document found with id "${params.memoryId}".`,
							},
						],
					}
				}

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
							text: "Provide a query, path, or memoryId to forget.",
						},
					],
				}
			},
		},
		{ name: toolName },
	)
}
