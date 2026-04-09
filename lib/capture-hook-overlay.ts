import html2canvas from 'html2canvas';

/**
 * Captures the hook text overlay as a transparent PNG at the exact video resolution.
 *
 * This renders the hook using the SAME CSS as the live preview,
 * but at the actual video dimensions (e.g. 720x1280).
 * The result is a base64 PNG that can be sent to the VPS for FFmpeg overlay.
 *
 * This guarantees pixel-perfect match between preview and final render.
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

  // Scale factor: CSS values are designed for ~280px preview width
  const scale = videoWidth / 280;

  // Create an off-screen container at exact video resolution
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: -9999px;
    width: ${videoWidth}px;
    height: ${videoHeight}px;
    overflow: hidden;
    background: transparent;
    z-index: -1;
  `;

  // Create the hook overlay — same structure as the live preview
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: ${positionPct}%;
    width: 100%;
    padding: 0 ${Math.round(8 * scale)}px;
    display: flex;
    justify-content: center;
    pointer-events: none;
  `;

  const capsule = document.createElement('div');
  capsule.style.cssText = `
    padding: ${Math.round(6 * scale)}px ${Math.round(12 * scale)}px;
    border-radius: ${Math.round(6 * scale)}px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    width: fit-content;
    max-width: 100%;
    background: rgba(0,0,0,0.75);
    border: ${Math.round(2 * scale)}px solid #9146FF;
    box-shadow: 0 0 ${Math.round(10 * scale)}px #9146FF88, 0 0 ${Math.round(24 * scale)}px #9146FF44;
  `;

  const span = document.createElement('span');
  span.style.cssText = `
    font-size: ${Math.round(10 * scale)}px;
    font-weight: 900;
    color: white;
    text-transform: uppercase;
    letter-spacing: ${Math.round(0.5 * scale)}px;
    line-height: 1;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  span.textContent = text;

  capsule.appendChild(span);
  wrapper.appendChild(capsule);
  container.appendChild(wrapper);
  document.body.appendChild(container);

  try {
    // Capture with html2canvas — transparent background
    const canvas = await html2canvas(container, {
      width: videoWidth,
      height: videoHeight,
      backgroundColor: null, // transparent
      scale: 1, // 1:1 pixel ratio — we already sized to video resolution
      logging: false,
      useCORS: true,
    });

    // Convert to base64 PNG
    const base64 = canvas.toDataURL('image/png');

    return base64;
  } catch (err) {
    console.error('[captureHookOverlayPNG] Failed:', err);
    return null;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}
