/**
 * Captures the hook text overlay as a transparent PNG.
 *
 * HYBRID approach for pixel-perfect results:
 *   - Canvas 2D API for capsule background, border, glow (exact CSS match)
 *   - SVG foreignObject + HTML for text (supports color emojis natively)
 *
 * Matches the CSS live preview exactly:
 *   background: rgba(0,0,0,0.75)
 *   border: 2px solid #9146FF
 *   box-shadow: 0 0 10px #9146FF88, 0 0 24px #9146FF44
 *   border-radius: 6px (rounded-md)
 *   text: 10px font-black white uppercase tracking-wide
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
}): Promise<string | null> {
  if (!text) return null;

  const scale = videoWidth / 280;

  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // ── CSS values scaled to video resolution ──
  const fontSize = Math.round(10 * scale);
  const paddingX = Math.round(12 * scale);
  const paddingY = Math.round(6 * scale);
  const borderW = Math.max(2, Math.round(2 * scale));
  const borderRadius = Math.round(6 * scale);

  // ── Measure text using a temp canvas with emoji-capable font ──
  const fontStr = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.font = fontStr;
  const upperText = text.toUpperCase();
  const textMetrics = ctx.measureText(upperText);
  const textWidth = textMetrics.width;

  // ── Box dimensions ──
  const boxW = textWidth + paddingX * 2;
  const boxH = fontSize + paddingY * 2;
  const boxX = (videoWidth - boxW) / 2;
  const boxY = videoHeight * (Math.max(5, Math.min(90, positionPct)) / 100);

  // ── Draw glow layers (CSS box-shadow) ──
  // Outer glow: 0 0 24px #9146FF44
  ctx.save();
  ctx.shadowColor = 'rgba(145, 70, 255, 0.27)';
  ctx.shadowBlur = Math.round(24 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  roundRect(ctx, boxX, boxY, boxW, boxH, borderRadius);
  ctx.fill();
  ctx.restore();

  // Inner glow: 0 0 10px #9146FF88
  ctx.save();
  ctx.shadowColor = 'rgba(145, 70, 255, 0.53)';
  ctx.shadowBlur = Math.round(10 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  roundRect(ctx, boxX, boxY, boxW, boxH, borderRadius);
  ctx.fill();
  ctx.restore();

  // ── Draw capsule background ──
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  roundRect(ctx, boxX, boxY, boxW, boxH, borderRadius);
  ctx.fill();
  ctx.restore();

  // ── Draw border ──
  ctx.save();
  ctx.strokeStyle = '#9146FF';
  ctx.lineWidth = borderW;
  roundRect(ctx, boxX, boxY, boxW, boxH, borderRadius);
  ctx.stroke();
  ctx.restore();

  // ── Draw text via SVG foreignObject (supports color emojis) ──
  const textImg = await renderTextToImage(upperText, fontSize, textWidth, boxH);
  if (textImg) {
    // Center text in capsule
    const textX = boxX + paddingX;
    const textY = boxY;
    ctx.drawImage(textImg, textX, textY, textWidth, boxH);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Render text (with emoji support) to an Image using SVG foreignObject.
 * This is the only reliable way to get color emojis on Canvas.
 */
async function renderTextToImage(
  text: string,
  fontSize: number,
  width: number,
  height: number,
): Promise<HTMLImageElement | null> {
  // Build SVG with foreignObject containing HTML text
  const svgStr = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-size: ${fontSize}px;
          font-weight: 900;
          color: white;
          text-transform: uppercase;
          letter-spacing: ${fontSize * 0.05}px;
          line-height: 1;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
          white-space: nowrap;
          text-align: center;
        ">${escapeHtml(text)}</div>
      </foreignObject>
    </svg>`;

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Draw a rounded rectangle path on a canvas context.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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
