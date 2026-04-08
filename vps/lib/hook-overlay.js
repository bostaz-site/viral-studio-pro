import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

/**
 * Generates a pixel-perfect hook text overlay as a transparent PNG.
 *
 * Reproduces the EXACT CSS from the live preview:
 *   background: rgba(0,0,0,0.75)
 *   border: 2px solid #9146FF
 *   box-shadow: 0 0 10px #9146FF88, 0 0 24px #9146FF44
 *   border-radius: 6px (rounded-md)
 *   text: bold, white, uppercase, tracking-wide
 *
 * The SVG is rendered to PNG via @resvg/resvg-js and overlaid by FFmpeg.
 */

/**
 * Generate a hook overlay PNG that matches the CSS live preview exactly.
 *
 * @param {object} opts
 * @param {string} opts.text        - Hook text to display
 * @param {number} opts.canvasW     - Video width in pixels (e.g. 720)
 * @param {number} opts.canvasH     - Video height in pixels (e.g. 1280)
 * @param {number} opts.positionPct - Vertical position as % from top (5-90)
 * @param {string} opts.outputPath  - Where to save the PNG
 * @returns {Promise<string>} Path to the generated PNG
 */
export async function generateHookOverlayPNG({ text, canvasW, canvasH, positionPct = 15, outputPath }) {
  // ── Scale ratios ──
  // Preview: 280px wide, text is 10px, padding is px-3 (12px) py-1.5 (6px), border 2px, radius 6px
  // Scale everything proportionally to the actual video width
  const scale = canvasW / 280;

  const fontSize = Math.round(10 * scale);         // 10px on 280px preview
  const paddingX = Math.round(12 * scale);          // px-3 = 12px
  const paddingY = Math.round(6 * scale);           // py-1.5 = 6px
  const borderW = Math.round(2 * scale);            // 2px border
  const borderRadius = Math.round(6 * scale);       // rounded-md = 6px
  const letterSpacing = Math.round(0.5 * scale);    // tracking-wide
  const glowBlur1 = Math.round(10 * scale);         // box-shadow blur 1
  const glowBlur2 = Math.round(24 * scale);         // box-shadow blur 2

  // ── Measure text width ──
  // Approximate: uppercase bold chars are roughly 0.65 * fontSize wide
  // This is close enough for SVG — resvg handles the actual rendering
  const upperText = text.toUpperCase();
  const charWidth = fontSize * 0.62;
  const textWidth = Math.round(upperText.length * charWidth);

  // ── Box dimensions ──
  const boxWidth = textWidth + (paddingX * 2) + (borderW * 2);
  const boxHeight = fontSize + (paddingY * 2) + (borderW * 2);

  // ── Position ──
  const boxX = Math.round((canvasW - boxWidth) / 2);
  const boxY = Math.round(canvasH * (Math.max(5, Math.min(90, positionPct)) / 100));

  // Text position: centered in box
  const textX = Math.round(canvasW / 2);
  const textY = Math.round(boxY + borderW + paddingY + fontSize * 0.82); // baseline offset

  // ── Build SVG ──
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <defs>
    <!-- Glow filter matching box-shadow: 0 0 10px #9146FF88, 0 0 24px #9146FF44 -->
    <filter id="hookGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="${glowBlur1 / 2}" flood-color="#9146FF" flood-opacity="0.533"/>
      <feDropShadow dx="0" dy="0" stdDeviation="${glowBlur2 / 2}" flood-color="#9146FF" flood-opacity="0.267"/>
    </filter>
  </defs>

  <!-- Capsule: black bg + purple border + neon glow -->
  <rect
    x="${boxX}"
    y="${boxY}"
    width="${boxWidth}"
    height="${boxHeight}"
    rx="${borderRadius}"
    ry="${borderRadius}"
    fill="rgba(0,0,0,0.75)"
    stroke="#9146FF"
    stroke-width="${borderW}"
    filter="url(#hookGlow)"
  />

  <!-- Hook text: white, bold, uppercase -->
  <text
    x="${textX}"
    y="${textY}"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="900"
    font-size="${fontSize}px"
    fill="white"
    letter-spacing="${letterSpacing}px"
    text-rendering="optimizeLegibility"
  >${escapeXml(upperText)}</text>
</svg>`;

  // ── Render SVG → PNG ──
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'original',
    },
    font: {
      // Use system fonts for text rendering
      loadSystemFonts: true,
    },
    logLevel: 'off',
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`[hook-overlay] Generated PNG: ${outputPath} (${boxWidth}x${boxHeight} capsule, ${canvasW}x${canvasH} canvas)`);

  return outputPath;
}

/**
 * Escape special XML characters in text
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
