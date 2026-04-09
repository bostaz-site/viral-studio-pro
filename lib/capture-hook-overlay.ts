/**
 * Captures ONLY the hook capsule as a small transparent PNG.
 *
 * Instead of a full 720x1280 canvas (mostly transparent, huge file),
 * we capture just the capsule+glow area and send position data separately.
 * The VPS overlays it at the correct position.
 *
 * Uses Canvas 2D for capsule + SVG foreignObject for emoji text.
 */
export async function captureHookOverlayPNG({
  text,
  positionPct = 15,
  videoWidth = 720,
  videoHeight = 1280,
}: {
  text: string;
  positionPct?: number;
  videoWidth?: number;
  videoHeight?: number;
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
    measureCtx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
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

    // ── Glow (CSS box-shadow: 0 0 10px #9146FF88, 0 0 24px #9146FF44) ──
    ctx.save();
    ctx.shadowColor = 'rgba(145, 70, 255, 0.27)';
    ctx.shadowBlur = Math.round(24 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(145, 70, 255, 0.53)';
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
    ctx.strokeStyle = '#9146FF';
    ctx.lineWidth = borderW;
    roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
    ctx.stroke();
    ctx.restore();

    // ── Text via SVG foreignObject (emoji support) ──
    let textDrawn = false;
    try {
      const textImg = await renderTextToImage(upperText, fontSize, textWidth, capsuleH);
      if (textImg) {
        ctx.drawImage(textImg, boxX + paddingX, boxY, textWidth, capsuleH);
        textDrawn = true;
      }
    } catch {
      // SVG foreignObject failed — fallback to canvas fillText
    }

    // Fallback: plain canvas text (no color emojis but at least shows text)
    if (!textDrawn) {
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(upperText, boxX + capsuleW / 2, boxY + capsuleH / 2);
      ctx.restore();
    }

    const png = canvas.toDataURL('image/png');

    // Sanity check — if the base64 is too large (>500KB), skip it
    if (png.length > 500000) {
      console.warn('[captureHookOverlay] PNG too large, skipping:', png.length);
      return null;
    }

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

/**
 * Render text with color emojis via SVG foreignObject → Image.
 */
function renderTextToImage(
  text: string,
  fontSize: number,
  width: number,
  height: number,
): Promise<HTMLImageElement | null> {
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:${fontSize}px;font-weight:900;color:white;text-transform:uppercase;letter-spacing:${Math.round(fontSize * 0.05)}px;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;white-space:nowrap;text-align:center;">${escapeHtml(text)}</div>
</foreignObject>
</svg>`;

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    // Timeout after 2s — don't block render if SVG fails
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 2000);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
