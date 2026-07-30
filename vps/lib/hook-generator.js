/**
 * Hook Generator — Detects the peak viral moment in a clip and generates
 * contextual hook text overlays + reorder instructions for seamless looping.
 *
 * Pipeline:
 *   1. Score each second of the clip (spike detection + viral keywords + positional prior)
 *   2. Pick the top moment (1-2s)
 *   3. Generate 3 hook text variants via Claude API (contextual, references peak moment)
 *   4. Output reorder timestamps for FFmpeg concat (word-boundary snapped)
 */

import { supabase } from './supabase-client.js';

// ─── Viral Keywords (weighted) ──────────────────────────────────────────────
const VIRAL_KEYWORDS = {
  // High-impact reactions (weight 3)
  high: [
    'no way', 'what the', 'oh my god', 'omg', 'holy', 'insane', 'crazy',
    'bro', 'bruh', 'dude', 'yo', 'wait', 'noooo', 'lets go', "let's go",
    'are you serious', 'seriously', 'impossible', 'unbelievable', 'clutch',
    'oh shit', 'what', 'how', 'why', 'nah', 'aint no way', "ain't no way",
    'maaaa', 'sheesh', 'goated', 'violation', 'emotional damage',
  ],
  // Medium reactions (weight 2)
  medium: [
    'really', 'actually', 'literally', 'never', 'always', 'first time',
    'look at', 'watch this', 'check this', 'told you', 'see', 'damn',
    'wow', 'haha', 'lol', 'dead', 'crying', 'screaming', 'stop',
    'run', 'go go go', 'come on', 'please', 'help',
  ],
  // Mild emphasis (weight 1)
  mild: [
    'okay', 'right', 'like', 'think', 'know', 'feel', 'gonna',
    'wanna', 'gotta', 'need', 'want', 'try', 'big', 'huge',
  ],
};

/**
 * Detect the peak viral moment in a clip.
 *
 * Signals combined:
 *   - Audio spike vs local baseline (not absolute volume)
 *   - Viral keyword density from word timestamps
 *   - Positional prior for Twitch/Kick viewer clips (peak biased to last third)
 *   - Anti-edge bias (first/last 1s penalized)
 *
 * @param {Object} opts
 * @param {Array}  opts.audioPeaks     - [{time, amplitude}] from audio analysis
 * @param {Array}  opts.wordTimestamps - [{word, start, end}] from Whisper
 * @param {string} opts.transcript     - Full transcript text
 * @param {number} opts.duration       - Clip duration in seconds
 * @param {boolean} opts.isViewerClip  - true for Twitch/Kick clips (biases peak to last third)
 * @returns {Object} { peakTime, peakScore, scores[], windowSize, peakTranscript }
 */
