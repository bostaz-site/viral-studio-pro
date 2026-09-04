/**
 * Hook Generator — Detects the peak viral moment in a clip and generates
 * contextual hook text overlays + reorder instructions for seamless looping.
 *
 * Pipeline:
 *   1. Score each second of the clip (spike detection + viral keywords + positional prior)
 *   2. Pick the top moment (1-2s)
 *   3. Generate 3 hook text variants via Claude API (contextual, references peak moment)
 *      + niche_keyword (P4 · Hook Hunter, 2026-09: 4-8 words, UPPERCASE, keyword aligned,
 *        breaking framing only for early_gem/hot_now, color white/yellow/red)
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
    const baselineWindow = 3.0;
    for (const peak of audioPeaks) {
      const t = peak.time || peak.t || 0;
      const amp = peak.amplitude || peak.a || 0;
      const windowIdx = Math.min(Math.floor(t / windowSize), numWindows - 1);

      const nearby = audioPeaks.filter(p => {
        const pt = p.time || p.t || 0;
        return Math.abs(pt - t) <= baselineWindow && pt !== t;
      });
      const baseline = nearby.length > 0
        ? nearby.reduce((s, p) => s + (p.amplitude || p.a || 0), 0) / nearby.length
        : amp * 0.5;

      const spike = baseline > 0.001 ? (amp - baseline) / baseline : 0;
      scores[windowIdx] += Math.max(0, spike) * 8;
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

  // ── Smooth scores ──
  const smoothed = scores.map((_, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(numWindows, i + 2);
    let sum = 0;
    for (let j = start; j < end; j++) sum += scores[j];
    return sum / (end - start);
  });

  // ── Positional prior ──
  if (isViewerClip) {
    const oneThird = Math.floor(numWindows / 3);
    for (let i = 0; i < numWindows; i++) {
      if (i < oneThird) smoothed[i] *= 0.8;
      else if (i >= oneThird * 2) smoothed[i] *= 1.3;
    }
  }

  // ── Anti-edge bias ──
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
 * Extract the transcript text around a specific time.
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
 */
export function getTopPeakWindows(peakResult, n = 3, cooldownSec = 2.5) {
  if (!peakResult?.scores?.length) return [];
  const { scores, windowSize } = peakResult;

  const indexed = scores.map((score, i) => ({ score, time: i * windowSize }));
  indexed.sort((a, b) => b.score - a.score);

  const picked = [];
  for (const entry of indexed) {
    if (entry.score <= 0) break;
    const tooClose = picked.some(t => Math.abs(t - entry.time) < cooldownSec);
    if (tooClose) continue;
    picked.push(entry.time);
    if (picked.length >= n) break;
  }

  return picked.sort((a, b) => a - b);
}

// ─── P4 · Hook Hunter rules (2026-09) ──────────────────────────────────────
// Vulgarity/slurs guard for on-screen text (mirrors lib/distribution/caption-filters.ts).
const BANNED_WORDS = [
  'fuck', 'fucking', 'fucked', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'retard', 'retarded',
  'faggot', 'fag', 'nigga', 'nigger', 'kys', 'rape', 'nazi',
];
const BANNED_WORD_RE = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'gi');

/** Allowed hook colors — anything else maps to 'white' (backward compat). */
export const HOOK_COLORS = ['white', 'yellow', 'red'];

/**
 * Hook color mapping (mirrors lib/enhance/hook-color.ts — keep in sync):
 *   default → white ; hype|wholesome → yellow ; rage|shock|breaking → red.
 */
export function getHookColor({ mood = '', hookStyle = '', breaking = false, override } = {}) {
  if (typeof override === 'string' && HOOK_COLORS.includes(override)) return override;
  const m = String(mood || '').toLowerCase();
  const st = String(hookStyle || '').toLowerCase();
  if (breaking || m === 'rage' || m === 'shock' || st === 'shock') return 'red';
  if (m === 'hype' || m === 'wholesome') return 'yellow';
  return 'white';
}

