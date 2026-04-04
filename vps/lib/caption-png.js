import { promises as fs } from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

/**
 * Caption PNG Generator — mirrors the UI LivePreview exactly.
 *
 * For each group of words (one line) we emit N PNGs — one per active word.
 * Each PNG contains the full line with one word highlighted.
 * FFmpeg overlays each PNG for its time window via enable='between(t,s,e)'.
 *
 * This eliminates ASS/CSS translation drift: the renderer draws the same
 * SVG that represents the live UI component.
 */

// ─── Style mirror from app/(dashboard)/dashboard/enhance/[clipId]/page.tsx ──
// Each style matches its Tailwind preview/highlightClass from CAPTION_STYLES
const CAPTION_STYLES = {
  hormozi: {
    // text-yellow-400 font-black uppercase
    textColor: '#facc15',
    fontWeight: 900,
    uppercase: true,
    // highlight: text-yellow-400 bg-yellow-400/20
    highlightTextColor: '#facc15',
    highlightBg: 'rgba(250, 204, 21, 0.20)',
  },
  mrbeast: {
    // text-white font-black
    textColor: '#ffffff',
    fontWeight: 900,
    uppercase: false,
    // highlight: text-red-500 bg-red-500/20
    highlightTextColor: '#ef4444',
    highlightBg: 'rgba(239, 68, 68, 0.20)',
  },
  aliabdaal: {
    // text-blue-300 font-semibold
    textColor: '#93c5fd',
    fontWeight: 600,
    uppercase: false,
    // highlight: text-blue-300 bg-blue-300/20
    highlightTextColor: '#93c5fd',
    highlightBg: 'rgba(147, 197, 253, 0.20)',
  },
  neon: {
    // text-green-400 font-bold
    textColor: '#4ade80',
    fontWeight: 700,
    uppercase: false,
    // highlight: text-green-400 bg-green-400/20
    highlightTextColor: '#4ade80',
    highlightBg: 'rgba(74, 222, 128, 0.20)',
  },
  bold: {
    // text-white font-black text-lg
    textColor: '#ffffff',
    fontWeight: 900,
    uppercase: false,
    // highlight: text-white bg-white/20
    highlightTextColor: '#ffffff',
    highlightBg: 'rgba(255, 255, 255, 0.20)',
  },
  minimal: {
    // text-white/80 font-medium
    textColor: 'rgba(255,255,255,0.80)',
    fontWeight: 500,
    uppercase: false,
    // highlight: text-white/80 bg-white/10
    highlightTextColor: 'rgba(255,255,255,0.80)',
    highlightBg: 'rgba(255, 255, 255, 0.10)',
  },
  default: {
    textColor: '#ffffff',
    fontWeight: 700,
    uppercase: false,
    highlightTextColor: '#facc15',
    highlightBg: 'rgba(250, 204, 21, 0.20)',
  },
};

