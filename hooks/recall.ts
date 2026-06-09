import type { ProfileSearchResult, UnisonBrainClient } from "../client.ts"
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

function deduplicateMemories(
	staticFacts: string[],
	dynamicFacts: string[],
	searchResults: ProfileSearchResult[],
): {
	static: string[]
	dynamic: string[]
	searchResults: ProfileSearchResult[]
} {
	const seen = new Set<string>()

	const uniqueStatic = staticFacts.filter((m) => {
		if (seen.has(m)) return false
		seen.add(m)
		return true
	})

	const uniqueDynamic = dynamicFacts.filter((m) => {
		if (seen.has(m)) return false
		seen.add(m)
		return true
	})

	const uniqueSearch = searchResults.filter((r) => {
		const memory = r.memory ?? ""
		if (!memory || seen.has(memory)) return false
		seen.add(memory)
		return true
	})

	return {
		static: uniqueStatic,
		dynamic: uniqueDynamic,
		searchResults: uniqueSearch,
	}
}

function formatContainerMetadata(
	cfg: UnisonConfig,
	messageProvider?: string,
): string | null {
	if (!messageProvider) return null

	const lines: string[] = []
	lines.push(`Brain path: \`${cfg.brainPath}\``)

	if (messageProvider) {
		lines.push("")
		lines.push(`Current channel: ${messageProvider}`)
	}

	lines.push("")
	lines.push(
		"Use the brain path prefix when storing notes to organise memories by topic.",
	)

	return lines.join("\n")
}

function formatContext(
	staticFacts: string[],
	dynamicFacts: string[],
	searchResults: ProfileSearchResult[],
	maxResults: number,
	showMemoryUsage = true,
): string | null {
	const deduped = deduplicateMemories(staticFacts, dynamicFacts, searchResults)
	const statics = deduped.static.slice(0, maxResults)
	const dynamics = deduped.dynamic.slice(0, maxResults)
	const search = deduped.searchResults.slice(0, maxResults)

	if (statics.length === 0 && dynamics.length === 0 && search.length === 0)
		return null

	const totalMemories = statics.length + dynamics.length + search.length

	const sections: string[] = []

	if (statics.length > 0) {
		sections.push(
			"## User Profile (Persistent)\n" +
				statics.map((f) => `- ${f}`).join("\n"),
		)
	}

	if (dynamics.length > 0) {
		sections.push(
			`## Recent Context\n${dynamics.map((f) => `- ${f}`).join("\n")}`,
		)
	}

	if (search.length > 0) {
		const lines = search.map((r) => {
			const memory = r.memory ?? ""
			const timeStr = r.updatedAt ? formatRelativeTime(r.updatedAt) : ""
			const pct =
				r.similarity != null ? `[${Math.round(r.similarity * 100)}%]` : ""
			const prefix = timeStr ? `[${timeStr}]` : ""
			return `- ${prefix}${memory} ${pct}`.trim()
		})
		sections.push(
			`## Relevant Memories (with relevance %)\n${lines.join("\n")}`,
		)
	}

	const intro =
		"The following is background context retrieved from the Unison brain (long-term memory). Use this context silently to inform your understanding — only reference it when the user's message is directly related to something in these memories."
	const disclaimer =
		"Do not proactively bring up these memories. Only use them when the conversation naturally calls for it."

	let memoryUsageInstruction = ""
	if (showMemoryUsage) {
		memoryUsageInstruction = `\n\nIMPORTANT: At the very beginning of your response, include a brief note indicating how many memories from Unison were used to inform your response. Format it as: "[Unison: ${totalMemories} memories loaded]" — this helps the user understand that OpenClaw is using their Unison brain. If none of the memories are relevant to the current message, say "[Unison: ${totalMemories} memories loaded, 0 used]".`
	}

	return `<unison-context>\n${intro}\n\n${sections.join("\n\n")}\n\n${disclaimer}${memoryUsageInstruction}\n</unison-context>`
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
		const isNewSession = turn === 0
		const includeProfile = isNewSession || turn % cfg.profileFrequency === 0
		const messageProvider = ctx?.messageProvider as string | undefined
		const query = isNewSession ? undefined : stripInboundMetadata(rawPrompt)

		log.debug(
			`recalling for turn ${turn} (profile: ${includeProfile}, newSession: ${isNewSession})`,
		)

		try {
			const profile = await client.getProfile(query)
			const memoryContext = formatContext(
				includeProfile ? profile.static : [],
				includeProfile ? profile.dynamic : [],
				profile.searchResults,
				cfg.maxRecallResults,
				cfg.showMemoryUsage,
			)

			const containerContext = formatContainerMetadata(cfg, messageProvider)

			const contextParts: string[] = []
			if (memoryContext) contextParts.push(memoryContext)
			if (containerContext) {
				contextParts.push(
					`<unison-containers>\n${containerContext}\n</unison-containers>`,
				)
			}

			if (contextParts.length === 0) {
				log.debug("no profile data to inject")
				return
			}

			const finalContext = contextParts.join("\n\n")
			log.debug(
				`injecting context (${finalContext.length} chars, turn ${turn})`,
			)
			return { prependContext: finalContext }
		} catch (err) {
			log.error("recall failed", err)
			return
		}
	}
}