export function detectPeakMoment(opts = {}) {
  const {
    audioPeaks = [],
    wordTimestamps = [],
    transcript = '',
    duration = 30,
    isViewerClip = false,
  } = opts;

  if (duration <= 0) return { peakTime: 0, peakScore: 0, scores: [], peakTranscript: '' };

  // Score each 0.5-second window
  const windowSize = 0.5;
  const numWindows = Math.ceil(duration / windowSize);
  const scores = new Array(numWindows).fill(0);

  // ── Audio SPIKE scoring (jump vs local baseline, not absolute volume) ──
  if (audioPeaks.length > 0) {
    // Compute local baseline per peak using a rolling window of ~3s
    const baselineWindow = 3.0; // seconds
    for (const peak of audioPeaks) {
      const t = peak.time || peak.t || 0;
      const amp = peak.amplitude || peak.a || 0;
      const windowIdx = Math.min(Math.floor(t / windowSize), numWindows - 1);

      // Compute local baseline: average amplitude within ±baselineWindow
      const nearby = audioPeaks.filter(p => {
        const pt = p.time || p.t || 0;
        return Math.abs(pt - t) <= baselineWindow && pt !== t;
      });
      const baseline = nearby.length > 0
        ? nearby.reduce((s, p) => s + (p.amplitude || p.a || 0), 0) / nearby.length
        : amp * 0.5; // fallback: assume baseline is half the current

      // Spike score: how much this peak exceeds local baseline
      // A sudden shout in silence scores much higher than constant loud music
      const spike = baseline > 0.001 ? (amp - baseline) / baseline : 0;
      scores[windowIdx] += Math.max(0, spike) * 8; // scale factor for spike detection
    }
  }

  // ── Keyword scoring from word timestamps ──
  if (wordTimestamps.length > 0) {
    for (const wt of wordTimestamps) {
      const word = (wt.word || '').toLowerCase().trim();
      const t = wt.start || wt.s || 0;
      const windowIdx = Math.min(Math.floor(t / windowSize), numWindows - 1);

      for (const kw of VIRAL_KEYWORDS.high) {
        if (word.includes(kw) || kw.includes(word)) {
          scores[windowIdx] += 3;
          break;
        }
      }
      for (const kw of VIRAL_KEYWORDS.medium) {
        if (word.includes(kw) || kw.includes(word)) {
          scores[windowIdx] += 2;
          break;
        }
      }

      // ALL CAPS = shouting = high energy
      if (wt.word === wt.word?.toUpperCase() && wt.word?.length > 2) {
        scores[windowIdx] += 2;
      }
    }
  }

  // ── Fallback: transcript keyword scan ──
  if (wordTimestamps.length === 0 && transcript) {
    const words = transcript.toLowerCase().split(/\s+/);
    words.forEach((word, i) => {
      const approxTime = (i / words.length) * duration;
      const windowIdx = Math.min(Math.floor(approxTime / windowSize), numWindows - 1);

      for (const kw of VIRAL_KEYWORDS.high) {
        if (word.includes(kw)) { scores[windowIdx] += 2; break; }
      }
    });
  }

  // ── Smooth scores (running average over 3 windows = 1.5s) ──
  const smoothed = scores.map((_, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(numWindows, i + 2);
    let sum = 0;
    for (let j = start; j < end; j++) sum += scores[j];
    return sum / (end - start);
  });

  // ── Positional prior for Twitch/Kick viewer clips ──
  // Viewers clip AFTER the moment → peak biased to last third
  if (isViewerClip) {
    const oneThird = Math.floor(numWindows / 3);
    for (let i = 0; i < numWindows; i++) {
      if (i < oneThird) {
        smoothed[i] *= 0.8;        // first third: slightly penalized
      } else if (i >= oneThird * 2) {
        smoothed[i] *= 1.3;        // last third: boosted
      }
      // middle third: unchanged (×1.0)
    }
  }

  // ── Bias against first/last 1s (anti-edge, applied after positional prior) ──
  const biasWindows = Math.ceil(1.0 / windowSize);
  for (let i = 0; i < biasWindows && i < smoothed.length; i++) {
    smoothed[i] *= 0.3;
  }
  for (let i = smoothed.length - biasWindows; i < smoothed.length; i++) {
    if (i >= 0) smoothed[i] *= 0.5;
  }

  // ── Find peak ──
  let peakIdx = 0;
  let peakScore = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > peakScore) {
      peakScore = smoothed[i];
      peakIdx = i;
    }
  }

  const peakTime = peakIdx * windowSize;

  // ── Extract transcript around peak (5s window for hook context) ──
  const peakTranscript = extractTranscriptAroundTime(wordTimestamps, peakTime, 5.0);

  return {
    peakTime: Math.round(peakTime * 100) / 100,
    peakScore: Math.round(peakScore * 100) / 100,
    scores: smoothed.map(s => Math.round(s * 100) / 100),
    windowSize,
    peakTranscript,
  };
}

/**
 * Extract the transcript text around a specific time (±half of windowSec).
 */
function extractTranscriptAroundTime(wordTimestamps, time, windowSec) {
  if (!wordTimestamps || wordTimestamps.length === 0) return '';
  const halfWindow = windowSec / 2;
  const words = wordTimestamps
    .filter(w => {
      const t = w.start || w.s || 0;
      return t >= time - halfWindow && t <= time + halfWindow;
    })
    .map(w => w.word || '')
    .join(' ')
    .trim();
  return words;
}

