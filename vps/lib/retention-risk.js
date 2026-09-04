/**
 * Retention Risk Scorer — estimates how likely a clip is to lose viewers
 * without additional visual stimulation (split-screen gameplay).
 *
 * Score 0-100. >= 55 → split-screen recommended.
 *
 * Signals:
 *   +35  static cam / just chatting (crop advisor → fit with low face detection)
 *   +15  duo layout (talking heads, low action)
 *   +25  low visual motion (inter-frame diff < threshold)
 *   +20  sparse audio peaks (< 4 per minute)
 *   +15  low content density (P5 analysis density < 5)
 *   +5   long clip on static content (> 30s + static cam)
 */

/**
 * Compute retention risk from available analysis signals.
 *
 * @param {object} opts
 * @param {string} opts.cropRecommendation - 'fullframe' | 'fit' | 'reaction' | 'duo'
 * @param {number} opts.faceDetectionRate  - 0-1 from crop advisor
 * @param {number} opts.audiopeakCount     - number of audio peaks in the clip
 * @param {number} opts.duration           - clip duration in seconds
 * @param {number|null} opts.analysisDensity - P5 analysis density (0-10), null if unavailable
 * @param {number|null} opts.motionScore   - 0-100 inter-frame motion score, null if unavailable
 * @returns {{ retention_risk: number, split_screen_recommended: boolean, why: string[] }}
 */
export function computeRetentionRisk({
  cropRecommendation = 'fullframe',
  faceDetectionRate = 1,
  audiopeakCount = 10,
  duration = 30,
  analysisDensity = null,
  motionScore = null,
} = {}) {
  let risk = 0;
  const why = [];

  // Static cam / just chatting: fit + dominant face = talking head
  const isStaticCam = cropRecommendation === 'fit' || (cropRecommendation === 'fullframe' && faceDetectionRate > 0.7);
  if (isStaticCam && faceDetectionRate > 0.5) {
    risk += 35;
    why.push('static cam / talking head');
  }

  // Duo layout: two speakers, usually low action
  if (cropRecommendation === 'duo') {
    risk += 15;
    why.push('duo layout (low action)');
  }

  // Low visual motion
  if (motionScore !== null && motionScore < 25) {
    risk += 25;
    why.push(`low visual motion (${motionScore})`);
  }

  // Sparse audio peaks (< 4 per minute)
  const peaksPerMin = duration > 0 ? (audiopeakCount / duration) * 60 : 0;
  if (peaksPerMin < 4) {
    risk += 20;
    why.push(`sparse audio peaks (${peaksPerMin.toFixed(1)}/min)`);
  }

  // Low content density from P5 analysis
  if (analysisDensity !== null && analysisDensity < 5) {
    risk += 15;
    why.push(`low density (${analysisDensity})`);
  }

  // Long clip on static content
  if (duration > 30 && isStaticCam) {
    risk += 5;
    why.push(`long static clip (${Math.round(duration)}s)`);
  }

  const score = Math.min(100, risk);

  return {
    retention_risk: score,
    split_screen_recommended: score >= 55,
    why,
  };
}
