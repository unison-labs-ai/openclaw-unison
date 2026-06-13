// Validation utilities for the Unison OpenClaw plugin

/**
 * Validate that an API key has the expected usk_ prefix format.
 * @param {string} key
 * @returns {{ valid: boolean; reason?: string }}
 */
export function validateApiKeyFormat(key) {
	if (!key || typeof key !== "string") {
		return { valid: false, reason: "API key must be a non-empty string" }
	}
	if (!key.startsWith("usk_")) {
		return { valid: false, reason: "Unison API keys must start with 'usk_'" }
	}
	if (key.length < 20) {
		return { valid: false, reason: "API key is too short" }
	}
	return { valid: true }
}

/**
 * Validate that a brain path prefix is well-formed.
 * @param {string} brainPath
 * @returns {{ valid: boolean; reason?: string }}
 */
export function validateBrainPath(brainPath) {
	if (!brainPath || typeof brainPath !== "string") {
		return { valid: false, reason: "Brain path must be a non-empty string" }
	}
	if (!brainPath.startsWith("/private/") && !brainPath.startsWith("/workspace/")) {
		return {
			valid: false,
			reason: "Brain path must start with /private/ or /workspace/",
		}
	}
	return { valid: true }
}

/**
 * Sanitize content before storing in the brain.
 * @param {string} content
 * @returns {string}
 */
export function sanitizeContent(content) {
	if (!content || typeof content !== "string") return ""
	// Trim and collapse excessive blank lines
	return content
		.trim()
		.replace(/\n{4,}/g, "\n\n\n")
}