/**
 * Get the top N scoring windows from a detectPeakMoment result.
 * Used by ffmpeg-render for dynamic zoom targeting.
 *
 * @param {Object} peakResult - Result from detectPeakMoment
 * @param {number} n - Number of top windows to return
 * @param {number} cooldownSec - Min seconds between returned peaks
 * @returns {number[]} Array of peak timestamps
 */
export function getTopPeakWindows(peakResult, n = 3, cooldownSec = 2.5) {
  if (!peakResult?.scores?.length) return [];
  const { scores, windowSize } = peakResult;

  // Sort windows by score descending
  const indexed = scores.map((score, i) => ({ score, time: i * windowSize }));
  indexed.sort((a, b) => b.score - a.score);

  // Pick top N with cooldown
  const picked = [];
  for (const entry of indexed) {
    if (entry.score <= 0) break;
    const tooClose = picked.some(t => Math.abs(t - entry.time) < cooldownSec);
    if (tooClose) continue;
    picked.push(entry.time);
    if (picked.length >= n) break;
  }

  return picked.sort((a, b) => a - b); // chronological
}

// ─── Fallback Templates (used when Claude API is unavailable) ───────────────
const FALLBACK_HOOKS = {
  shock: [
    'HE ACTUALLY DID THAT 💀',
    'NOBODY EXPECTED THIS 😱',
    'IT WENT WRONG SO FAST 🤯',
    'LEGENDARY MOMENT 🔥',
    'I\'M LITERALLY DEAD 😂💀',
  ],
  curiosity: [
    'WAIT FOR WHAT HAPPENS NEXT... 👀',
    'YOU WON\'T BELIEVE THIS',
    'NOBODY SAW THIS COMING 😳',
    'WHAT HAPPENS NEXT IS INSANE',
    'THIS IS WHERE IT GETS CRAZY 🤯',
  ],
  suspense: [
    'WAIT FOR THE END... 👀',
    'IT GOES OFF THE RAILS',
    'NOBODY SAW THIS COMING 💀',
    'WATCH WHAT HAPPENS NEXT...',
    'THE TIMING IS PERFECT 😭',
  ],
};

/**
 * Generate 3 contextual hook text variants using Claude API.
 * Hooks reference the actual peak moment transcript when available.
 * Falls back to generic templates if Claude API is unavailable.
 *
 * @param {Object} opts
 * @param {string} opts.transcript     - Clip transcript
 * @param {string} opts.streamerName   - Streamer display name
 * @param {string} opts.niche          - Content niche (gaming, irl, etc.)
 * @param {string} opts.title          - Clip title
 * @param {string} opts.peakTranscript - Transcript of the 5s around the peak moment
 * @returns {Promise<Array>} [{style, label, text}]
 */
