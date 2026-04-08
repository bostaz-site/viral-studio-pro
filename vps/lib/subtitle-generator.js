/**
 * ASS subtitle file generator for Viral Studio Pro
 * Supports karaoke word-by-word highlighting and multiple caption styles
 */

// ─────────────────────────────────────────────────────────────────────────────
// Style Definitions
// ─────────────────────────────────────────────────────────────────────────────

// Modern viral caption styles (TikTok 2025):
// No background box — thick black outline around each letter + drop shadow.
// Clean, cinematic, readable on any background.
const CAPTION_STYLES = {
  hormozi: {
    fontname: 'Liberation Sans',
    fontsize: 78,
    fontweight: true,
    primaryColor: '&H00FFFFFF', // white (active / all words)
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000', // Opaque black stroke around letters
    backColor: '&H80000000', // Shadow: 50% opaque black
    bold: -1,
    italic: 0,
    outline: 5, // Thick letter stroke
    shadow: 2, // Drop shadow for depth
    borderStyle: 1, // 1 = outline+shadow (NOT opaque box)
    alignment: 2, // Bottom center
    marginV: 120,
  },

  mrbeast: {
    fontname: 'Liberation Sans',
    fontsize: 78,
    fontweight: true,
    primaryColor: '&H004444EF', // red-500 (active word)
    secondaryColor: '&H00FFFFFF', // White (inactive)
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 120,
  },

  neon: {
    fontname: 'Liberation Sans',
    fontsize: 76,
    fontweight: true,
    primaryColor: '&H0080DE4A', // green-400
    secondaryColor: '&H0080DE4A',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 130,
  },

  minimal: {
    fontname: 'Liberation Sans',
    fontsize: 64,
    fontweight: 0,
    primaryColor: '&H00FFFFFF', // White
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: 0,
    italic: 0,
    outline: 3,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 110,
  },

  impact: {
    fontname: 'Liberation Sans',
    fontsize: 80,
    fontweight: true,
    primaryColor: '&H000000FF', // Red
    secondaryColor: '&H00FFFFFF', // White
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 120,
  },

  aliabdaal: {
    fontname: 'Liberation Sans',
    fontsize: 70,
    fontweight: true,
    primaryColor: '&H00FDC593', // blue-300
    secondaryColor: '&H00FDC593',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 125,
  },

  imangadzhi: {
    fontname: 'Liberation Sans',
    fontsize: 88,
    fontweight: true,
    primaryColor: '&H0000D4FF', // Gold
    secondaryColor: '&H00FFFFFF', // White
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 115,
  },

  default: {
    fontname: 'Arial',
    fontsize: 70,
    fontweight: true,
    primaryColor: '&H0000FFFF', // Yellow
    secondaryColor: '&H00FFFFFF', // White
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 120,
  },

  bold: {
    fontname: 'Liberation Sans',
    fontsize: 84,
    fontweight: true,
    primaryColor: '&H00FFFFFF', // White
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: 120,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Time Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert seconds to ASS time format: H:MM:SS.CC
 */
function toASSTime(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  let sec = Math.floor(s % 60);
  let cs = Math.round((s % 1) * 100);

  // Handle rounding overflow: cs can reach 100 when fractional part rounds up
  if (cs >= 100) {
    cs = 0;
    sec += 1;
  }

  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Color hex to ASS BGR format
 * Input: '#RRGGBB' or '0xRRGGBB'
 * Output: '&HAABBGGRR'
 */
function hexToASSColor(hex, alpha = 0) {
  // Remove # or 0x prefix
  let color = hex.replace(/^#|^0x/, '');

  // Ensure 6 character RGB
  if (color.length !== 6) {
    color = 'FFFFFF'; // Default to white
  }

  // Extract RGB
  const r = color.substring(4, 6);
  const g = color.substring(2, 4);
  const b = color.substring(0, 2);

  // Alpha: 00 = opaque, FF = transparent
  const a = String(Math.round(alpha * 255)).padStart(2, '0');

  return `&H${a}${b}${g}${r}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Positioning Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adjust caption alignment and marginV based on position setting and split-screen config.
 * ASS alignment values: 1-3 = bottom, 4-6 = middle, 7-9 = top (left/center/right)
 * MarginV: distance from the edge determined by alignment (bottom→from bottom, top→from top)
 */
function adjustPositioning(styleConfig, { position = 'bottom', canvasWidth = 1080, canvasHeight = 1920, splitScreen = null }) {
  const config = { ...styleConfig };

  // Scale font size proportionally to canvas (styles designed for 1080x1920)
  // Clamp to min 0.75 so captions remain readable in split-screen / small canvases
  const scaleFactor = Math.max(0.75, canvasHeight / 1920);
  config.fontsize = Math.round(config.fontsize * scaleFactor);

  // Convert numeric position (0-100, % from top) to ASS alignment + marginV
  // Also support legacy string values ('top', 'middle', 'bottom')
  const numericPos = typeof position === 'number' ? position
    : position === 'top' ? 8
    : position === 'middle' ? 42
    : 72; // 'bottom' default

  if (splitScreen && splitScreen.enabled && splitScreen.layout === 'top-bottom') {
    // Split-screen: clamp position within the top video portion
    const ratio = (splitScreen.ratio || 50) / 100;
    const clampedPct = Math.min(numericPos, (ratio * 100) - 6);
    config.alignment = 8; // top-center
    config.marginV = Math.round(canvasHeight * (clampedPct / 100));
  } else {
    // ── SIMPLE: always use \an8 (top-center), marginV = top offset ──
    // This matches CSS `top: X%` exactly — the TOP of the text sits at X% from top.
    // Previous approach used 3 zones (top/middle/bottom) with different alignments
    // which caused mismatches with the CSS preview.
    config.alignment = 8;
    config.marginV = Math.round(canvasHeight * (numericPos / 100));
  }

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASS File Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate complete ASS subtitle file with karaoke support
 *
 * @param {Array} wordTimestamps - [{word, start, end}, ...]
 * @param {Object} options - {style, clipStartTime, wordsPerLine, customColors, position, canvasWidth, canvasHeight, splitScreen}
 * @returns {string} ASS file content
 */
export function generateASS(wordTimestamps, options = {}) {
  const {
    style = 'hormozi',
    animation = 'highlight',
    clipStartTime = 0,
    wordsPerLine = 6,
    customColors = null,
    customImportantWords = [],
    emphasisEffect = 'none',
    position = 'bottom',
    canvasWidth = 1080,
    canvasHeight = 1920,
    splitScreen = null,
  } = options;

  // Get base style
  let styleConfig = CAPTION_STYLES[style] || CAPTION_STYLES.hormozi;

  // Apply custom colors if provided
  if (customColors) {
    styleConfig = {
      ...styleConfig,
      primaryColor: customColors.primaryColor || styleConfig.primaryColor,
      secondaryColor: customColors.secondaryColor || styleConfig.secondaryColor,
      fontsize: customColors.fontSize || styleConfig.fontsize,
    };
  }

  // Adjust positioning based on split-screen and position setting
  styleConfig = adjustPositioning(styleConfig, { position, canvasWidth, canvasHeight, splitScreen });

  // Generate ASS header with correct canvas dimensions
  const header = buildASSHeader(styleConfig, canvasWidth, canvasHeight);

  // All animations (including word-pop) now use ASS subtitles — no more drawtext filters.

  // Group words into lines
  const wordLines = groupWords(wordTimestamps, wordsPerLine);

  // Generate events (dialogue lines with karaoke timing or animated effects)
  // Modern viral style: no background box — text with thick stroke + drop shadow
  // handles contrast against any video background.
  const events = [];

  if (animation === 'word-pop') {
    // WORD-POP SPECIAL: process ALL words flat (not per-line) to avoid cross-line overlap.
    // Each word ends EXACTLY when the next starts — zero overlap, no minimum duration.
    // This prevents libass from stacking words vertically when speech is fast.
    const allWords = wordLines.flat().filter(Boolean);
    const an = styleConfig.alignment || 2;
    for (let i = 0; i < allWords.length; i++) {
      const w = allWords[i];
      const wordStart = Math.max(0, w.start - clipStartTime);
      // Word duration: natural end or next word start, but CAPPED at 1.5s
      // Without cap, sparse speech makes words linger on screen way too long
      const MAX_WORD_DISPLAY = 1.5; // seconds
      const naturalEnd = (i < allWords.length - 1)
        ? Math.max(0, allWords[i + 1].start - clipStartTime)
        : Math.max(wordStart + 0.3, w.end - clipStartTime);
      const wordEnd = Math.min(naturalEnd, wordStart + MAX_WORD_DISPLAY);

      const word = w.word.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
      const important = isImportantWord(w.word, customImportantWords);
      const overrides = important
        ? `{\\an${an}${getEmphasisASS(emphasisEffect)}}`
        : `{\\an${an}}`;
      events.push(
        `Dialogue: 0,${toASSTime(wordStart)},${toASSTime(wordEnd)},Default,,0,0,0,,${overrides}${word}`
      );
    }
  } else {
    for (const lineWords of wordLines) {
      if (!lineWords || lineWords.length === 0) continue;

      if (animation && animation !== 'highlight') {
        const lineEvents = generateAnimatedEvents(lineWords, clipStartTime, styleConfig, animation, customImportantWords);
        events.push(...lineEvents);
      } else {
        const event = generateKaraokeEvent(lineWords, clipStartTime, styleConfig);
        if (event) events.push(event);
      }
    }
  }

  return [header, ...events].join('\n');
}

/**
 * Build ASS file header with style definition
 * @param {Object} styleConfig - Style configuration
 * @param {number} canvasWidth - Actual video canvas width (default 1080)
 * @param {number} canvasHeight - Actual video canvas height (default 1920)
 */
function buildASSHeader(styleConfig, canvasWidth = 1080, canvasHeight = 1920) {
  const {
    fontname,
    fontsize,
    bold,
    italic,
    outline,
    shadow,
    primaryColor,
    secondaryColor,
    outlineColor,
    backColor,
    alignment,
    marginV,
    borderStyle = 1, // 1 = outline+shadow, 3 = opaque box
  } = styleConfig;

  return `[Script Info]
Title: Viral Studio Pro Captions
ScriptType: v4.00+
PlayResX: ${canvasWidth}
PlayResY: ${canvasHeight}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${fontname},${fontsize},${primaryColor},${secondaryColor},${outlineColor},${backColor},${bold},${italic},0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},20,20,${marginV},1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;
}

/**
 * Group words into lines of N words each
 */
function groupWords(words, wordsPerLine) {
  const lines = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine));
  }
  return lines;
}

