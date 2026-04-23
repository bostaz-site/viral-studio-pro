/**
 * Captures ONLY the hook capsule as a small transparent PNG.
 *
 * Uses Canvas 2D only (no SVG foreignObject — that taints the canvas
 * and makes toDataURL() throw SecurityError).
 *
 * Color emojis work natively with canvas fillText on Chrome/Edge/Safari.
 */
export async function captureHookOverlayPNG({
  text,
  positionPct = 15,
  videoWidth = 720,
  videoHeight = 1280,
  glowColor = '#9146FF',
}: {
  text: string;
  positionPct?: number;
  videoWidth?: number;
  videoHeight?: number;
  glowColor?: string;
}): Promise<{ png: string; capsuleW: number; capsuleH: number; positionPct: number } | null> {
  if (!text) return null;

  try {
    const scale = videoWidth / 280;

    // ── CSS values scaled ──
    const fontSize = Math.round(10 * scale);
    const paddingX = Math.round(12 * scale);
    const paddingY = Math.round(6 * scale);
    const borderW = Math.max(2, Math.round(2 * scale));
    const borderRadius = Math.round(6 * scale);
    const glowPad = Math.round(30 * scale); // extra space for glow bleed

    // ── Measure text ──
    const upperText = text.toUpperCase();
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    const fontStr = `900 ${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    measureCtx.font = fontStr;
    const textWidth = measureCtx.measureText(upperText).width;

    // ── Capsule dimensions ──
    const capsuleW = Math.ceil(textWidth + paddingX * 2);
    const capsuleH = Math.ceil(fontSize + paddingY * 2);

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

    // ── Convert glowColor hex to RGB components ──
    const hexToRgb = (hex: string) => {
      const h = hex.replace('#', '');
      return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
    };
    const gc = hexToRgb(glowColor);

    // ── Glow (outer + inner) ──
    ctx.save();
    ctx.shadowColor = `rgba(${gc.r}, ${gc.g}, ${gc.b}, 0.27)`;
    ctx.shadowBlur = Math.round(24 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = `rgba(${gc.r}, ${gc.g}, ${gc.b}, 0.53)`;
    ctx.shadowBlur = Math.round(10 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
    ctx.fill();
    ctx.restore();

    // ── Background ──
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
    ctx.fill();
    ctx.restore();

    // ── Border ──
    ctx.save();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = borderW;
    roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
    ctx.stroke();
    ctx.restore();

    // ── Text (direct canvas fillText — supports color emojis natively) ──
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font = fontStr;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(upperText, boxX + capsuleW / 2, boxY + capsuleH / 2);
    ctx.restore();

    const png = canvas.toDataURL('image/png');

    // Sanity check — if the base64 is too large (>500KB), skip it
    if (png.length > 500000) {
      console.warn('[captureHookOverlay] PNG too large, skipping:', png.length);
      return null;
    }

    console.log(`[captureHookOverlay] OK: ${canvasW}x${canvasH}, ${png.length} chars`);
    return {
      png,
      capsuleW: canvasW,
      capsuleH: canvasH,
      positionPct,
    };
  } catch (err) {
    console.error('[captureHookOverlay] Error:', err);
    return null;
  }
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
