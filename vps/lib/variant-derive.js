/**
 * Variant Derivation — lightweight second-pass re-encode of a base render
 * to produce platform-specific variants that defeat cross-platform duplicate detection.
 *
 * Each variant gets a unique seed derived from SHA-256(jobId + variantKey).
 * The second pass is ~5-8s per variant (vs 30-90s for the full pipeline).
 *
 * Applied variations (all imperceptible):
 *   - Entry trim: 0-0.3s (shorter range than base to avoid cutting content)
 *   - Audio shift: different asetrate/atempo than base
 *   - Border crop: 2-8px from edges
 *   - Color micro-shift: hue, saturation, brightness
 *   - Invisible grain: temporal noise
 *   - CRF variation: encoding decision differences
 *   - FPS variant: 30 vs 29.97
 *   - Metadata rewrite: unique encoder string per platform
 */

import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// ── Seeded PRNG (same as diversify.js) ───────────────────────────────────────

function deriveSeed(jobId, variantKey) {
  const hash = crypto.createHash('sha256').update(`${jobId}:${variantKey}`).digest();
  return hash.readUInt32BE(0) || 1;
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

// ── Compute variant-specific diversification ─────────────────────────────────

export function computeVariantDiversify(jobId, variantKey) {
  const seed = deriveSeed(jobId, variantKey);
  const rand = createRng(seed);

  return {
    seed,
    variantKey,
    // Shorter entry trim for variants (base already trimmed)
    entryTrimS: Math.round(rand() * 3) / 10,           // 0-0.3s
    // Audio shift: different range than base (1.5-3.5%)
    audioShiftPct: round2(1.5 + rand() * 2.0),
    // Border crop: 2-8px
    borderCropPx: 2 + Math.floor(rand() * 7),
    // Color micro-shift
    hueDeg: round2(rand() * 5),                         // 0-5 degrees
    saturation: round2(0.98 + rand() * 0.04),           // 0.98-1.02
    brightness: round2((rand() - 0.5) * 0.03),          // -0.015 to +0.015
    // Grain
    grainStrength: 2 + Math.floor(rand() * 4),           // 2-5
    // Encoding
    crfVariant: 19 + Math.floor(rand() * 5),             // 19-23
    fpsVariant: rand() > 0.5 ? 30 : '30000/1001',
  };
}

// ── Platform metadata strings (rewrites encoder tag) ─────────────────────────

const PLATFORM_METADATA = {
  tiktok: { comment: 'va-tk', encoder: 'Lavf60.3' },
  instagram: { comment: 'va-ig', encoder: 'Lavf60.16' },
  youtube: { comment: 'va-yt', encoder: 'Lavf59.27' },
  facebook: { comment: 'va-fb', encoder: 'Lavf60.10' },
};

// ── Derive a single variant via lightweight FFmpeg second pass ────────────────

/**
 * @param {string} basePath - Path to the base rendered MP4
 * @param {string} outputPath - Where to write the variant MP4
 * @param {object} div - Diversification params from computeVariantDiversify
 * @param {string} platform - Target platform for metadata
 * @returns {Promise<{success: boolean, outputPath: string, sizeMB: string}>}
 */
export async function deriveVariant(basePath, outputPath, div, platform) {
  const meta = PLATFORM_METADATA[platform] || PLATFORM_METADATA.tiktok;
  const fps = typeof div.fpsVariant === 'string' ? div.fpsVariant : String(div.fpsVariant);

  // Build video filters
  const vf = [];

  // Border crop (crop then scale back to original size)
  const crop = div.borderCropPx;
  if (crop > 0) {
    vf.push(`crop=iw-${crop * 2}:ih-${crop * 2}:${crop}:${crop}`);
    vf.push('scale=1080:1920:flags=lanczos');
  }

  // Color micro-shift via eq + hue
  if (div.hueDeg > 0 || div.saturation !== 1.0 || div.brightness !== 0) {
    const eqParts = [];
    if (div.brightness !== 0) eqParts.push(`brightness=${div.brightness}`);
    if (div.saturation !== 1.0) eqParts.push(`saturation=${div.saturation}`);
    if (eqParts.length > 0) vf.push(`eq=${eqParts.join(':')}`);
    if (div.hueDeg > 0) vf.push(`hue=h=${div.hueDeg}`);
  }

  // Invisible temporal grain
  if (div.grainStrength > 0) {
    vf.push(`noise=c0s=${div.grainStrength}:c0f=t`);
  }

  // Build audio filters (different shift than base)
  const shiftFactor = 1 + div.audioShiftPct / 100;
  const shiftedRate = Math.round(48000 * shiftFactor);
  const af = [
    `asetrate=${shiftedRate}`,
    `atempo=${(1 / shiftFactor).toFixed(6)}`,
    'aresample=48000',
  ];

  // Build FFmpeg command
  const args = [
    '-y',
    '-i', basePath,
  ];

  // Entry trim
  if (div.entryTrimS > 0) {
    args.push('-ss', String(div.entryTrimS));
  }

  // Video filters
  if (vf.length > 0) {
    args.push('-vf', vf.join(','));
  }

  // Audio filters
  args.push('-af', af.join(','));

  // Encoding params (lightweight — no complex filters)
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', String(div.crfVariant),
    '-r', fps,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    // Metadata rewrite
    '-metadata', `comment=${meta.comment}`,
    '-metadata', `encoder=${meta.encoder}`,
    '-metadata', `variant_seed=${div.seed}`,
    outputPath,
  );

  console.log(`[variant] Deriving ${div.variantKey} (seed=${div.seed}, crop=${crop}px, audio=+${div.audioShiftPct}%, crf=${div.crfVariant}, hue=${div.hueDeg}°)`);

  await execFileAsync('ffmpeg', args, { timeout: 60_000 });

  const stat = await fs.stat(outputPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  console.log(`[variant] ${div.variantKey} done: ${sizeMB}MB`);

  return { success: true, outputPath, sizeMB };
}

/**
 * Derive all requested variants from a base render.
 *
 * @param {string} basePath - Base rendered MP4
 * @param {string} tempDir - Temp directory for variant outputs
 * @param {string} jobId - Render job ID (seed source)
 * @param {Array<{id: string, platform: string, accountId?: string}>} variants - Requested variants
 * @returns {Promise<Array<{variantKey: string, platform: string, accountId?: string, localPath: string, div: object}>>}
 */
export async function deriveAllVariants(basePath, tempDir, jobId, variants) {
  const results = [];

  for (const v of variants) {
    const variantKey = v.id;
    const div = computeVariantDiversify(jobId, variantKey);
    const outputPath = path.join(tempDir, `variant_${variantKey}.mp4`);

    try {
      await deriveVariant(basePath, outputPath, div, v.platform);
      results.push({
        variantKey,
        platform: v.platform,
        accountId: v.accountId || null,
        localPath: outputPath,
        div,
      });
    } catch (err) {
      console.error(`[variant] Failed to derive ${variantKey}:`, err.message);
      // Non-fatal: variant failure doesn't block base render
    }
  }

  return results;
}
