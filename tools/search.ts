import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerSearchTool(
	api: OpenClawPluginApi,
	client: UnisonBrainClient,
	_cfg: UnisonConfig,
	toolName = "unison_search",
): void {
	api.registerTool(
		{
			name: toolName,
			label: "Brain Search",
			description:
				"Search the Unison brain for relevant documents using hybrid semantic + keyword search.",
			parameters: Type.Object({
				query: Type.String({ description: "Search query" }),
				limit: Type.Optional(
					Type.Number({ description: "Max results (default: 10)" }),
				),
			}),
			async execute(
				_toolCallId: string,
				params: { query: string; limit?: number },
			) {
				const limit = params.limit ?? 10
				log.debug(`search tool: query="${params.query}" limit=${limit}`)

				const results = await client.search(params.query, limit)

				if (results.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No relevant brain documents found.",
							},
						],
					}
				}

				const text = results
					.map((r, i) => {
						const label = r.title ?? r.path.split("/").pop() ?? r.path
						const score = ` (${(r.score * 100).toFixed(0)}%)`
						const excerpt = r.highlight ?? r.tldr ?? ""
						const excerptPart = excerpt ? ` — ${excerpt}` : ""
						return `${i + 1}. ${label}${excerptPart}${score}`
					})
					.join("\n")

				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${results.length} brain documents:\n\n${text}`,
						},
					],
					details: {
						count: results.length,
						results: results.map((r) => ({
							path: r.path,
							title: r.title,
							score: r.score,
						})),
					},
				}
			},
		},
		{ name: toolName },
	)
}
