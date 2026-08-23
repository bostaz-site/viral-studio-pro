/**
 * Crop Advisor — analyzes video content to recommend the best framing mode.
 *
 * Decision matrix:
 *   1. Reaction layout (webcam in corner) → 'reaction'
 *   2. Large centered face (talking head / facecam streamer) → 'fullframe'
 *   3. No dominant face / wide action (gameplay, IRL wide) → 'fit'
 *
 * Uses the existing face-detect.py (OpenCV) on 3-5 sampled frames.
 * Graceful: any failure → 'fit' (safe fallback — never crops blindly).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FACE_DETECT_SCRIPT = path.join(__dirname, 'face-detect.py');

/**
 * Probe source video dimensions via ffprobe.
 * @returns {{ w: number, h: number } | null}
 */
async function probeVideoDimensions(videoPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      videoPath,
    ], { timeout: 10000 });
    const [w, h] = stdout.trim().split(',').map(Number);
    if (w > 0 && h > 0) return { w, h };
  } catch { /* non-critical */ }
  return null;
}

/**
 * @typedef {'fullframe' | 'fit' | 'reaction'} CropAdvice
 *
 * @typedef {Object} CropAdvisorResult
 * @property {CropAdvice} recommended - The recommended zoom mode
 * @property {string} reason - Human-readable explanation
 * @property {number} faceScore - 0-1 how dominant the face is (size × centering × consistency)
 * @property {{ detectionRate: number, avgSizeRatio: number, centeredness: number }} details
 */

/**
 * Analyze the video and recommend a crop mode.
 *
 * @param {string} videoPath - Path to the source video file
 * @param {{ reactionLayout?: { isReactionLayout: boolean } | null, timeoutMs?: number }} opts
 * @returns {Promise<CropAdvisorResult>}
 */