export async function generateHookTexts(opts = {}) {
  const { transcript = '', streamerName = '', niche = '', title = '', peakTranscript = '' } = opts;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If no API key or no content to analyze, use fallback templates
  if (!apiKey || (!transcript && !title)) {
    console.log('[Hook] No API key or content — using fallback templates');
    return generateFallbackHooks(streamerName);
  }

  try {
    console.log(`[Hook] Calling Claude API for contextual hooks (transcript: ${transcript.length} chars, title: "${title}", peakTranscript: "${peakTranscript.slice(0, 80)}")`);
    const hookStartMs = Date.now();

    const contentParts = [
      title ? `CLIP TITLE: "${title}"` : '',
      transcript ? `FULL TRANSCRIPT: "${transcript.slice(0, 500)}"` : '',
      streamerName ? `STREAMER: ${streamerName}` : '',
      niche ? `CATEGORY: ${niche}` : '',
    ].filter(Boolean).join('\n');

    // Peak moment context for the prompt
    const peakSection = peakTranscript
      ? `\n\nPEAK MOMENT (the exact 5 seconds the algorithm detected as the viral moment):\n"${peakTranscript.slice(0, 300)}"\n\nThe hook MUST reference this specific moment. Quote or tease what actually happens at the peak. NEVER write a generic hook. The hook must deliver its promise in under 3 seconds of reading.`
      : '';

    const claudeAbort = new AbortController();
    const claudeTimeout = setTimeout(() => claudeAbort.abort(), 30_000); // 30s timeout
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: claudeAbort.signal,
        body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You generate hooks for TikTok/Reels clips of streamers. Here is the clip:

${contentParts}${peakSection}

MISSION: Write 3 short hooks IN ENGLISH that SUMMARIZE what happens in the clip. The hook must make people want to watch.

EXAMPLES of good hooks based on content:
- Clip title "He sends his friend to Dagestan" → "HE SENT HIS FRIEND TO DAGESTAN 💀🔥"
- Clip title "Speed breaks his TV again" → "HE BROKE HIS TV AGAIN ON STREAM 😭💀"
- Clip title "Kai Cenat meets a crazy fan" → "THIS FAN JUMPED ON HIM 😱🔥"
- Clip title "xQc rage quits ranked" → "HE RAGE QUIT IN RANKED 💀😂"

RULES:
- BASED ON THE CLIP TITLE/CONTENT (not generic!!)
- English casual, TikTok style
- MAX 45 characters
- 1-2 emojis (💀🔥😱👀🤯😂⚡😭)
- ALL CAPS
- "shock" = brutal summary, "curiosity" = tease what's next, "suspense" = build anticipation

JSON only, no text around it:
[
  {"style": "shock", "label": "Shock", "text": "HOOK BASED ON THE CLIP 💀"},
  {"style": "curiosity", "label": "Curiosity", "text": "HOOK BASED ON THE CLIP 👀"},
  {"style": "suspense", "label": "Suspense", "text": "HOOK BASED ON THE CLIP 😱"}
]`
        }],
      }),
      });
    } finally {
      clearTimeout(claudeTimeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Hook] Claude API error ${response.status}: ${errText.slice(0, 200)}`);
      return generateFallbackHooks(streamerName);
    }

    const hookLatencyMs = Date.now() - hookStartMs;
    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Fire-and-forget cost tracking
    try {
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      const costUsd = (inputTokens / 1_000_000) * 1.00 + (outputTokens / 1_000_000) * 5.00;
      await supabase.from('ai_calls').insert({
        model: 'claude-haiku-4-5-20251001',
        feature: 'hook_generation',
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_usd: costUsd,
        latency_ms: hookLatencyMs,
        success: true,
        metadata: { streamer: streamerName || null, niche: niche || null },
      });
    } catch { /* never block render */ }

    // Parse JSON from response — handle potential markdown wrapping
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[Hook] Could not parse JSON from Claude response:', text.slice(0, 200));
      return generateFallbackHooks(streamerName);
    }

    const hooks = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!Array.isArray(hooks) || hooks.length < 3) {
      console.warn('[Hook] Invalid hooks array from Claude');
      return generateFallbackHooks(streamerName);
    }

    // Ensure proper structure and truncate if needed
    const result = hooks.slice(0, 3).map(h => ({
      style: h.style || 'shock',
      label: h.label || h.style || 'Hook',
      text: (h.text || '').slice(0, 60),
    }));

    console.log(`[Hook] Claude generated: ${result.map(h => `[${h.style}] ${h.text}`).join(' | ')}`);
    return result;

  } catch (err) {
    console.warn('[Hook] Claude API call failed:', err.message);
    return generateFallbackHooks(streamerName);
  }
}

/**
 * Fallback: pick random templates when Claude API is unavailable
 */
function generateFallbackHooks(streamerName = '') {
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  return [
    { style: 'shock', label: 'Shock', text: pickRandom(FALLBACK_HOOKS.shock) },
    { style: 'curiosity', label: 'Curiosity', text: pickRandom(FALLBACK_HOOKS.curiosity) },
    { style: 'suspense', label: 'Suspense', text: pickRandom(FALLBACK_HOOKS.suspense) },
  ];
}

/**
 * Calculate reorder timestamps for hook-first looping structure.
 * Snaps segment boundaries to word boundaries (never cuts mid-word).
 *
 * Output: [Peak segment with 2-4s context] → [Full clip from start]
 *
 * @param {number} peakTime       - Start of the peak moment (seconds)
 * @param {number} duration       - Total clip duration (seconds)
 * @param {number} hookLength     - Length of the hook segment (default: 1.5s)
 * @param {number} maxContext     - Max context duration before peak (default: 8s)
 * @param {Array}  wordTimestamps - [{word, start, end}] for word-boundary snapping
 * @returns {Object} { segments: [{start, end, label}], totalDuration }
 */
