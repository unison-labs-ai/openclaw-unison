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
				"Show the authenticated Unison user identity: email, tenant name, and granted API scopes.",
			parameters: Type.Object({}),
			async execute(_toolCallId: string, _params: Record<string, never>) {
				log.debug("profile tool: fetching whoami")

				const w = await client.whoami()

				const lines: string[] = []

				const email = w.user.email ?? "(no email)"
				lines.push(`User: ${email} (id: ${w.user.id})`)

				const tenantName = w.tenant.name ?? "(unnamed)"
				lines.push(`Tenant: ${tenantName} (id: ${w.tenant.id})`)

				if (w.scopes.length > 0) {
					lines.push(`Scopes: ${w.scopes.join(", ")}`)
				}

				return {
					content: [
						{
							type: "text" as const,
							text: `## Unison Brain Profile\n\n${lines.join("\n")}`,
						},
					],
					details: w,
				}
			},
		},
		{ name: toolName },
	)
}
