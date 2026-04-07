/**
 * Word-Pop drawtext filter generator for FFmpeg.
 *
 * Generates native FFmpeg drawtext filters instead of ASS subtitles.
 * Each word gets its own drawtext filter with enable='between(t,start,end)'.
 * "Important" words render in red, others in white — all with thick black outline.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Important-word detection
// ─────────────────────────────────────────────────────────────────────────────

const HYPE_WORDS = new Set([
  'damn', 'crazy', 'insane', 'sick', 'fire', 'bro', 'wow', 'omg',
  'no', 'yes', 'what', 'why', 'how', 'kill', 'dead', 'clutch',
  'goat', 'god', 'holy', 'fuck', 'shit', 'ass', 'dude', 'bruh',
  'lets', 'go', 'nice', 'gg', 'ez', 'rip', 'oof', 'pog',
  'huge', 'win', 'lost', 'lose', 'hate', 'love', 'help',
]);

/**
 * Determine if a word should be highlighted (rendered in red).
 *
 * @param {string} rawWord - Original word from Whisper (before uppercasing)
 * @param {number} index   - Position in the word array
 * @param {number} total   - Total number of words
 * @returns {boolean}
 */
function isImportantWord(rawWord, index, total) {
  const clean = rawWord.replace(/[^a-zA-Z]/g, '').toLowerCase();

  // First and last word of the sentence
  if (index === 0 || index === total - 1) return true;

  // Already ALL-CAPS in transcription (Whisper sometimes returns emphasis caps)
  if (rawWord.length > 1 && rawWord === rawWord.toUpperCase() && /[A-Z]/.test(rawWord)) return true;

  // Contains exclamation
  if (rawWord.includes('!')) return true;

  // Long words (6+ letters) tend to be meaningful
  if (clean.length >= 6) return true;

  // Known hype / exclamation words
  if (HYPE_WORDS.has(clean)) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// FFmpeg drawtext escaping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape a word for use inside a drawtext text='...' value.
 *
 * FFmpeg drawtext special chars:  : ' \ [ ] % @
 * Inside a filter_complex -filter_complex "..." string the ; and , are
 * structural separators, but since each drawtext is chained with commas
 * inside a single segment we only need to worry about the drawtext-level
 * escapes.  The outer filter_complex string uses single-quote for paths
 * so we keep the text= value in single quotes and escape inner quotes.
 */
function escapeWordForDrawtext(word) {
  return word
    .replace(/\\/g, '\\\\\\\\')   // \ → \\\\  (double-escape for filter + drawtext)
    .replace(/'/g, "'\\\\'")       // ' → '\\'  (end quote, escaped quote, reopen)
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/@/g, '\\@')
    .replace(/;/g, '\\;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

// DejaVu Sans Bold is installed on Railway via fonts-dejavu-core in Dockerfile
const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

/**
 * Build an array of FFmpeg drawtext filter strings for word-pop animation.
 *
 * Each word gets one drawtext filter that is only visible during its time
 * window (via `enable='between(t,start,end)'`).
 *
 * @param {Array<{word:string, start:number, end:number}>} wordTimestamps
 * @param {number} clipStartTime - Offset of clip within source video
 * @param {Object} opts
 * @param {number} opts.canvasWidth   - FFmpeg canvas width  (default 720)
 * @param {number} opts.canvasHeight  - FFmpeg canvas height (default 1280)
 * @param {string} opts.position      - 'top' | 'middle' | 'bottom' (default 'bottom')
 * @param {Object|null} opts.splitScreen - { enabled, layout, ratio }
 * @returns {string[]}  Array of drawtext filter strings (without leading comma)
 */
export function buildWordPopDrawtext(wordTimestamps, clipStartTime = 0, opts = {}) {
  const {
    canvasWidth = 720,
    canvasHeight = 1280,
    position = 'bottom',
    splitScreen = null,
  } = opts;

  if (!wordTimestamps || wordTimestamps.length === 0) return [];

  // Determine Y position.
  // For 9:16 vertical video, "bottom" = ~72% from top (above tag bar area).
  // For split-screen top-bottom, place text inside the main (top) portion.
  let yExpr;
  if (splitScreen && splitScreen.enabled && splitScreen.layout === 'top-bottom') {
    const ratio = (splitScreen.ratio || 50) / 100;
    const topH = Math.round(canvasHeight * ratio);
    // Place at 72% of the top portion height
    yExpr = `${Math.round(topH * 0.72)}`;
  } else if (position === 'top') {
    yExpr = `${Math.round(canvasHeight * 0.12)}`;
  } else if (position === 'middle') {
    yExpr = `(h-text_h)/2`;
  } else {
    // bottom — 72% down from top
    yExpr = `${Math.round(canvasHeight * 0.72)}`;
  }

  const fontSize = Math.round(canvasWidth * 0.115); // ~83px at 720w
  const borderW = Math.max(3, Math.round(fontSize * 0.06));
  const shadowX = Math.max(1, Math.round(fontSize * 0.025));
  const shadowY = shadowX;

  const total = wordTimestamps.length;
  const filters = [];

  for (let i = 0; i < total; i++) {
    const w = wordTimestamps[i];
    const start = Math.max(0, w.start - clipStartTime);

    // Extend display until next word starts (+ 50ms overlap) so no gap
    const nextStart = i < total - 1
      ? Math.max(0, wordTimestamps[i + 1].start - clipStartTime)
      : start + 0.5;
    const end = Math.max(start + 0.1, Math.min(nextStart + 0.05, w.end - clipStartTime + 0.15));

    const important = isImportantWord(w.word, i, total);
    const color = important ? 'red' : 'white';
    const word = escapeWordForDrawtext(w.word.toUpperCase());

    // Pop effect via fontsize expression:
    //   First 80ms: fontsize overshoots to 120% then eases back to 100%
    //   Rest: steady at base size
    // Using a simpler 2-phase approach:
    //   phase1 (0–80ms after start): lerp from 1.18 → 1.0  (overshoot → settle)
    //   rest: 1.0
    const s = start.toFixed(4);
    const popEnd = (start + 0.08).toFixed(4);
    const baseFontSize = fontSize;
    const fontSizeExpr = `if(between(t\\,${s}\\,${popEnd})\\,${Math.round(baseFontSize * 1.18)}-${Math.round(baseFontSize * 0.18)}*(t-${s})/0.08\\,${baseFontSize})`;

    const enableExpr = `between(t\\,${start.toFixed(4)}\\,${end.toFixed(4)})`;

    const dt = [
      `drawtext=text='${word}'`,
      `enable='${enableExpr}'`,
      `fontfile=${FONT_PATH}`,
      `fontsize='${fontSizeExpr}'`,
      `fontcolor=${color}`,
      `borderw=${borderW}`,
      `bordercolor=black`,
      `shadowcolor=black@0.6`,
      `shadowx=${shadowX}`,
      `shadowy=${shadowY}`,
      `x=(w-text_w)/2`,
      `y=${yExpr}`,
    ].join(':');

    filters.push(dt);
  }

  return filters;
}

/**
 * Build drawtext filters from a plain-text title (fallback when no Whisper timestamps).
 * Splits the title into individual words and distributes them evenly over the duration.
 *
 * @param {string} text     - Clip title or fallback text
 * @param {number} duration - Clip duration in seconds
 * @param {Object} opts     - Same as buildWordPopDrawtext opts
 * @returns {string[]}
 */
export function buildWordPopDrawtextFromTitle(text, duration, opts = {}) {
  if (!text || !duration || duration <= 0) return [];

  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const wordDuration = Math.max(0.3, duration / words.length);
  const fakeTimestamps = words.map((word, i) => ({
    word,
    start: i * wordDuration,
    end: Math.min((i + 1) * wordDuration, duration),
  }));

  return buildWordPopDrawtext(fakeTimestamps, 0, opts);
}
