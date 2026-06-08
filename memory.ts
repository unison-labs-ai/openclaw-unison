export const MEMORY_CATEGORIES = [
	"preference",
	"fact",
	"decision",
	"entity",
	"other",
] as const
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

export function detectCategory(text: string): MemoryCategory {
	const lower = text.toLowerCase()
	if (/\b(?:prefer|like|love|hate|want)\b/.test(lower)) return "preference"
	if (/\b(?:decided|will use|going with)\b/.test(lower)) return "decision"
	if (/\+\d{10,}|@[\w.-]+\.\w+|\bis called\b/.test(lower)) return "entity"
	if (/\b(?:is|are|has|have)\b/.test(lower)) return "fact"
	return "other"
}

const INBOUND_META_SENTINELS = [
	"Conversation info (untrusted metadata):",
	"Sender (untrusted metadata):",
	"Thread starter (untrusted, for context):",
	"Replied message (untrusted, for context):",
	"Forwarded message context (untrusted metadata):",
	"Chat history since last reply (untrusted, for context):",
]

const LEADING_TIMESTAMP_RE =
	/^\[[A-Za-z]{3} \d{4}-\d{2}-\d{2} \d{2}:\d{2}[^\]]*\] */

function isMetaSentinel(line: string): boolean {
	const trimmed = line.trim()
	return INBOUND_META_SENTINELS.some((s) => s === trimmed)
}

export function stripInboundMetadata(text: string): string {
	if (!text) return text

	const withoutTimestamp = text.replace(LEADING_TIMESTAMP_RE, "")
	const lines = withoutTimestamp.split("\n")
	const result: string[] = []
	let inMetaBlock = false
	let inFencedJson = false

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (!inMetaBlock && isMetaSentinel(line)) {
			const next = lines[i + 1]
			if (next?.trim() !== "```json") {
				result.push(line)
				continue
			}
			inMetaBlock = true
			inFencedJson = false
			continue
		}

		if (inMetaBlock) {
			if (!inFencedJson && line.trim() === "```json") {
				inFencedJson = true
				continue
			}
			if (inFencedJson) {
				if (line.trim() === "```") {
					inMetaBlock = false
					inFencedJson = false
				}
				continue
			}
			if (line.trim() === "") continue
			inMetaBlock = false
		}

		result.push(line)
	}

	return result.join("\n").replace(/^\n+/, "").replace(/\n+$/, "")
}

/** Build a brain document path for a session note. */
export function buildSessionPath(
	brainPath: string,
	sessionKey: string,
): string {
	const sanitized = sessionKey
		.replace(/[^a-zA-Z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
	return `${brainPath}/sessions/session_${sanitized}.md`
}

/** Build a brain document path for a manually remembered note. */
export function buildMemoryPath(brainPath: string, slug: string): string {
	const sanitized = slug
		.toLowerCase()
		.replace(/[^a-zA-Z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 60)
	const ts = Date.now()
	return `${brainPath}/notes/${sanitized}_${ts}.md`
}
