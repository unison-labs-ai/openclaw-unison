// Minimal type shims for the openclaw/plugin-sdk peer dependency.
// The full SDK ships its own types; this file provides the minimal
// surface we reference so TypeScript is satisfied without the SDK installed.
declare module "openclaw/plugin-sdk" {
	export interface OpenClawPluginApi {
		readonly pluginConfig: unknown
		readonly logger: {
			info(msg: string, ...args: unknown[]): void
			warn(msg: string, ...args: unknown[]): void
			error(msg: string, ...args: unknown[]): void
			debug?(msg: string, ...args: unknown[]): void
		}
		on(event: string, handler: (...args: unknown[]) => unknown): void
		registerTool(
			tool: {
				name: string
				label?: string
				description?: string
				parameters: unknown
				execute(toolCallId: string, params: unknown): Promise<unknown>
			},
			opts?: { name?: string },
		): void
		registerCommand(cmd: {
			name: string
			description?: string
			acceptsArgs?: boolean
			requireAuth?: boolean
			handler(ctx: unknown): Promise<{ text: string }>
		}): void
		registerCli(
			factory: (opts: { program: unknown }) => void,
			opts?: {
				descriptors?: Array<{
					name: string
					description: string
					hasSubcommands?: boolean
				}>
			},
		): void
		registerService(service: { id: string; start(): void; stop(): void }): void
		registerMemoryCapability?(opts: {
			runtime: unknown
			promptBuilder: unknown
			flushPlanResolver: unknown
		}): void
		registerMemoryRuntime?(runtime: unknown): void
		registerMemoryPromptSection?(builder: unknown): void
		registerMemoryFlushPlan?(resolver: unknown): void
	}
}
