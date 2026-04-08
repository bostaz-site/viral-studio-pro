/**
 * Hook Generator — Detects the peak viral moment in a clip and generates
 * contextual hook text overlays + reorder instructions for seamless looping.
 *
 * Pipeline:
 *   1. Score each second of the clip (audio peaks + viral keywords)
 *   2. Pick the top moment (1-2s)
 *   3. Generate 3 hook text variants via Claude API (contextual, French, emojis)
 *   4. Output reorder timestamps for FFmpeg concat
 */

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
 * @param {Object} opts
 * @param {Array}  opts.audioPeaks    - [{time, amplitude}] from audio analysis
 * @param {Array}  opts.wordTimestamps - [{word, start, end}] from Whisper
 * @param {string} opts.transcript    - Full transcript text
 * @param {number} opts.duration      - Clip duration in seconds
 * @returns {Object} { peakTime, peakScore, scores[] }
 */
export function detectPeakMoment(opts = {}) {
  const {
    audioPeaks = [],
    wordTimestamps = [],
    transcript = '',
    duration = 30,
  } = opts;

  if (duration <= 0) return { peakTime: 0, peakScore: 0, scores: [] };

  // Score each 0.5-second window
  const windowSize = 0.5;
  const numWindows = Math.ceil(duration / windowSize);
  const scores = new Array(numWindows).fill(0);

  // ── Audio peak scoring ──
  if (audioPeaks.length > 0) {
    const maxAmp = Math.max(...audioPeaks.map(p => p.amplitude || p.a || 0), 0.01);
    for (const peak of audioPeaks) {
      const t = peak.time || peak.t || 0;
      const amp = peak.amplitude || peak.a || 0;
      const windowIdx = Math.min(Math.floor(t / windowSize), numWindows - 1);
      scores[windowIdx] += (amp / maxAmp) * 10;
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

  // ── Bias against first/last 1s ──
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

  return {
    peakTime: Math.round(peakTime * 100) / 100,
    peakScore: Math.round(peakScore * 100) / 100,
    scores: smoothed.map(s => Math.round(s * 100) / 100),
    windowSize,
  };
}

// ─── Fallback Templates (used when Claude API is unavailable) ───────────────
const FALLBACK_HOOKS = {
  choc: [
    'IL A VRAIMENT FAIT ÇA 💀',
    'PERSONNE S\'ATTENDAIT À ÇA 😱',
    'ÇA A DÉGÉNÉRÉ EN 2 SECONDES 🤯',
    'MOMENT LÉGENDAIRE 🔥',
    'JE SUIS MORT 😂💀',
  ],
  curiosite: [
    'ATTENDEZ DE VOIR CE QUI ARRIVE... 👀',
    'VOUS ALLEZ PAS CROIRE LA SUITE',
    'PERSONNE AVAIT VU ÇA VENIR 😳',
    'LA SUITE EST INCROYABLE',
    'C\'EST LÀ QUE ÇA DEVIENT FOU 🤯',
  ],
  suspense: [
    'ATTENDEZ LA FIN... 👀',
    'ÇA PART EN VRILLE',
    'PERSONNE A VU ÇA VENIR 💀',
    'REGARDEZ BIEN CE QUI SE PASSE...',
    'LE TIMING EST PARFAIT 😭',
  ],
};

/**
 * Generate 3 contextual hook text variants using Claude API.
 * Hooks are in French, with emojis, based on the actual clip content.
 * Falls back to generic templates if Claude API is unavailable.
 *
 * @param {Object} opts
 * @param {string} opts.transcript   - Clip transcript
 * @param {string} opts.streamerName - Streamer display name
 * @param {string} opts.niche        - Content niche (gaming, irl, etc.)
 * @param {string} opts.title        - Clip title
 * @returns {Promise<Array>} [{style, label, text}]
 */
export async function generateHookTexts(opts = {}) {
  const { transcript = '', streamerName = '', niche = '', title = '' } = opts;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If no API key or no content to analyze, use fallback templates
  if (!apiKey || (!transcript && !title)) {
    console.log('[Hook] No API key or content — using fallback templates');
    return generateFallbackHooks(streamerName);
  }

  try {
    console.log(`[Hook] Calling Claude API for contextual hooks (transcript: ${transcript.length} chars, title: "${title}")`);

    const contentParts = [
      title ? `TITRE DU CLIP: "${title}"` : '',
      transcript ? `CE QUI SE DIT: "${transcript.slice(0, 500)}"` : '',
      streamerName ? `STREAMER: ${streamerName}` : '',
      niche ? `CATÉGORIE: ${niche}` : '',
    ].filter(Boolean).join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Tu génères des hooks pour des clips TikTok/Reels de streamers. Voici le clip:

${contentParts}

MISSION: Écris 3 hooks courts EN FRANÇAIS qui RÉSUMENT ce qui se passe dans le clip. Le hook doit donner envie de regarder.

EXEMPLES de bons hooks basés sur le contenu:
- Clip titre "He sends his friend to Dagestan" → "IL ENVOIE SON AMI AU DAGESTAN 💀🔥"
- Clip titre "Speed breaks his TV again" → "IL RECASSE SA TV EN LIVE 😭💀"
- Clip titre "Kai Cenat meets a crazy fan" → "LE FAN LUI SAUTE DESSUS 😱🔥"
- Clip titre "xQc rage quits ranked" → "IL RAGE QUIT EN RANKED 💀😂"

RÈGLES:
- BASÉ SUR LE TITRE/CONTENU DU CLIP (pas générique!!)
- Français casual/québécois, style TikTok
- MAX 45 caractères
- 1-2 emojis (💀🔥😱👀🤯😂⚡😭)
- TOUT EN MAJUSCULES
- Le hook "choc" = résumé brutal, "curiosité" = tease la suite, "suspense" = crée l'attente

JSON seulement, pas de texte autour:
[
  {"style": "choc", "label": "Choc", "text": "HOOK BASÉ SUR LE CLIP 💀"},
  {"style": "curiosite", "label": "Curiosité", "text": "HOOK BASÉ SUR LE CLIP 👀"},
  {"style": "suspense", "label": "Suspense", "text": "HOOK BASÉ SUR LE CLIP 😱"}
]`
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Hook] Claude API error ${response.status}: ${errText.slice(0, 200)}`);
      return generateFallbackHooks(streamerName);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

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
      style: h.style || 'choc',
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
    { style: 'choc', label: 'Choc', text: pickRandom(FALLBACK_HOOKS.choc) },
    { style: 'curiosite', label: 'Curiosité', text: pickRandom(FALLBACK_HOOKS.curiosite) },
    { style: 'suspense', label: 'Suspense', text: pickRandom(FALLBACK_HOOKS.suspense) },
  ];
}

/**
 * Calculate reorder timestamps for hook-first looping structure.
 *
 * Output: [Peak segment] → [Context segment] → [Peak repeat]
 * This creates a seamless loop when the video replays on TikTok.
 *
 * @param {number} peakTime    - Start of the peak moment (seconds)
 * @param {number} duration    - Total clip duration (seconds)
 * @param {number} hookLength  - Length of the hook segment (default: 1.5s)
 * @param {number} maxContext  - Max context duration before peak (default: 8s)
 * @returns {Object} { segments: [{start, end, label}], totalDuration }
 */
export function calculateReorderTimestamps(peakTime, duration, hookLength = 1.5, maxContext = 8) {
  const peak = Math.max(0, Math.min(peakTime, duration - hookLength));

  const hookStart = peak;
  const hookEnd = Math.min(peak + hookLength, duration);

  const contextStart = Math.max(0, hookStart - maxContext);
  const contextEnd = hookStart;

  const afterStart = hookEnd;
  const afterEnd = Math.min(hookEnd + 3, duration);

  const segments = [
    { start: hookStart, end: hookEnd, label: 'hook' },
  ];

  if (contextEnd - contextStart > 0.5) {
    segments.push({ start: contextStart, end: contextEnd, label: 'context' });
  }

  if (afterEnd - afterStart > 0.3) {
    segments.push({ start: afterStart, end: afterEnd, label: 'payoff' });
  }

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
