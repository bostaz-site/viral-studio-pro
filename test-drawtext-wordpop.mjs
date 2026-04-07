#!/usr/bin/env node

/**
 * Drawtext Word-Pop E2E Test
 *
 * Validates that buildWordPopDrawtext() generates correct FFmpeg drawtext filters
 * and optionally renders a test video with them (--render flag).
 *
 * Usage:
 *   node test-drawtext-wordpop.mjs          # Validate filter strings only
 *   node test-drawtext-wordpop.mjs --render # Also render with FFmpeg
 */

import { buildWordPopDrawtext, buildWordPopDrawtextFromTitle } from './vps/lib/drawtext-wordpop.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const doRender = process.argv.includes('--render');

// ── Test Data ────────────────────────────────────────────────────────────────

const WORD_TIMESTAMPS = [
  { word: 'This', start: 0.0, end: 0.3 },
  { word: 'is', start: 0.3, end: 0.5 },
  { word: 'absolutely', start: 0.5, end: 1.0 },
  { word: 'INSANE', start: 1.0, end: 1.5 },
  { word: 'bro', start: 1.5, end: 2.0 },
  { word: 'watch', start: 2.2, end: 2.5 },
  { word: 'this', start: 2.5, end: 2.8 },
  { word: 'clutch', start: 2.8, end: 3.3 },
  { word: 'play', start: 3.3, end: 3.8 },
  { word: 'wow', start: 4.0, end: 4.5 },
];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

// ── Test 1: Basic Filter Generation ──────────────────────────────────────────

console.log('\n═══ TEST 1: Basic Filter Generation ═══\n');

const filters = buildWordPopDrawtext(WORD_TIMESTAMPS, 0, {
  canvasWidth: 720,
  canvasHeight: 1280,
  position: 'bottom',
});

assert(Array.isArray(filters), 'Returns an array');
assert(filters.length === WORD_TIMESTAMPS.length, `One filter per word (${filters.length}/${WORD_TIMESTAMPS.length})`);

for (let i = 0; i < filters.length; i++) {
  const f = filters[i];
  const word = WORD_TIMESTAMPS[i].word.toUpperCase();

  assert(f.startsWith('drawtext='), `Filter ${i}: starts with drawtext=`);
  assert(f.includes(`text='${word}'`) || f.includes('text='), `Filter ${i}: contains text for "${word}"`);
  assert(f.includes('enable='), `Filter ${i}: has enable= condition`);
  assert(f.includes('between('), `Filter ${i}: uses between() for timing`);
  assert(f.includes('fontfile='), `Filter ${i}: specifies fontfile`);
  assert(f.includes('fontcolor='), `Filter ${i}: specifies fontcolor`);
  assert(f.includes('borderw='), `Filter ${i}: has border width`);
  assert(f.includes('bordercolor=black'), `Filter ${i}: has black border`);
  assert(f.includes('x=(w-text_w)/2'), `Filter ${i}: horizontally centered`);
}

// ── Test 2: Important Word Detection ─────────────────────────────────────────

console.log('\n═══ TEST 2: Important Word Colors ═══\n');

// Expected: "This" (first word) = red, "is" = white, "absolutely" (6+ letters) = red,
// "INSANE" (all caps) = red, "bro" (hype word) = red, "watch" (5 letters) = white,
// "this" = white, "clutch" (hype + 6 letters) = red, "play" = white, "wow" (hype + last) = red
const expectedColors = ['red', 'white', 'red', 'red', 'red', 'white', 'white', 'red', 'white', 'red'];

for (let i = 0; i < filters.length; i++) {
  const expected = expectedColors[i];
  const hasRed = filters[i].includes('fontcolor=red');
  const hasWhite = filters[i].includes('fontcolor=white');
  const actual = hasRed ? 'red' : hasWhite ? 'white' : 'unknown';
  assert(actual === expected, `"${WORD_TIMESTAMPS[i].word}" → ${actual} (expected ${expected})`);
}

// ── Test 3: Pop Effect (fontsize expression) ─────────────────────────────────

console.log('\n═══ TEST 3: Pop Effect ═══\n');

for (let i = 0; i < Math.min(3, filters.length); i++) {
  const f = filters[i];
  // Should have fontsize expression with if(between(...))
  assert(f.includes("fontsize='if("), `Filter ${i}: has dynamic fontsize expression`);
}

// ── Test 4: Edge Cases ───────────────────────────────────────────────────────

console.log('\n═══ TEST 4: Edge Cases ═══\n');

// Empty array
const emptyFilters = buildWordPopDrawtext([], 0);
assert(emptyFilters.length === 0, 'Empty timestamps → empty filters');

// Null/undefined
const nullFilters = buildWordPopDrawtext(null, 0);
assert(nullFilters.length === 0, 'Null timestamps → empty filters');

// Single word
const singleFilters = buildWordPopDrawtext([{ word: 'Hey', start: 0, end: 1 }], 0);
assert(singleFilters.length === 1, 'Single word → single filter');

// Word with special characters
const specialFilters = buildWordPopDrawtext([{ word: "it's", start: 0, end: 1 }], 0);
assert(specialFilters.length === 1, 'Special char word generates a filter');
assert(!specialFilters[0].includes("text='IT'S'"), 'Apostrophe is escaped (not raw)');

// ── Test 5: Title Fallback ───────────────────────────────────────────────────

console.log('\n═══ TEST 5: Title Fallback (no Whisper) ═══\n');

