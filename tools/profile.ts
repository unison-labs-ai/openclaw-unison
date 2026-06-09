import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerProfileTool(
	api: OpenClawPluginApi,
	client: UnisonBrainClient,
	_cfg: UnisonConfig,
	toolName = "unison_profile",
): void {
	api.registerTool(
		{
			name: toolName,
			label: "Brain Profile",
			description:
				"Get a summary of what is known about the user from the Unison brain — stable facts, entity context, and recent relevant documents.",
			parameters: Type.Object({
				query: Type.Optional(
					Type.String({
						description: "Optional query to focus the profile on a topic",
					}),
				),
			}),
			async execute(_toolCallId: string, params: { query?: string }) {
				log.debug(`profile tool: query="${params.query ?? "(none)"}"`)

				const profile = await client.getProfile(params.query)

				if (
					profile.static.length === 0 &&
					profile.dynamic.length === 0 &&
					profile.searchResults.length === 0
				) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No profile information available yet.",
							},
						],
					}
				}

				const sections: string[] = []

				if (profile.static.length > 0) {
					sections.push(
						"## User Profile (Persistent)\n" +
							profile.static.map((f) => `- ${f}`).join("\n"),
					)
				}

				if (profile.dynamic.length > 0) {
					sections.push(
						"## Recent Context\n" +
							profile.dynamic.map((f) => `- ${f}`).join("\n"),
					)
				}

				if (profile.searchResults.length > 0) {
					const lines = profile.searchResults.map((r) => {
						const memory = r.memory ?? ""
						const pct =
							r.similarity != null
								? ` [${Math.round(r.similarity * 100)}%]`
								: ""
						return `- ${memory}${pct}`
					})
					sections.push(`## Relevant Brain Documents\n${lines.join("\n")}`)
				}

				return {
					content: [{ type: "text" as const, text: sections.join("\n\n") }],
					details: {
						staticCount: profile.static.length,
						dynamicCount: profile.dynamic.length,
						searchCount: profile.searchResults.length,
					},
				}
			},
		},
		{ name: toolName },
	)
}
