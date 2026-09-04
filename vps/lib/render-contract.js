/**
 * Render Contract — tracks which features were requested vs actually applied.
 *
 * Each render builds a contract: the list of features the user turned on
 * (from settings) and what was actually applied by the pipeline. If a
 * user-facing feature fails silently, the contract catches it.
 *
 * Features are classified as:
 *   - critical: voiceover, captions, hook text — failure triggers 'degraded' status + refund
 *   - cosmetic: audio shift, smart zoom, exposure, cta_follow — failure logged but not refunded
 */

// Feature classification: critical = user explicitly enabled, visible output expected.
// Voiceover removed from critical set (on standby — VO failure no longer degrades a render).
const CRITICAL_FEATURES = new Set([
  'captions',
  'hook_text',
]);

/**
 * P5 · Normalize settings.analysis (4-criteria grid) into the contract meta shape.
 * Mirrors lib/enhance/clip-criteria.ts (Next side). Returns null when any of the
 * 4 scores is missing / non-numeric — the entry is simply not added.
 *
 * @param {object|undefined} analysis - settings.analysis from the render payload
 * @returns {{unexpected:number, emotion:number, informative:number, density:number, score:number, verdict:string|null, hook_type_mapping:string|null}|null}
 */
export function normalizeAnalysisCriteria(analysis) {
  if (!analysis || typeof analysis !== 'object') return null;
  const clamp10 = (v) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
  };
  const unexpected = clamp10(analysis.unexpected);
  const emotion = clamp10(analysis.emotion);
  const informative = clamp10(analysis.informative);
  const density = clamp10(analysis.density);
  if (unexpected === null || emotion === null || informative === null || density === null) return null;
  // Weighted 30/30/20/20 → 0-100 (same formula as computeCriteriaScore on the Next side)
  const score = Math.round((unexpected * 0.3 + emotion * 0.3 + informative * 0.2 + density * 0.2) * 10);
  const verdict = ['strong', 'ok', 'weak'].includes(analysis.verdict) ? analysis.verdict : null;
  const hook = ['shock', 'storytelling', 'curiosity', 'transformation'].includes(analysis.hook_type_mapping)
    ? analysis.hook_type_mapping : null;
  return { unexpected, emotion, informative, density, score, verdict, hook_type_mapping: hook };
}

/**
 * Create a new render contract from the settings.
 * Call at the START of the render pipeline.
 *
 * @param {object} settings - The render settings from the request
 * @returns {object} contract tracker
 */
