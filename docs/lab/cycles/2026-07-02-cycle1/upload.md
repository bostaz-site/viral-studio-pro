# Lab Deep Dive — upload (cycle #1)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a drag-and-drop upload zone with real-time progress and instant thumbnail preview. Users abandon during silent waits — visual feedback keeps them engaged and reduces drop-off before the enhance step.
- **Risk:** Large files (>100MB) silently fail or timeout at the Netlify edge layer before hitting Supabase Storage, leaving users with no actionable error and no retry path.
- **Metric:** upload_to_enhance_rate — percentage of successful uploads that proceed to open the enhance editor within the same session

## Target Metric (forced clarity)
- **Metric:** `upload_completion_rate`
- **Minimum delta:** 20
- **Measurement:** COUNT(videos WHERE status = 'uploaded') / COUNT(videos WHERE status IN ('uploading', 'uploaded', 'error')) over a 7d rolling window. 'uploading' = sign step completed (intent confirmed), 'uploaded' = /complete endpoint verified file in storage. Drop = technical failure (abandoned mid-upload, storage verification miss, timeout). Segment by file size bucket (<50MB, 50-200MB, >200MB) to surface size-correlated failures.
- **Clarity:** 9/10

## Research Synthesis
## User Clip Upload — Research Synthesis

---

### 1. Industry Consensus

Upload UX has converged on three non-negotiables: drag-drop as the primary interaction, background/resumable uploads so users aren't hostage to the browser tab, and immediate post-upload feedback (progress state, file validation, size limits surfaced before the user hits a wall). Every major tool (Loom, VEED, Descript) also agrees that upload is not the destination — something must happen automatically post-upload to justify the wait, whether that's landing in an editor (VEED), triggering transcription (Descript), or dropping into a library (Loom). No serious tool in 2025-2026 leaves users staring at a bare file list with zero next action. File format tolerance has also standardized around MP4/MOV/WebM; tools that don't support MOV lose Mac users immediately.

---

### 2. Industry Disagreement

The core split is **library-first vs. editor-first**. Loom bets on library as the organizational unit (upload → library → share later); VEED bets on editor as the atomic unit (upload → immediately editing). For clip-to-TikTok workflows, editor-first wins on speed, but library-first wins on repurposability. A second disagreement is around **mandatory processing steps**: Descript forces transcription before the user can touch the file — high value, higher latency. VEED skips it unless requested — lower latency, user must opt in to AI features. There's no consensus on which conversion is better; it depends entirely on whether users arrive knowing what they want to do. A third split is **mobile parity**: Loom paywalls it, Descript treats it as Labs, VEED is mostly desktop-native. The industry hasn't settled on whether mobile upload is table stakes or a premium differentiator for video creators.

---

### 3. Competitor Best Moves

**Descript's per-file SuperToast progress indicators** are the gold standard for upload anxiety reduction — showing queued → uploading → transcribing → done as discrete states rather than a single spinner gives users confidence and lets them context-switch without fear. **VEED's zero-account-required entry** is a powerful acquisition move: the editor loads before signup, reducing top-of-funnel drop-off dramatically. **Loom's background upload resilience** (close the modal, upload continues) is underrated — it respects that users multitask and don't want to babysit a progress bar. Descript's auto-resume on network failure is technically the most defensible moat: it removes a class of failure that frustrates power users who upload large files on unstable connections. VEED's immediate social format presets (9:16 on upload) pre-frame the user's goal before they've made a single edit.

---

### 4. User-Reported Pains

