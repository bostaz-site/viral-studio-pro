/**
 * ASS subtitle file generator for Viral Animal
 *
 * R2 (2026-09) — calibrated on the open-source consensus (OpenShorts A/B tests,
 * AutoShorts): ~105 px fonts on 1080x1920, ONE Dialogue event PER WORD (active
 * word colored + 90→108 % pop in 110 ms), grouping by characters (16) + duration
 * (1.4 s) + max 2 lines, uppercase everywhere, bottom alignment with MarginV 15 % H.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants (single source of truth — route + lib + export endpoint)
// ─────────────────────────────────────────────────────────────────────────────

/** Grouping rules (OpenShorts / AutoShorts consensus) */
export const CAPTION_GROUPING = {
  maxCharsPerGroup: 16,   // per line — a word longer than this stays alone
  maxGroupDuration: 1.4,  // seconds — a group never spans more than this
  maxLines: 2,            // lines per group
  maxSilenceGap: 1.0,     // seconds — a silence longer than this starts a new group
};

/**
 * Legacy "words per line" default. Kept ONLY as a soft hint (caps words per
 * line on top of the character rule). Undefined = no hint.
 */
export const DEFAULT_WORDS_PER_LINE = undefined;

/** Active-word pop: 90 → 108 % in 110 ms (OpenShorts A/B: 75→112 "read like a bug") */
const POP_FROM = 90;
const POP_TO = 108;
const POP_MS = 110;

/** Tail kept on screen after the last word of a group (seconds) */
const GROUP_TAIL_S = 0.2;

/** Yellow #FFE500 in ASS BGR — nearly absent from gaming/IRL footage */
const ACTIVE_YELLOW = '&H0000E5FF';

// ─────────────────────────────────────────────────────────────────────────────
// Style Definitions
// ─────────────────────────────────────────────────────────────────────────────

