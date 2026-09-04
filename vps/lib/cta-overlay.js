/**
 * CTA Follow Overlay — P4 · Copywriter SEO (2026-09).
 *
 * Adds a small "FOLLOW FOR MORE" text during the last ~1.2 s of the clip, at
 * ~80% height, styled like the captions (uppercase, white, black outline).
 * Data: a follow CTA at the END (never at the start, never "like this")
 * converts viewers without hurting interactions.
 *
 * Deliberately standalone: does NOT touch subtitle-generator.js / ffmpeg-render.js.
 *   - `buildCtaDialogue()`  → one ASS Dialogue line (override tags inline, so any
 *                             existing style name works)
 *   - `appendCtaToAss()`    → string-append the Dialogue to an existing .ass
 *   - `buildStandaloneCtaAss()` → minimal .ass when captions are disabled
 *
 * Feature flag: settings.ctaFollow?.enabled (default true). Contract feature
 * `cta_follow` is NON-critical and does not count in transformScore.
 */

/** Seeded 2-4 word variants (no "like", no emoji — indexed on-screen text). */
export const CTA_VARIANTS = [
  'FOLLOW FOR MORE',
  'FOLLOW FOR MORE CLIPS',
  'MORE CLIPS DAILY',
  'FOLLOW FOR DAILY CLIPS',
  'NEW CLIPS EVERY DAY',
];

export const CTA_DURATION_S = 1.2;
export const CTA_MIN_CLIP_DURATION_S = 4;

function seededIndex(seed, mod) {
  let h = 0x9e3779b9;
  const str = String(seed ?? '');
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  return mod > 0 ? (h >>> 0) % mod : 0;
}

/** Pick the CTA text: explicit text > seeded variant > default. */
export function pickCtaText({ text, seed } = {}) {
  if (typeof text === 'string' && text.trim()) {
    return text.trim().toUpperCase().replace(/\s{2,}/g, ' ').slice(0, 32);
  }
  if (seed === undefined || seed === null || seed === '') return CTA_VARIANTS[0];
  return CTA_VARIANTS[seededIndex(seed, CTA_VARIANTS.length)];
}

/** ASS timestamp h:mm:ss.cc */
function assTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

/** Find the first style name declared in an ASS file (fallback 'Default'). */
export function findFirstStyleName(assContent) {
  const m = String(assContent || '').match(/^Style:\s*([^,\r\n]+),/m);
  return m ? m[1].trim() : 'Default';
}

/** Read PlayResX/PlayResY from an ASS header (fallback 1080x1920). */
export function readPlayRes(assContent) {
  const x = String(assContent || '').match(/^PlayResX:\s*(\d+)/m);
  const y = String(assContent || '').match(/^PlayResY:\s*(\d+)/m);
  return {
    w: x ? parseInt(x[1], 10) : 1080,
    h: y ? parseInt(y[1], 10) : 1920,
  };
}

/**
 * Build the CTA Dialogue line.
 * @param {object} opts
 * @param {number} opts.duration     - clip duration (s) — CTA occupies the last CTA_DURATION_S
 * @param {number} [opts.canvasW=1080]
 * @param {number} [opts.canvasH=1920]
 * @param {string} [opts.styleName='Default'] - existing style name to reference
 * @param {string} [opts.text]       - explicit CTA text
 * @param {string} [opts.seed]       - seed for variant pick
 * @param {number} [opts.heightPct=80] - vertical position (% of canvas height)
 * @returns {string|null} Dialogue line (no trailing newline) or null if clip too short
 */
export function buildCtaDialogue(opts = {}) {
  const {
    duration, canvasW = 1080, canvasH = 1920, styleName = 'Default',
    text, seed, heightPct = 80,
  } = opts;
  if (!Number.isFinite(duration) || duration < CTA_MIN_CLIP_DURATION_S) return null;

  const ctaText = pickCtaText({ text, seed });
  const start = Math.max(0, duration - CTA_DURATION_S);
  const end = duration;
  const x = Math.round(canvasW / 2);
  const y = Math.round(canvasH * (heightPct / 100));
  // Caption-like look: ~3.2% of canvas height, bold, white fill, black outline + soft shadow.
  const fs = Math.round(canvasH * 0.032);
  const bord = Math.max(2, Math.round(fs * 0.12));
  const shad = Math.max(1, Math.round(fs * 0.06));
  const tags = `{\\an5\\pos(${x},${y})\\fs${fs}\\b1\\c&H00FFFFFF&\\3c&H00000000&\\4c&H80000000&\\bord${bord}\\shad${shad}\\fad(150,0)\\fsp1}`;
  const safeText = ctaText.replace(/[{}]/g, '');
  return `Dialogue: 5,${assTime(start)},${assTime(end)},${styleName},,0,0,0,,${tags}${safeText}`;
}

/**
 * Append the CTA Dialogue to an existing ASS content string.
 * Never throws — returns the original content on any problem.
 */
export function appendCtaToAss(assContent, opts = {}) {
  try {
    const content = String(assContent || '');
    if (!/\[Events\]/i.test(content)) return { content, dialogue: null, applied: false, reason: 'no_events_section' };
    const { w, h } = readPlayRes(content);
    const dialogue = buildCtaDialogue({
      ...opts,
      canvasW: opts.canvasW ?? w,
      canvasH: opts.canvasH ?? h,
      styleName: opts.styleName ?? findFirstStyleName(content),
    });
    if (!dialogue) return { content, dialogue: null, applied: false, reason: 'clip_too_short' };
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const trimmed = content.replace(/\s+$/, '');
    return { content: `${trimmed}${eol}${dialogue}${eol}`, dialogue, applied: true, reason: null };
  } catch (err) {
    return { content: String(assContent || ''), dialogue: null, applied: false, reason: err.message };
  }
}

/**
 * Minimal standalone ASS (captions disabled) containing only the CTA.
 * @returns {string|null}
 */
export function buildStandaloneCtaAss(opts = {}) {
  const canvasW = opts.canvasW ?? 1080;
  const canvasH = opts.canvasH ?? 1920;
  const dialogue = buildCtaDialogue({ ...opts, canvasW, canvasH, styleName: 'Default' });
  if (!dialogue) return null;
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${canvasW}`,
    `PlayResY: ${canvasH}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,Montserrat,${Math.round(canvasH * 0.032)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,4,2,5,40,40,40,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    dialogue,
    '',
  ].join('\n');
}
