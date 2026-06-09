import { hostname } from "node:os"
import { DEFAULT_ENTITY_CONTEXT } from "./memory.ts"

export type CaptureMode = "everything" | "all"

export type UnisonConfig = {
	apiKey: string | undefined
	baseUrl: string
	brainPath: string
	autoRecall: boolean
	autoCapture: boolean
	maxRecallResults: number
	profileFrequency: number
	captureMode: CaptureMode
	entityContext: string
	debug: boolean
	showMemoryUsage: boolean
}

const ALLOWED_KEYS = [
	"apiKey",
	"baseUrl",
	"brainPath",
	"autoRecall",
	"autoCapture",
	"maxRecallResults",
	"profileFrequency",
	"captureMode",
	"entityContext",
	"debug",
	"showMemoryUsage",
]

function assertAllowedKeys(
	value: Record<string, unknown>,
	allowed: string[],
	label: string,
): void {
	const unknown = Object.keys(value).filter((k) => !allowed.includes(k))
	if (unknown.length > 0) {
		throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`)
	}
}

function resolveEnvVars(value: string): string {
	return value.replace(/\$\{([^}]+)\}/g, (_, envVar: string) => {
		const envValue = process.env[envVar]
		if (!envValue) {
			throw new Error(`Environment variable ${envVar} is not set`)
		}
		return envValue
	})
}

function sanitizeSlug(raw: string): string {
	return raw
		.replace(/[^a-zA-Z0-9_-]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
}

function defaultBrainPath(): string {
	return `/private/openclaw_${sanitizeSlug(hostname())}`
}

export function parseConfig(raw: unknown): UnisonConfig {
	const cfg =
		raw && typeof raw === "object" && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {}

	if (Object.keys(cfg).length > 0) {
		assertAllowedKeys(cfg, ALLOWED_KEYS, "unison config")
	}

	let apiKey: string | undefined
	try {
		apiKey =
			typeof cfg.apiKey === "string" && cfg.apiKey.length > 0
				? resolveEnvVars(cfg.apiKey)
				: process.env.UNISON_TOKEN
	} catch {
		apiKey = undefined
	}

	let baseUrl =
		typeof cfg.baseUrl === "string" && cfg.baseUrl.length > 0
			? cfg.baseUrl
			: (process.env.UNISON_API_URL ?? "https://api.unisonlabs.ai")
	// Strip trailing slash
	baseUrl = baseUrl.replace(/\/$/, "")

	return {
		apiKey,
		baseUrl,
		brainPath:
			typeof cfg.brainPath === "string" && cfg.brainPath.trim()
				? cfg.brainPath.trim().replace(/\/$/, "")
				: defaultBrainPath(),
		autoRecall: (cfg.autoRecall as boolean) ?? true,
		autoCapture: (cfg.autoCapture as boolean) ?? true,
		maxRecallResults: (cfg.maxRecallResults as number) ?? 10,
		profileFrequency: (cfg.profileFrequency as number) ?? 50,
		captureMode:
			cfg.captureMode === "everything"
				? ("everything" as const)
				: ("all" as const),
		entityContext:
			typeof cfg.entityContext === "string" && cfg.entityContext.trim()
				? cfg.entityContext.trim()
				: DEFAULT_ENTITY_CONTEXT,
		debug: (cfg.debug as boolean) ?? false,
		showMemoryUsage: (cfg.showMemoryUsage as boolean) ?? true,
	}
}

export const unisonConfigSchema = {
	jsonSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			apiKey: { type: "string" },
			baseUrl: { type: "string" },
			brainPath: { type: "string" },
			autoRecall: { type: "boolean" },
			autoCapture: { type: "boolean" },
			maxRecallResults: { type: "number", minimum: 1, maximum: 50 },
			profileFrequency: { type: "number" },
			captureMode: { type: "string", enum: ["all", "everything"] },
			entityContext: { type: "string" },
			debug: { type: "boolean" },
			showMemoryUsage: { type: "boolean" },
		},
	},
	parse: parseConfig,
}