export function calculateReorderTimestamps(peakTime, duration, hookLength = 1.5, maxContext = 8, wordTimestamps = []) {
  const peak = Math.max(0, Math.min(peakTime, duration - hookLength));

  // If peak is near the start (< 3s), reorder is pointless — return empty
  if (peak < 3) {
    return {
      segments: [],
      totalDuration: duration,
      peakTime: 0,
    };
  }

  // Hook teaser: 2-4s context before peak + peak moment
  const contextBefore = Math.min(3, peak); // 2-3s before peak
  let teaserStart = Math.max(0, peak - contextBefore);
  const teaserLength = Math.min(4, duration - teaserStart);
  let teaserEnd = Math.min(duration, teaserStart + teaserLength);

  // ── Snap to word boundaries ──
  if (wordTimestamps.length > 0) {
    teaserStart = snapToWordBoundary(teaserStart, wordTimestamps, 'before');
    teaserEnd = snapToWordBoundary(teaserEnd, wordTimestamps, 'after');
  }

  // Safety: ensure start < end and reasonable length
  if (teaserEnd - teaserStart < 1.5) teaserEnd = Math.min(duration, teaserStart + 2);
  if (teaserEnd - teaserStart > 5) teaserEnd = teaserStart + 5;

  const segments = [
    { start: teaserStart, end: teaserEnd, label: 'hook' },
    { start: 0, end: duration, label: 'context' },
  ];

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

  return {
    segments: segments.map(s => ({
      start: Math.round(s.start * 100) / 100,
      end: Math.round(s.end * 100) / 100,
      duration: Math.round((s.end - s.start) * 100) / 100,
      label: s.label,
    })),
    totalDuration: Math.round(totalDuration * 100) / 100,
    peakTime: Math.round(peak * 100) / 100,
  };
}

/**
 * Snap a timestamp to the nearest word boundary.
 * 'before' = snap to the END of the word before/at this time (no mid-word cut)
 * 'after' = snap to the END of the word at/after this time
 */
function snapToWordBoundary(time, wordTimestamps, direction) {
  if (!wordTimestamps || wordTimestamps.length === 0) return time;

  // Find sentence breaks (punctuation or gap > 0.5s)
  const breakpoints = [];
  for (let i = 0; i < wordTimestamps.length; i++) {
    const wt = wordTimestamps[i];
    const end = wt.end || wt.e || (wt.start || wt.s || 0) + 0.3;
    const word = wt.word || '';

    // Punctuation at end of word = sentence boundary
    if (/[.!?]$/.test(word)) {
      breakpoints.push(end);
    }
    // Gap > 0.5s to next word = natural break
    if (i < wordTimestamps.length - 1) {
      const nextStart = wordTimestamps[i + 1].start || wordTimestamps[i + 1].s || 0;
      if (nextStart - end > 0.5) {
        breakpoints.push(end);
      }
    }
    // Also add every word end as a fallback
    breakpoints.push(end);
  }

  // Prefer sentence breaks within 0.8s, else nearest word end within 0.4s
  const sentenceBreaks = breakpoints.filter(bp => {
    const wt = wordTimestamps.find(w => {
      const end = w.end || w.e || 0;
      return Math.abs(end - bp) < 0.01;
    });
    if (!wt) return false;
    const word = wt.word || '';
    return /[.!?]$/.test(word) || breakpoints.indexOf(bp) < breakpoints.length; // gap-based
  });

  if (direction === 'before') {
    // Find the nearest break AT or BEFORE this time
    const candidates = breakpoints.filter(bp => bp <= time + 0.4);
    if (candidates.length > 0) return candidates[candidates.length - 1];
  } else {
    // Find the nearest break AT or AFTER this time
    const candidates = breakpoints.filter(bp => bp >= time - 0.4);
    if (candidates.length > 0) return candidates[0];
  }

  return time; // no snap possible
}
