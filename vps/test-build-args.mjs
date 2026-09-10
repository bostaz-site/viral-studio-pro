#!/usr/bin/env node
/**
 * Smoke test: imports ffmpeg-render.js and exercises the filter/args building
 * code path with minimal settings. Does NOT run ffmpeg — catches TDZ errors,
 * import failures, and syntax issues that node --check misses.
 *
 * Usage:  node vps/test-build-args.mjs
 * Exit:   0 = OK, 1 = crash
 */

import { renderClip } from './lib/ffmpeg-render.js';

const FAKE_INPUT = '/dev/null';
const FAKE_OUTPUT = '/tmp/test-smoke-output.mp4';

async function main() {
  console.log('[smoke] Importing ffmpeg-render.js — OK');

  // Call renderClip with minimal options.
  // It will fail at ffprobe/ffmpeg execution (file doesn't exist), but
  // all the JS code (filter building, hasSfx, loudnorm, diversify)
  // runs BEFORE the first exec call. A TDZ crash happens here.
  try {
    await renderClip(FAKE_INPUT, FAKE_OUTPUT, {
      startTime: 0,
      endTime: 10,
      duration: 10,
      aspectRatio: '9:16',
      captions: null,
      watermark: null,
      plan: 'free',
      tag: null,
      cropAnchor: 'center',
      videoZoom: 'auto',
      smartZoom: { enabled: true, mode: 'dynamic' },
      hook: null,
      audioEnhance: false,
      voiceoverPaths: null,
      sfxPaths: null,
      splitScreen: null,
      diversify: { audioShiftPct: 1, zoomAmpMult: 1, zoomPhase: 0, grainStrength: 2, hookDelayS: 0, hookPosPct: 0, hookSizePct: 0, borderCropPx: 50, hueDeg: 0, saturation: 1, brightness: 0 },
    });
    // If renderClip doesn't crash, it means ffmpeg actually ran (unlikely with /dev/null)
    console.log('[smoke] renderClip returned without crash — OK');
  } catch (err) {
    // Expected: ffprobe/ffmpeg will fail on /dev/null — that's fine.
    // What we're testing is that the JS code BEFORE exec doesn't crash.
    const msg = err.message || '';
    if (msg.includes('Cannot access') || msg.includes('is not defined') || msg.includes('is not a function')) {
      // This IS a JS error (TDZ, reference error, etc.) — FAIL
      console.error(`[smoke] FATAL JS ERROR: ${msg}`);
      process.exit(1);
    }
    // ffmpeg/ffprobe failure = expected, test passes
    console.log(`[smoke] renderClip threw expected exec error: ${msg.slice(0, 80)}`);
    console.log('[smoke] No TDZ or reference errors — OK');
  }
}

main().then(() => {
  console.log('[smoke] PASS');
  process.exit(0);
}).catch(err => {
  console.error(`[smoke] UNEXPECTED CRASH: ${err.message}`);
  process.exit(1);
});
