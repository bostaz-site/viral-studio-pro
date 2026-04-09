/**
 * Captures the streamer tag as a small transparent PNG using Canvas 2D.
 *
 * Same approach as capture-hook-overlay.ts — pure Canvas, no SVG foreignObject
 * (which taints the canvas and blocks toDataURL).
 *
 * Draws the Twitch icon + text with exact CSS styles from the preview.
 */

// Twitch logo path (24x24 viewBox)
const TWITCH_PATH = 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z';

type TagStyle = 'viral-glow' | 'pop-creator' | 'minimal-pro';

export async function captureTagOverlayPNG({
  streamerName,
  style,
  tagSize = 100,
  videoWidth = 720,
  videoHeight = 1280,
  splitScreenEnabled = false,
  splitRatio = 50,
}: {
  streamerName: string;
  style: TagStyle;
  tagSize?: number;
  videoWidth?: number;
  videoHeight?: number;
  splitScreenEnabled?: boolean;
  splitRatio?: number;
}): Promise<{ png: string; w: number; h: number; anchorX: number; anchorY: number } | null> {
  if (!streamerName || style === 'minimal-pro') return null; // minimal-pro has backdrop-filter which canvas can't do

  try {
    const scale = videoWidth / 280; // preview width is ~280px
    const sizeScale = (tagSize || 100) / 100;

    // ── CSS values scaled ──
    const fontSize = Math.round(11 * scale * sizeScale);
    const iconSize = Math.round((style === 'viral-glow' ? 14 : 12) * scale * sizeScale);
    const gap = Math.round(6 * scale * sizeScale);
    const paddingX = Math.round((style === 'pop-creator' ? 12 : 10) * scale * sizeScale);
    const paddingY = Math.round(6 * scale * sizeScale);
    const borderW = Math.round(1.5 * scale * sizeScale);
    const glowPad = Math.round(25 * scale * sizeScale); // space for glow bleed

    // ── Measure text ──
    const fontStr = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    measureCtx.font = fontStr;
    const textWidth = measureCtx.measureText(streamerName).width;

    // ── Capsule dimensions ──
    const capsuleW = Math.ceil(iconSize + gap + textWidth + paddingX * 2);
    const capsuleH = Math.ceil(Math.max(fontSize, iconSize) + paddingY * 2);

    // Canvas = capsule + glow padding
    const canvasW = capsuleW + glowPad * 2;
    const canvasH = capsuleH + glowPad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const boxX = glowPad;
    const boxY = glowPad;
    const fullRound = capsuleH / 2; // rounded-full

    if (style === 'viral-glow') {
      // ── Glow: box-shadow: 0 0 8px #9146FF88, 0 0 20px #9146FF44, 0 2px 8px rgba(0,0,0,0.5) ──
      ctx.save();
      ctx.shadowColor = 'rgba(145, 70, 255, 0.27)';
      ctx.shadowBlur = Math.round(20 * scale * sizeScale);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = 'rgba(145, 70, 255, 0.53)';
      ctx.shadowBlur = Math.round(8 * scale * sizeScale);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      // Drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = Math.round(8 * scale * sizeScale);
      ctx.shadowOffsetY = Math.round(2 * scale * sizeScale);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      // ── Background: rgba(0,0,0,0.75) ──
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      // ── Border: 1.5px solid #9146FF ──
      ctx.save();
      ctx.strokeStyle = '#9146FF';
      ctx.lineWidth = borderW;
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.stroke();
      ctx.restore();

      // ── Twitch icon (purple) ──
      drawTwitchIcon(ctx, boxX + paddingX, boxY + (capsuleH - iconSize) / 2, iconSize, '#9146FF');

      // ── Text ──
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(streamerName, boxX + paddingX + iconSize + gap, boxY + capsuleH / 2);
      ctx.restore();

    } else if (style === 'pop-creator') {
      // ── Glow: 0 2px 12px rgba(145,70,255,0.5), 0 1px 4px rgba(0,0,0,0.3) ──
      ctx.save();
      ctx.shadowColor = 'rgba(145, 70, 255, 0.5)';
      ctx.shadowBlur = Math.round(12 * scale * sizeScale);
      ctx.shadowOffsetY = Math.round(2 * scale * sizeScale);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = Math.round(4 * scale * sizeScale);
      ctx.shadowOffsetY = Math.round(1 * scale * sizeScale);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      // ── Background: #9146FF ──
      ctx.save();
      ctx.fillStyle = '#9146FF';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.fill();
      ctx.restore();

      // ── Border: 1.5px solid rgba(255,255,255,0.3) ──
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = borderW;
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, fullRound);
      ctx.stroke();
      ctx.restore();

      // ── Twitch icon (white) ──
      drawTwitchIcon(ctx, boxX + paddingX, boxY + (capsuleH - iconSize) / 2, iconSize, 'white');

      // ── Text ──
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(streamerName, boxX + paddingX + iconSize + gap, boxY + capsuleH / 2);
      ctx.restore();
    }

    const png = canvas.toDataURL('image/png');

    if (png.length > 500000) {
      console.warn('[captureTagOverlay] PNG too large, skipping:', png.length);
      return null;
    }

    // Anchor position: bottom-left of the video
    // CSS: bottom: 10px (or splitScreen offset), left: 0, px-3
    const marginX = Math.round(12 * scale); // px-3
    const marginBottom = Math.round(10 * scale);
    const contentAreaH = splitScreenEnabled ? Math.round(videoHeight * splitRatio / 100) : videoHeight;
    const anchorX = marginX;
    const anchorY = contentAreaH - marginBottom - canvasH + glowPad; // bottom-aligned

    console.log(`[captureTagOverlay] OK: ${canvasW}x${canvasH}, anchor=(${anchorX},${anchorY}), ${png.length} chars`);
    return { png, w: canvasW, h: canvasH, anchorX, anchorY };
  } catch (err) {
    console.error('[captureTagOverlay] Error:', err);
    return null;
  }
}

/**
 * Draw the Twitch icon using Canvas path commands.
 */
function drawTwitchIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  const iconScale = size / 24;
  ctx.translate(x, y);
  ctx.scale(iconScale, iconScale);
  ctx.fillStyle = color;
  ctx.beginPath();
  // Simplified Twitch path
  // Main shape
  ctx.moveTo(6, 0);
  ctx.lineTo(1.714, 4.286);
  ctx.lineTo(1.714, 19.714);
  ctx.lineTo(6.857, 19.714);
  ctx.lineTo(6.857, 24);
  ctx.lineTo(11.143, 19.714);
  ctx.lineTo(14.571, 19.714);
  ctx.lineTo(22.286, 12);
  ctx.lineTo(22.286, 0);
  ctx.closePath();
  ctx.fill();

  // Inner cutout (dark area)
  ctx.fillStyle = color === 'white' ? '#9146FF' : 'rgba(0,0,0,0.75)'; // match bg
  ctx.beginPath();
  ctx.moveTo(6.857, 1.714);
  ctx.lineTo(20.571, 1.714);
  ctx.lineTo(20.571, 11.143);
  ctx.lineTo(17.143, 14.571);
  ctx.lineTo(13.714, 14.571);
  ctx.lineTo(10.714, 17.571);
  ctx.lineTo(10.714, 14.571);
  ctx.lineTo(6.857, 14.571);
  ctx.closePath();
  ctx.fill();

  // Chat lines
  ctx.fillStyle = color;
  ctx.fillRect(11.571, 4.714, 1.715, 5.143);
  ctx.fillRect(16.286, 4.714, 1.714, 5.143);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
