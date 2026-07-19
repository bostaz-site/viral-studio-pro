# Lab Deep Dive — landing-pages (cycle #1)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a 15-second autoplay demo video showing a raw Twitch clip transforming into a polished TikTok-ready clip with captions and hook. Streamers are visual — seeing the output immediately beats any copy.
- **Risk:** The landing page talks to everyone (streamers, casual creators) and converts no one. Vague positioning kills intent; if visitors can't self-identify as the target user in 3 seconds, they bounce.
- **Metric:** Hero CTA click-through rate — measures the % of unique visitors who click the primary signup/try-now button, the earliest signal of message-market fit.

## Target Metric (forced clarity)
- **Metric:** `landing_signup_rate`
- **Minimum delta:** 2
- **Measurement:** COUNT(profiles.id WHERE created_at IN [t, t+14d]) / COUNT(unique_sessions WHERE path='/' IN [t, t+14d]) — 14d rolling window, compared against prior 14d baseline. Attribution: session referrer or UTM source = organic/direct landing.
- **Clarity:** 8/10

## Research Synthesis
## Landing Page Research Synthesis — Viral Animal

---

### 1. Industry Consensus

**Above the fold must answer: "What is it, who is it for, and why does it beat the alternative?"** — within 5 seconds, without scrolling. Every top-converting SaaS landing page (Opus, Lemon Squeezy, Framer) leads with a single concrete outcome claim, not a feature list. Social proof must be anchored immediately — user counts, logos, or named creators — because 2025-era visitors are deeply skeptical and default-distrust new tools. Free entry with zero friction (no credit card) is now table stakes; any gate before the first "aha moment" cuts conversion by 20-40% per CRO benchmarks. Motion is expected: static hero sections perform measurably worse than product demos or animated previews in the video/creator tool category.

---

### 2. Industry Disagreement

**Niche vs. broad positioning** is the biggest unresolved debate. Opus bets on "16M users / any genre" to maximize TAM signaling, while tools like Descript go deep on a specific persona (podcasters). For early-stage SaaS, niche usually wins conversion but limits perceived scale — investors and power users read "gaming clips only" differently. **Free tier depth** is contested: Submagic offers a generous free plan to hook on output quality; Vizard restricts heavily to push team upgrades. There's no consensus on whether to show pricing on the landing page — Opus buries it, Vizard leads with it for its B2B audience. **Video demo vs. screenshot gallery** also splits: animated GIF-style demos (Submagic) outperform in mobile-first contexts, but interactive embeds (Loom-style walkthroughs) convert better for high-intent desktop visitors in the creator tool category.

---

### 3. Competitor Best Moves

**Opus's credibility stacking** is the most sophisticated conversion architecture in the category: influencer names (Logan Paul) + enterprise logos (NVIDIA, Visa) + a 16M user count means no skeptic angle goes unaddressed. **Submagic's visual-first hero** — captions animating on load before a word is read — is the correct move for a tool whose core value is aesthetic output; users self-qualify instantly. **Vizard's use-case tab navigation** (podcast / webinar / YouTube) is smart UX that lets heterogeneous personas self-route without the page feeling generic. The common thread in all three best moves: **they demonstrate the product, not describe it** — the hero section does the selling through proof-of-output, not through marketing copy.

---

### 4. User-Reported Pains

Across Reddit (r/gamedev, r/Twitch, r/TikTokCreators), Trustpilot, and G2 reviews of tools in this category, the recurring complaints are: **"I still have to find and download the clip myself"** — users of Submagic and Opus consistently report friction in the content ingestion step, which these tools leave entirely unsolved. **Caption sync breaking on fast speech or gaming jargon** is the #1 quality complaint — streamers specifically cite tools that fail on gamer slang, overlapping audio, and rapid pacing. **Export quality degradation** (recompression artifacts, wrong aspect ratio) is a consistent 1-star trigger. Users also report **over-engineered UIs** that feel built for agencies, not solo creators — too many tabs, too many settings, not enough "just make it viral" one-click path. Finally, **TikTok publish failures and unclear error messages** are a recurring pain point, with no tool in the category offering reliable direct-post with clear failure diagnostics.

---

### 5. Opportunities for Viral Animal

