import { Type } from "@sinclair/typebox"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"

export function registerStatusTool(
	api: OpenClawPluginApi,
	client: UnisonBrainClient,
	_cfg: UnisonConfig,
	toolName = "unison_status",
): void {
	api.registerTool(
		{
			name: toolName,
			label: "Brain Status",
			description:
				"Check the Unison brain health: document count, entity count, fact count, and pending jobs.",
			parameters: Type.Object({}),
			async execute(_toolCallId: string, _params: Record<string, never>) {
				log.debug("status tool: fetching brain status")

				const s = await client.status()

				const lines = [
					`Documents: ${s.docCount} (${s.docWithEmbedding} with embeddings)`,
					`Entities: ${s.entityCount}`,
					`Facts: ${s.factCount}`,
					`Pending jobs: ${s.pendingJobs}`,
					`Stale wiki pages: ${s.staleWikiPageCount}`,
					s.lastIngestAt
						? `Last ingest: ${s.lastIngestAt}`
						: "Last ingest: never",
				]

				return {
					content: [
						{
							type: "text" as const,
							text: `## Unison Brain Status\n\n${lines.join("\n")}`,
						},
					],
					details: s,
				}
			},
		},
		{ name: toolName },
	)
}
