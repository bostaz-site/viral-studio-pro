/**
 * Render Diversification — ensures each render is perceptually unique
 * to defeat TikTok's duplicate content detection (perceptual hashing).
 *
 * Principle (non-negotiable): render-parity — NEVER contradict user-configured
 * settings. Only varies micro-parameters the user didn't explicitly choose.
 *
 * Seed is derived deterministically from jobId via SHA-256 → reproducible for debug.
 */

import crypto from 'crypto';

// ── Seeded PRNG ──────────────────────────────────────────────────────────────

function deriveSeed(jobId) {
  if (!jobId) return 1;
  const hash = crypto.createHash('sha256').update(String(jobId)).digest();
  return hash.readUInt32BE(0) || 1; // never 0
}

function createRng(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Compute all diversification parameters from a jobId.
 * Each value is deterministic for a given jobId (reproducible).
 *
 * @param {string} jobId - Render job UUID
 * @returns {object} Diversification parameters
 */
export function computeDiversify(jobId) {
  const seed = deriveSeed(jobId);
  const rand = createRng(seed);

  // 1. Entry trim: 0 to 1.2s in 0.1s steps (13 values)
  const entryTrimS = Math.round(rand() * 12) / 10;

  // 2. Audio shift: +1.8% to +4.2% (never 0 — always shifts)
  const audioShiftPct = round2(1.8 + rand() * 2.4);

  // 3. Caption micro-variations (only applied to params user didn't set)
  const captionMarginVPct = round2((rand() - 0.5) * 6);   // ±3%
  const captionSizePct = round2((rand() - 0.5) * 12);     // ±6%
  const captionColorIdx = Math.floor(rand() * 5);          // 0-4

  // 4. Voice pool index (0-5, selects from 6-voice pool of same register)
  const voiceIdx = Math.floor(rand() * 6);

  // 5. Hook overlay micro-variations
  const hookPosPct = round2((rand() - 0.5) * 8);           // ±4%
  const hookSizePct = round2((rand() - 0.5) * 10);         // ±5%
  const hookDelayS = Math.round(rand() * 4) / 10;          // 0-0.4s in 0.1s steps

  // 6. Zoom amplitude & phase variation
  const zoomAmpMult = round2(0.85 + rand() * 0.30);        // ±15% of default
  const zoomPhase = round2(rand() * 0.15);                  // 0-15% phase offset

  // 7. Invisible grain: noise strength 1 or 2
  const grainStrength = 1 + Math.floor(rand() * 2);

  return {
    seed,
    entryTrimS,
    audioShiftPct,
    captionMarginVPct,
    captionSizePct,
    captionColorIdx,
    voiceIdx,
    hookPosPct,
    hookSizePct,
    hookDelayS,
    zoomAmpMult,
    zoomPhase,
    grainStrength,
  };
}

// ── Accent Color Palettes ────────────────────────────────────────────────────
// 5 variants per style (ASS BGR format &H00BBGGRR).
// Subtle hue/saturation shifts — same tone family, different hash.

const ACCENT_PALETTES = {
  'hormozi-purple': [
    '&H00FF7DC7', '&H00FF6BD0', '&H00FF8FBE', '&H00E872C0', '&H00FF95D8',
  ],
  mrbeast: [
    '&H004444EF', '&H003838E5', '&H005252F2', '&H003A50E8', '&H004040DC',
  ],
  neon: [
    '&H0080DE4A', '&H0070D455', '&H0090E83F', '&H0075C84A', '&H0095F055',
  ],
  impact: [
    '&H000000FF', '&H000015F0', '&H000000E0', '&H001010FF', '&H000020E8',
  ],
  imangadzhi: [
    '&H0000D4FF', '&H0000C0F0', '&H0000E0FF', '&H0010D0F5', '&H0000D8E8',
  ],
  default: [
    '&H0000FFFF', '&H0000F0F0', '&H0010FFFF', '&H0020F5FF', '&H0000E8E8',
  ],
  aliabdaal: [
    '&H00FDC593', '&H00F0B888', '&H00FFD09E', '&H00E8BA88', '&H00FFD8A8',
  ],
};

/**
 * Get a diversified accent color for a caption style.
 * Returns the palette color at the given index, or null if the style
 * has no accent (white-only styles like hormozi, minimal, bold, word-pop).
 */
export function getDiversifiedAccentColor(styleName, colorIdx) {
  const palette = ACCENT_PALETTES[styleName];
  if (!palette) return null;
  return palette[colorIdx % palette.length];
}

// ── Voice Pools ──────────────────────────────────────────────────────────────
// 6 voices per register, all from ElevenLabs premade library.
// Index 0 = the original voice used before diversification.

export const VOICE_POOLS = {
  default: [
    'nPczCjzI2devNBz1zQrb', // Brian — original
    'pNInz6obpgDQGcFmaJgB', // Adam
    'TxGEqnHWrfWFTfGW9XjX', // Josh
    'VR6AewLTigWG4xSOukaG', // Arnold
    'yoZ06aMxZJJ28mfd3POQ', // Sam
    'ErXwobaYiN019PkySvjV', // Antoni
  ],
  female: [
    'cgSgspJ2msm6clMCkdW9', // Jessica — original
    'EXAVITQu4vr4xnSDxMaL', // Bella
    'MF3mGyEYCl7XYWbV9V6O', // Elli
    'AZnzlk1XvdvUeBnXmlld', // Domi
    'XB0fDUnXU5powFXDhCwa', // Charlotte
    'pFZP5JQG7iQjIQuC4Bku', // Lily
  ],
  deep: [
    'N2lVS1w4EtoT3dr4eOWO', // Callum — original
    'pNInz6obpgDQGcFmaJgB', // Adam
    'VR6AewLTigWG4xSOukaG', // Arnold
    'CYw3kZ02Hs0563khs1Fj', // Dave
    'JBFqnCBsd6RMkjVDRZzb', // George
    'bIHbv24MWmeRgasZH58o', // Will
  ],
};

/**
 * Pick a voice ID from the pool for a given register and diversify index.
 */
export function pickVoice(register, voiceIdx) {
  const pool = VOICE_POOLS[register] || VOICE_POOLS.default;
  return pool[voiceIdx % pool.length];
}