// Modern viral caption styles:
// No background box — thick black outline around each letter (+ optional drop shadow).
// primaryColor  = INACTIVE words (whole group displayed)
// activeColor   = the word currently spoken (\c override + pop)
// secondaryColor = only used by the legacy `karaoke-wipe` (\kf) technique
// Sizes are designed for 1080x1920 and scaled by adjustPositioning().
// alignment/marginV = the style's "bottom" position (2 = bottom-center, MarginV 15 % H).
const BOTTOM_MARGIN_V = 288; // 15 % of 1920
const CAPTION_STYLES = {
  hormozi: {
    fontname: 'Inter',
    fontsize: 105,
    fontweight: true,
    primaryColor: '&H00FFFFFF', // white (inactive words)
    activeColor: ACTIVE_YELLOW, // yellow #FFE500 (active word)
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000', // Opaque black stroke around letters
    backColor: '&H80000000', // Shadow: 50% opaque black
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1, // 1 = outline+shadow (NOT opaque box)
    alignment: 2, // Bottom center
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  // Same mechanics as hormozi but the ACTIVE word pops in neon purple to match
  // the viral-glow tag/hook overlays. Purple tone: #C77DFF → ASS BGR = FF7DC7
  'hormozi-purple': {
    fontname: 'Inter',
    fontsize: 105,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: '&H00FF7DC7',
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  // Anton (Google Fonts, OFL) — the open-source consensus font for shorts.
  anton: {
    fontname: 'Anton',
    fontsize: 105,
    fontweight: false,
    primaryColor: '&H00FFFFFF',
    activeColor: ACTIVE_YELLOW,
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: 0, // Anton has a single (heavy) weight — no synthetic bold
    italic: 0,
    outline: 4,
    shadow: 0,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  mrbeast: {
    fontname: 'Montserrat',
    fontsize: 110,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: '&H004444EF', // red-500 (active word)
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  neon: {
    fontname: 'Poppins',
    fontsize: 100,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: '&H0080DE4A', // green-400
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  minimal: {
    fontname: 'Poppins',
    fontsize: 80,
    fontweight: 0,
    primaryColor: '&H00FFFFFF',
    activeColor: ACTIVE_YELLOW,
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: 0,
    italic: 0,
    outline: 5,
    shadow: 1,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: false,
  },

  impact: {
    fontname: 'Montserrat',
    fontsize: 105,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: '&H000000FF', // Red
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  aliabdaal: {
    fontname: 'Lora',
    fontsize: 95,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: '&H00FDC593', // blue-300
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 1,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: false,
  },

  imangadzhi: {
    fontname: 'Montserrat',
    fontsize: 110,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: '&H0000D4FF', // Gold
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  // Word-pop: single-word-at-a-time display needs a larger font.
  'word-pop': {
    fontname: 'Inter',
    fontsize: 120,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: ACTIVE_YELLOW,
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  default: {
    fontname: 'Inter',
    fontsize: 100,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: ACTIVE_YELLOW,
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  bold: {
    fontname: 'Montserrat',
    fontsize: 105,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: ACTIVE_YELLOW,
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 6,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
  },

  // Legacy technique: cumulative \kf karaoke wipe (words swept stay colored).
  // Kept ONLY for this explicit style — every other style uses per-word events.
  'karaoke-wipe': {
    fontname: 'Inter',
    fontsize: 105,
    fontweight: true,
    primaryColor: '&H00FFFFFF',
    activeColor: ACTIVE_YELLOW,
    secondaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    backColor: '&H80000000',
    bold: -1,
    italic: 0,
    outline: 5,
    shadow: 2,
    borderStyle: 1,
    alignment: 2,
    marginV: BOTTOM_MARGIN_V,
    uppercase: true,
    technique: 'kf',
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

/**
 * Normalise an ASS color to the inline override form `&HBBGGRR&`
 * (strips the alpha byte of a `&HAABBGGRR` style color).
 */
function toInlineColor(assColor) {
  if (!assColor) return '&HFFFFFF&';
  let c = String(assColor).replace(/^&H/i, '').replace(/&$/, '');
  if (c.length === 8) c = c.substring(2);
  return `&H${c}&`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Positioning Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adjust caption alignment and marginV based on position setting.
 * ASS alignment values: 1-3 = bottom, 4-6 = middle, 7-9 = top (left/center/right)
 * MarginV: distance from the edge determined by alignment (bottom→from bottom, top→from top)
 *
 * String positions respect the per-style alignment/marginV:
 *   'bottom' → style alignment (2) + style marginV (15 % H)
 *   'middle' → alignment 5 (MarginV ignored by libass)
 *   'top'    → alignment 8 + MarginV 8 % H
 * Numeric positions (0-100, % from top — the UI slider) keep the "top of the
 * text sits at X %" semantic for single lines but anchor to the nearest edge so
 * multi-line groups grow AWAY from the TikTok UI (never into the dead zone):
 *   < 35   → alignment 8, MarginV = X % H
 *   35-55  → alignment 5 (centered)
 *   > 55   → alignment 2, MarginV = (100-X) % H − one line height
 */
function adjustPositioning(styleConfig, { position = 'bottom', canvasWidth = 1080, canvasHeight = 1920 }) {
  const config = { ...styleConfig };

  // Scale font size proportionally to canvas (styles designed for 1080x1920)
  // Clamp to min 0.75 so captions remain readable in small canvases
  const scaleFactor = Math.max(0.75, canvasHeight / 1920);
  config.fontsize = Math.round(config.fontsize * scaleFactor);
  const lineHeight = Math.round(config.fontsize * 1.3);

  if (typeof position === 'number' && Number.isFinite(position)) {
    const pos = Math.min(100, Math.max(0, position));
    if (pos < 35) {
      config.alignment = 8;
      config.marginV = Math.round(canvasHeight * (pos / 100));
    } else if (pos <= 55) {
      config.alignment = 5;
      config.marginV = 0;
    } else {
      config.alignment = 2;
      config.marginV = Math.max(40, Math.round(canvasHeight * (1 - pos / 100)) - lineHeight);
    }
    return config;
  }

  if (position === 'top') {
    config.alignment = 8;
    config.marginV = Math.round(canvasHeight * 0.08);
  } else if (position === 'middle') {
    config.alignment = 5;
    config.marginV = 0;
  } else {
    // 'bottom' (default) — respect the style's own alignment / marginV, scaled to canvas
    config.alignment = styleConfig.alignment || 2;
    config.marginV = Math.round((styleConfig.marginV || BOTTOM_MARGIN_V) * (canvasHeight / 1920));
  }

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeASS(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

function displayWord(w, uppercase) {
  const raw = String(w.word ?? '').trim();
  return escapeASS(uppercase ? raw.toUpperCase() : raw);
}

/**
 * Resolve the effective style config: base style → customColors → positioning → diversify.
 */
function resolveStyleConfig(style, { customColors, position, canvasWidth, canvasHeight, diversify }) {
  let styleConfig = CAPTION_STYLES[style] || CAPTION_STYLES.hormozi;

  // Apply custom colors if provided
  // primaryColor (legacy meaning: active) → activeColor ; secondaryColor (inactive) → primaryColor
  if (customColors) {
    styleConfig = {
      ...styleConfig,
      activeColor: customColors.activeColor || customColors.primaryColor || styleConfig.activeColor,
      primaryColor: customColors.secondaryColor || styleConfig.primaryColor,
      fontsize: customColors.fontSize || styleConfig.fontsize,
    };
  }

  styleConfig = adjustPositioning(styleConfig, { position, canvasWidth, canvasHeight });

  // Diversify: micro-adjust marginV (±3%), fontsize (±6%), accent color (applied on top)
  if (diversify) {
    if (diversify.captionMarginVPct && styleConfig.alignment !== 5) {
      styleConfig = { ...styleConfig, marginV: Math.round(styleConfig.marginV * (1 + diversify.captionMarginVPct / 100)) };
    }
    if (diversify.captionSizePct) {
      styleConfig = { ...styleConfig, fontsize: Math.round(styleConfig.fontsize * (1 + diversify.captionSizePct / 100)) };
    }
    if (diversify.accentColor && !customColors) {
      styleConfig = { ...styleConfig, activeColor: diversify.accentColor };
    }
  }

  return styleConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASS File Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate complete ASS subtitle file with per-word highlight events.
 *
 * @param {Array} wordTimestamps - [{word, start, end}, ...]
 * @param {Object} options - {style, animation, clipStartTime, wordsPerLine (legacy hint),
 *   maxCharsPerGroup, maxGroupDuration, uppercase, customColors, customImportantWords,
 *   emphasisEffect, emphasisColor, position, canvasWidth, canvasHeight, diversify}
 * @returns {string} ASS file content
 */
export function generateASS(wordTimestamps, options = {}) {
  const {
    style = 'hormozi',
    animation = 'highlight',
    clipStartTime = 0,
    wordsPerLine = DEFAULT_WORDS_PER_LINE,
    maxCharsPerGroup = CAPTION_GROUPING.maxCharsPerGroup,
    maxGroupDuration = CAPTION_GROUPING.maxGroupDuration,
    customColors = null,
    customImportantWords = [],
    emphasisEffect = 'none',
    emphasisColor = 'red',
    position = 'bottom',
    canvasWidth = 1080,
    canvasHeight = 1920,
    diversify = null,
    uppercase,
    // splitScreen is accepted but ignored (permanently removed)
  } = options;

  const styleConfig = resolveStyleConfig(style, { customColors, position, canvasWidth, canvasHeight, diversify });
  const upper = typeof uppercase === 'boolean' ? uppercase : styleConfig.uppercase !== false;
  const useKf = styleConfig.technique === 'kf';

  // Generate ASS header with correct canvas dimensions
  const header = buildASSHeader(styleConfig, canvasWidth, canvasHeight, { karaokeWipe: useKf });

  // Group words (characters + duration + max lines; wordsPerLine = soft hint)
  const groups = groupWords(wordTimestamps, { maxCharsPerGroup, maxGroupDuration, wordsPerLineHint: wordsPerLine });

  const ctx = {
    clipStartTime,
    styleConfig,
    uppercase: upper,
    customImportantWords,
    emphasisEffect,
    emphasisColor,
  };

  const events = [];

  if (animation === 'word-pop') {
    // WORD-POP SPECIAL: process ALL words flat (not per-group) to avoid cross-group overlap.
    // Each word ends EXACTLY when the next starts — zero overlap, no minimum duration.
    const allWords = groups.flat().filter(Boolean);
    const an = styleConfig.alignment || 2;
    for (let i = 0; i < allWords.length; i++) {
      const w = allWords[i];
      const wordStart = Math.max(0, w.start - clipStartTime);
      // Word duration: natural end or next word start, but CAPPED at 1.5s
      const MAX_WORD_DISPLAY = 1.5; // seconds
      const naturalEnd = (i < allWords.length - 1)
        ? Math.max(0, allWords[i + 1].start - clipStartTime)
        : Math.max(wordStart + 0.3, w.end - clipStartTime);
      const wordEnd = Math.min(naturalEnd, wordStart + MAX_WORD_DISPLAY);

      const word = displayWord(w, upper);
      const important = isImportantWord(w.word, customImportantWords);
      const overrides = important
        ? `{\\an${an}${getEmphasisASS(emphasisEffect, emphasisColor)}}`
        : `{\\an${an}}`;
      events.push(
        `Dialogue: 0,${toASSTime(wordStart)},${toASSTime(wordEnd)},Default,,0,0,0,,${overrides}${word}`
      );
    }
  } else {
    for (let g = 0; g < groups.length; g++) {
      const groupWordsArr = groups[g];
      if (!groupWordsArr || groupWordsArr.length === 0) continue;
      const nextGroupStart = g < groups.length - 1 ? groups[g + 1][0].start : null;

      if (useKf) {
        const event = generateKaraokeEvent(groupWordsArr, clipStartTime, styleConfig, upper);
        if (event) events.push(event);
      } else if (animation && animation !== 'highlight') {
        events.push(...generateAnimatedEvents(groupWordsArr, ctx, animation, nextGroupStart));
      } else {
        events.push(...generatePerWordEvents(groupWordsArr, ctx, nextGroupStart));
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
 * @param {Object} opts - { karaokeWipe } → PrimaryColour = activeColor (\kf fills Secondary → Primary)
 */
function buildASSHeader(styleConfig, canvasWidth = 1080, canvasHeight = 1920, opts = {}) {
  const {
    fontname,
    fontsize,
    bold,
    italic,
    outline,
    shadow,
    primaryColor,
    secondaryColor,
    activeColor,
    outlineColor,
    backColor,
    alignment,
    marginV,
    borderStyle = 1, // 1 = outline+shadow, 3 = opaque box
  } = styleConfig;

  const primary = opts.karaokeWipe ? (activeColor || primaryColor) : primaryColor;
  const secondary = opts.karaokeWipe ? primaryColor : secondaryColor;

  return `[Script Info]
Title: Viral Animal Captions
ScriptType: v4.00+
PlayResX: ${canvasWidth}
PlayResY: ${canvasHeight}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${fontname},${fontsize},${primary},${secondary},${outlineColor},${backColor},${bold},${italic},0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},40,40,${marginV},1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group words into caption groups (max 2 lines each).
 * Rules: ≤ maxCharsPerGroup characters per line, ≤ maxGroupDuration seconds per
 * group, ≤ maxLines lines, new group after a silence > maxSilenceGap.
 * A word longer than maxCharsPerGroup stays alone.
 * `wordsPerLineHint` (legacy slider) caps words per line; hint ≤ 1 → single line.
 *
 * Returns an array of groups; each group is an array of word objects (copies)
 * where `lineBreakAfter: true` marks the end of a line inside the group.
 */
export function groupWords(words, opts = {}) {
  const {
    maxCharsPerGroup = CAPTION_GROUPING.maxCharsPerGroup,
    maxGroupDuration = CAPTION_GROUPING.maxGroupDuration,
    maxSilenceGap = CAPTION_GROUPING.maxSilenceGap,
    wordsPerLineHint,
  } = typeof opts === 'number' ? { wordsPerLineHint: opts } : opts;

  const hint = Number.isFinite(wordsPerLineHint) && wordsPerLineHint > 0 ? Math.floor(wordsPerLineHint) : null;
  const maxLines = hint !== null && hint <= 1 ? 1 : CAPTION_GROUPING.maxLines;

  const groups = [];
  let group = [];
  let lines = 1;
  let lineChars = 0;
  let lineWords = 0;
  let groupStart = 0;

  const closeGroup = () => {
    if (group.length > 0) groups.push(group);
    group = [];
    lines = 1;
    lineChars = 0;
    lineWords = 0;
  };

  for (const raw of words || []) {
    if (!raw || typeof raw.word !== 'string') continue;
    const text = raw.word.trim();
    if (!text) continue;
    const w = { ...raw, word: text };
    const len = text.length;

    if (group.length > 0) {
      const prev = group[group.length - 1];
      const exceedsDuration = (w.end - groupStart) > maxGroupDuration;
      const longSilence = (w.start - prev.end) > maxSilenceGap;
      const prevTooLong = prev.word.length > maxCharsPerGroup; // long word stays alone
      if (exceedsDuration || longSilence || prevTooLong || len > maxCharsPerGroup) {
        closeGroup();
      }
    }

    if (group.length === 0) {
      group.push(w);
      groupStart = w.start;
      lineChars = len;
      lineWords = 1;
      continue;
    }

    const fitsChars = lineChars + 1 + len <= maxCharsPerGroup;
    const fitsHint = hint === null || lineWords < hint;
    if (fitsChars && fitsHint) {
      group.push(w);
      lineChars += 1 + len;
      lineWords += 1;
    } else if (lines < maxLines) {
      group[group.length - 1].lineBreakAfter = true;
      group.push(w);
      lines += 1;
      lineChars = len;
      lineWords = 1;
    } else {
      closeGroup();
      group.push(w);
      groupStart = w.start;
      lineChars = len;
      lineWords = 1;
    }
  }
  closeGroup();
  return groups;
}

/**
 * Compute per-word time windows for a group: start = word.start, end = next
 * word start (last word: word.end + tail, capped by next group start).
 * Guarantees no gaps and no overlaps inside the group.
 */
function wordWindows(groupWordsArr, clipStartTime, nextGroupStart) {
  const windows = [];
  for (let i = 0; i < groupWordsArr.length; i++) {
    const w = groupWordsArr[i];
    const start = Math.max(0, w.start - clipStartTime);
    let end;
    if (i < groupWordsArr.length - 1) {
      end = Math.max(0, groupWordsArr[i + 1].start - clipStartTime);
    } else {
      end = Math.max(0, w.end - clipStartTime) + GROUP_TAIL_S;
      if (nextGroupStart !== null && nextGroupStart !== undefined) {
        end = Math.min(end, Math.max(0, nextGroupStart - clipStartTime));
      }
    }
    end = Math.max(start + 0.05, end);
    windows.push({ start, end });
  }
  return windows;
}

/**
 * Build the text of a group with the active word highlighted.
 * Inactive words stay in PrimaryColour; the active word gets `\c` + pop
 * (90 → 108 % in 110 ms) then `\r`. Important words (when active) get the
 * emphasis color/effect instead (108-112 %).
 */
function buildGroupText(groupWordsArr, activeIdx, ctx, extraActiveTags = '', linePrefix = '') {
  const { styleConfig, uppercase, customImportantWords, emphasisEffect, emphasisColor } = ctx;
  const activeColor = toInlineColor(styleConfig.activeColor || styleConfig.primaryColor);
  // Group-level tags (looped transforms) are re-applied after the `\r` reset so
  // the trailing words keep animating with the rest of the group.
  let out = linePrefix ? `{${linePrefix}}` : '';
  for (let i = 0; i < groupWordsArr.length; i++) {
    const w = groupWordsArr[i];
    const word = displayWord(w, uppercase);
    if (i === activeIdx) {
      const important = isImportantWord(w.word, customImportantWords);
      const tags = important
        ? getEmphasisASS(emphasisEffect, emphasisColor, true)
        : `\\c${activeColor}\\fscx${POP_FROM}\\fscy${POP_FROM}\\t(0,${POP_MS},\\fscx${POP_TO}\\fscy${POP_TO})`;
      out += `{${linePrefix}${tags}${extraActiveTags}}${word}{\\r${linePrefix}}`;
    } else {
      out += word;
    }
    if (i < groupWordsArr.length - 1) out += w.lineBreakAfter ? '\\N' : ' ';
  }
  return out;
}

/**
 * ONE Dialogue event per word: the whole group is displayed, only the active
 * word is colored + pops.
 */
function generatePerWordEvents(groupWordsArr, ctx, nextGroupStart) {
  const windows = wordWindows(groupWordsArr, ctx.clipStartTime, nextGroupStart);
  const events = [];
  for (let i = 0; i < groupWordsArr.length; i++) {
    const { start, end } = windows[i];
    const text = buildGroupText(groupWordsArr, i, ctx);
    events.push(`Dialogue: 0,${toASSTime(start)},${toASSTime(end)},Default,,0,0,0,,${text}`);
  }
  return events;
}

/**
 * Legacy: a single dialogue event with cumulative \kf karaoke timing.
 * Only used by the explicit `karaoke-wipe` style.
 */
function generateKaraokeEvent(lineWords, clipStartTime, styleConfig, uppercase = true) {
  if (!lineWords || lineWords.length === 0) return null;

  const firstWord = lineWords[0];
  const lastWord = lineWords[lineWords.length - 1];

  const lineStart = Math.max(0, firstWord.start - clipStartTime);
  const lineEnd = Math.max(lineStart + 0.1, lastWord.end - clipStartTime);

  const karaokeText = buildKaraokeWordChain(lineWords, uppercase);

  return `Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,${karaokeText}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate an ASS file with animation effects (convenience wrapper around generateASS).
 *
 * Supported animations:
 * - "highlight" — per-word events, active word colored + pop (default)
 * - "pop"       — group pulses alpha/scale (2s cycle) on top of per-word highlight
 * - "bounce"    — squash-stretch (1s cycle) on top of per-word highlight
 * - "shake"     — active exclamation/CAPS words tremble
 * - "typewriter" — letters appear one by one (single event per group)
 * - "glow"      — outline glow pulse (1.5s cycle) on top of per-word highlight
 */
// generateAnimatedASS removed — was a dead-code wrapper around generateASS

/**
 * Generate animated dialogue events for a single group of words.
 */
function generateAnimatedEvents(groupWordsArr, ctx, animation, nextGroupStart) {
  if (!groupWordsArr || groupWordsArr.length === 0) return [];

  const { clipStartTime, styleConfig } = ctx;
  const firstWord = groupWordsArr[0];
  const lastWord = groupWordsArr[groupWordsArr.length - 1];
  const lineStart = Math.max(0, firstWord.start - clipStartTime);
  const lineEnd = Math.max(lineStart + 0.1, lastWord.end - clipStartTime);

  switch (animation) {
    case 'word-pop':
      return generateWordPopEvents(groupWordsArr, clipStartTime, lineStart, lineEnd, ctx.customImportantWords, styleConfig.alignment || 2, ctx.uppercase, ctx.emphasisEffect, ctx.emphasisColor);
    case 'pop':
      return generateLoopedPerWordEvents(groupWordsArr, ctx, nextGroupStart, lineStart, 200, (t0, t1, toggle) => {
        const targetAlpha = toggle === 0 ? 'A0' : '00'; // 37% ↔ 100%
        const scale = toggle === 0 ? 92 : 108;
        return `\\t(${t0},${t1},\\alpha&H${targetAlpha}&\\fscx${scale}\\fscy${scale})`;
      });
    case 'bounce':
      return generateLoopedPerWordEvents(groupWordsArr, ctx, nextGroupStart, lineStart, 100, (t0, t1, toggle) => {
        const scaleY = toggle === 0 ? 112 : 94;
        const scaleX = toggle === 0 ? 94 : 106;
        return `\\t(${t0},${t1},\\fscx${scaleX}\\fscy${scaleY})`;
      });
    case 'shake':
      return generateShakeEvents(groupWordsArr, ctx, nextGroupStart);
    case 'typewriter':
      return generateTypewriterEvents(groupWordsArr, lineStart, lineEnd, ctx.uppercase);
    case 'glow': {
      const baseBord = styleConfig.outline || 5;
      const glowBord = Math.round(baseBord * 1.8);
      return generateLoopedPerWordEvents(groupWordsArr, ctx, nextGroupStart, lineStart, 150, (t0, t1, toggle) => {
        const targetAlpha = toggle === 0 ? '70' : '00';
        const targetBord = toggle === 0 ? glowBord : baseBord;
        return `\\t(${t0},${t1},\\alpha&H${targetAlpha}&\\bord${targetBord})`;
      });
    }
    default:
      return generatePerWordEvents(groupWordsArr, ctx, nextGroupStart);
  }
}

/**
 * Helper: build a \kf karaoke word chain (legacy karaoke-wipe only).
 */
function buildKaraokeWordChain(lineWords, uppercase = true) {
  return lineWords
    .map((w, i) => {
      const durationCs = Math.max(1, Math.round((w.end - w.start) * 100));
      const sep = i < lineWords.length - 1 ? (w.lineBreakAfter ? '\\N' : ' ') : '';
      return `{\\kf${durationCs}}${displayWord(w, uppercase)}${sep}`;
    })
    .join('');
}

/**
 * Helper: build a repeating \t transform sequence over [0, durCs] centiseconds,
 * starting at `phaseCs` inside the cycle so consecutive per-word events continue
 * the same loop seamlessly.
 * cycleLenCs: duration of ONE full cycle in centiseconds
 * builder(t0, t1, toggle): returns a string of tags for a single half-cycle
 */
function buildLoopedTransforms(durCs, cycleLenCs, builder, phaseCs = 0) {
  const half = Math.max(1, Math.round(cycleLenCs / 2));
  const tags = [];
  const elapsed = ((phaseCs % cycleLenCs) + cycleLenCs) % cycleLenCs;
  let toggle = Math.floor(elapsed / half) % 2;
  let t = 0;
  let first = half - (elapsed % half);
  while (t < durCs) {
    const t1 = Math.min(t + (first || half), durCs);
    tags.push(builder(t, t1, toggle));
    toggle = 1 - toggle;
    t = t1;
    first = 0;
  }
  return tags.join('');
}

/**
 * Per-word events + a group-level looped transform (pop / bounce / glow).
 * The loop phase is carried across events so the group animates continuously.
 */
function generateLoopedPerWordEvents(groupWordsArr, ctx, nextGroupStart, groupStart, cycleLenCs, builder) {
  const windows = wordWindows(groupWordsArr, ctx.clipStartTime, nextGroupStart);
  const events = [];
  for (let i = 0; i < groupWordsArr.length; i++) {
    const { start, end } = windows[i];
    const durCs = Math.max(1, Math.round((end - start) * 100));
    const phaseCs = Math.max(0, Math.round((start - groupStart) * 100));
    const transforms = buildLoopedTransforms(durCs, cycleLenCs, builder, phaseCs);
    const text = buildGroupText(groupWordsArr, i, ctx, '', transforms);
    events.push(`Dialogue: 0,${toASSTime(start)},${toASSTime(end)},Default,,0,0,0,,${text}`);
  }
  return events;
}

/**
 * Detect if a word is "important" (should be emphasized).
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
 * Emphasis colors in ASS inline format &HBBGGRR&.
 */
const EMPHASIS_COLOR_MAP = {
  red:    '&H4444EF&',   // #EF4444
  yellow: '&H15CCFA&',   // #FACC15
  cyan:   '&HFFFF00&',   // #00FFFF
  green:  '&H80DE4A&',   // #4ADE80
  orange: '&H1673F9&',   // #F97316
  pink:   '&H9948EC&',   // #EC4899
  purple: '&HFF7DC7&',   // #C77DFF → neon purple (matches viral-glow tag/hook)
  white:  '&HFFFFFF&',   // #FFFFFF
};

/**
 * Convert emphasisEffect name to ASS override tags for important words.
 * Scale calibrated 108-112 % (was 120-140 % — read as a bug in A/B tests).
 * @param {boolean} animated - true → pop transition from 90 % (per-word events)
 */
function getEmphasisASS(effect, color = 'red', animated = false) {
  const assColor = EMPHASIS_COLOR_MAP[color] || EMPHASIS_COLOR_MAP.red;
  const scaleTo = (s, extra = '') => animated
    ? `\\fscx${POP_FROM}\\fscy${POP_FROM}\\t(0,${POP_MS},\\fscx${s}\\fscy${s}${extra})`
    : `\\fscx${s}\\fscy${s}${extra}`;
  switch (effect) {
    case 'scale':
      return `\\c${assColor}${scaleTo(112)}`;
    case 'bounce':
      return `\\c${assColor}\\shad3${scaleTo(110)}`;
    case 'glow':
      return `\\c${assColor}\\bord4\\3c${assColor}${scaleTo(POP_TO)}`;
    case 'none':
    default:
      return `\\c${assColor}${scaleTo(POP_TO)}`;
  }
}

function isImportantWord(rawWord, customWords = []) {
  const clean = String(rawWord || '').replace(/[^a-zA-Z]/g, '');
  if (clean.length === 0) return false;
  // ALL CAPS (3+ letters)
  if (clean.length >= 3 && clean === clean.toUpperCase()) return true;
  // Exclamation mark
  if (String(rawWord).includes('!')) return true;
  // Known hype words
  if (IMPORTANT_WORDS.has(clean.toLowerCase())) return true;
  // User-defined custom important words
  if (customWords.length > 0 && customWords.includes(clean.toLowerCase())) return true;
  return false;
}

/**
 * Word-Pop animation: words appear one by one, centered on screen.
 * ONE separate Dialogue event per word with precise start/end timing.
 */
function generateWordPopEvents(lineWords, clipStartTime, lineStart, lineEnd, customImportantWords = [], alignment = 2, uppercase = true, emphasisEffect = 'none', emphasisColor = 'red') {
  if (!lineWords || lineWords.length === 0) return [];

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

    const word = displayWord(w, uppercase);
    const important = isImportantWord(w.word, customImportantWords);

    const overrides = important
      ? `{\\an${an}${getEmphasisASS(emphasisEffect, emphasisColor)}}`
      : `{\\an${an}}`;

    events.push(
      `Dialogue: 0,${toASSTime(wordStart)},${toASSTime(wordEnd)},Default,,0,0,0,,${overrides}${word}`
    );
  }

  return events;
}

/**
 * Shake animation: per-word events; the active word trembles when it is an
 * exclamation / CAPS word.
 */
function generateShakeEvents(groupWordsArr, ctx, nextGroupStart) {
  const windows = wordWindows(groupWordsArr, ctx.clipStartTime, nextGroupStart);
  const events = [];
  for (let i = 0; i < groupWordsArr.length; i++) {
    const w = groupWordsArr[i];
    const { start, end } = windows[i];
    const isExclamation = w.word.includes('!') || (w.word === w.word.toUpperCase() && w.word.replace(/[^a-zA-Z]/g, '').length > 2);
    const shake = isExclamation
      ? `\\t(0,5,\\frz3)\\t(5,10,\\frz-3)\\t(10,15,\\frz2)\\t(15,20,\\frz0)`
      : '';
    const text = buildGroupText(groupWordsArr, i, ctx, shake);
    events.push(`Dialogue: 0,${toASSTime(start)},${toASSTime(end)},Default,,0,0,0,,${text}`);
  }
  return events;
}

/**
 * Typewriter animation: text appears character by character (single event per group)
 */
function generateTypewriterEvents(lineWords, lineStart, lineEnd, uppercase = true) {
  const fullText = lineWords.map((w) => w.word).join(' ');
  const totalChars = fullText.length;
  const lineDuration = lineEnd - lineStart;

  if (totalChars === 0) return [];

  // Each character appears at even intervals
  const charDuration = (lineDuration / totalChars) * 100; // in centiseconds

  let charIndex = 0;
  const text = lineWords.map((w, wi) => {
    const shown = uppercase ? w.word.toUpperCase() : w.word;
    const chars = shown.split('').map((ch) => {
      const showAt = Math.round(charIndex * charDuration);
      charIndex++;
      return `{\\alphaFF\\t(${showAt},${showAt + 1},\\alpha00)}${escapeASS(ch)}`;
    }).join('');
    charIndex++; // account for space
    const sep = wi < lineWords.length - 1 ? (w.lineBreakAfter ? '\\N' : ' ') : '';
    return chars + sep;
  }).join('');

  return [`Dialogue: 0,${toASSTime(lineStart)},${toASSTime(lineEnd)},Default,,0,0,0,,${text}`];
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
    activeColor: colors.activeColor ? hexToASSColor(colors.activeColor)
      : colors.primaryColor ? hexToASSColor(colors.primaryColor) : baseStyle.activeColor,
    primaryColor: colors.secondaryColor ? hexToASSColor(colors.secondaryColor) : baseStyle.primaryColor,
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
 * Groups text by the same character rules and distributes groups evenly across
 * the clip duration. Used for trending clips that don't have Whisper transcription.
 *
 * @param {string} text - The text to display (e.g. clip title)
 * @param {number} duration - Clip duration in seconds
 * @param {Object} options - {style, animation, wordsPerLine (hint), position, canvasWidth, canvasHeight}
 * @returns {string} ASS file content
 */
export function generateStaticASS(text, duration, options = {}) {
  const {
    style = 'hormozi',
    animation = 'highlight',
    wordsPerLine = DEFAULT_WORDS_PER_LINE,
    position = 'bottom',
    canvasWidth = 1080,
    canvasHeight = 1920,
    uppercase,
    // splitScreen is accepted but ignored (permanently removed)
  } = options;

  if (!text || !duration || duration <= 0) return '';

  const styleConfig = resolveStyleConfig(style, { customColors: null, position, canvasWidth, canvasHeight, diversify: null });
  const upper = typeof uppercase === 'boolean' ? uppercase : styleConfig.uppercase !== false;
  const header = buildASSHeader(styleConfig, canvasWidth, canvasHeight);

  // Split text into words
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';

  const an = styleConfig.alignment || 2;

  // ── Word-pop mode: show one word at a time, evenly distributed ──
  if (animation === 'word-pop') {
    const events = [];
    const wordDuration = Math.min(1.2, Math.max(0.3, duration / words.length));
    const totalWordsTime = wordDuration * words.length;
    const startOffset = Math.max(0, (duration - totalWordsTime) / 2);

    for (let i = 0; i < words.length; i++) {
      const wordStart = startOffset + i * wordDuration;
      const wordEnd = Math.min(wordStart + wordDuration, duration);
      const word = displayWord({ word: words[i] }, upper);
      events.push(`Dialogue: 0,${toASSTime(wordStart)},${toASSTime(wordEnd)},Default,,0,0,0,,{\\an${an}}${word}`);
    }
    return [header, ...events].join('\n');
  }

  // ── Default: group by characters (same rules as timed captions) and show sequentially ──
  // Fake evenly spaced timestamps so groupWords() applies the character/line rules.
  const perWord = duration / words.length;
  const fakeWords = words.map((w, i) => ({ word: w, start: i * perWord, end: (i + 1) * perWord }));
  const groups = groupWords(fakeWords, { maxGroupDuration: Infinity, maxSilenceGap: Infinity, wordsPerLineHint: wordsPerLine });

  const groupDuration = Math.max(1.5, duration / groups.length);
  const events = [];

  for (let i = 0; i < groups.length; i++) {
    const start = i * groupDuration;
    const end = Math.min(start + groupDuration, duration);
    if (end <= start) break;
    const groupText = groups[i]
      .map((w, wi) => displayWord(w, upper) + (wi < groups[i].length - 1 ? (w.lineBreakAfter ? '\\N' : ' ') : ''))
      .join('');
    events.push(`Dialogue: 0,${toASSTime(start)},${toASSTime(end)},Default,,0,0,0,,${groupText}`);
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
 *   style: 'anton',
 *   clipStartTime: 0,
 * });
 *
 * // Write to file:
 * fs.writeFileSync('captions.ass', assContent, 'utf-8');
 */