/** early_gem / hot_now (or clip < 6h) → "breaking" framing allowed. */
export function isBreakingEligible(feedCategory, clipCreatedAt) {
  if (feedCategory === 'early_gem' || feedCategory === 'hot_now') return true;
  if (clipCreatedAt) {
    const ageH = (Date.now() - new Date(clipCreatedAt).getTime()) / 3_600_000;
    if (Number.isFinite(ageH) && ageH >= 0 && ageH < 6) return true;
  }
  return false;
}

/** Strip vulgarity from a hook (whole word). */
function stripBannedWords(text) {
  return String(text || '').replace(BANNED_WORD_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** Count words (emojis excluded). */
function wordCount(text) {
  return String(text || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .split(/\s+/)
    .filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Case-insensitive keyword presence (also matches squashed variant). */
export function hookContainsKeyword(text, keyword) {
  if (!keyword) return true;
  const kw = String(keyword).trim().toLowerCase();
  if (!kw) return true;
  const lower = String(text || '').toLowerCase();
  if (lower.includes(kw)) return true;
  return lower.replace(/\s+/g, '').includes(kw.replace(/\s+/g, ''));
}

/** Derive a niche keyword when the model didn't return one (title → streamer → niche). */
function deriveNicheKeyword({ title = '', streamerName = '', niche = '' }) {
  const STOP = new Set(['the', 'this', 'that', 'with', 'from', 'what', 'when', 'just', 'and', 'for', 'his', 'her', 'gets', 'goes', 'into', 'again', 'after', 'over', 'you', 'your', 'are', 'was', 'has', 'have']);
  const words = String(title || '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w.toLowerCase()));
  if (words.length > 0) return words.slice(0, 2).join(' ');
  if (streamerName) return String(streamerName).replace(/^@/, '');
  return String(niche || '').trim();
}

// ─── Consecutive fallback counter (for Discord alerts) ────────────────────
let consecutiveFallbacks = 0;

/**
 * Generate 3 contextual hook text variants using Claude API.
 *
 * Every hook MUST reference the specific clip content (title, transcript,
 * or peak moment). Generic hooks are explicitly banned in the prompt.
 *
 * If Claude fails: returns title-based hooks or null (caller decides whether
 * to show a hook at all). NEVER returns generic template hooks.
 *
 * @param {Object} opts
 * @param {string} opts.transcript     - Full Whisper transcript (or clip description)
 * @param {string} opts.streamerName   - Streamer display name
 * @param {string} opts.niche          - Content niche (gaming, irl, etc.)
 * @param {string} opts.title          - Clip title (strongest signal for trending clips)
 * @param {string} opts.peakTranscript - Transcript of the 5s around the peak moment
 * @returns {Promise<Array|null>} [{style, label, text}] or null if no content-aware hook possible
 */
export async function generateHookTexts(opts = {}) {
  const pkg = await generateHookPackage(opts);
  return pkg.hooks;
}

/**
 * P4 · Hook Hunter — full hook package.
 *
 * Returns { hooks, nicheKeyword, breaking, color } where:
 *   - hooks: [{style,label,text,color}] or null (no content-aware hook possible)
 *   - nicheKeyword: 1-3 words extracted from transcript + title + streamer + niche,
 *     to be aligned in the description (TikTok SEO indexes caption + on-screen text)
 *   - breaking: true when the "breaking" framing was allowed (early_gem / hot_now / < 6h)
 *   - color: hook text color (white | yellow | red) derived from mood/style/breaking
 *
 * @param {Object} opts — same as generateHookTexts plus:
 * @param {string}  opts.feedCategory  - trending_clips.feed_category ('early_gem' | 'hot_now' | ...)
 * @param {string}  opts.clipCreatedAt - ISO date of the clip (age < 6h → breaking allowed)
 * @param {string}  opts.mood          - detected mood (rage, funny, drama, wholesome, hype, story)
 */
export async function generateHookPackage(opts = {}) {
  const {
    transcript = '', streamerName = '', niche = '', title = '', peakTranscript = '',
    feedCategory = null, clipCreatedAt = null, mood = '',
  } = opts;

  const breaking = isBreakingEligible(feedCategory, clipCreatedAt);
  const derivedKeyword = deriveNicheKeyword({ title, streamerName, niche });
  const finalize = (hooks, nicheKeyword) => {
    const kw = (nicheKeyword || derivedKeyword || '').trim().slice(0, 40);
    const withColor = Array.isArray(hooks)
      ? hooks.map(h => ({ ...h, color: getHookColor({ mood, hookStyle: h.style, breaking }) }))
      : null;
    return { hooks: withColor, nicheKeyword: kw, breaking, color: getHookColor({ mood, breaking }) };
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── Fallback point 1: no API key ──
  if (!apiKey) {
    console.warn('[Hook] fallback reason: no_api_key — ANTHROPIC_API_KEY not set on VPS');
    return finalize(buildTitleFallback(title, streamerName), null);
  }

  // ── Fallback point 2: no content at all ──
  if (!transcript && !title && !peakTranscript) {
    console.warn('[Hook] fallback reason: no_content — no transcript, title, or peak transcript available');
    return finalize(null, null); // no hook is better than a generic hook
  }

  try {
    console.log(`[Hook] Calling Claude API for content-aware hooks (title: "${title}", transcript: ${transcript.length} chars, peak: "${peakTranscript.slice(0, 60)}")`);
    const hookStartMs = Date.now();

    const contentParts = [
      title ? `CLIP TITLE: "${title}"` : '',
      streamerName ? `STREAMER: ${streamerName}` : '',
      niche ? `CATEGORY: ${niche}` : '',
      mood ? `MOOD: ${mood}` : '',
      breaking ? 'FRESHNESS: this clip is less than 6 hours old (BREAKING framing allowed)' : 'FRESHNESS: not fresh (no breaking framing)',
      transcript ? `FULL TRANSCRIPT: "${transcript.slice(0, 800)}"` : '',
      peakTranscript ? `PEAK MOMENT (the exact viral moment): "${peakTranscript.slice(0, 300)}"` : '',
    ].filter(Boolean).join('\n');

    const framingRule = breaking
      ? '6. FRAMING: this clip is FRESH — you MAY use a breaking-news framing on ONE hook ("HE JUST..." / "BREAKING: ..."), the others use curiosity / shock / storytelling.'
      : '6. FRAMING: curiosity, shock or storytelling only. NO "BREAKING" / "JUST HAPPENED" framing (the clip is not fresh).';

    const claudeAbort = new AbortController();
    const claudeTimeout = setTimeout(() => claudeAbort.abort(), 30_000);
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
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You write hooks for TikTok clips of streamers. The hook appears as text overlay in the first 2 seconds. TikTok SEO indexes on-screen text, so the hook must contain the clip's NICHE KEYWORD.

${contentParts}

STEP 1 — Pick ONE niche keyword (1-3 words) that a viewer would SEARCH for: the game, the streamer, or the specific situation (e.g. "Apex Legends", "xQc", "Dagestan", "ranked"). Extract it from the title/transcript/streamer/category. Return it as "niche_keyword".

STEP 2 — Write 3 short hooks that SPECIFICALLY describe what happens in THIS clip and CONTAIN the niche keyword (or a direct variant).

MANDATORY RULES:
1. Each hook MUST mention something specific from the title or transcript (a name, an action, a situation) AND contain the niche keyword
2. BANNED PHRASES (instant reject): "nobody expected", "you won't believe", "this is insane", "wait for it", "what happens next", "gone wrong", "goes crazy", "watch till the end", "legendary moment", "I'm dead". These are generic clickbait — NEVER use them.
3. The hook must be UNUSABLE on any other clip. If you could put it on a random clip and it still makes sense, it's too generic — rewrite it.
4. 4 to 8 WORDS, ALL CAPS, max 45 characters, 1 emoji max from: 💀🔥😱👀🤯😂⚡😭
5. English, casual TikTok tone. NO vulgarity, NO slurs, NO censored swearing (f*ck) — on-screen text is indexed and demonetised.
${framingRule}

GOOD EXAMPLES (specific to content):
- Title "He sends his friend to Dagestan" → "HE SENT HIM TO DAGESTAN 💀"
- Title "Speed breaks his TV again" → "SPEED BROKE HIS TV AGAIN 😭"
- Title "xQc rage quits ranked" → "XQC RAGE QUIT MID-GAME 💀"
- Transcript mentions "triple kill" → "THAT TRIPLE KILL THO 🔥"

BAD EXAMPLES (generic, would work on any clip):
- "NOBODY EXPECTED THIS 😱" ← banned, generic
- "LEGENDARY MOMENT 🔥" ← banned, generic
- "WAIT FOR THE END 👀" ← banned, says nothing about clip

Return ONLY JSON:
{
  "niche_keyword": "1-3 words",
  "hooks": [
    {"style": "shock", "label": "Shock", "text": "YOUR SPECIFIC HOOK 💀"},
    {"style": "curiosity", "label": "Curiosity", "text": "YOUR SPECIFIC HOOK 👀"},
    {"style": "suspense", "label": "Suspense", "text": "YOUR SPECIFIC HOOK 😱"}
  ]
}`
          }],
        }),
      });
    } finally {
      clearTimeout(claudeTimeout);
    }

    // ── Fallback point 3: API error ──
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Hook] fallback reason: api_error — Claude API ${response.status}: ${errText.slice(0, 200)}`);
      trackFallback('api_error');
      return finalize(buildTitleFallback(title, streamerName), null);
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

    // ── Fallback point 4: parse error ──
    // Accept both the new object shape {niche_keyword, hooks:[...]} and the legacy bare array.
    const objMatch = text.match(/\{[\s\S]*\}/);
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (!objMatch && !arrMatch) {
      console.warn(`[Hook] fallback reason: parse_error — no JSON in Claude response: "${text.slice(0, 200)}"`);
      trackFallback('parse_error');
      return finalize(buildTitleFallback(title, streamerName), null);
    }

    let hooks;
    let nicheKeyword = null;
    try {
      let parsed = null;
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]); } catch { parsed = null; }
      }
      if (parsed && Array.isArray(parsed.hooks)) {
        hooks = parsed.hooks;
        nicheKeyword = typeof parsed.niche_keyword === 'string' ? parsed.niche_keyword : null;
      } else if (arrMatch) {
        hooks = JSON.parse(arrMatch[0]);
      } else {
        throw new Error('no hooks array');
      }
    } catch (parseErr) {
      console.warn(`[Hook] fallback reason: json_parse_error — ${parseErr.message}`);
      trackFallback('json_parse_error');
      return finalize(buildTitleFallback(title, streamerName), null);
    }

    // ── Fallback point 5: invalid structure ──
    if (!Array.isArray(hooks) || hooks.length < 3) {
      console.warn(`[Hook] fallback reason: invalid_structure — got ${Array.isArray(hooks) ? hooks.length : typeof hooks} hooks`);
      trackFallback('invalid_structure');
      return finalize(buildTitleFallback(title, streamerName), nicheKeyword);
    }

    // Reset consecutive fallback counter on success
    consecutiveFallbacks = 0;

    // Sanitise keyword (1-3 words, no #, no vulgarity)
    if (nicheKeyword) {
      nicheKeyword = stripBannedWords(nicheKeyword.replace(/^#/, '')).split(/\s+/).slice(0, 3).join(' ').slice(0, 40);
    }
    const effectiveKeyword = nicheKeyword || derivedKeyword;

    const result = hooks.slice(0, 3).map(h => {
      let t = stripBannedWords((h.text || '').toUpperCase()).slice(0, 60);
      // Soft validations — warn only, never fail the render
      if (!hookContainsKeyword(t, effectiveKeyword)) {
        console.warn(`[Hook] WARN keyword_missing: hook "${t}" does not contain niche keyword "${effectiveKeyword}"`);
      }
      const wc = wordCount(t);
      if (wc < 4 || wc > 8) {
        console.warn(`[Hook] WARN word_count: hook "${t}" has ${wc} words (target 4-8)`);
      }
      if (!breaking && /\b(BREAKING|JUST HAPPENED)\b/.test(t)) {
        console.warn(`[Hook] WARN breaking_framing on non-fresh clip: "${t}" — stripping prefix`);
        t = t.replace(/^BREAKING:?\s*/i, '').trim();
      }
      return {
        style: h.style || 'shock',
        label: h.label || h.style || 'Hook',
        text: t,
      };
    });

    console.log(`[Hook] Claude generated content-aware hooks (keyword="${effectiveKeyword}", breaking=${breaking}): ${result.map(h => `[${h.style}] "${h.text}"`).join(' | ')}`);
    return finalize(result, nicheKeyword);

  } catch (err) {
    // ── Fallback point 6: network/timeout ──
    const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
    console.warn(`[Hook] fallback reason: ${reason} — ${err.message}`);
    trackFallback(reason);
    return finalize(buildTitleFallback(title, streamerName), null);
  }
}

/**
 * Build a hook from the clip title when Claude is unavailable.
 * Returns null if even the title is empty — no hook is better than a generic one.
 */
function buildTitleFallback(title, streamerName = '') {
  if (!title || title.trim().length < 5) {
    console.log('[Hook] No title available for fallback — returning null (no hook)');
    return null;
  }

  // Format title as hook: uppercase, strip vulgarity, truncate, add emoji
  let hookBase = stripBannedWords(title.trim().toUpperCase());
  if (hookBase.length > 42) hookBase = hookBase.slice(0, 39) + '...';
  if (hookBase.length < 5) return null;

  console.log(`[Hook] Using title-based fallback: "${hookBase}"`);
  return [
    { style: 'shock', label: 'Shock', text: `${hookBase} 💀` },
    { style: 'curiosity', label: 'Curiosity', text: `${hookBase} 👀` },
    { style: 'suspense', label: 'Suspense', text: `${hookBase} 😱` },
  ];
}

/**
 * Track consecutive fallbacks and alert Discord if threshold exceeded.
 */
function trackFallback(reason) {
  consecutiveFallbacks++;
  console.warn(`[Hook] Consecutive fallbacks: ${consecutiveFallbacks} (reason: ${reason})`);

  if (consecutiveFallbacks >= 3) {
    alertDiscordHookFailure(reason, consecutiveFallbacks).catch(() => {});
  }
}

/**
 * Send Discord alert when hook generation fails repeatedly.
 */
async function alertDiscordHookFailure(reason, count) {
  const webhookUrl = process.env.DISCORD_AUDIT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**[CRITICAL] Hook generation failing** — ${count} consecutive fallbacks (last reason: \`${reason}\`). Check VPS ANTHROPIC_API_KEY and Claude API status.`,
      }),
    });
  } catch { /* non-critical */ }
}