/**
 * Generate a single dialogue event with karaoke timing
 */
function generateKaraokeEvent(lineWords, clipStartTime, styleConfig) {
  if (!lineWords || lineWords.length === 0) return null;

  const firstWord = lineWords[0];
  const lastWord = lineWords[lineWords.length - 1];

  const lineStart = Math.max(0, firstWord.start - clipStartTime);
  const lineEnd = Math.max(lineStart + 0.1, lastWord.end - clipStartTime);

  // Build karaoke text with \kf tags (fill effect)
  const karaokeText = lineWords
    .map((word) => {
      // Duration in centiseconds
      const durationCs = Math.max(1, Math.round((word.end - word.start) * 100));
      return `{\\kf${durationCs}}${word.word}`;
    })
    .join(' ');

  return `Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,${karaokeText}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate dialogue events with animation effects.
 *
 * @param {Array} wordTimestamps - [{word, start, end}, ...]
 * @param {Object} options - {animation, style, clipStartTime, wordsPerLine, customColors}
 * @returns {string} ASS file content
 *
 * Supported animations:
 * - "highlight" — default karaoke word-by-word fill (\\kf)
 * - "pop"       — each word scales up from 0 to 120% then to 100%
 * - "bounce"    — words drop from above with easing (Y translation)
 * - "shake"     — text trembles on exclamation/CAPS words
 * - "typewriter" — letters appear one by one
 * - "glow"      — active words pulse with outline glow
 */
export function generateAnimatedASS(wordTimestamps, options = {}) {
  const {
    animation = 'highlight',
    style = 'hormozi',
    clipStartTime = 0,
    wordsPerLine = 6,
    customColors = null,
  } = options;

  // Default highlight = standard karaoke
  if (animation === 'highlight') {
    return generateASS(wordTimestamps, { style, clipStartTime, wordsPerLine, customColors });
  }

  let styleConfig = CAPTION_STYLES[style] || CAPTION_STYLES.hormozi;
  if (customColors) {
    styleConfig = {
      ...styleConfig,
      primaryColor: customColors.primaryColor || styleConfig.primaryColor,
      secondaryColor: customColors.secondaryColor || styleConfig.secondaryColor,
      fontsize: customColors.fontSize || styleConfig.fontsize,
    };
  }

  const header = buildASSHeader(styleConfig);
  const wordLines = groupWords(wordTimestamps, wordsPerLine);
  const events = [];

  for (const lineWords of wordLines) {
    const lineEvents = generateAnimatedEvents(lineWords, clipStartTime, styleConfig, animation, []);
    events.push(...lineEvents);
  }

  return [header, ...events].join('\n');
}

/**
 * Generate animated dialogue events for a single line of words.
 */
function generateAnimatedEvents(lineWords, clipStartTime, styleConfig, animation, customImportantWords = []) {
  if (!lineWords || lineWords.length === 0) return [];

  const firstWord = lineWords[0];
  const lastWord = lineWords[lineWords.length - 1];
  const lineStart = Math.max(0, firstWord.start - clipStartTime);
  const lineEnd = Math.max(lineStart + 0.1, lastWord.end - clipStartTime);

  switch (animation) {
    case 'word-pop':
      return generateWordPopEvents(lineWords, clipStartTime, lineStart, lineEnd, customImportantWords, styleConfig.alignment || 2);
    case 'pop':
      return generatePopEvents(lineWords, clipStartTime, lineStart, lineEnd);
    case 'bounce':
      return generateBounceEvents(lineWords, clipStartTime, lineStart, lineEnd);
    case 'shake':
      return generateShakeEvents(lineWords, clipStartTime, lineStart, lineEnd);
    case 'typewriter':
      return generateTypewriterEvents(lineWords, clipStartTime, lineStart, lineEnd);
    case 'glow':
      return generateGlowEvents(lineWords, clipStartTime, lineStart, lineEnd, styleConfig);
    default:
      // Fallback to standard karaoke
      return [generateKaraokeEvent(lineWords, clipStartTime, styleConfig)].filter(Boolean);
  }
}

/**
 * Helper: build a karaoke word chain with optional line-level prefix transforms.
 */
function buildKaraokeWordChain(lineWords) {
  return lineWords
    .map((w) => {
      const durationCs = Math.max(1, Math.round((w.end - w.start) * 100));
      return `{\\kf${durationCs}}${w.word}`;
    })
    .join(' ');
}

/**
 * Helper: build a repeating \\t transform sequence over [0, lineDurCs] centiseconds.
 * cycleLenCs: duration of ONE full cycle in centiseconds
 * builder(t0, t1, half): returns a string of tags for a single half-cycle
 */
function buildLoopedTransforms(lineDurCs, cycleLenCs, builder) {
  const half = Math.max(1, Math.round(cycleLenCs / 2));
  const tags = [];
  let t = 0;
  let toggle = 0;
  while (t < lineDurCs) {
    const t1 = Math.min(t + half, lineDurCs);
    tags.push(builder(t, t1, toggle));
    toggle = 1 - toggle;
    t = t1;
  }
  return tags.join('');
}

/**
 * Detect if a word is "important" (should be emphasized in red).
 * Heuristics:
 * - ALL CAPS words (3+ letters): "CRAZY", "OMG", "WTF"
 * - Words with exclamation marks
 * - Common hype/viral trigger words
 */
const IMPORTANT_WORDS = new Set([
  'crazy', 'insane', 'omg', 'wtf', 'bruh', 'fire', 'goat', 'goated',
  'clutch', 'cracked', 'broken', 'destroyed', 'killed', 'dead', 'no way',
  'impossible', 'legendary', 'epic', 'massive', 'unreal', 'sick', 'nuts',
  'wild', 'lit', 'god', 'godlike', 'demon', 'monster', 'insane',
  'million', 'money', 'free', 'secret', 'hack', 'exposed', 'banned',
  'never', 'always', 'best', 'worst', 'first', 'last', 'only',
]);

/**
 * Convert emphasisEffect name to ASS override tags for important words.
 * Effects: scale (bigger), color (red), bounce (Y shift), glow (border glow), none (red+scale default)
 */
function getEmphasisASS(effect) {
  switch (effect) {
    case 'scale':
      // 140% scale + yellow color
      return '\\fscx140\\fscy140\\c&H00FFFF&';
    case 'color':
      // Red color, normal size
      return '\\c&H0000FF&';
    case 'bounce':
      // 130% scale + orange color + slight Y shift
      return '\\fscx130\\fscy130\\c&H0080FF&\\shad3';
    case 'glow':
      // Normal size + glow border effect (thick outline + bright color)
      return '\\c&H00FF00&\\bord4\\3c&H00FF80&';
    case 'none':
    default:
      // Default: red + 120% (legacy behavior)
      return '\\c&H000000FF&\\fscx120\\fscy120';
  }
}

function isImportantWord(rawWord, customWords = []) {
  const clean = rawWord.replace(/[^a-zA-Z]/g, '');
  if (clean.length === 0) return false;
  // ALL CAPS (3+ letters)
  if (clean.length >= 3 && clean === clean.toUpperCase()) return true;
  // Exclamation mark
  if (rawWord.includes('!')) return true;
  // Known hype words
  if (IMPORTANT_WORDS.has(clean.toLowerCase())) return true;
  // User-defined custom important words
  if (customWords.length > 0 && customWords.includes(clean.toLowerCase())) return true;
  return false;
}

/**
 * Word-Pop animation: words appear one by one, centered on screen.
 *
 * Strategy: ONE separate Dialogue event per word with precise start/end timing.
 * Each word is visible only during its own time window — no \t transforms,
 * no per-word override blocks. This avoids libass memory corruption that
 * caused SIGABRT/SIGSEGV on Railway with complex \t chains.
 *
 * Important words render in RED and at 120% scale for emphasis.
 * Uses \an5 (middle-center) alignment so each word appears alone, centered.
 */
function generateWordPopEvents(lineWords, clipStartTime, lineStart, lineEnd, customImportantWords = [], alignment = 2) {
  if (!lineWords || lineWords.length === 0) return [];

  // NOTE: This is called per-line, but we need strict non-overlapping timing.
  // Each word shows from its start until the NEXT word's start (no overlap).
  // The last word shows until lineEnd.
  const events = [];
  const an = alignment;

  for (let i = 0; i < lineWords.length; i++) {
    const w = lineWords[i];
    const wordStart = Math.max(0, w.start - clipStartTime);
    const nextStart = (i < lineWords.length - 1)
      ? Math.max(0, lineWords[i + 1].start - clipStartTime)
      : lineEnd;
    // Cap word display at 1.5s so sparse speech doesn't linger on screen
    const MAX_WORD_DISPLAY = 1.5;
    const wordEnd = Math.min(lineEnd, Math.min(wordStart + MAX_WORD_DISPLAY, Math.max(wordStart + 0.05, nextStart)));

    const word = w.word.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
    const important = isImportantWord(w.word, customImportantWords);

    const overrides = important
      ? `{\\an${an}\\c&H000000FF&\\fscx120\\fscy120}`
      : `{\\an${an}}`;

    events.push(
      `Dialogue: 0,${toASSTime(wordStart)},${toASSTime(wordEnd)},Default,,0,0,0,,${overrides}${word}`
    );
  }

  return events;
}

/**
 * Pop animation: whole line pulses opacity 100% → 50% → 100% every 2s (matches
 * Tailwind `animate-pulse` in UI preview).
 */
function generatePopEvents(lineWords, clipStartTime, lineStart, lineEnd) {
  const lineDurCs = Math.max(1, Math.round((lineEnd - lineStart) * 100));
  // 2s cycle = 200cs. Pulse alpha + scale for strong visual "pop".
  const transforms = buildLoopedTransforms(lineDurCs, 200, (t0, t1, toggle) => {
    const targetAlpha = toggle === 0 ? 'A0' : '00'; // more dramatic: 37% ↔ 100%
    const scale = toggle === 0 ? 92 : 108; // slight scale pulse
    return `\\t(${t0},${t1},\\alpha&H${targetAlpha}&\\fscx${scale}\\fscy${scale})`;
  });
  const karaoke = buildKaraokeWordChain(lineWords);
  return [`Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,{${transforms}}${karaoke}`];
}

/**
 * Bounce animation: whole line bounces vertically (matches Tailwind
 * `animate-bounce` in UI: translateY(-25%) with ease-out, 1s cycle).
 * In ASS we simulate by pulsing Y scale up and down slightly.
 */
function generateBounceEvents(lineWords, clipStartTime, lineStart, lineEnd) {
  const lineDurCs = Math.max(1, Math.round((lineEnd - lineStart) * 100));
  // 1s cycle = 100cs. Squash-stretch: (fscy up + fscx down) ↔ (fscy down + fscx up)
  // This produces a visually obvious "bouncing" deformation.
  const transforms = buildLoopedTransforms(lineDurCs, 100, (t0, t1, toggle) => {
    const scaleY = toggle === 0 ? 130 : 90;
    const scaleX = toggle === 0 ? 88 : 110;
    return `\\t(${t0},${t1},\\fscx${scaleX}\\fscy${scaleY})`;
  });
  const karaoke = buildKaraokeWordChain(lineWords);
  return [`Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,{${transforms}}${karaoke}`];
}

/**
 * Shake animation: text trembles on exclamation/CAPS words
 */
function generateShakeEvents(lineWords, clipStartTime, lineStart, lineEnd) {
  const text = lineWords.map((w) => {
    const durationCs = Math.max(1, Math.round((w.end - w.start) * 100));
    const isExclamation = w.word.includes('!') || w.word === w.word.toUpperCase() && w.word.length > 2;
    if (isExclamation) {
      // Rapid small rotations for shake effect
      const wordStart = Math.max(0, w.start - clipStartTime);
      const relOffset = Math.round((wordStart - lineStart) * 100);
      return `{\\t(${relOffset},${relOffset + 5},\\frz3)\\t(${relOffset + 5},${relOffset + 10},\\frz-3)\\t(${relOffset + 10},${relOffset + 15},\\frz2)\\t(${relOffset + 15},${relOffset + 20},\\frz0)\\kf${durationCs}}${w.word}`;
    }
    return `{\\kf${durationCs}}${w.word}`;
  }).join(' ');

  return [`Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,${text}`];
}

/**
 * Typewriter animation: text appears character by character
 */
function generateTypewriterEvents(lineWords, clipStartTime, lineStart, lineEnd) {
  // Build the full line text
  const fullText = lineWords.map((w) => w.word).join(' ');
  const totalChars = fullText.length;
  const lineDuration = lineEnd - lineStart;

  if (totalChars === 0) return [];

  // Each character appears at even intervals
  const charDuration = (lineDuration / totalChars) * 100; // in centiseconds

  let charIndex = 0;
  const text = lineWords.map((w) => {
    const chars = w.word.split('').map((ch) => {
      const showAt = Math.round(charIndex * charDuration);
      charIndex++;
      return `{\\alphaFF\\t(${showAt},${showAt + 1},\\alpha00)}${ch}`;
    }).join('');
    charIndex++; // account for space
    return chars;
  }).join(' ');

  return [`Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,${text}`];
}

/**
 * Glow animation: whole line pulses opacity + border width, 1.5s cycle
 * (matches Tailwind `animate-pulse` 1.5s + glow shadow in UI preview).
 */
function generateGlowEvents(lineWords, clipStartTime, lineStart, lineEnd, styleConfig) {
  const lineDurCs = Math.max(1, Math.round((lineEnd - lineStart) * 100));
  const baseBord = styleConfig.outline || 20;
  const glowBord = Math.round(baseBord * 1.8); // more dramatic glow pulse
  // 1.5s cycle = 150cs
  const transforms = buildLoopedTransforms(lineDurCs, 150, (t0, t1, toggle) => {
    const targetAlpha = toggle === 0 ? '70' : '00';
    const targetBord = toggle === 0 ? glowBord : baseBord;
    return `\\t(${t0},${t1},\\alpha&H${targetAlpha}&\\bord${targetBord})`;
  });
  const karaoke = buildKaraokeWordChain(lineWords);
  return [`Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,{${transforms}}${karaoke}`];
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List available caption styles
 */
export function getAvailableStyles() {
  return Object.keys(CAPTION_STYLES);
}

/**
 * Get configuration for a specific style
 */
export function getStyleConfig(styleName) {
  return CAPTION_STYLES[styleName] || CAPTION_STYLES.hormozi;
}

/**
 * Apply custom color to a style
 */
export function applyCustomColors(styleName, colors = {}) {
  const baseStyle = getStyleConfig(styleName);

  const customized = {
    ...baseStyle,
    primaryColor: colors.primaryColor ? hexToASSColor(colors.primaryColor) : baseStyle.primaryColor,
    secondaryColor: colors.secondaryColor ? hexToASSColor(colors.secondaryColor) : baseStyle.secondaryColor,
    outlineColor: colors.outlineColor ? hexToASSColor(colors.outlineColor) : baseStyle.outlineColor,
    backColor: colors.backColor ? hexToASSColor(colors.backColor, 0.5) : baseStyle.backColor,
    fontsize: colors.fontSize || baseStyle.fontsize,
  };

  return customized;
}

/**
 * Validate word timestamps array
 */
export function validateWordTimestamps(words) {
  if (!Array.isArray(words)) {
    throw new Error('Word timestamps must be an array');
  }

  for (const word of words) {
    if (!word.word || typeof word.start !== 'number' || typeof word.end !== 'number') {
      throw new Error('Each word must have: word (string), start (number), end (number)');
    }

    // Auto-fix zero-duration or reversed timings (Whisper sometimes returns start == end).
    // Give the word a minimum duration of 80ms so subtitle rendering still works.
    if (word.end <= word.start) {
      word.end = word.start + 0.08;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static Captions (for clips without transcription/word timestamps)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate ASS subtitles from a plain text string (no word timestamps needed).
 * Splits text into lines and distributes them evenly across the clip duration.
 * Used for trending clips that don't have Whisper transcription.
 *
 * @param {string} text - The text to display (e.g. clip title)
 * @param {number} duration - Clip duration in seconds
 * @param {Object} options - {style, wordsPerLine}
 * @returns {string} ASS file content
 */
export function generateStaticASS(text, duration, options = {}) {
  const {
    style = 'hormozi',
    animation = 'highlight',
    wordsPerLine = 4,
    position = 'bottom',
    canvasWidth = 1080,
    canvasHeight = 1920,
    splitScreen = null,
  } = options;

  if (!text || !duration || duration <= 0) return '';

  let styleConfig = CAPTION_STYLES[style] || CAPTION_STYLES.hormozi;
  styleConfig = adjustPositioning(styleConfig, { position, canvasWidth, canvasHeight, splitScreen });
  const header = buildASSHeader(styleConfig, canvasWidth, canvasHeight);

  // Split text into words
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';

  const an = styleConfig.alignment || 2;

  // ── Word-pop mode: show one word at a time, evenly distributed ──
  if (animation === 'word-pop') {
    const events = [];
    // Estimate ~0.4s per word for natural reading speed, cap to fit duration
    const wordDuration = Math.min(1.2, Math.max(0.3, duration / words.length));
    // Center the words in the clip duration
    const totalWordsTime = wordDuration * words.length;
    const startOffset = Math.max(0, (duration - totalWordsTime) / 2);

    for (let i = 0; i < words.length; i++) {
      const wordStart = startOffset + i * wordDuration;
      const wordEnd = Math.min(wordStart + wordDuration, duration);
      const word = words[i].toUpperCase();
      events.push(`Dialogue: 0,${toASSTime(wordStart)},${toASSTime(wordEnd)},Default,,0,0,0,,{\\an${an}}${word}`);
    }
    return [header, ...events].join('\n');
  }

  // ── Default: group into lines and show sequentially ──
  const lines = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(' '));
  }

  // Distribute lines evenly across the clip duration
  const lineDuration = Math.max(1.5, duration / lines.length);
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const start = i * lineDuration;
    const end = Math.min(start + lineDuration, duration);
    const lineText = lines[i].toUpperCase(); // Uppercase for viral style
    events.push(`Dialogue: 0,${toASSTime(start)},${toASSTime(end)},Default,,0,0,0,,${lineText}`);
  }

  return [header, ...events].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Example Usage Comment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Example usage:
 *
 * const wordTimestamps = [
 *   { word: 'Hello', start: 0.5, end: 1.2 },
 *   { word: 'world', start: 1.3, end: 2.0 },
 * ];
 *
 * const assContent = generateASS(wordTimestamps, {
 *   style: 'hormozi',
 *   clipStartTime: 0,
 *   wordsPerLine: 6,
 * });
 *
 * // Write to file:
 * fs.writeFileSync('captions.ass', assContent, 'utf-8');
 */