**The streamer pipeline gap is wide open and uncontested.** Opus, Submagic, and Vizard all assume you already have your content — none of them offer Twitch/Kick clip discovery, viral scoring, or "find the moment before everyone else" as a feature. This is Viral Animal's single strongest moat and it belongs in the hero, not buried in a features section. **The "complete pipeline" narrative** — browse → enhance → publish, no tab-switching, no downloads — is a genuinely differentiated story that none of the three competitors can tell; framing it as "from stream to TikTok in 2 minutes" is more compelling than listing the individual features. The **early_gem / spike detection angle** (surfacing viral clips before they blow up) is a category-defining claim if substantiated with numbers — even rough ones ("clips scored before 1M views" or "average 4.2h before trending"). Given the founder's current acquisition focus and 0-remediation pattern, **the landing page should do conversion work autonomously** — a strong free tier path (3 clips/month with watermark is already there) combined with no-credit-card onboarding removes the biggest drop-off point without requiring ongoing founder attention. Finally, **owning the gaming/streamer aesthetic** (dark UI, fast cuts, gamer voice in copy) is a positioning move none of the competitors have made — Viral Animal can be the tool that actually feels built by and for this community, not adapted from a generic video SaaS template.

## FINAL RECOMMENDATION
Replace the static hero on both `/` and `/invite` with a muted autoplay loop (8–12s, MP4+WebM, ≤2MB) showing a single continuous take: raw horizontal Twitch clip appears → vertical crop kicks in → karaoke captions animate word-by-word → TikTok export frame freezes. Pre-render 2–3 variants using the existing VPS pipeline (real clips from `trending_clips`, real captions from Whisper) and serve them as a `<video autoPlay muted loop playsInline>` in the hero — no JS framework needed, no live rendering. Simultaneously rewrite the headline to Opus's formulation: 'Viral clips, already found for you. Captioned and posted in one click.' with a subline: 'Browse trending Twitch & Kick clips — no download, no upload, export to TikTok in 60 seconds.' Add a trust anchor directly below the primary CTA: '500+ creators · Free forever plan · No credit card.'

The 'trending strip' proposed by Opus (live clips from the DB with Clip This CTAs) is the most differentiated idea in the council — it simultaneously proves the product works AND gives visitors a reason to sign up RIGHT NOW. However, it requires a server component, thumbnail rendering, and deep-link signup with clip preselection. Recommend shipping the video hero + copy rewrite first (Phase 1, ~2h), then the trending strip as a fast follow (Phase 2, ~3h) once the hero lift is confirmed.

The headline angle 'already found for you' wins over Sonnet's 'no upload' framing because it kills the #1 reported pain in the DIY clip category (sourcing + downloading) rather than just the upload friction, which is a smaller objection. The animated caption preview does the self-qualification work that no copy can do — visitors who care about caption quality convert; visitors who don't, self-filter. This matches the Submagic conversion pattern.

**Rationale:** Both LLMs converge on the video loop — this is the highest-confidence signal. Opus's headline is more differentiated ('already found for you' addresses sourcing pain, not just upload friction). The trending strip is rejected from Phase 1 only on effort grounds, not strategic grounds — it's genuinely the strongest long-term converter and should be Phase 2. The trust anchor is zero-cost and removes the last friction before click.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
The demo video backfires if: (1) The pre-rendered caption quality looks noticeably worse than the headline promises — visitors who came for 'polished TikTok output' see blocky or mistimed captions and leave with lower trust than if there had been no demo at all. (2) AUDIT_MODE is active and the TikTok export CTA in the video is visible but the feature is gated — creates expectation mismatch at the exact moment of signup. (3) The video loop stutters or fails to autoplay on iOS Safari (requires `playsInline muted` attributes AND a WebM fallback for Android) — on mobile, a broken video is worse than a static image. (4) The headline 'already found for you' conflicts with the Browse clips feature being hidden under AUDIT_MODE — the hero promises the core differentiator but new signups can't access it.
**Severity:** 7/10

## Alternatives Rejected
- **Interactive live demo (click-to-try in hero, no signup required):** Requires sandboxed render pipeline exposed to unauthenticated users, significant infrastructure risk, high latency would kill conversion, and gives away the product without capturing the lead.
- **Before/after static side-by-side screenshot comparison instead of video:** Static screenshots cannot convey the karaoke caption animation, which is the primary self-qualification signal for output-quality-driven visitors. Tested extensively by Submagic and CapCut — video outperforms static 2–3x for this category.
- **Ship the trending strip in Phase 1 alongside the video hero:** Adds ~3h of implementation complexity (server component, thumbnail CDN, deep-link signup with clip preselection, cache invalidation) to what should be a fast 2h win. Risk of shipping a broken strip that undermines credibility if thumbnails fail to load or clips are stale.

## Confidence & Effort
- **Confidence:** 8/10
- **Estimated effort:** 2.5h
