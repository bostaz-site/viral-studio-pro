/**
 * Captures the hook text overlay as a transparent PNG using Canvas API.
 *
 * Uses Canvas 2D API directly (no html2canvas) for pixel-perfect control.
 * Draws the exact same visual as the CSS live preview:
 *   - Black capsule rgba(0,0,0,0.75) with rounded corners
 *   - Thin 2px #9146FF purple border
 *   - Purple neon glow (box-shadow)
 *   - White bold uppercase text with emojis
 *
 * The result is a base64 PNG sent to VPS → FFmpeg overlay.
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

  // Scale factor: CSS values designed for ~280px preview width
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
  const letterSpacing = 0.5 * scale;

  // ── Measure text ──
  const upperText = text.toUpperCase();
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // Measure with letter spacing
  let textWidth = 0;
  for (let i = 0; i < upperText.length; i++) {
    textWidth += ctx.measureText(upperText[i]).width;
    if (i < upperText.length - 1) textWidth += letterSpacing;
  }

  // ── Box dimensions ──
  const boxW = textWidth + paddingX * 2;
  const boxH = fontSize + paddingY * 2;
  const boxX = (videoWidth - boxW) / 2;
  const boxY = videoHeight * (Math.max(5, Math.min(90, positionPct)) / 100);

  // ── Draw glow (box-shadow: 0 0 10px #9146FF88, 0 0 24px #9146FF44) ──
  // Layer 1: wide outer glow
  ctx.save();
  ctx.shadowColor = '#9146FF44';
  ctx.shadowBlur = Math.round(24 * scale);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(0,0,0,0)'; // invisible fill just to trigger shadow
  roundRect(ctx, boxX - 1, boxY - 1, boxW + 2, boxH + 2, borderRadius);
  ctx.fill();
  ctx.restore();

  // Layer 2: tight inner glow
  ctx.save();
  ctx.shadowColor = '#9146FF88';
  ctx.shadowBlur = Math.round(10 * scale);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  roundRect(ctx, boxX - 1, boxY - 1, boxW + 2, boxH + 2, borderRadius);
  ctx.fill();
  ctx.restore();

  // ── Draw capsule background: rgba(0,0,0,0.75) ──
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  roundRect(ctx, boxX, boxY, boxW, boxH, borderRadius);
  ctx.fill();
  ctx.restore();

  // ── Draw border: 2px solid #9146FF ──
  ctx.save();
  ctx.strokeStyle = '#9146FF';
  ctx.lineWidth = borderW;
  roundRect(ctx, boxX, boxY, boxW, boxH, borderRadius);
  ctx.stroke();
  ctx.restore();

  // ── Draw text: white, bold, uppercase, with letter-spacing ──
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';

  // Draw each character individually for letter-spacing support
  let x = boxX + paddingX;
  const y = boxY + boxH / 2;
  for (let i = 0; i < upperText.length; i++) {
    ctx.fillText(upperText[i], x, y);
    x += ctx.measureText(upperText[i]).width + letterSpacing;
  }
  ctx.restore();

  // ── Export as PNG base64 ──
  return canvas.toDataURL('image/png');
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
  r: number
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
