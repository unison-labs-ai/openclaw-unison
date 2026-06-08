import type { UnisonBrainClient } from "../client.ts"
import type { UnisonConfig } from "../config.ts"
import { log } from "../logger.ts"
import { stripInboundMetadata } from "../memory.ts"
import { isInteractiveTrigger } from "./trigger.ts"

function formatRelativeTime(isoTimestamp: string): string {
	try {
		const dt = new Date(isoTimestamp)
		const now = new Date()
		const seconds = (now.getTime() - dt.getTime()) / 1000
		const minutes = seconds / 60
		const hours = seconds / 3600
		const days = seconds / 86400

		if (minutes < 30) return "just now"
		if (minutes < 60) return `${Math.floor(minutes)}mins ago`
		if (hours < 24) return `${Math.floor(hours)} hrs ago`
		if (days < 7) return `${Math.floor(days)}d ago`

		const month = dt.toLocaleString("en", { month: "short" })
		if (dt.getFullYear() === now.getFullYear()) {
			return `${dt.getDate()} ${month}`
		}
		return `${dt.getDate()} ${month}, ${dt.getFullYear()}`
	} catch {
		return ""
	}
}

function formatContext(
	results: {
		path: string
		title: string | null
		tldr: string | null
		score: number
		highlight?: string
		updatedAt?: string | null
	}[],
	maxResults: number,
	showMemoryUsage: boolean,
): string | null {
	const trimmed = results.slice(0, maxResults)
	if (trimmed.length === 0) return null

	const lines = trimmed.map((r) => {
		const label = r.title ?? r.path.split("/").pop() ?? r.path
		const excerpt = r.highlight ?? r.tldr ?? ""
		const pct = `[${Math.round(r.score * 100)}%]`
		const timeStr = r.updatedAt ? formatRelativeTime(r.updatedAt) : ""
		const prefix = timeStr ? `[${timeStr}]` : ""
		const excerptPart = excerpt ? ` — ${excerpt}` : ""
		return `- ${prefix}${label}${excerptPart} ${pct}`.trim()
	})

	const intro =
		"The following is background context retrieved from the Unison brain (long-term memory). Use this context silently to inform your understanding — only reference it when the user's message is directly related."
	const disclaimer =
		"Do not proactively bring up these memories. Only use them when the conversation naturally calls for it."

	let memoryUsageInstruction = ""
	if (showMemoryUsage) {
		memoryUsageInstruction = `\n\nIMPORTANT: At the very beginning of your response, include a brief note indicating how many brain documents from Unison were used to inform your response. Format it as: "[Unison: ${trimmed.length} documents loaded]" — this helps the user understand that OpenClaw is using their Unison brain. If none are relevant, say "[Unison: ${trimmed.length} documents loaded, 0 used]".`
	}

	return `<unison-context>\n${intro}\n\n## Relevant Brain Documents\n${lines.join("\n")}\n\n${disclaimer}${memoryUsageInstruction}\n</unison-context>`
}

function countUserTurns(messages: unknown[]): number {
	let count = 0
	for (const msg of messages) {
		if (
			msg &&
			typeof msg === "object" &&
			(msg as Record<string, unknown>).role === "user"
		) {
			count++
		}
	}
	return count
}

export function buildRecallHandler(
	client: UnisonBrainClient,
	cfg: UnisonConfig,
) {
	return async (
		event: Record<string, unknown>,
		ctx?: Record<string, unknown>,
	) => {
		const trigger = ctx?.trigger as string | undefined
		if (!isInteractiveTrigger(trigger)) {
			return
		}

		const rawPrompt = event.prompt as string | undefined
		if (!rawPrompt || rawPrompt.length < 5) return

		const messages = Array.isArray(event.messages) ? event.messages : []
		const turn = countUserTurns(messages)
		const query = turn === 0 ? rawPrompt : stripInboundMetadata(rawPrompt)

		log.debug(`recalling for turn ${turn}`)

		try {
			const results = await client.search(query, cfg.maxRecallResults)
			const memoryContext = formatContext(
				results,
				cfg.maxRecallResults,
				cfg.showMemoryUsage,
			)

			if (!memoryContext) {
				log.debug("no brain data to inject")
				return
			}

			log.debug(
				`injecting context (${memoryContext.length} chars, turn ${turn})`,
			)
			return { prependContext: memoryContext }
		} catch (err) {
			log.error("recall failed", err)
			return
		}
	}
}
