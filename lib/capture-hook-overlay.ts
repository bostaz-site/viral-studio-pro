/**
 * Captures the hook text as a transparent PNG overlay.
 *
 * Three visual styles:
 *   - sticker:  Black text on white rounded rect — native TikTok text sticker look
 *   - outline:  White text with thick black stroke, no background — Hormozi style
 *   - capsule:  White text on dark semi-transparent rect, subtle border — original
 *
 * Typography: Apple-style SF Pro stack, semibold/bold weight, tight tracking.
 * Emoji: Apple emoji images loaded from CDN (emoji-datasource-apple) to replace
 *        Windows Segoe emoji glyphs. Only used emojis are fetched.
 *
 * Uses Canvas 2D only (no SVG foreignObject — that taints the canvas).
 */
export type HookVisualStyle = 'sticker' | 'outline' | 'capsule'

// ── Emoji helpers ──────────────────────────────────────────────────────────

const EMOJI_PATTERN = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F?\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}))*/gu

type Segment = { type: 'text' | 'emoji'; content: string; img?: HTMLImageElement | null }

function splitTextEmoji(text: string): Segment[] {
  const result: Segment[] = []
  let lastIdx = 0
  for (const m of text.matchAll(EMOJI_PATTERN)) {
    if (m.index! > lastIdx) result.push({ type: 'text', content: text.slice(lastIdx, m.index!) })
    result.push({ type: 'emoji', content: m[0] })
    lastIdx = m.index! + m[0].length
  }
  if (lastIdx < text.length) result.push({ type: 'text', content: text.slice(lastIdx) })
  return result
}

function emojiUnified(emoji: string): string {
  return [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(cp => cp !== 'fe0f')
    .join('-')
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function loadAppleEmoji(emoji: string): Promise<HTMLImageElement | null> {
  const unified = emojiUnified(emoji)
  const base = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64'
  // Try without variation selector first (most common), then with full codepoints
  const img = await loadImg(`${base}/${unified}.png`)
  if (img) return img
  // Fallback: full codepoints including fe0f
  const full = [...emoji].map(c => c.codePointAt(0)!.toString(16)).join('-')
  if (full !== unified) return loadImg(`${base}/${full}.png`)
  return null
}

function measureSegments(
  ctx: CanvasRenderingContext2D, segments: Segment[], emojiSize: number,
): number {
  let w = 0
  for (const seg of segments) {
    if (seg.type === 'emoji' && seg.img) w += emojiSize
    else w += ctx.measureText(seg.content).width
  }
  return w
}

function drawSegments(
  ctx: CanvasRenderingContext2D, segments: Segment[],
  startX: number, centerY: number, emojiSize: number,
) {
  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  let x = startX
  for (const seg of segments) {
    if (seg.type === 'emoji' && seg.img) {
      ctx.drawImage(seg.img, x, centerY - emojiSize * 0.5, emojiSize, emojiSize)
      x += emojiSize
    } else {
      ctx.fillText(seg.content, x, centerY)
      x += ctx.measureText(seg.content).width
    }
  }
  ctx.textAlign = prevAlign
}

// ── Main capture function ──────────────────────────────────────────────────

export async function captureHookOverlayPNG({
  text,
  positionPct = 18,
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

    // ── Font — Apple-style SF Pro stack, semibold/bold, tight tracking ──
    const fontSize = Math.round(visual === 'outline' ? 12.5 * scale : 11.5 * scale);
    const fontWeight = visual === 'outline' ? '800' : '700';
    const fontStr = `${fontWeight} ${fontSize}px -apple-system, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif`;
    const tracking = Math.round(-0.3 * scale); // slight negative letter-spacing

    // ── Detect and pre-load Apple emoji images ──
    const segments = splitTextEmoji(upperText);
    const hasEmoji = segments.some(s => s.type === 'emoji');
    if (hasEmoji) {
      await Promise.all(
        segments.filter(s => s.type === 'emoji').map(async s => {
          s.img = await loadAppleEmoji(s.content)
        }),
      )
    }
    const emojiSize = Math.round(fontSize * 1.15); // emoji slightly larger than text caps

    // ── Measure text ──
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    measureCtx.font = fontStr;
    if (tracking) (measureCtx as unknown as Record<string, string>).letterSpacing = `${tracking}px`;
    const textWidth = hasEmoji
      ? measureSegments(measureCtx, segments, emojiSize)
      : measureCtx.measureText(upperText).width;

    // ── Style-specific dimensions ──
    const paddingX = Math.round((visual === 'sticker' ? 16 : visual === 'outline' ? 6 : 12) * scale);
    const paddingY = Math.round((visual === 'sticker' ? 10 : visual === 'outline' ? 6 : 6) * scale);
    const borderRadius = Math.round((visual === 'sticker' ? 10 : 6) * scale);
    const extraPad = Math.round((visual === 'outline' ? 8 : 4) * scale);

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
    const centerX = boxX + capsuleW / 2;
    const centerY = boxY + capsuleH / 2 + (visual === 'sticker' ? Math.round(1 * scale) : 0);

    // Apply tight tracking
    if (tracking) (ctx as unknown as Record<string, string>).letterSpacing = `${tracking}px`;

    if (visual === 'sticker') {
      // ── STICKER: white rect, black text ──
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = Math.round(6 * scale);
      ctx.shadowOffsetY = Math.round(2 * scale);
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#111111';
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      if (hasEmoji && segments.some(s => s.img)) {
        drawSegments(ctx, segments, centerX - textWidth / 2, centerY, emojiSize);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(upperText, centerX, centerY);
      }
      ctx.restore();

    } else if (visual === 'outline') {
      // ── BOLD OUTLINE: white text, thick black stroke, no background ──
      ctx.save();
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';

      if (hasEmoji && segments.some(s => s.img)) {
        // Stroke pass — text segments only
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(3, Math.round(4 * scale));
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.textAlign = 'left';
        let x = centerX - textWidth / 2;
        for (const seg of segments) {
          if (seg.type === 'text') {
            ctx.strokeText(seg.content, x, centerY);
            x += ctx.measureText(seg.content).width;
          } else {
            x += seg.img ? emojiSize : ctx.measureText(seg.content).width;
          }
        }
        // Fill pass — text + emoji images
        ctx.fillStyle = '#FFFFFF';
        drawSegments(ctx, segments, centerX - textWidth / 2, centerY, emojiSize);
      } else {
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(3, Math.round(4 * scale));
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(upperText, centerX, centerY);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(upperText, centerX, centerY);
      }
      ctx.restore();

    } else {
      // ── CAPSULE: dark bg, subtle neutral border ──
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
      roundRect(ctx, boxX, boxY, capsuleW, capsuleH, borderRadius);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = fontStr;
      ctx.textBaseline = 'middle';
      if (hasEmoji && segments.some(s => s.img)) {
        drawSegments(ctx, segments, centerX - textWidth / 2, centerY, emojiSize);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(upperText, centerX, centerY);
      }
      ctx.restore();
    }

    const png = canvas.toDataURL('image/png');
    if (png.length > 500000) {
      console.warn('[captureHookOverlay] PNG too large, skipping:', png.length);
      return null;
    }

    console.log(`[captureHookOverlay] OK: ${canvasW}x${canvasH} visual=${visual}, emoji=${hasEmoji}, ${png.length} chars`);
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
