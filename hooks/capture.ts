import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"
import { buildSessionPath, stripInboundMetadata } from "../memory.ts"
import { isInteractiveTrigger } from "./trigger.ts"

const SKIPPED_PROVIDERS = ["exec-event", "cron-event", "heartbeat"]

function getLastTurn(messages: unknown[]): unknown[] {
	let lastUserIdx = -1
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]
		if (
			msg &&
			typeof msg === "object" &&
			(msg as Record<string, unknown>).role === "user"
		) {
			lastUserIdx = i
			break
		}
	}
	return lastUserIdx >= 0 ? messages.slice(lastUserIdx) : messages
}

export function buildCaptureHandler(
	client: UnisonBrainClient,
	cfg: UnisonConfig,
	getSessionKey: () => string | undefined,
) {
	return async (
		event: Record<string, unknown>,
		ctx: Record<string, unknown>,
	) => {
		const trigger = ctx.trigger as string | undefined
		if (!isInteractiveTrigger(trigger)) {
			return
		}

		log.info(
			`agent_end fired: provider="${ctx.messageProvider}" success=${event.success}`,
		)
		const provider = ctx.messageProvider as string

		if (SKIPPED_PROVIDERS.includes(provider)) {
			return
		}

		if (
			!event.success ||
			!Array.isArray(event.messages) ||
			event.messages.length === 0
		)
			return

		const lastTurn = getLastTurn(event.messages)

		const texts: string[] = []
		for (const msg of lastTurn) {
			if (!msg || typeof msg !== "object") continue
			const msgObj = msg as Record<string, unknown>
			const role = msgObj.role
			if (role !== "user" && role !== "assistant") continue

			const content = msgObj.content

			const parts: string[] = []

			if (typeof content === "string") {
				parts.push(content)
			} else if (Array.isArray(content)) {
				for (const block of content) {
					if (!block || typeof block !== "object") continue
					const b = block as Record<string, unknown>
					if (b.type === "text" && typeof b.text === "string") {
						parts.push(b.text)
					}
				}
			}

			if (parts.length > 0) {
				const cleaned =
					role === "user"
						? parts.map(stripInboundMetadata).join("\n")
						: parts.join("\n")
				texts.push(`[role: ${role}]\n${cleaned}\n[${role}:end]`)
			}
		}

		const captured =
			cfg.captureMode === "all"
				? texts
						.map((t) =>
							t
								.replace(/<unison-context>[\s\S]*?<\/unison-context>\s*/g, "")
								.replace(
									/<unison-containers>[\s\S]*?<\/unison-containers>\s*/g,
									"",
								)
								.trim(),
						)
						.filter((t) => t.length >= 10)
				: texts

		if (captured.length === 0) return

		const content = captured.join("\n\n")
		const sk = getSessionKey()
		const notePath = sk
			? buildSessionPath(cfg.brainPath, sk)
			: buildSessionPath(cfg.brainPath, `auto_${Date.now()}`)

		log.debug(
			`capturing ${captured.length} texts (${content.length} chars) → ${notePath}`,
		)

		try {
			// Try to append to existing session note, or create a new one
			let existing: string | null = null
			try {
				const doc = await client.getDoc(notePath)
				existing = doc?.bodyMd ?? null
			} catch {
				existing = null
			}

			const timestamp = new Date().toISOString()
			const bodyMd = existing
				? `${existing}\n\n---\n\n_Captured: ${timestamp}_\n\n${content}`
				: `# Session Note\n\n_Captured: ${timestamp}_\n\n${content}`

			await client.writeNote(notePath, bodyMd, "Session Note")
		} catch (err) {
			log.error("capture failed", err)
		}
	}
}