The dominant complaint across Reddit, Product Hunt reviews, and G2 for tools in this category is **upload size friction at the worst possible moment** — users hit a file size cap after the upload is already 80% complete, with no upfront warning. For gaming footage specifically, high-bitrate 1080p60 clips from OBS or Twitch can easily exceed 500MB for a 3-minute clip, which breaks the free tiers of every competitor. A second persistent pain is **no URL import for platform clips** — streamers on Twitch or Kick must download the clip locally (sometimes via third-party tools), then re-upload, adding 3-5 minutes of friction for a workflow that should take seconds. Users of Descript frequently complain that **transcription quality degrades on gaming content** (game audio bleeds into streamer mic, character names and slang aren't in the model vocabulary), making the auto-transcript more noise than signal. A subtler pain reported on editing forums: **no context preserved on upload** — once the file is in the editor, all metadata (where it came from, who the streamer is, original view count) is lost, making it impossible to make informed editing decisions.

---

### 5. Opportunities for Viral Animal

The clearest gap is **Twitch/Kick URL-as-upload**: none of the competitors support importing a clip directly from a platform URL. For Viral Animal's core user (someone who just found a viral moment on Twitch), eliminating the download-then-reupload step is a 3-minute friction reduction that no competitor offers — this should be the primary upload CTA, with file upload as the fallback. Second opportunity: **upload-time signal injection** — when a user uploads or imports a clip, immediately surface its velocity score, view count, and tier (hot/viral/gem) alongside the file so they're editing with context, not blind. Descript auto-transcribes; Viral Animal should auto-score. Third: **proactive size/format validation before upload starts**, with an in-browser re-encode option for oversized files — the Railway VPS can handle this, and it removes the single most rage-inducing UX failure in the category. Fourth: the **"make it viral" pipeline as the post-upload destination** (not a library, not a raw editor) is a genuine differentiator — the implicit promise is that dropping a clip here transforms it, which none of the competitors make. Finally, **mobile upload with direct TikTok handoff** is unserved: every competitor either paywalls or deprioritizes mobile, but the clip → phone → TikTok post flow is exactly how streamers operate on-the-go — owning that workflow on mobile is a wedge no incumbent is fighting for.

## FINAL RECOMMENDATION
Replace the current proxy-through-API upload architecture with direct-to-Supabase TUS resumable uploads. The root cause of abandonment is not just a fake progress bar — it's that large files (100-500MB gameplay recordings) silently die mid-flight because Netlify serverless functions have a 60s max duration and a hard body size limit well below the advertised 500MB cap. Fix the architecture first: (1) a lightweight API route generates a signed upload URL/token, (2) the browser uploads directly to Supabase Storage `videos/` bucket via TUS protocol using tus-js-client (already supported by supabase-js v2), giving real byte-level progress events and auto-resume on network failure.

Layer on top of the architecture fix: immediate on-drop validation surfacing filename, size as a fraction of the 500MB limit with a green/yellow/red indicator, and type/duration checks — all before any bytes move. Replace the fake progress bar with a discrete state machine: validating → uploading (real %) → finalizing → ready. Persist the TUS fingerprint so a tab refresh resumes instead of restarts, and keep the upload alive during in-app navigation.

On completion, call a slim POST /api/upload/complete to create the `videos` DB record and redirect to enhance. This eliminates both abandonment vectors: users who close tabs on stalled fake bars, and users who discover the 500MB cap only after minutes of uploading.

**Rationale:** Sonnet correctly identified the fake progress bar as a UX problem and the Supabase onUploadProgress callback as the fix — but this only works if the upload goes through supabase-js directly, not through a proxied API route. Opus identified WHY the fake bar exists: the file never reaches Supabase directly, so there are no real progress events to wire up. You cannot fix the progress bar without fixing the architecture. Opus's diagnosis is the unlock for Sonnet's UX solution. The combined approach is strictly better than either alone.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
Supabase Storage has its own TUS upload size limits, rate limits, or RLS policy constraints that block direct browser uploads to the `videos/` bucket — meaning direct uploads fail for unauthenticated or improperly scoped requests. Severity is high if the current proxy architecture was put in place specifically because direct uploads were attempted and failed (e.g. CORS issues, bucket policy blocks public uploads, or the Supabase project plan has Storage bandwidth caps that make direct large-file uploads expensive). A secondary kill switch: if the Netlify body limit was intentionally set low as a content-scanning gate (malware, copyright), bypassing it with direct uploads creates a security/compliance gap.
**Severity:** 7/10

## Alternatives Rejected
- **Keep the proxy architecture, just wire real onUploadProgress to the Netlify API route:** No real progress events exist on a proxied fetch — the Netlify function receives the full body before it can respond. Even if streamed, the 60s timeout still kills 200MB+ uploads silently. Treats the symptom, not the cause.
- **Chunked multipart upload through the existing /api/upload route:** Adds significant complexity (chunk reassembly, state management, error recovery) while still being constrained by Netlify function cold start and per-chunk timeout. TUS over direct Supabase is simpler and more reliable for the same outcome.
- **Thumbnail preview + drag-drop polish only (original intuition scope):** Cosmetic fix on a broken foundation. Users with 300MB files will still abandon after silent upload death regardless of how polished the drop zone looks.

## Confidence & Effort
- **Confidence:** 8/10
- **Estimated effort:** 4h
