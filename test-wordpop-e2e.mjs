#!/usr/bin/env node

/**
 * Word-Pop Subtitles E2E Test
 *
 * This script replicates the exact same pipeline as render.js → ffmpeg-render.js
 * to verify that word-pop ASS subtitles are correctly generated and rendered.
 *
 * Usage:
 *   node test-wordpop-e2e.mjs          # Validate ASS content only (no FFmpeg needed)
 *   node test-wordpop-e2e.mjs --render # Also render with FFmpeg (requires ffmpeg)
 */

import { generateASS, generateStaticASS, validateWordTimestamps } from './vps/lib/subtitle-generator.js';
import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const doRender = process.argv.includes('--render');

// ── Test Data ────────────────────────────────────────────────────────────────
// Simulates Whisper output for a 5-second clip
const SAMPLE_WORD_TIMESTAMPS = [
  { word: 'This', start: 0.2, end: 0.5 },
  { word: 'is', start: 0.55, end: 0.7 },
  { word: 'a', start: 0.75, end: 0.85 },
  { word: 'crazy', start: 0.9, end: 1.3 },
  { word: 'play', start: 1.4, end: 1.8 },
  { word: 'right', start: 2.0, end: 2.3 },
  { word: 'here', start: 2.35, end: 2.7 },
  { word: 'no', start: 3.0, end: 3.2 },
  { word: 'way', start: 3.25, end: 3.6 },
  { word: 'he', start: 3.7, end: 3.9 },
  { word: 'did', start: 3.95, end: 4.2 },
  { word: 'that', start: 4.25, end: 4.6 },
];

const TESTS_PASSED = [];
const TESTS_FAILED = [];

function assert(condition, message) {
  if (condition) {
    TESTS_PASSED.push(message);
    console.log(`  ✓ ${message}`);
  } else {
    TESTS_FAILED.push(message);
    console.log(`  ✗ FAIL: ${message}`);
  }
}

// ── Test 1: ASS Content Generation ───────────────────────────────────────────

console.log('\n═══ TEST 1: ASS Content Generation (word-pop) ═══\n');

const assContent = generateASS(SAMPLE_WORD_TIMESTAMPS, {
  style: 'hormozi',
  animation: 'word-pop',
  clipStartTime: 0,
  wordsPerLine: 1,
  position: 'bottom',
  canvasWidth: 720,
  canvasHeight: 1280,
  splitScreen: null,
});

assert(typeof assContent === 'string' && assContent.length > 0, 'ASS content is a non-empty string');

// Check required sections
assert(assContent.includes('[Script Info]'), 'Has [Script Info] section');
assert(assContent.includes('[V4+ Styles]'), 'Has [V4+ Styles] section');
assert(assContent.includes('[Events]'), 'Has [Events] section');

// Check PlayRes matches canvas
assert(assContent.includes('PlayResX: 720'), 'PlayResX matches canvas width (720)');
assert(assContent.includes('PlayResY: 1280'), 'PlayResY matches canvas height (1280)');
assert(assContent.includes('ScaledBorderAndShadow: yes'), 'ScaledBorderAndShadow is enabled');

// Check style definition
const styleMatch = assContent.match(/Style: Default,([^,]+),/);
assert(!!styleMatch, 'Has Default style definition');
if (styleMatch) {
  assert(styleMatch[1] === 'Liberation Sans', `Font is Liberation Sans (got: ${styleMatch[1]})`);
}

// Check dialogue events
const lines = assContent.split('\n');
const dialogueLines = lines.filter(l => l.startsWith('Dialogue:'));
assert(dialogueLines.length === SAMPLE_WORD_TIMESTAMPS.length, `Has ${SAMPLE_WORD_TIMESTAMPS.length} dialogue events (got: ${dialogueLines.length})`);

