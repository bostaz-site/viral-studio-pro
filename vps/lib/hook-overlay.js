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
  // Preview: ~280px wide container, CSS values in px
  // Scale proportionally to actual video width
  const scale = canvasW / 280;

  const fontSize = Math.round(10 * scale);           // 10px on 280px preview
  const paddingX = Math.round(12 * scale);            // px-3 = 12px
  const paddingY = Math.round(6 * scale);             // py-1.5 = 6px
  const borderW = Math.max(2, Math.round(2 * scale)); // 2px border — keep thin
  const borderRadius = Math.round(6 * scale);         // rounded-md = 6px
  const letterSpacing = Math.round(0.5 * scale);      // tracking-wide

  // Glow: keep subtle — CSS box-shadow blur is visual, SVG stdDeviation is Gaussian
  // CSS 10px blur ≈ stdDeviation 3-4 at preview scale, scale up but cap it
  const glowStd1 = Math.min(8, Math.round(3 * scale));   // subtle inner glow
  const glowStd2 = Math.min(14, Math.round(6 * scale));  // wider outer glow

  // ── Measure text width ──
  // Approximate: uppercase bold chars are roughly 0.62 * fontSize wide
  const upperText = text.toUpperCase();
  const charWidth = fontSize * 0.62;
  const textWidth = Math.round(upperText.length * charWidth);

  // ── Box dimensions (stroke is centered on edge, so inset by half) ──
  const boxWidth = textWidth + (paddingX * 2);
  const boxHeight = fontSize + (paddingY * 2);

  // ── Position ──
  // Center horizontally, vertical % from top
  const boxX = Math.round((canvasW - boxWidth) / 2);
  const boxY = Math.round(canvasH * (Math.max(5, Math.min(90, positionPct)) / 100));

  // Text position: centered in box
  const textX = Math.round(canvasW / 2);
  const textY = Math.round(boxY + paddingY + fontSize * 0.78); // baseline offset (~78% of fontSize)

  // ── Build SVG ──
  // IMPORTANT: use fill="#000000" fill-opacity="0.75" instead of rgba() — resvg doesn't support CSS rgba
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <defs>
    <!-- Subtle glow matching CSS box-shadow: 0 0 10px #9146FF88, 0 0 24px #9146FF44 -->
    <filter id="hookGlow" x="-30%" y="-50%" width="160%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${glowStd1}" result="blur1"/>
      <feColorMatrix in="blur1" type="matrix" values="0 0 0 0 0.569  0 0 0 0 0.275  0 0 0 0 1  0 0 0 0.35 0" result="glow1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="${glowStd2}" result="blur2"/>
      <feColorMatrix in="blur2" type="matrix" values="0 0 0 0 0.569  0 0 0 0 0.275  0 0 0 0 1  0 0 0 0.18 0" result="glow2"/>
      <feMerge>
        <feMergeNode in="glow2"/>
        <feMergeNode in="glow1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Capsule: black bg 75% opacity + thin purple border + subtle neon glow -->
  <rect
    x="${boxX}"
    y="${boxY}"
    width="${boxWidth}"
    height="${boxHeight}"
    rx="${borderRadius}"
    ry="${borderRadius}"
    fill="#000000"
    fill-opacity="0.75"
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
