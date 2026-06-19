/**
 * Robust JSON extraction from Claude responses.
 * Handles empty, truncated, markdown-wrapped, and malformed JSON.
 */

/**
 * Safely extract and parse JSON from a Claude response string.
 * Tries multiple strategies before falling back to the default value.
 */
export function safeParseClaudeJson<T>(text: string, fallback: T): T {
  if (!text || text.trim() === '') {
    console.warn('[safe-json] Empty response, using fallback')
    return fallback
  }

  // Strategy 1: Extract from ```json ... ``` code block (anywhere in text)
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    try { return JSON.parse(jsonBlockMatch[1].trim()) } catch { /* continue */ }
  }

  // Strategy 2: Extract from ``` ... ``` code block
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) } catch { /* continue */ }
  }

  // Strategy 3: Strip markdown fences and find JSON
  let cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  // Extract first balanced [ ... ] (arrays) or { ... } (objects)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  cleaned = arrayMatch?.[0] ?? objectMatch?.[0] ?? cleaned

  // Attempt 1: direct parse
  try {
    return JSON.parse(cleaned)
  } catch {
    // continue to repair attempts
  }

  // Attempt 2: fix common issues (trailing commas, unescaped newlines)
  try {
    const repaired = cleaned
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/[\x00-\x1F\x7F]/g, (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\t') return ch
        return ''
      })
    return JSON.parse(repaired)
  } catch {
    // continue
  }

  // Attempt 3: truncated JSON — try closing open braces/brackets
  try {
    let attempt = cleaned
    // Count open/close braces
    const openBraces = (attempt.match(/\{/g) || []).length
    const closeBraces = (attempt.match(/\}/g) || []).length
    const openBrackets = (attempt.match(/\[/g) || []).length
    const closeBrackets = (attempt.match(/\]/g) || []).length

    // Remove trailing partial values (e.g., truncated string)
    attempt = attempt.replace(/,\s*"[^"]*$/, '')
    attempt = attempt.replace(/,\s*$/, '')

    // Close open structures
    for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += ']'
    for (let i = 0; i < openBraces - closeBraces; i++) attempt += '}'

    return JSON.parse(attempt)
  } catch {
    // continue
  }

  console.error(`[safe-json] All parse attempts failed. Response length: ${text.length}, first 300 chars:`, text.slice(0, 300))
  return fallback
}

/**
 * Extract text from a Claude API response content block.
 */
export function extractClaudeText(response: { content: Array<{ type: string; text?: string }> }): string {
  return response.content[0]?.type === 'text' ? (response.content[0].text ?? '') : ''
}