// Check each dialogue event
console.log('\n--- Dialogue Events ---');
for (let i = 0; i < dialogueLines.length; i++) {
  const line = dialogueLines[i];
  console.log(`  [${i}] ${line.substring(0, 120)}...`);

  // Check \an5 override (middle center alignment)
  assert(line.includes('\\an5'), `Event ${i}: has \\an5 alignment override`);

  // Check pop animation tags
  assert(line.includes('\\fscx'), `Event ${i}: has \\fscx scale tag`);
  assert(line.includes('\\fscy'), `Event ${i}: has \\fscy scale tag`);
  assert(line.includes('\\alpha'), `Event ${i}: has \\alpha transparency tag`);

  // Check \t transition tags exist
  const tMatches = line.match(/\\t\((\d+),(\d+),/g);
  assert(tMatches && tMatches.length >= 2, `Event ${i}: has at least 2 \\t transitions (got: ${tMatches?.length || 0})`);

  // Check \t timing values are in MILLISECONDS (not centiseconds)
  if (tMatches) {
    for (const tm of tMatches) {
      const [, t1, t2] = tm.match(/\\t\((\d+),(\d+),/);
      const t1n = parseInt(t1);
      const t2n = parseInt(t2);
      // The overshoot should be ~80ms and settle ~140ms. If values are <15, they're in centiseconds (BUG).
      assert(t2n > 15, `Event ${i}: \\t timing t2=${t2n} should be >15ms (milliseconds, not centiseconds)`);
    }
  }

  // Check word is UPPERCASE
  const textPart = line.split(',,').pop();
  const wordText = textPart.replace(/\{[^}]*\}/g, '').trim();
  assert(wordText === wordText.toUpperCase(), `Event ${i}: word "${wordText}" is uppercase`);

  // Check ASS time format (H:MM:SS.CC)
  const timeMatches = line.match(/(\d+:\d{2}:\d{2}\.\d{2})/g);
  assert(timeMatches && timeMatches.length >= 2, `Event ${i}: has valid ASS time format`);
  if (timeMatches) {
    for (const t of timeMatches) {
      const cs = t.split('.')[1];
      assert(parseInt(cs) < 100, `Event ${i}: centiseconds ${cs} < 100 (valid range)`);
    }
  }
}

// ── Test 2: ASS Content for 1080x1920 canvas ────────────────────────────────

console.log('\n═══ TEST 2: ASS Content at 1080x1920 ═══\n');

const assContent1080 = generateASS(SAMPLE_WORD_TIMESTAMPS, {
  style: 'hormozi',
  animation: 'word-pop',
  clipStartTime: 0,
  wordsPerLine: 1,
  position: 'bottom',
  canvasWidth: 1080,
  canvasHeight: 1920,
  splitScreen: null,
});

assert(assContent1080.includes('PlayResX: 1080'), 'PlayResX matches 1080');
assert(assContent1080.includes('PlayResY: 1920'), 'PlayResY matches 1920');

const dialogueLines1080 = assContent1080.split('\n').filter(l => l.startsWith('Dialogue:'));
assert(dialogueLines1080.length === SAMPLE_WORD_TIMESTAMPS.length, `Has ${SAMPLE_WORD_TIMESTAMPS.length} dialogue events at 1080p`);

// ── Test 3: Static ASS fallback (no word timestamps) ─────────────────────────

console.log('\n═══ TEST 3: Static ASS Fallback ═══\n');

const staticASS = generateStaticASS('This is a crazy play right here', 5, {
  style: 'hormozi',
  position: 'bottom',
  canvasWidth: 720,
  canvasHeight: 1280,
});

assert(typeof staticASS === 'string' && staticASS.length > 0, 'Static ASS is non-empty');
assert(staticASS.includes('[Script Info]'), 'Static ASS has [Script Info]');
const staticDialogues = staticASS.split('\n').filter(l => l.startsWith('Dialogue:'));
assert(staticDialogues.length > 0, `Static ASS has dialogue events (got: ${staticDialogues.length})`);

// ── Test 4: Word timestamp validation ─────────────────────────────────────────

console.log('\n═══ TEST 4: Word Timestamp Validation ═══\n');

try {
  validateWordTimestamps(SAMPLE_WORD_TIMESTAMPS);
  assert(true, 'Valid timestamps pass validation');
} catch (e) {
  assert(false, `Valid timestamps should pass: ${e.message}`);
}

// ── Test 5: toASSTime edge cases ──────────────────────────────────────────────

console.log('\n═══ TEST 5: toASSTime Edge Cases ═══\n');

// Test edge case: seconds that would produce cs=100
const edgeCaseASS = generateASS(
  [{ word: 'test', start: 0.995, end: 1.995 }],
  { style: 'hormozi', animation: 'word-pop', clipStartTime: 0, canvasWidth: 720, canvasHeight: 1280 }
);
const edgeTimes = edgeCaseASS.match(/(\d+:\d{2}:\d{2}\.\d{2})/g) || [];
for (const t of edgeTimes) {
  const cs = parseInt(t.split('.')[1]);
  assert(cs < 100, `toASSTime edge case: cs=${cs} < 100 for time "${t}"`);
}

// ── Test 6: Different styles ─────────────────────────────────────────────────

console.log('\n═══ TEST 6: Different Caption Styles ═══\n');

const styles = ['hormozi', 'mrbeast', 'neon', 'minimal', 'impact', 'default', 'bold'];
for (const style of styles) {
  const ass = generateASS(SAMPLE_WORD_TIMESTAMPS, {
    style,
    animation: 'word-pop',
    clipStartTime: 0,
    canvasWidth: 720,
    canvasHeight: 1280,
  });
  const events = ass.split('\n').filter(l => l.startsWith('Dialogue:'));
  assert(events.length === SAMPLE_WORD_TIMESTAMPS.length, `Style "${style}": ${events.length} events generated`);
}

// ── Test 7: Split-screen word-pop ────────────────────────────────────────────

console.log('\n═══ TEST 7: Split-Screen Word-Pop ═══\n');

const splitASS = generateASS(SAMPLE_WORD_TIMESTAMPS, {
  style: 'hormozi',
  animation: 'word-pop',
  clipStartTime: 0,
  canvasWidth: 720,
  canvasHeight: 1280,
  splitScreen: { enabled: true, layout: 'top-bottom', ratio: 50 },
});

assert(splitASS.includes('[Events]'), 'Split-screen ASS has [Events]');
const splitDialogues = splitASS.split('\n').filter(l => l.startsWith('Dialogue:'));
assert(splitDialogues.length === SAMPLE_WORD_TIMESTAMPS.length, `Split-screen: ${splitDialogues.length} dialogue events`);

// ── Test 8: Simulate render.js captions object construction ──────────────────

console.log('\n═══ TEST 8: Captions Object Construction (render.js simulation) ═══\n');

// Simulate exactly what render.js does
const settingsCaptions = {
  enabled: true,
  style: 'hormozi',
  animation: 'word-pop',
  position: 'bottom',
  wordsPerLine: 4,
};

const assFilePath = '/tmp/viral-studio-render/test-uuid/captions.ass';

// This is what render.js line 539 does:
const captionsObj = assFilePath
  ? { assFilePath, ...settingsCaptions }
  : null;

assert(captionsObj !== null, 'Captions object is not null');
assert(captionsObj.assFilePath === assFilePath, 'assFilePath is preserved after spread');
assert(captionsObj.animation === 'word-pop', 'animation is preserved');

// Check that settingsCaptions doesn't accidentally overwrite assFilePath
assert(!('assFilePath' in settingsCaptions), 'settings.captions does not have assFilePath property');

// Simulate ffmpeg-render.js check
const hasASS = captionsObj && captionsObj.assFilePath;
assert(!!hasASS, 'ffmpeg-render.js would detect ASS file path');

const hasPNG = captionsObj && captionsObj.pngOverlays && captionsObj.pngOverlays.length > 0;
assert(!hasPNG, 'ffmpeg-render.js would NOT detect PNG overlays (correct for word-pop)');

// ── Test 9: FFmpeg Render (optional) ─────────────────────────────────────────

if (doRender) {
  console.log('\n═══ TEST 9: FFmpeg Render ═══\n');

  const testDir = '/tmp/test-wordpop-e2e';
  try { await fs.mkdir(testDir, { recursive: true }); } catch {}

  const testAssPath = path.join(testDir, 'captions.ass');
  const testInputPath = path.join(testDir, 'test_input.mp4');
  const testOutputPath = path.join(testDir, 'test_output.mp4');

  // Write ASS file
  await fs.writeFile(testAssPath, assContent1080, 'utf-8');
  console.log(`  Wrote ASS file: ${testAssPath} (${assContent1080.length} bytes)`);

  // Generate test pattern video (5 seconds, 1080x1920, 30fps)
  console.log('  Generating test pattern video...');
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=5:size=1080x1920:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-shortest',
      '-pix_fmt', 'yuv420p',
      testInputPath,
    ], { timeout: 30000 });
    console.log('  Test pattern video created.');

    // Render with ASS subtitles (mimics ffmpeg-render.js standard path)
    const escapedPath = testAssPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
    const filterComplex = [
      `[0:v]fps=30,split=2[srcfg][srcbg]`,
      `[srcbg]scale=540:960:force_original_aspect_ratio=increase,crop=540:960:(iw-540)/2:(ih-960)/2,gblur=sigma=20,eq=brightness=-0.35:saturation=1.25:contrast=1.1,scale=1080:1920:flags=bilinear,setsar=1[bg]`,
      `[srcfg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[composed]`,
      `[composed]ass='${escapedPath}'[captioned]`,
    ].join(';');

    console.log('  Rendering with ASS subtitles...');
    console.log(`  Filter: ...ass='${escapedPath}'[captioned]`);

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
      testOutputPath,
    ], { timeout: 60000 });

    const stat = await fs.stat(testOutputPath);
    assert(stat.size > 10000, `Output video exists and is ${stat.size} bytes (> 10KB)`);
    console.log(`  Output: ${testOutputPath} (${stat.size} bytes)`);
    console.log('  → Open this file to visually verify subtitles are visible!');
  } catch (err) {
    console.log(`  FFmpeg render failed: ${err.message}`);
    if (err.stderr) {
      const lastLines = err.stderr.split('\n').filter(l => !l.startsWith('\r') && l.trim()).slice(-5);
      console.log('  FFmpeg stderr (last 5 lines):');
      lastLines.forEach(l => console.log(`    ${l}`));
    }
    assert(false, 'FFmpeg render completed');
  }
} else {
  console.log('\n═══ TEST 9: FFmpeg Render (SKIPPED — use --render flag) ═══\n');
}

// ── Print full ASS content for inspection ────────────────────────────────────

console.log('\n═══ FULL ASS CONTENT (720x1280) ═══\n');
console.log(assContent);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n═══ SUMMARY ═══\n');
console.log(`  Passed: ${TESTS_PASSED.length}`);
console.log(`  Failed: ${TESTS_FAILED.length}`);
if (TESTS_FAILED.length > 0) {
  console.log('\n  Failed tests:');
  TESTS_FAILED.forEach(t => console.log(`    ✗ ${t}`));
}
console.log('');

process.exit(TESTS_FAILED.length > 0 ? 1 : 0);
