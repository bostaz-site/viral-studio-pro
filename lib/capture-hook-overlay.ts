/**
 * Captures the hook text as a transparent PNG overlay.
 *
 * Three visual styles:
 *   - sticker:  Black text on white rounded rect — native TikTok text sticker look
 *   - outline:  White text with thick black stroke, no background — Hormozi style
 *   - capsule:  White text on dark semi-transparent rect, subtle border — original
 *
 * Uses Canvas 2D only (no SVG foreignObject — that taints the canvas).
 * Color emojis work natively with canvas fillText on Chrome/Edge/Safari.
 */
export type HookVisualStyle = 'sticker' | 'outline' | 'capsule'

export async function captureHookOverlayPNG({
  text,
  positionPct = 15,
  videoWidth = 1080,
  videoHeight = 1920,
  visual = 'sticker',
}: {
  text: string;
  positionPct?: number;
  videoWidth?: number;
  videoHeight?: number;
  visual?: HookVisualStyle;
  glowColor?: string; // kept for backward compat, ignored
}): Promise<{ png: string; capsuleW: number; capsuleH: number; positionPct: number } | null> {
  if (!text) return null;

  try {
    const scale = videoWidth / 280;
    const upperText = text.toUpperCase();

    // ── Font ──
    const fontSize = Math.round(visual === 'outline' ? 11 * scale : 10 * scale);
    const fontWeight = visual === 'outline' ? '900' : '800';
    const fontStr = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, "Helvetica Neue", sans-serif, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"`;

    // ── Measure text ──
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    measureCtx.font = fontStr;
    const textWidth = measureCtx.measureText(upperText).width;

    // ── Style-specific dimensions ──
    const paddingX = Math.round((visual === 'sticker' ? 16 : visual === 'outline' ? 6 : 12) * scale);
    const paddingY = Math.round((visual === 'sticker' ? 10 : visual === 'outline' ? 6 : 6) * scale);
    const borderRadius = Math.round((visual === 'sticker' ? 10 : 6) * scale);
    const extraPad = Math.round((visual === 'outline' ? 8 : 4) * scale); // room for stroke/shadow

    const capsuleW = Math.ceil(textWidth + paddingX * 2);
    const capsuleH = Math.ceil(fontSize + paddingY * 2);
    const canvasW = capsuleW + extraPad * 2;
    const canvasH = capsuleH + extraPad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const boxX = extraPad;
    const boxY = extraPad;

    if (visual === 'sticker') {
      // ── STICKER: white rect, black text ──
      // Subtle shadow behind the sticker for depth
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = Math.round(6 * scale);
      ctx.shadowOffsetY = Math.round(2 * scale);
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
      ctx.fill();
      ctx.restore();

      // Text
      ctx.save();
      ctx.fillStyle = '#111111';
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(upperText, boxX + capsuleW / 2, boxY + capsuleH / 2 + Math.round(1 * scale));
      ctx.restore();

    } else if (visual === 'outline') {
      // ── BOLD OUTLINE: white text, thick black stroke, no background ──
      ctx.save();
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const cx = boxX + capsuleW / 2;
      const cy = boxY + capsuleH / 2;
      // Black stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, Math.round(4 * scale));
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(upperText, cx, cy);
      // White fill
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(upperText, cx, cy);
      ctx.restore();

    } else {
      // ── CAPSULE: dark bg, subtle neutral border, no glow ──
      // Background
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
      ctx.fill();
      ctx.restore();

      // Subtle border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
      ctx.stroke();
      ctx.restore();

      // Text
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(upperText, boxX + capsuleW / 2, boxY + capsuleH / 2);
      ctx.restore();
    }

    const png = canvas.toDataURL('image/png');
    if (png.length > 500000) {
      console.warn('[captureHookOverlay] PNG too large, skipping:', png.length);
      return null;
    }

    console.log(`[captureHookOverlay] OK: ${canvasW}x${canvasH} visual=${visual}, ${png.length} chars`);
    return { png, capsuleW: canvasW, capsuleH: canvasH, positionPct };
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
