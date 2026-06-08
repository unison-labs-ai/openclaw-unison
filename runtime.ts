import type { UnisonBrainClient } from "./client.ts"
import { log } from "./logger.ts"

type MemoryProviderStatus = {
	backend: "builtin" | "qmd"
	provider: string
	model?: string
	files?: number
	chunks?: number
	custom?: Record<string, unknown>
}

type MemoryEmbeddingProbeResult = {
	ok: boolean
	error?: string
}

type MemorySyncProgressUpdate = {
	completed: number
	total: number
	label?: string
}

type RegisteredMemorySearchManager = {
	status(): MemoryProviderStatus
	probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult>
	probeVectorAvailability(): Promise<boolean>
	sync?(params?: {
		reason?: string
		force?: boolean
		sessionFiles?: string[]
		progress?: (update: MemorySyncProgressUpdate) => void
	}): Promise<void>
	close?(): Promise<void>
}

type MemoryRuntimeBackendConfig =
	| { backend: "builtin" }
	| { backend: "qmd"; qmd?: { command?: string } }

type MemoryPluginRuntime = {
	getMemorySearchManager(params: {
		cfg: unknown
		agentId: string
		purpose?: "default" | "status"
	}): Promise<{
		manager: RegisteredMemorySearchManager | null
		error?: string
	}>
	resolveMemoryBackendConfig(params: {
		cfg: unknown
		agentId: string
	}): MemoryRuntimeBackendConfig
	closeAllMemorySearchManagers?(): Promise<void>
}

function createSearchManager(
	client: UnisonBrainClient,
): RegisteredMemorySearchManager {
	return {
		status() {
			return {
				backend: "builtin" as const,
				provider: "unison-brain",
				model: "unison-hybrid-remote",
				files: 0,
				chunks: 0,
				custom: {
					brainPath: client.getBrainPath(),
					transport: "remote",
				},
			}
		},

		async probeEmbeddingAvailability() {
			try {
				await client.search("connection-probe", 1)
				return { ok: true }
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "unison brain unreachable"
				log.warn(`embedding probe failed: ${message}`)
				return { ok: false, error: message }
			}
		},

		async probeVectorAvailability() {
			return true
		},

		async sync() {},

		async close() {},
	}
}

export function buildMemoryRuntime(
	client: UnisonBrainClient,
): MemoryPluginRuntime {
	return {
		async getMemorySearchManager() {
			return { manager: createSearchManager(client) }
		},

		resolveMemoryBackendConfig() {
			return { backend: "builtin" as const }
		},
	}
}

export function buildPromptSection(params: {
	availableTools: Set<string>
}): string[] {
	const hasSearch = params.availableTools.has("unison_search")
	const hasStore = params.availableTools.has("unison_store")
	if (!hasSearch && !hasStore) return []

	const lines: string[] = [
		"## Memory (Unison Brain)",
		"",
		"Memory is managed by the Unison brain (cloud). Do not read or write local memory files like MEMORY.md or memory/*.md — use the brain tools instead.",
		"Relevant brain documents are automatically retrieved and injected at the start of each conversation.",
		"",
	]

	if (hasSearch) {
		lines.push(
			"Use unison_search to look up prior conversations, preferences, and facts from the brain.",
		)
	}
	if (hasStore) {
		lines.push(
			"Use unison_store to save important information the user asks you to remember.",
		)
	}

	return lines
}
