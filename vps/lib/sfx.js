/**
 * SFX Layer — selects and places sound effects on audio peaks.
 *
 * Mood → SFX family mapping, seeded by diversify for per-render variation.
 * Assets expected in vps/assets/sfx/ as WAV 48 kHz files.
 * Degrades gracefully: if assets are missing, returns empty array.
 */

import fs from 'fs';
import path from 'path';

// ── SFX families and mood mapping ────────────────────────────────────────────

const SFX_FAMILIES = {
  whoosh:   ['whoosh-1.wav', 'whoosh-2.wav', 'whoosh-3.wav'],
  bassHit:  ['bass-hit-1.wav', 'bass-hit-2.wav'],
  boom:     ['vine-boom.wav'],
  ding:     ['ding.wav'],
  glitch:   ['glitch.wav'],
  pop:      ['pop.wav'],
  riser:    ['riser-short.wav'],
};

// Which families to use per mood (ordered by priority)
const MOOD_FAMILIES = {
  rage:      ['bassHit', 'glitch', 'boom'],
  funny:     ['boom', 'pop', 'ding'],
  drama:     ['riser', 'bassHit', 'glitch'],
  wholesome: ['ding', 'pop', 'riser'],
  hype:      ['whoosh', 'bassHit', 'boom'],
  story:     ['riser', 'whoosh', 'ding'],
};

const SFX_DIR = path.resolve(import.meta.dirname || '.', '../assets/sfx');
const MIN_COOLDOWN_S = 4;    // max 1 SFX per 4 seconds
const VOLUME_DB = -12;       // -12 dB under voice (after loudnorm)
const FADE_MS = 30;          // 30 ms fade in/out

/**
 * Check if SFX assets are available.
 */
export function sfxAssetsAvailable() {
  try {
    return fs.existsSync(SFX_DIR) && fs.readdirSync(SFX_DIR).some(f => f.endsWith('.wav'));
  } catch {
    return false;
  }
}

/**
 * Simple seeded PRNG for SFX selection (same as diversify.js).
 */
function createRng(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Select and place SFX on audio peaks.
 *
 * @param {object} opts
 * @param {Array<{time: number, intensity: number}>} opts.peaks - Audio peaks with intensity
 * @param {string} opts.mood - Clip mood (rage, funny, etc.)
 * @param {number} opts.duration - Clip duration in seconds
 * @param {string} opts.level - 'off' | 'subtle' | 'punchy'
 * @param {number} opts.seed - Diversify seed for per-render variation
 * @returns {Array<{path: string, time: number, volume: number}>}
 */
export function selectSfx({ peaks = [], mood = 'hype', duration = 30, level = 'subtle', seed = 1 }) {
  if (level === 'off' || !sfxAssetsAvailable()) return [];
  if (peaks.length === 0) return [];

  const rand = createRng(seed);
  const families = MOOD_FAMILIES[mood] || MOOD_FAMILIES.hype;

  // Resolve available files per family
  const availableFamilies = families
    .map(fam => ({
      name: fam,
      files: (SFX_FAMILIES[fam] || [])
        .map(f => path.join(SFX_DIR, f))
        .filter(p => fs.existsSync(p)),
    }))
    .filter(f => f.files.length > 0);

  if (availableFamilies.length === 0) return [];

  // Volume: subtle = -12 dB, punchy = -6 dB
  const volumeDb = level === 'punchy' ? -6 : VOLUME_DB;

  // Filter peaks: skip first 1s, respect cooldown, cap at duration-0.5s
  const placed = [];
  let lastTime = -Infinity;

  for (const peak of peaks) {
    const t = typeof peak === 'number' ? peak : peak.time;
    if (t < 1.0 || t > duration - 0.5) continue;
    if (t - lastTime < MIN_COOLDOWN_S) continue;

    // Pick family (rotate through available, seeded)
    const famIdx = Math.floor(rand() * availableFamilies.length);
    const family = availableFamilies[famIdx];

    // Pick file within family (seeded)
    const fileIdx = Math.floor(rand() * family.files.length);
    const sfxPath = family.files[fileIdx];

    // Jitter timing ±80ms (seeded)
    const jitter = (rand() - 0.5) * 0.16; // ±80ms
    const placedTime = Math.max(0, t + jitter);

    placed.push({
      path: sfxPath,
      time: Math.round(placedTime * 1000) / 1000,
      volume: volumeDb,
      family: family.name,
    });

    lastTime = t;
  }

  return placed;
}

/**
 * Volume in dB to FFmpeg volume filter value.
 * -12 dB ≈ 0.25, -6 dB ≈ 0.5
 */
export function dbToVolume(db) {
  return Math.pow(10, db / 20);
}

export { FADE_MS, SFX_DIR };