// ─── Measurement helpers ────────────────────────────────────────────────────
// Rough text-width estimation scaled by weight. We don't need exact kerning —
// resvg handles glyph layout, but we need to size the background box and
// the highlight pill. Tuned against DejaVu Sans Bold.
function estimateTextWidth(text, fontSize, weight) {
  // Average advance width per character in em units for DejaVu Sans Bold
  const baseRatio = weight >= 800 ? 0.60 : weight >= 700 ? 0.56 : 0.52;
  let width = 0;
  for (const ch of text) {
    if (ch === ' ') width += fontSize * 0.30;
    else if (/[A-Z0-9]/.test(ch)) width += fontSize * baseRatio * 1.05;
    else if (/[mwMW]/.test(ch)) width += fontSize * baseRatio * 1.35;
    else if (/[ilIt!.,']/.test(ch)) width += fontSize * baseRatio * 0.45;
    else width += fontSize * baseRatio;
  }
  return width;
}

// XML-escape a string for safe SVG embedding
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Line grouping ──────────────────────────────────────────────────────────
/**
 * Groups words into lines of `wordsPerLine` words each, preserving timing.
 * Returns lines: [ { words: [{text,start,end}, ...], lineStart, lineEnd } ]
 */
function groupLines(wordTimestamps, wordsPerLine, clipStartTime = 0) {
  const lines = [];
  for (let i = 0; i < wordTimestamps.length; i += wordsPerLine) {
    const chunk = wordTimestamps.slice(i, i + wordsPerLine);
    if (chunk.length === 0) continue;
    // Shift times to be relative to clip start
    const words = chunk.map(w => ({
      text: w.word || w.text || '',
      start: Math.max(0, (w.start || 0) - clipStartTime),
      end: Math.max(0, (w.end || 0) - clipStartTime),
    }));
    lines.push({
      words,
      lineStart: words[0].start,
      lineEnd: words[words.length - 1].end,
    });
  }
  return lines;
}

// ─── SVG builder ────────────────────────────────────────────────────────────
/**
 * Builds an SVG representing one caption frame (full line, with one word
 * highlighted). Returns { svg, width, height }.
 *
 * Maps directly to the UI's caption container:
 *   bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 max-w-[85%]
 * with text styled per captionStyle.preview.
 */
function buildCaptionSVG(line, activeIdx, styleSpec, opts) {
  const {
    fontSize,
    fontFamily = 'DejaVu Sans, sans-serif',
    maxWidth,  // max allowed width in px (85% of canvas)
    animation = 'highlight',
    activeScale = 1.0,
    activeOpacity = 1.0,
  } = opts;

  // Build token list with width measurements
  const tokens = line.words.map((w, idx) => {
    const display = styleSpec.uppercase ? w.text.toUpperCase() : w.text;
    const weight = styleSpec.fontWeight;
    const width = estimateTextWidth(display, fontSize, weight);
    return { text: display, width, isActive: idx === activeIdx };
  });

  // Space between words (matches a normal space character advance)
  const spaceWidth = fontSize * 0.30;

  // Layout horizontally
  let totalTextWidth = 0;
  tokens.forEach((t, i) => {
    totalTextWidth += t.width;
    if (i < tokens.length - 1) totalTextWidth += spaceWidth;
  });

  // Padding matches the UI's px-3 py-1.5 scaled to video
  const padX = Math.round(fontSize * 0.75);
  const padY = Math.round(fontSize * 0.375);

  // If text is wider than maxWidth, we'll shrink font but for simplicity
  // just accept that it may be wide (we center it anyway).
  const contentWidth = Math.min(totalTextWidth, maxWidth - padX * 2);
  const boxWidth = Math.ceil(contentWidth + padX * 2);
  const lineHeight = Math.round(fontSize * 1.25);
  const boxHeight = lineHeight + padY * 2;

  // Extra canvas padding to avoid clipping the highlight pill scaling
  const canvasPadX = 8;
  const canvasPadY = 8;
  const svgWidth = boxWidth + canvasPadX * 2;
  const svgHeight = boxHeight + canvasPadY * 2;

  // Box origin inside SVG
  const boxX = canvasPadX;
  const boxY = canvasPadY;

  // Background: bg-black/80 rounded-lg (r=8px from Tailwind, scaled)
  const bgRadius = Math.round(fontSize * 0.5);

  // Starting X for centered text inside the box
  const textStartX = boxX + (boxWidth - totalTextWidth) / 2;
  const baselineY = boxY + padY + Math.round(fontSize * 0.85);

  // Build token rendering
  let tokensSvg = '';
  let cursorX = textStartX;

  tokens.forEach((t, i) => {
    const tokenX = cursorX;

    if (t.isActive) {
      // Highlight pill bg — matches UI: px-0.5 rounded (r=4px)
      const pillPadX = Math.round(fontSize * 0.15);
      const pillPadY = Math.round(fontSize * 0.08);
      const pillX = tokenX - pillPadX;
      const pillY = boxY + padY - pillPadY;
      const pillW = t.width + pillPadX * 2;
      const pillH = lineHeight + pillPadY * 2;
      const pillR = Math.round(fontSize * 0.18);

      tokensSvg += `<rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH.toFixed(1)}" rx="${pillR}" ry="${pillR}" fill="${styleSpec.highlightBg}"/>`;

      // Active word text (with optional scale transform centered on pill)
      const pillCx = pillX + pillW / 2;
      const pillCy = pillY + pillH / 2;
      const transform = activeScale !== 1.0
        ? `transform="translate(${pillCx.toFixed(1)} ${pillCy.toFixed(1)}) scale(${activeScale}) translate(${(-pillCx).toFixed(1)} ${(-pillCy).toFixed(1)})"`
        : '';

      tokensSvg += `<text x="${tokenX.toFixed(1)}" y="${baselineY.toFixed(1)}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${styleSpec.fontWeight}" fill="${styleSpec.highlightTextColor}" opacity="${activeOpacity}" ${transform}>${xmlEscape(t.text)}</text>`;
    } else {
      // Inactive word — secondary text color
      tokensSvg += `<text x="${tokenX.toFixed(1)}" y="${baselineY.toFixed(1)}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${styleSpec.fontWeight}" fill="${styleSpec.textColor}">${xmlEscape(t.text)}</text>`;
    }

    cursorX += t.width;
    if (i < tokens.length - 1) cursorX += spaceWidth;
  });

  // Glow animation filter (mimics box-shadow pulse)
  const glowFilter = animation === 'glow'
    ? `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="${fontSize * 0.15}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : '';
  const bgFilter = animation === 'glow' ? ' filter="url(#glow)"' : '';
  const bgFill = animation === 'glow' ? 'rgba(0,0,0,0.60)' : 'rgba(0,0,0,0.80)';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">${glowFilter}<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${bgRadius}" ry="${bgRadius}" fill="${bgFill}"${bgFilter}/>${tokensSvg}</svg>`;

  return { svg, width: svgWidth, height: svgHeight };
}

// ─── Main generator ─────────────────────────────────────────────────────────
/**
 * Generates caption PNG overlays for an entire clip.
 *
 * @param {Array}  wordTimestamps - [{word/text, start, end}]
 * @param {Object} opts
 *   - style: 'hormozi' | 'mrbeast' | ...
 *   - animation: 'highlight' | 'pop' | 'bounce' | 'glow' | 'typewriter'
 *   - position: 'top' | 'middle' | 'bottom'
 *   - canvasWidth, canvasHeight
 *   - splitScreen: { enabled, ratio } | null
 *   - clipStartTime
 *   - wordsPerLine
 *   - outputDir: directory to write PNGs
 * @returns {Array} overlays: [{ pngPath, startTime, endTime, x, y, width, height }]
 */
export async function generateCaptionPNGs(wordTimestamps, opts) {
  const {
    style = 'hormozi',
    animation = 'highlight',
    position = 'bottom',
    canvasWidth,
    canvasHeight,
    splitScreen = null,
    clipStartTime = 0,
    wordsPerLine = 4,
    outputDir,
  } = opts;

  if (!outputDir) throw new Error('outputDir is required');
  if (!canvasWidth || !canvasHeight) throw new Error('canvas dimensions required');

  const styleSpec = CAPTION_STYLES[style] || CAPTION_STYLES.default;
  await fs.mkdir(outputDir, { recursive: true });

  // Font size: UI uses text-sm (14px) on a ~280px preview container.
  // Scaled to video canvas, that's roughly canvasWidth * (14/280) = 5% of canvas width.
  // But video captions need to be larger for readability — bump to ~5.5% of canvas.
  const fontSize = Math.round(canvasWidth * 0.055);
  const maxWidth = Math.round(canvasWidth * 0.85);

  // Caption vertical position — mirrors UI logic exactly
  const splitRatio = splitScreen?.enabled ? (splitScreen.ratio ?? 50) : 100;
  let topPercent;
  if (position === 'top') {
    topPercent = 0.08;
  } else if (position === 'middle') {
    topPercent = splitScreen?.enabled ? (splitRatio / 2) / 100 : 0.42;
  } else { // bottom
    topPercent = splitScreen?.enabled ? (splitRatio - 10) / 100 : 0.72;
  }

  const lines = groupLines(wordTimestamps, wordsPerLine, clipStartTime);
  const overlays = [];

  let pngIndex = 0;

  for (const line of lines) {
    for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
      const word = line.words[wIdx];

      // Animation-specific active-word styling
      let activeScale = 1.0;
      let activeOpacity = 1.0;
      if (animation === 'pop') {
        activeScale = 1.12;
      } else if (animation === 'bounce') {
        activeScale = 1.08;
      } else if (animation === 'typewriter') {
        // Show only up to active word (reveal progressively)
        activeScale = 1.0;
      }

      const { svg, width, height } = buildCaptionSVG(line, wIdx, styleSpec, {
        fontSize,
        maxWidth,
        animation,
        activeScale,
        activeOpacity,
      });

      // Render SVG → PNG
      const resvg = new Resvg(svg, {
        background: 'rgba(0,0,0,0)',
        fitTo: { mode: 'width', value: width },
        font: {
          loadSystemFonts: true,
          defaultFontFamily: 'DejaVu Sans',
        },
      });
      const pngData = resvg.render().asPng();

      const pngPath = path.join(outputDir, `cap_${pngIndex.toString().padStart(5, '0')}.png`);
      await fs.writeFile(pngPath, pngData);
      pngIndex++;

      // Position on canvas — center horizontally, vertical from position setting
      const x = Math.round((canvasWidth - width) / 2);
      const y = Math.round(canvasHeight * topPercent - height / 2);

      overlays.push({
        pngPath,
        startTime: word.start,
        endTime: word.end,
        x,
        y,
        width,
        height,
      });
    }
  }

  return overlays;
}
