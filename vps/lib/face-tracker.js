/**
 * Face Tracker — Node.js wrapper for the Python face detection script.
 *
 * Runs face-detect.py on a video file, returns smoothed keyframes
 * that can be fed to buildSmartZoomFilter for follow mode.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.join(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), 'face-detect.py');

/**
 * Detect faces in a video and return smoothed tracking keyframes.
 *
 * @param {string} videoPath - Path to the video file
 * @param {Object} opts
 * @param {number} opts.canvasW - Target canvas width (default: 720)
 * @param {number} opts.canvasH - Target canvas height (default: 1280)
 * @param {number} opts.everyN  - Sample every N frames (default: 8)
 * @param {number} opts.timeoutMs - Max execution time (default: 30000)
 * @returns {Promise<Object>} - { smoothed: [{t, cx, cy, zoom}], detected_count, ... }
 */
export async function detectFaces(videoPath, opts = {}) {
  const {
    canvasW = 720,
    canvasH = 1280,
    everyN = 8,
    timeoutMs = 30000,
  } = opts;

  // Verify script exists
  if (!fs.existsSync(SCRIPT_PATH)) {
    console.error(`[FaceTracker] Script not found: ${SCRIPT_PATH}`);
    return { error: 'face-detect.py not found', smoothed: [] };
  }

  // Verify video exists
  if (!fs.existsSync(videoPath)) {
    console.error(`[FaceTracker] Video not found: ${videoPath}`);
    return { error: 'Video file not found', smoothed: [] };
  }

  try {
    console.log(`[FaceTracker] Starting face detection: ${videoPath} (every ${everyN} frames, ${canvasW}x${canvasH})`);
    const startTime = Date.now();

    const { stdout, stderr } = await execFileAsync('python3', [
      SCRIPT_PATH,
      videoPath,
      '--every', String(everyN),
      '--width', String(canvasW),
      '--height', String(canvasH),
    ], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB — large clips can have many keyframes
    });

    if (stderr) {
      console.warn(`[FaceTracker] Python stderr: ${stderr.slice(0, 500)}`);
    }

    const elapsed = Date.now() - startTime;
    const result = JSON.parse(stdout);

    if (result.error) {
      console.error(`[FaceTracker] Detection error: ${result.error}`);
      return { error: result.error, smoothed: [] };
    }

    console.log(`[FaceTracker] Done in ${elapsed}ms — ${result.detected_count}/${result.raw_keyframes} frames with face, ${result.smoothed?.length || 0} smoothed keyframes`);

    return result;
  } catch (err) {
    if (err.killed) {
      console.error(`[FaceTracker] Timeout after ${timeoutMs}ms`);
      return { error: 'Face detection timed out', smoothed: [] };
    }
    console.error(`[FaceTracker] Error:`, err.message);
    return { error: err.message, smoothed: [] };
  }
}
