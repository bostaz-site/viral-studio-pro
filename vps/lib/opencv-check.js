/**
 * OpenCV startup self-test.
 *
 * Runs a quick Python check to verify cv2.CascadeClassifier + haarcascades
 * are functional. Logs OPENCV OK / OPENCV BROKEN and sends a Discord alert
 * if broken — this failure was previously invisible and caused crop advisor
 * + face tracking to silently fall back on every render.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

/** @type {boolean | null} null = not yet tested */
let opencvHealthy = null;

const TEST_SCRIPT = [
  'import cv2',
  'cc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")',
  'print("OK" if not cc.empty() else "CASCADE_EMPTY")',
].join('; ');

export async function checkOpenCV() {
  try {
    const { stdout, stderr } = await execFileAsync('python3', ['-c', TEST_SCRIPT], { timeout: 10000 });
    const result = stdout.trim();
    if (result === 'OK') {
      opencvHealthy = true;
      logger.info('OPENCV OK — CascadeClassifier + haarcascades verified at startup');
    } else {
      opencvHealthy = false;
      logger.error({ result, stderr: stderr?.slice(0, 500) }, 'OPENCV BROKEN — cascade loaded but empty');
      await alertDiscord(`Cascade loaded but empty: ${result}`);
    }
  } catch (err) {
    opencvHealthy = false;
    logger.error({ err: err.message, stderr: err.stderr?.slice(0, 500) }, `OPENCV BROKEN: ${err.message}`);
    await alertDiscord(err.message);
  }
}

export function getOpenCVStatus() {
  return opencvHealthy;
}

async function alertDiscord(errorMsg) {
  const webhookUrl = process.env.DISCORD_AUDIT_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**[CRITICAL] OpenCV broken on VPS** — crop advisor and face tracking are dead on every render.\nError: \`${errorMsg.slice(0, 300)}\`\nFix: check Dockerfile opencv-python-headless install + system deps (libglib2.0-0, libgl1-mesa-glx).`,
      }),
    });
  } catch { /* non-critical */ }
}