/**
 * Calculate reorder timestamps for hook-first looping structure.
 */
export function calculateReorderTimestamps(peakTime, duration, hookLength = 1.5, maxContext = 8, wordTimestamps = []) {
  const peak = Math.max(0, Math.min(peakTime, duration - hookLength));

  if (peak < 3) {
    return { segments: [], totalDuration: duration, peakTime: 0 };
  }

  const contextBefore = Math.min(3, peak);
  let teaserStart = Math.max(0, peak - contextBefore);
  const teaserLength = Math.min(4, duration - teaserStart);
  let teaserEnd = Math.min(duration, teaserStart + teaserLength);

  if (wordTimestamps.length > 0) {
    teaserStart = snapToWordBoundary(teaserStart, wordTimestamps, 'before');
    teaserEnd = snapToWordBoundary(teaserEnd, wordTimestamps, 'after');
  }

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
 */
function snapToWordBoundary(time, wordTimestamps, direction) {
  if (!wordTimestamps || wordTimestamps.length === 0) return time;

  const breakpoints = [];
  for (let i = 0; i < wordTimestamps.length; i++) {
    const wt = wordTimestamps[i];
    const end = wt.end || wt.e || (wt.start || wt.s || 0) + 0.3;
    const word = wt.word || '';

    if (/[.!?]$/.test(word)) breakpoints.push(end);
    if (i < wordTimestamps.length - 1) {
      const nextStart = wordTimestamps[i + 1].start || wordTimestamps[i + 1].s || 0;
      if (nextStart - end > 0.5) breakpoints.push(end);
    }
    breakpoints.push(end);
  }

  if (direction === 'before') {
    const candidates = breakpoints.filter(bp => bp <= time + 0.4);
    if (candidates.length > 0) return candidates[candidates.length - 1];
  } else {
    const candidates = breakpoints.filter(bp => bp >= time - 0.4);
    if (candidates.length > 0) return candidates[0];
  }

  return time;
}