export function createContract(settings) {
  const entries = [];

  // Voiceover
  entries.push({
    feature: 'voiceover',
    requested: settings.voiceover?.enabled !== false,
    applied: false,
    reason: null,
  });

  // Captions
  entries.push({
    feature: 'captions',
    requested: settings.captions?.enabled !== false && settings.captions?.style !== 'none',
    applied: false,
    reason: null,
  });

  // Hook text
  entries.push({
    feature: 'hook_text',
    requested: settings.hook?.enabled === true && settings.hook?.textEnabled !== false,
    applied: false,
    reason: null,
  });

  // Auto-cut
  entries.push({
    feature: 'auto_cut',
    requested: settings.autoCut?.enabled === true,
    applied: false,
    reason: null,
  });

  // Smart zoom
  entries.push({
    feature: 'smart_zoom',
    requested: settings.smartZoom?.enabled !== false,
    applied: false,
    reason: null,
  });

  // SFX (non-critical)
  entries.push({
    feature: 'sfx',
    requested: settings.soundDesign && settings.soundDesign !== 'off',
    applied: false,
    reason: null,
  });

  // Audio shift (always-on)
  entries.push({
    feature: 'audio_shift',
    requested: true,
    applied: false,
    reason: null,
  });

  // Loudnorm (always-on, non-critical)
  entries.push({
    feature: 'loudnorm',
    requested: true,
    applied: false,
    reason: null,
  });

  // Metadata scrub (always-on, non-critical)
  entries.push({
    feature: 'metadata_scrub',
    requested: true,
    applied: false,
    reason: null,
  });

  // Audio enhance
  entries.push({
    feature: 'audio_enhance',
    requested: settings.audioEnhance?.enabled === true,
    applied: false,
    reason: null,
  });

  // Crop mode
  entries.push({
    feature: 'crop_mode',
    requested: true,
    applied: false,
    reason: null,
    meta: { requested_mode: settings.format?.videoZoom || 'auto' },
  });

  // CTA follow overlay (P4 · 2026-09) — NON-critical, default ON, last ~1.2s.
  // Not counted in transformScore (cosmetic closer, not a transformation).
  entries.push({
    feature: 'cta_follow',
    requested: settings.ctaFollow?.enabled !== false,
    applied: false,
    reason: null,
  });

  // Analysis criteria (P5 · 2026-09) — NOT a feature, a data carrier. Persists the
  // 4-criteria grid (unexpected/emotion/informative/density, 0-10) in render_jobs.contract
  // so the autofarm gate (publish-scheduled cron) and the data loop can read it.
  // requested=applied=true → never degrades a render, ignored by transformScore().
  const analysis = normalizeAnalysisCriteria(settings.analysis);
  if (analysis) {
    entries.push({
      feature: 'analysis_criteria',
      requested: true,
      applied: true,
      reason: null,
      intentional: true,
      meta: analysis,
    });
  }

  return {
    entries,
    /**
     * Mark a feature as applied (or intentionally skipped).
     * @param {string} feature
     * @param {boolean} applied
     * @param {string} [reason] - Why it wasn't applied (if applied=false)
     * @param {object} [meta] - Extra info (e.g. actual mode chosen)
     * @param {boolean} [intentional] - True if skip was a correct decision (e.g. burned-in captions detected).
     *   Intentional skips don't trigger degraded status or refund.
     */
    record(feature, applied, reason, meta, intentional) {
      const entry = entries.find(e => e.feature === feature);
      if (entry) {
        entry.applied = applied;
        if (reason) entry.reason = reason;
        if (meta) entry.meta = { ...(entry.meta || {}), ...meta };
        if (intentional !== undefined) entry.intentional = intentional;
      }
    },

    /** Get the full contract for storage */
    toJSON() {
      return entries.map(e => ({
        feature: e.feature,
        requested: e.requested,
        applied: e.applied,
        reason: e.reason || null,
        meta: e.meta || null,
        intentional: e.intentional || false,
      }));
    },

    /**
     * Compute a transform score (0-3) that measures how many visible
     * transformations were actually applied to the render.
     * Used by the autofarm quality gate to block low-effort outputs.
     *   +1 hook text, +1 captions, +1 smart zoom / dynamic crop
     * Voiceover excluded (on standby).
     */
    transformScore() {
      let score = 0;
      for (const e of entries) {
        if (!e.applied) continue;
        if (e.feature === 'hook_text') score++;
        if (e.feature === 'captions') score++;
        if (e.feature === 'smart_zoom') score++;
      }
      return score;
    },

    /**
     * Check if any critical feature was requested but not applied.
     * Intentional skips (e.g. burned-in captions) don't count as failures.
     * @returns {{ isDegraded: boolean, missing: string[], summary: string }}
     */
    evaluate() {
      const missing = entries
        .filter(e => e.requested && !e.applied && !e.intentional && CRITICAL_FEATURES.has(e.feature))
        .map(e => e.feature);

      const summary = entries
        .filter(e => e.requested && !e.applied)
        .map(e => `${e.feature}: ${e.reason || 'not applied'}`)
        .join('; ');

      return {
        isDegraded: missing.length > 0,
        missing,
        summary: summary || 'all features applied',
      };
    },
  };
}

// ─── Consecutive failure tracking per feature ──────────────────────────────

const featureFailStreaks = {};

/**
 * Track a feature failure and alert Discord if threshold exceeded.
 * @param {string} feature
 * @param {string} reason
 */
export async function trackFeatureFailure(feature, reason) {
  featureFailStreaks[feature] = (featureFailStreaks[feature] || 0) + 1;
  const count = featureFailStreaks[feature];

  if (count >= 3) {
    const webhookUrl = process.env.DISCORD_AUDIT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**[CRITICAL] Feature "${feature}" failing** — ${count} consecutive renders without it. Reason: \`${reason}\`. Check VPS env vars and API keys.`,
          }),
        });
      } catch { /* non-critical */ }
    }
  }
}

/**
 * Reset the failure streak for a feature (on success).
 * @param {string} feature
 */
export function resetFeatureStreak(feature) {
  featureFailStreaks[feature] = 0;
}
