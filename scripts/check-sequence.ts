/**
 * scripts/check-sequence.ts — compliance check for an email sequence.
 * Usage: npx tsx scripts/check-sequence.ts <sequenceId>
 * Reads templates from migration SQL files (no DB connection required).
 * Prints PASS/FAIL per step.
 */

import fs from 'fs'
import path from 'path'

const BANNED_PHRASES = ['limited time', 'exclusive', 'act now']
const POSTAL_MARKER = 'J1Z 0A6'
const FOOTER_SEPARATOR = '\n—\n'

interface ParsedTemplate {
  step_number: number
  body_text: string
  max_words: number
}

function parseMigrationSql(sql: string, sequenceId: string): ParsedTemplate[] {
  const templates: ParsedTemplate[] = []

  // Match INSERT blocks with $body$...$body$ delimited body_text
  const insertRegex = new RegExp(
    `'${sequenceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*,\\s*(\\d+)\\s*,\\s*\\d+\\s*,\\s*(?:true|false)\\s*,\\s*(\\d+)`,
    'g'
  )
  const bodyRegex = /\$body\$([\s\S]*?)\$body\$/g

  const bodies: string[] = []
  let bodyMatch: RegExpExecArray | null
  while ((bodyMatch = bodyRegex.exec(sql)) !== null) {
    bodies.push(bodyMatch[1])
  }

  let insertMatch: RegExpExecArray | null
  let idx = 0
  while ((insertMatch = insertRegex.exec(sql)) !== null) {
    templates.push({
      step_number: parseInt(insertMatch[1], 10),
      body_text: bodies[idx] ?? '',
      max_words: parseInt(insertMatch[2], 10),
    })
    idx++
  }

  return templates
}

function splitFooter(bodyText: string): { body: string; footer: string } {
  const idx = bodyText.lastIndexOf(FOOTER_SEPARATOR)
  if (idx === -1) return { body: bodyText, footer: '' }
  return { body: bodyText.slice(0, idx), footer: bodyText.slice(idx) }
}

function countWords(text: string): number {
  const cleaned = text
    .replace(/\{\{[^}]+\}\}/g, 'X')
    .replace(/\{([^}]+)\}/g, (_m, content: string) => {
      const variants = content.split('|')
      return variants.reduce((a: string, b: string) => a.length > b.length ? a : b, '')
    })
    .trim()
  if (!cleaned) return 0
  return cleaned.split(/\s+/).filter((w: string) => w.length > 0).length
}

function hasUrl(text: string): boolean {
  if (/https?:\/\//i.test(text)) return true
  if (/\{\{[^}]*[Uu]rl[^}]*\}\}/.test(text)) return true
  return false
}

function main() {
  const sequenceId = process.argv[2]
  if (!sequenceId) {
    console.error('Usage: npx tsx scripts/check-sequence.ts <sequenceId>')
    process.exit(1)
  }

  // Find migration files containing the sequence
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))

  let templates: ParsedTemplate[] = []
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    if (sql.includes(`'${sequenceId}'`)) {
      const parsed = parseMigrationSql(sql, sequenceId)
      if (parsed.length > 0) templates = parsed
    }
  }

  if (templates.length === 0) {
    console.error(`No templates found for sequence "${sequenceId}" in migration files`)
    process.exit(1)
  }

  let allPass = true

  for (const tpl of templates) {
    const violations: string[] = []
    const { body, footer } = splitFooter(tpl.body_text)
    const maxWords = tpl.max_words ?? 80

    if (tpl.step_number === 1 && hasUrl(body)) {
      violations.push('URL in step 1 body')
    }

    const wc = countWords(body)
    if (wc > maxWords) {
      violations.push(`${wc} words > ${maxWords} max`)
    }

    if (!footer.includes(POSTAL_MARKER)) {
      violations.push('Missing postal address in footer')
    }

    if (!footer.includes('unsubscribeLink')) {
      violations.push('Missing {{unsubscribeLink}} in footer')
    }

    const bodyLower = body.toLowerCase()
    for (const phrase of BANNED_PHRASES) {
      if (bodyLower.includes(phrase)) violations.push(`Banned: "${phrase}"`)
    }

    if ((body.match(/!/g) || []).length >= 3) {
      violations.push('3+ exclamation marks')
    }

    const capsWords = body
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\{[^}]+\}/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w))

    if (capsWords.length > 0) {
      violations.push(`ALL-CAPS: ${capsWords.join(', ')}`)
    }

    if (violations.length === 0) {
      console.log(`Step ${tpl.step_number}: PASS (${wc} words)`)
    } else {
      console.log(`Step ${tpl.step_number}: FAIL — ${violations.join('; ')}`)
      allPass = false
    }
  }

  process.exit(allPass ? 0 : 1)
}

main()