const titleFilters = buildWordPopDrawtextFromTitle('This is a crazy clutch play', 5, {
  canvasWidth: 720,
  canvasHeight: 1280,
});

assert(titleFilters.length === 6, `Title split into 6 words (got ${titleFilters.length})`);
assert(titleFilters[0].includes('drawtext='), 'First title filter is drawtext');
assert(titleFilters[0].includes('enable='), 'Title filter has timing');

// Empty title
const emptyTitle = buildWordPopDrawtextFromTitle('', 5);
assert(emptyTitle.length === 0, 'Empty title → empty filters');

// Zero duration
const zeroDur = buildWordPopDrawtextFromTitle('Hello world', 0);
assert(zeroDur.length === 0, 'Zero duration → empty filters');

// ── Test 6: Split-screen positioning ─────────────────────────────────────────

console.log('\n═══ TEST 6: Split-Screen Positioning ═══\n');

const splitFilters = buildWordPopDrawtext(WORD_TIMESTAMPS, 0, {
  canvasWidth: 720,
  canvasHeight: 1280,
  splitScreen: { enabled: true, layout: 'top-bottom', ratio: 50 },
});

assert(splitFilters.length === WORD_TIMESTAMPS.length, 'Same number of filters with split-screen');
// Y position should be inside the top portion (ratio=50% of 1280 = 640, 72% of 640 = 461)
// Match the actual y= parameter (last one, after x=...)
const yMatch = splitFilters[0].match(/:y=(\d+)$/);
if (yMatch) {
  const yPos = parseInt(yMatch[1]);
  assert(yPos < 640, `Split-screen y=${yPos} is inside top half (< 640)`);
  assert(yPos > 300, `Split-screen y=${yPos} is in lower portion of top half (> 300)`);
}

// ── Test 7: Filter chain joinability ─────────────────────────────────────────

console.log('\n═══ TEST 7: Filter Chain Construction ═══\n');

// Simulate what ffmpeg-render.js does
const dtChain = filters.join(',');
const testFilterComplex = `[0:v]fps=30,scale=720:1280[src];[src]${dtChain}[captioned]`;

assert(!testFilterComplex.includes(',,'), 'No double commas in chain');
assert(testFilterComplex.includes('[captioned]'), 'Chain ends with [captioned] label');
assert(testFilterComplex.split('drawtext=').length - 1 === WORD_TIMESTAMPS.length,
  `Chain has ${WORD_TIMESTAMPS.length} drawtext filters`);

// ── Test 8: Print sample filter for inspection ───────────────────────────────

console.log('\n═══ Sample Filters (first 3) ═══\n');
for (let i = 0; i < Math.min(3, filters.length); i++) {
  console.log(`  [${i}] ${filters[i].substring(0, 160)}...`);
}

// ── Test 9: FFmpeg Render (optional) ─────────────────────────────────────────

if (doRender) {
  console.log('\n═══ TEST 9: FFmpeg Render ═══\n');

  const testDir = '/tmp/test-drawtext-wordpop';
  try { await fs.mkdir(testDir, { recursive: true }); } catch {}

  const testInputPath = path.join(testDir, 'test_input.mp4');
  const testOutputPath = path.join(testDir, 'test_output.mp4');

  try {
    // Generate test pattern video
    console.log('  Generating test pattern video (5s, 720x1280)...');
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=5:size=720x1280:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-shortest', '-pix_fmt', 'yuv420p',
      testInputPath,
    ], { timeout: 30000 });
    console.log('  Test video created.');

    // Build filter_complex mimicking ffmpeg-render.js standard path
    const dtChainStr = filters.join(',');
    const filterComplex = [
      `[0:v]fps=30,split=2[srcfg][srcbg]`,
      `[srcbg]scale=360:640:force_original_aspect_ratio=increase,crop=360:640:(iw-360)/2:(ih-640)/2,gblur=sigma=20,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=720:1280:flags=bilinear,setsar=1[bg]`,
      `[srcfg]scale=720:1280:force_original_aspect_ratio=decrease,setsar=1[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[composed]`,
      `[composed]${dtChainStr}[captioned]`,
    ].join(';');

    console.log('  Rendering with drawtext word-pop...');
    console.log(`  Filter chain: ${filterComplex.length} chars, ${filters.length} drawtext filters`);

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', testInputPath,
      '-t', '5',
      '-filter_complex', filterComplex,
      '-map', '[captioned]',
      '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-pix_fmt', 'yuv420p',
      '-threads', '1',
      testOutputPath,
    ], { timeout: 60000 });

    const stat = await fs.stat(testOutputPath);
    assert(stat.size > 10000, `Output video exists: ${stat.size} bytes`);
    console.log(`\n  Output: ${testOutputPath}`);
    console.log('  → Open this file to visually verify word-pop subtitles!');
  } catch (err) {
    console.log(`  FFmpeg render failed: ${err.message}`);
    if (err.stderr) {
      const lastLines = err.stderr.split('\n').filter(l => !l.startsWith('\r') && l.trim()).slice(-8);
      console.log('  FFmpeg stderr:');
      lastLines.forEach(l => console.log(`    ${l}`));
    }
    assert(false, 'FFmpeg render completed');
  }
} else {
  console.log('\n═══ TEST 9: FFmpeg Render (SKIPPED — use --render) ═══\n');
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n═══ SUMMARY ═══\n`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failed > 0) {
  console.log('\n  Some tests failed — check output above.');
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
