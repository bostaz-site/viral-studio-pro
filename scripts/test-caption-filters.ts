/**
 * P4 · Copywriter SEO — smoke test for the description post-filter + CTA overlay.
 *
 * Run (Node >= 22.18, type stripping built-in, no tsx/esbuild needed):
 *   node scripts/test-caption-filters.ts
 *
 * The TS module under test is compiled with the project's tsc into a temp dir
 * at runtime (dynamic import), so this file stays valid under the app tsconfig.
 *
 * Checks that sanitizeDescription():
 *   - removes banned hashtags (#fyp/#viral/#foryou/#trending/#xyzbca) from text + list
 *   - removes engagement bait ("like if", "tag a friend", "double tap"...)
 *   - removes vulgarity
 *   - keeps the niche keyword and the @credit
 *   - keeps "follow for more" only at the END
 *   - enforces the 150-char hard limit before hashtags
 * and that the VPS CTA overlay builds a valid ASS Dialogue in the last 1.2 s.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(path.join(tmpdir(), 'caption-filters-'))
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')
execFileSync(process.execPath, [
  tscBin, path.join(root, 'lib', 'distribution', 'caption-filters.ts'),
  '--outDir', outDir, '--module', 'es2020', '--target', 'es2020', '--skipLibCheck', '--strict',
], { stdio: 'inherit' })
writeFileSync(path.join(outDir, 'package.json'), '{"type":"module"}')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModule = Record<string, any>
const filters: AnyModule = await import(pathToFileURL(path.join(outDir, 'caption-filters.js')).href)
const cta: AnyModule = await import(pathToFileURL(path.join(root, 'vps', 'lib', 'cta-overlay.js')).href)
const {
  sanitizeDescription, filterHashtags, stripEngagementBait, normalizeFollowCta,
  containsKeyword, hasOpenQuestion, BANNED_HASHTAGS,
} = filters

let passed = 0
function ok(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`  ok   ${name}`) }
  catch (e) { console.error(`  FAIL ${name}\n       ${(e as Error).message}`); process.exitCode = 1 }
}

console.log('caption-filters')

ok('banned hashtags removed from list, niche kept, max 3', () => {
  const tags = filterHashtags(['#fyp', '#viral', '#ApexLegends', '#foryou', '#xyzbca', '#trending', '#xqc', '#ranked', '#clutch'], 3)
  assert.deepEqual(tags, ['#ApexLegends', '#xqc', '#ranked'])
  for (const t of tags) assert.ok(!BANNED_HASHTAGS.has(t.toLowerCase()))
})

ok('banned hashtags removed inline from caption text', () => {
  const r = sanitizeDescription({ caption: 'xQc clutches the Apex Legends final #fyp #viral. Would you have pushed? @xqc', nicheKeyword: 'Apex Legends', streamerHandle: 'xqc', hashtags: [] })
  assert.ok(!/#fyp|#viral/i.test(r.caption), r.caption)
  assert.ok(containsKeyword(r.caption, 'Apex Legends'))
  assert.ok(r.caption.includes('@xqc'))
  assert.ok(hasOpenQuestion(r.caption))
})

ok('engagement bait removed ("like if", "tag a friend", "double tap")', () => {
  const r = stripEngagementBait('Like if you agree! xQc clutched the Apex Legends final. Tag a friend who needs this. Double tap now!')
  assert.ok(!/like if|tag a friend|double tap/i.test(r), r)
  assert.ok(/Apex Legends/.test(r))
})

ok('"follow for more" at the START is removed, at the END is kept (short)', () => {
  const start = normalizeFollowCta('Follow for more clips! xQc clutched Apex Legends. Would you push?')
  assert.ok(!/^follow for more/i.test(start), start)
  const end = normalizeFollowCta('xQc clutched Apex Legends. Would you push? Follow for more')
  assert.ok(/Follow for more\.$/.test(end), end)
})

ok('vulgarity stripped, keyword preserved', () => {
  const r = sanitizeDescription({ caption: 'Holy shit xQc clutched the Apex Legends final, what a fucking play. Would you have pushed?', nicheKeyword: 'apex legends', hashtags: ['#apexlegends'] })
  assert.ok(!/\b(shit|fucking)\b/i.test(r.caption), r.caption)
  assert.ok(containsKeyword(r.caption, 'apex legends'))
  assert.deepEqual(r.hashtags, ['#apexlegends'])
})

ok('missing keyword → prepended (warning), missing credit → appended', () => {
  const r = sanitizeDescription({ caption: 'He clutched the final round. Would you have pushed?', nicheKeyword: 'Apex Legends', streamerHandle: '@xqc', hashtags: ['#fyp'] })
  assert.ok(r.warnings.includes('keyword_missing'))
  assert.ok(containsKeyword(r.caption, 'Apex Legends'))
  assert.ok(/@xqc/.test(r.caption))
  assert.deepEqual(r.hashtags, [])
})

ok('hard limit 150 chars before hashtags, credit kept', () => {
  const long = 'Apex Legends ' + 'a very long sentence about the clutch that goes on and on. '.repeat(6) + 'Would you have pushed? @xqc'
  const r = sanitizeDescription({ caption: long, nicheKeyword: 'Apex Legends', streamerHandle: 'xqc', hashtags: [] })
  assert.ok(r.caption.length <= 150, `len=${r.caption.length}`)
  assert.ok(r.caption.endsWith('@xqc'), r.caption)
  assert.ok(r.warnings.includes('too_long'))
})

ok('no question → warning only (soft)', () => {
  const r = sanitizeDescription({ caption: 'xQc clutched Apex Legends. @xqc', nicheKeyword: 'Apex Legends', hashtags: [] })
  assert.ok(r.warnings.includes('no_question'))
})

console.log('cta-overlay (vps)')

ok('dialogue in last 1.2s at ~80% height, uppercase, referencing existing style', () => {
  const ass = '[Script Info]\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name,Fontname\nStyle: Default,Inter,64\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,HELLO\n'
  const r = cta.appendCtaToAss(ass, { duration: 30, seed: 'job-1' })
  assert.ok(r.applied, r.reason ?? '')
  assert.ok(r.dialogue.startsWith('Dialogue: 5,0:00:28.80,0:00:30.00,Default,'), r.dialogue)
  assert.ok(/\\pos\(540,1536\)/.test(r.dialogue), 'pos 80% height')
  assert.ok(/FOLLOW|CLIPS/.test(r.dialogue))
  assert.ok(r.content.endsWith(`${r.dialogue}\n`))
  assert.equal(cta.pickCtaText({ seed: 'job-1' }), cta.pickCtaText({ seed: 'job-1' }))
})

ok('clip too short → not applied; standalone ASS when captions are off', () => {
  const r = cta.appendCtaToAss('[Events]\n', { duration: 3 })
  assert.equal(r.applied, false)
  const standalone = cta.buildStandaloneCtaAss({ duration: 12, canvasW: 1080, canvasH: 1920, text: 'follow for more' })
  assert.ok(standalone && /\[Events\]/.test(standalone) && /FOLLOW FOR MORE/.test(standalone))
})

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
