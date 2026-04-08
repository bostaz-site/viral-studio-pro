/**
 * Hook Generator — Detects the peak viral moment in a clip and generates
 * hook text overlays + reorder instructions for seamless looping.
 *
 * Pipeline:
 *   1. Score each second of the clip (audio peaks + viral keywords)
 *   2. Pick the top moment (1-2s)
 *   3. Generate 3 hook text variants (choc, curiosité, suspense)
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

// ─── Hook Text Templates ────────────────────────────────────────────────────
// {word} = injected keyword from transcript, {streamer} = author name
const HOOK_TEMPLATES = {
  choc: [
    'IL A VRAIMENT FAIT ÇA 💀',
    'PERSONNE S\'ATTENDAIT À ÇA',
    'REGARDEZ SA RÉACTION 😱',
    'ÇA A DÉGÉNÉRÉ EN 2 SECONDES',
    'IL A PÉTÉ UN CÂBLE 🤯',
    'LE MOMENT OÙ TOUT BASCULE',
    'ATTENDEZ LA FIN...',
    '{streamer} A PERDU LA TÊTE',
    'IL PEUT PAS ÊTRE SÉRIEUX LÀ',
    'MOMENT LÉGENDAIRE 🔥',
    'C\'EST ALLÉ TROP LOIN',
    'LA RÉACTION EST INCROYABLE',
    'IL A CASSÉ LE STREAM',
    'ÇA C\'EST DU CONTENU 💀',
    'JE SUIS MORT 😂',
  ],
  curiosite: [
    'ATTENDEZ DE VOIR CE QUI ARRIVE...',
    'REGARDEZ BIEN CE QU\'IL FAIT',
    'VOUS ALLEZ PAS CROIRE LA SUITE',
    'IL SAVAIT PAS CE QUI L\'ATTENDAIT',
    'PERSONNE AVAIT VU ÇA VENIR',
    'DEVINEZ CE QUI SE PASSE APRÈS',
    'LA SUITE EST INCROYABLE',
    'RESTEZ JUSQU\'À LA FIN',
    'COMMENT C\'EST POSSIBLE ?!',
    '{streamer} SAVAIT PAS QUE...',
    'LE PLOT TWIST 😳',
    'TOUT LE MONDE A RATÉ ÇA',
    'PERSONNE EN PARLE DE ÇA',
    'FAITES PAUSE ET REGARDEZ BIEN',
    'C\'EST LÀ QUE ÇA DEVIENT FOU',
  ],
  suspense: [
    'WAIT FOR IT... 👀',
    'WATCH WHAT HAPPENS NEXT',
    'HE THOUGHT IT WAS OVER',
    'THIS IS WHERE IT GETS CRAZY',
    'NOBODY SAW THIS COMING',
    'THE ENDING THO 💀',
    'KEEP WATCHING...',
    'IT GETS WORSE 😭',
    'PAY ATTENTION TO THIS PART',
    '{streamer} DIDN\'T EXPECT THIS',
    'THE TIMING IS INSANE',
    'JUST WAIT FOR IT',
    'DON\'T SKIP THIS',
    'THIS CLIP IS UNREAL',
    'BEST MOMENT OF THE STREAM',
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
  // Normalize audio peaks to 0-10 range
  if (audioPeaks.length > 0) {
    const maxAmp = Math.max(...audioPeaks.map(p => p.amplitude || p.a || 0), 0.01);
    for (const peak of audioPeaks) {
      const t = peak.time || peak.t || 0;
      const amp = peak.amplitude || peak.a || 0;
      const windowIdx = Math.min(Math.floor(t / windowSize), numWindows - 1);
      // Audio peaks get score 0-10 based on relative amplitude
      scores[windowIdx] += (amp / maxAmp) * 10;
    }
  }

  // ── Keyword scoring from word timestamps ──
  if (wordTimestamps.length > 0) {
    for (const wt of wordTimestamps) {
      const word = (wt.word || '').toLowerCase().trim();
      const t = wt.start || wt.s || 0;
      const windowIdx = Math.min(Math.floor(t / windowSize), numWindows - 1);

      // Check against viral keywords
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
    // Distribute score evenly across the clip based on word position
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

  // ── Bias against first/last 1s (bad for hooks — too early or too late) ──
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

/**
 * Generate 3 hook text variants for a clip.
 *
 * @param {Object} opts
 * @param {string} opts.transcript   - Clip transcript
 * @param {string} opts.streamerName - Streamer display name
 * @param {string} opts.niche        - Content niche (gaming, irl, etc.)
 * @returns {Array} [{style, text, emoji}]
 */
export function generateHookTexts(opts = {}) {
  const { transcript = '', streamerName = '', niche = '' } = opts;

  // Pick a contextual keyword from transcript for injection
  const words = transcript.toLowerCase().split(/\s+/);
  let contextWord = '';
  for (const kw of [...VIRAL_KEYWORDS.high, ...VIRAL_KEYWORDS.medium]) {
    if (words.some(w => w.includes(kw))) {
      contextWord = kw.toUpperCase();
      break;
    }
  }

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const processTemplate = (template) => {
    let text = template;
    if (streamerName) {
      text = text.replace('{streamer}', streamerName.toUpperCase());
    } else {
      // Remove templates that need streamer name
      if (text.includes('{streamer}')) return null;
    }
    if (contextWord && text.includes('{word}')) {
      text = text.replace('{word}', contextWord);
    } else if (text.includes('{word}')) {
      return null;
    }
    return text;
  };

  const getHook = (style) => {
    const templates = HOOK_TEMPLATES[style];
    // Try up to 10 times to get a valid template
    for (let i = 0; i < 10; i++) {
      const result = processTemplate(pickRandom(templates));
      if (result) return result;
    }
    // Fallback
    return templates[0].replace('{streamer}', 'LE STREAMER').replace('{word}', '');
  };

  return [
    { style: 'choc', label: 'Choc', text: getHook('choc') },
    { style: 'curiosite', label: 'Curiosité', text: getHook('curiosite') },
    { style: 'suspense', label: 'Suspense', text: getHook('suspense') },
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
  // Clamp peak within valid range
  const peak = Math.max(0, Math.min(peakTime, duration - hookLength));

  // Hook segment: the peak moment (1-2s)
  const hookStart = peak;
  const hookEnd = Math.min(peak + hookLength, duration);

  // Context: everything from the start up to the peak, capped at maxContext
  const contextStart = Math.max(0, hookStart - maxContext);
  const contextEnd = hookStart;

  // After-peak: from hook end to clip end (or a bit more for payoff)
  const afterStart = hookEnd;
  const afterEnd = Math.min(hookEnd + 3, duration); // max 3s after peak

  const segments = [
    { start: hookStart, end: hookEnd, label: 'hook' },
  ];

  // Add context if there's enough
  if (contextEnd - contextStart > 0.5) {
    segments.push({ start: contextStart, end: contextEnd, label: 'context' });
  }

  // Add payoff after peak
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
