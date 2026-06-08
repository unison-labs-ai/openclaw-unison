import type { BrainDocument, SearchResult } from "@unisonlabs/sdk"
import { BrainClient } from "@unisonlabs/sdk"
import { log } from "./logger.ts"

export type BrainSearchResult = {
	path: string
	title: string | null
	tldr: string | null
	score: number
	highlight?: string
}

export type BrainDocResult = {
	path: string
	title: string | null
	bodyMd: string
	tags: string[]
	updatedAt: string | null
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
		}))

		log.debugResponse("brain.search", { count: mapped.length })
		return mapped
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
			kind: "note",
			...(title ? { title } : {}),
			tags: ["openclaw"],
			source: { kind: "plugin", ref: "openclaw-unison" },
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
		log.debugRequest("brain.wipe", { brainPath: this.brainPath })

		const docs = await this.listNotes()
		if (docs.length === 0) {
			log.debug("wipe: no documents found")
			return { deletedCount: 0 }
		}

		log.debug(`wipe: found ${docs.length} documents, deleting`)
		let deletedCount = 0
		for (const doc of docs) {
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
