import Anthropic from '@anthropic-ai/sdk'

/**
 * Create a new Anthropic client instance per-request.
 * Avoids leaking state across serverless invocations.
 */
export function createAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

/** Default model for all Claude skills */
export const CLAUDE_MODEL = 'claude-sonnet-4-6'

/**
 * Safely extract and parse JSON from a Claude text response.
 * Handles markdown code blocks, extra text before/after JSON, and nested objects.
 *
 * @throws Error if no valid JSON found
 */
export function parseClaudeJson<T>(text: string, skillName: string): T {
  // Step 1: Try to strip markdown code fences if present
  let cleaned = text.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // Step 2: Try direct JSON.parse first (fastest path)
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fall through to regex extraction
  }

  // Step 3: Extract the outermost JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`No valid JSON found in ${skillName} response. Raw: ${cleaned.slice(0, 200)}`)
  }

  try {
    return JSON.parse(jsonMatch[0]) as T
  } catch (parseError) {
    throw new Error(
      `Invalid JSON from ${skillName}: ${parseError instanceof Error ? parseError.message : 'Parse failed'}. Raw: ${jsonMatch[0].slice(0, 200)}`
    )
  }
}