export async function adviseCrop(videoPath, opts = {}) {
  const { reactionLayout = null, timeoutMs = 12000 } = opts;

  // If layout detector already flagged reaction, trust it
  if (reactionLayout && reactionLayout.isReactionLayout) {
    return {
      recommended: 'reaction',
      reason: 'Reaction layout detected (webcam overlay + content)',
      faceScore: 0,
      details: { detectionRate: 0, avgSizeRatio: 0, centeredness: 0 },
    };
  }

  // Probe source dimensions
  const dims = await probeVideoDimensions(videoPath);
  if (!dims) {
    return fallback('Could not probe video dimensions');
  }

  const { w: vidW, h: vidH } = dims;

  // Already vertical source → fullframe works (it's just a scale, no real crop)
  if (vidH >= vidW) {
    return {
      recommended: 'fullframe',
      reason: 'Source is already vertical — fullframe is a natural fit',
      faceScore: 1,
      details: { detectionRate: 1, avgSizeRatio: 1, centeredness: 1 },
    };
  }

  // Run face detection (coarse: every 20 frames for speed)
  if (!fs.existsSync(FACE_DETECT_SCRIPT)) {
    return fallback('face-detect.py not found');
  }

  try {
    const startMs = Date.now();
    const { stdout, stderr } = await execFileAsync('python3', [
      FACE_DETECT_SCRIPT,
      videoPath,
      '--every', '20',
      '--width', String(vidW),
      '--height', String(vidH),
    ], {
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });

    if (stderr) {
      console.warn(`[CropAdvisor] Python stderr: ${stderr.slice(0, 200)}`);
    }

    const result = JSON.parse(stdout);
    const elapsed = Date.now() - startMs;

    if (result.error || !result.smoothed) {
      return fallback(`face-detect error: ${result.error || 'no smoothed data'}`);
    }

    const totalFrames = Math.max(1, result.raw_keyframes || result.smoothed.length);
    const detectedCount = result.detected_count || 0;
    const detectionRate = detectedCount / totalFrames;

    // No faces at all → definitely gameplay/wide content → fit
    if (detectedCount === 0 || detectionRate < 0.15) {
      console.log(`[CropAdvisor] No dominant face (rate=${detectionRate.toFixed(2)}) → fit [${elapsed}ms]`);
      return {
        recommended: 'fit',
        reason: `No dominant face detected (${Math.round(detectionRate * 100)}% detection rate) — likely gameplay or wide content`,
        faceScore: 0,
        details: { detectionRate, avgSizeRatio: 0, centeredness: 0 },
      };
    }

    // Analyze face positions from smoothed data
    const smoothed = result.smoothed;

    // Check if face is centered (within middle 60% of frame)
    let sumCxN = 0;
    for (const kf of smoothed) {
      sumCxN += kf.cx / vidW;
    }
    const avgCxN = sumCxN / smoothed.length; // 0=left, 1=right
    // Centeredness: 1.0 when face is at 0.5, drops to 0 at edges
    const centeredness = 1 - Math.abs(avgCxN - 0.5) * 2; // 0..1

    // Estimate face size from the keyframes data if available
    // face-detect.py stores raw keyframes with w/h but only outputs smoothed cx/cy
    // We use the zoom field as a proxy: larger zoom → larger face detection
    // Alternative: use detection rate + consistency as proxy for face dominance
    let avgSizeRatio = 0;
    if (result.keyframes && result.keyframes.length > 0) {
      // Raw keyframes available — use actual face width
      let sumFaceW = 0;
      let faceCount = 0;
      for (const kf of result.keyframes) {
        if (kf.detected && kf.w > 0) {
          sumFaceW += kf.w / vidW;
          faceCount++;
        }
      }
      avgSizeRatio = faceCount > 0 ? sumFaceW / faceCount : 0;
    } else {
      // Estimate: high detection rate + centered → likely large face
      // Low detection rate → small or intermittent face
      avgSizeRatio = detectionRate * 0.3; // rough estimate
    }

    // Position stability (low variance = static face = talking head)
    let varianceX = 0;
    for (const kf of smoothed) {
      varianceX += Math.pow(kf.cx / vidW - avgCxN, 2);
    }
    varianceX = Math.sqrt(varianceX / smoothed.length);
    const isStable = varianceX < 0.08;

    // Composite face score: how "safe" is fullframe?
    //   - Large face (>15% of frame width) → strong signal
    //   - Centered (middle 60%) → fullframe won't cut the subject
    //   - High detection rate → face is consistently visible
    //   - Stable position → talking head, not action moving around
    const faceScore =
      (avgSizeRatio >= 0.15 ? 0.35 : avgSizeRatio * 2.3) +  // face size: up to 0.35
      (centeredness * 0.25) +                                  // centering: up to 0.25
      (Math.min(detectionRate, 1) * 0.2) +                     // detection rate: up to 0.2
      (isStable ? 0.2 : varianceX < 0.15 ? 0.1 : 0);         // stability: up to 0.2

    const details = { detectionRate, avgSizeRatio, centeredness };

    // Decision thresholds
    if (faceScore >= 0.55 && centeredness >= 0.4) {
      console.log(`[CropAdvisor] Centered face (score=${faceScore.toFixed(2)}, center=${centeredness.toFixed(2)}, size=${avgSizeRatio.toFixed(2)}) → fullframe [${elapsed}ms]`);
      return {
        recommended: 'fullframe',
        reason: `Dominant centered face detected (score ${Math.round(faceScore * 100)}%) — fullframe crop preserves subject`,
        faceScore,
        details,
      };
    }

    console.log(`[CropAdvisor] Face not dominant enough (score=${faceScore.toFixed(2)}, center=${centeredness.toFixed(2)}) → fit [${elapsed}ms]`);
    return {
      recommended: 'fit',
      reason: `Face not dominant enough for center crop (score ${Math.round(faceScore * 100)}%) — fit preserves full content`,
      faceScore,
      details,
    };

  } catch (err) {
    if (err.killed) {
      console.warn(`[CropAdvisor] Timeout after ${timeoutMs}ms`);
    } else {
      console.warn(`[CropAdvisor] Error: ${err.message}`);
    }
    return fallback(`Analysis failed: ${err.message}`);
  }
}

/** Safe fallback: fit preserves all content, never crops blindly */
function fallback(reason) {
  console.log(`[CropAdvisor] Fallback to fit: ${reason}`);
  return {
    recommended: 'fit',
    reason: `Fallback — ${reason}`,
    faceScore: 0,
    details: { detectionRate: 0, avgSizeRatio: 0, centeredness: 0 },
  };
}
