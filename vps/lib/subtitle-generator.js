/**
 * ASS subtitle file generator for Viral Studio Pro
 * Supports karaoke word-by-word highlighting and multiple caption styles
 */

// ─────────────────────────────────────────────────────────────────────────────
// Style Definitions
// ─────────────────────────────────────────────────────────────────────────────

const CAPTION_STYLES = {
  hormozi: {
    fontname: 'Arial Black',
    fontsize: 80,
    fontweight: true,
    primaryColor: '&H0000FFFF', // Yellow (AABBGGRR format)
    secondaryColor: '&H000000FF', // Red
    outlineColor: '&H00000000', // Black
    backColor: '&H00000000', // Black (transparent)
    bold: -1,
    italic: 0,
    outline: 2,
    shadow: 1,
    alignment: 2, // Bottom center
    marginV: 30,
  },

  mrbeast: {
    fontname: 'Arial',
    fontsize: 72,
    fontweight: true,
    primaryColor: '&H00FFFFFF', // White
    secondaryColor: '&H00000000', // Black
    outlineColor: '&H00000000', // Black
    backColor: '&H80000000', // Semi-transparent black
    bold: -1,
    italic: 0,
    outline: 3,
    shadow: 2,
    alignment: 2,
    marginV: 30,
  },

  neon: {
    fontname: 'Arial',
    fontsize: 70,
    fontweight: true,
    primaryColor: '&H0000FFFF', // Cyan/Neon yellow
    secondaryColor: '&H00FF00FF', // Magenta
    outlineColor: '&H00FFFFFF', // White glow
    backColor: '&H80000000', // Semi-transparent
    bold: -1,
    italic: 0,
    outline: 4,
    shadow: 2,
    alignment: 2,
    marginV: 40,
  },

  minimal: {
    fontname: 'Helvetica',
    fontsize: 60,
    fontweight: 0,
    primaryColor: '&H00FFFFFF', // White
    secondaryColor: '&H00808080', // Gray
    outlineColor: '&H00000000', // Black
    backColor: '&H00000000', // Transparent
    bold: 0,
    italic: 0,
    outline: 1,
    shadow: 0,
    alignment: 2,
    marginV: 20,
  },

  impact: {
    fontname: 'Impact',
    fontsize: 75,
    fontweight: true,
    primaryColor: '&H00FFFFFF', // White
    secondaryColor: '&H000000FF', // Red
    outlineColor: '&H00000000', // Black
    backColor: '&H00000000', // Transparent
    bold: -1,
    italic: 0,
    outline: 3,
    shadow: 1,
    alignment: 2,
    marginV: 30,
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
  const sec = Math.floor(s % 60);
  const cs = Math.round((s % 1) * 100);

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
// ASS File Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate complete ASS subtitle file with karaoke support
 *
 * @param {Array} wordTimestamps - [{word, start, end}, ...]
 * @param {Object} options - {style, clipStartTime, wordsPerLine, customColors}
 * @returns {string} ASS file content
 */
export function generateASS(wordTimestamps, options = {}) {
  const {
    style = 'hormozi',
    clipStartTime = 0,
    wordsPerLine = 6,
    customColors = null,
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

  // Generate ASS header
  const header = buildASSHeader(styleConfig);

  // Group words into lines
  const wordLines = groupWords(wordTimestamps, wordsPerLine);

  // Generate events (dialogue lines with karaoke timing)
  const events = [];
  for (const lineWords of wordLines) {
    const event = generateKaraokeEvent(lineWords, clipStartTime, styleConfig);
    if (event) events.push(event);
  }

  return [header, ...events].join('\n');
}

/**
 * Build ASS file header with style definition
 */
function buildASSHeader(styleConfig) {
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
  } = styleConfig;

  return `[Script Info]
Title: Viral Studio Pro Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${fontname},${fontsize},${primaryColor},${secondaryColor},${outlineColor},${backColor},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},${alignment},20,20,${marginV},1

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

    if (word.start >= word.end) {
      throw new Error(`Invalid timing for word "${word.word}": start (${word.start}) >= end (${word.end})`);
    }
  }

  return true;
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
