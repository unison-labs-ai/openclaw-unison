import type { BrainDocument, SearchResult } from "@unisonlabs/sdk"
import { BrainClient } from "@unisonlabs/sdk"
import { log } from "./logger.ts"
import { clampEntityContext } from "./memory.ts"

export type BrainSearchResult = {
	path: string
	title: string | null
	tldr: string | null
	score: number
	highlight?: string
	updatedAt?: string | null
}

export type BrainDocResult = {
	path: string
	title: string | null
	bodyMd: string
	tags: string[]
	updatedAt: string | null
}

export type ProfileSearchResult = {
	memory?: string
	updatedAt?: string
	similarity?: number
	[key: string]: unknown
}

export type ProfileResult = {
	static: string[]
	dynamic: string[]
	searchResults: ProfileSearchResult[]
}

function limitText(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max)}…` : text
}

export class UnisonBrainClient {
	private client: BrainClient
	private brainPath: string

	constructor(apiKey: string, baseUrl: string, brainPath: string) {
		if (!apiKey.startsWith("usk_")) {
			log.warn(
				`API key does not start with usk_ — got prefix: ${apiKey.slice(0, 8)}`,
			)
		}

		this.client = new BrainClient({ baseUrl, token: apiKey })
		this.brainPath = brainPath
		log.info(`initialized (brainPath: ${brainPath}, baseUrl: ${baseUrl})`)
	}

	async search(query: string, limit = 10): Promise<BrainSearchResult[]> {
		log.debugRequest("brain.search", { query, limit })

		const results: SearchResult[] = await this.client.search(query, { limit })

		const mapped: BrainSearchResult[] = results.map((r) => ({
			path: r.doc.path,
			title: r.doc.title,
			tldr: r.doc.tldr,
			score: r.score,
			highlight: r.highlight,
			updatedAt: r.doc.updatedAt,
		}))

		log.debugResponse("brain.search", { count: mapped.length })
		return mapped
	}

	async addMemory(
		content: string,
		metadata?: Record<string, string | number | boolean>,
		path?: string,
		entityContext?: string,
	): Promise<BrainDocument> {
		const notePath = path ?? buildDefaultMemoryPath(this.brainPath)

		log.debugRequest("brain.addMemory", {
			path: notePath,
			contentLength: content.length,
			metadata,
		})

		const clampedCtx = entityContext
			? clampEntityContext(entityContext)
			: undefined

		const doc = await this.client.write({
			path: notePath,
			bodyMd: content,
			kind: "wiki_page",
			tags: [
				"openclaw",
				...(metadata?.source ? [`source:${String(metadata.source)}`] : []),
			],
			source: { kind: "manual", ref: "openclaw-unison" },
			...(clampedCtx ? { tldr: clampedCtx.slice(0, 200) } : {}),
		})

		log.debugResponse("brain.addMemory", { id: doc.id, path: doc.path })
		return doc
	}

	async writeNote(
		path: string,
		bodyMd: string,
		title?: string,
	): Promise<BrainDocument> {
		log.debugRequest("brain.write", { path, bodyMd: bodyMd.slice(0, 80) })
		const doc = await this.client.write({
			path,
			bodyMd,
			kind: "wiki_page",
			...(title ? { title } : {}),
			tags: ["openclaw"],
			source: { kind: "manual", ref: "openclaw-unison" },
		})
		log.debugResponse("brain.write", { id: doc.id, path: doc.path })
		return doc
	}

	async getDoc(path: string): Promise<BrainDocResult | null> {
		log.debugRequest("brain.get", { path })
		try {
			const doc = await this.client.get(path)
			log.debugResponse("brain.get", { path: doc.path })
			return {
				path: doc.path,
				title: doc.title,
				bodyMd: doc.bodyMd,
				tags: doc.tags,
				updatedAt: doc.updatedAt,
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes("not_found") || msg.includes("404")) return null
			throw err
		}
	}

	async deleteDoc(path: string): Promise<{ deleted: boolean }> {
		log.debugRequest("brain.delete", { path })
		const result = await this.client.delete(path)
		log.debugResponse("brain.delete", result)
		return result
	}

	async deleteMemory(id: string): Promise<{ deleted: boolean }> {
		log.debugRequest("brain.deleteMemory", { id })
		const docs = await this.listNotes()
		const target = docs.find((d) => d.id === id)
		if (!target) {
			log.warn(`deleteMemory: no document with id=${id}`)
			return { deleted: false }
		}
		const result = await this.client.delete(target.path)
		log.debugResponse("brain.deleteMemory", result)
		return result
	}

	async forgetByQuery(
		query: string,
	): Promise<{ success: boolean; message: string }> {
		log.debugRequest("brain.forgetByQuery", { query })

		const results = await this.search(query, 5)
		if (results.length === 0) {
			return {
				success: false,
				message: "No matching brain document found to forget.",
			}
		}

		const target = results[0]
		await this.deleteDoc(target.path)

		const preview = limitText(target.title ?? target.tldr ?? target.path, 100)
		return { success: true, message: `Forgot: "${preview}"` }
	}

	async listNotes(prefix?: string): Promise<BrainDocument[]> {
		const searchPrefix = prefix ?? this.brainPath
		log.debugRequest("brain.list", { prefix: searchPrefix })
		const docs = await this.client.list({ prefix: searchPrefix, limit: 200 })
		log.debugResponse("brain.list", { count: docs.length })
		return docs
	}

	async wipeAllNotes(): Promise<{ deletedCount: number }> {
		return this.wipeAllMemories()
	}

	async wipeAllMemories(): Promise<{ deletedCount: number }> {
		log.debugRequest("brain.wipe", { brainPath: this.brainPath })

		const allDocs: BrainDocument[] = []
		let offset = 0
		const pageSize = 200

		while (true) {
			const page = await this.client.list({
				prefix: this.brainPath,
				limit: pageSize,
			})
			if (page.length === 0) break
			allDocs.push(...page)
			if (page.length < pageSize) break
			offset += pageSize
			if (offset > 10_000) break
		}

		if (allDocs.length === 0) {
			log.debug("wipe: no documents found")
			return { deletedCount: 0 }
		}

		log.debug(`wipe: found ${allDocs.length} documents, deleting`)
		let deletedCount = 0
		for (const doc of allDocs) {
			try {
				await this.client.delete(doc.path)
				deletedCount++
			} catch (err) {
				log.warn(
					`wipe: failed to delete ${doc.path}: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		log.debugResponse("brain.wipe", { deletedCount })
		return { deletedCount }
	}

	async getProfile(query?: string): Promise<ProfileResult> {
		log.debugRequest("brain.getProfile", { query })

		const [entities, recentDocs] = await Promise.all([
			this.client.entities.list({ limit: 50 }).catch(() => []),
			query
				? this.search(query, 10).catch(() => [])
				: this.listNotes()
						.then((docs) =>
							docs.slice(0, 10).map((d) => ({
								path: d.path,
								title: d.title,
								tldr: d.tldr,
								score: 1,
								updatedAt: d.updatedAt,
							})),
						)
						.catch(() => []),
		])

		const staticFacts: string[] = []
		for (const entity of entities) {
			try {
				const facts = await this.client.facts.about(entity.id, {
					includeInvalidated: false,
				})
				for (const f of facts) {
					staticFacts.push(`${entity.displayName}: ${f.factText}`)
				}
			} catch {}
		}

		const dynamicFacts: string[] = entities.map((e) => {
			const parts: string[] = [e.displayName]
			if (e.aliases.length > 0) parts.push(`(aka ${e.aliases.join(", ")})`)
			return parts.join(" ")
		})

		const searchResults: ProfileSearchResult[] = recentDocs.map((r) => ({
			memory: r.title ?? r.tldr ?? r.path.split("/").pop() ?? r.path,
			updatedAt: r.updatedAt ?? undefined,
			similarity: r.score,
		}))

		const result: ProfileResult = {
			static: staticFacts,
			dynamic: dynamicFacts,
			searchResults,
		}

		log.debugResponse("brain.getProfile", {
			staticCount: result.static.length,
			dynamicCount: result.dynamic.length,
			searchCount: result.searchResults.length,
		})
		return result
	}

	async status() {
		log.debugRequest("brain.status", {})
		const s = await this.client.status()
		log.debugResponse("brain.status", s)
		return s
	}

	async whoami() {
		log.debugRequest("brain.whoami", {})
		const w = await this.client.whoami()
		log.debugResponse("brain.whoami", w)
		return w
	}

	getBrainPath(): string {
		return this.brainPath
	}
}

function buildDefaultMemoryPath(brainPath: string): string {
	const ts = Date.now()
	return `${brainPath}/notes/memory_${ts}.md`
}
